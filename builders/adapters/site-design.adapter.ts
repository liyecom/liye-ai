/**
 * Site Design Contract Adapter
 *
 * Purpose: Translate site-design.contract.yaml → Builder-consumable IR
 *
 * This is the SOLE translation point between contracts and builders.
 * When contract schema changes, update this adapter only.
 *
 * @version 1.0.0
 * @frozen 2026-01-13
 */

import { readFileSync } from 'fs';
import { parse } from 'yaml';
import { join } from 'path';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Intermediate Representation (IR) for Builders
 * This is the ONLY type Builders should consume
 */
export type SiteDesignIR = {
  site: {
    name: string;
    stack: string[];
  };
  theme: {
    colors: {
      primary: string;
      background: string;
      secondary?: string;
      surface?: string;
      text?: {
        primary?: string;
        secondary?: string;
      };
    };
    fonts: {
      primary: string;
      heading: string;
      mono?: string;
    };
    mode: 'light' | 'dark';
    allowedModes: ('light' | 'dark')[];
  };
  layout: {
    maxWidth: number;
    contentMaxWidth?: number;
    breakpoints?: Record<string, number>;
  };
  spacing: {
    baseUnit: number;
    scale: number[];
  };
  borders: {
    radius: Record<string, number>;
  };
  constraints: {
    motionAllowed: boolean;
    maxAnimationDuration: number;
    preferReducedMotion: boolean;
  };
  ux: {
    minContrast: number;
    forbidden: string[];
    requireFocusIndicators: boolean;
    requireAltText: boolean;
  };
};

/**
 * Raw contract structure (as read from YAML)
 */
interface RawContract {
  version: string;
  kind: string;
  scope: string;
  site?: {
    name?: string;
    stack?: string[];
  };
  tokens?: {
    colors?: Record<string, any>;
    typography?: Record<string, any>;
    spacing?: {
      base_unit?: number;
      scale?: number[];
    };
    borders?: {
      radius?: Record<string, number>;
    };
  };
  style?: {
    allowed_modes?: string[];
    default_mode?: string;
  };
  constraints?: {
    layout?: {
      max_width_px?: number;
      content_max_width_px?: number;
      breakpoints?: Record<string, number>;
    };
    motion?: {
      allow_heavy_runtime_animation?: boolean;
      max_animation_duration_ms?: number;
      prefer_reduced_motion?: boolean;
    };
    images?: {
      require_alt_text?: boolean;
    };
  };
  ux?: {
    accessibility?: {
      min_contrast_ratio?: number;
      require_focus_indicators?: boolean;
    };
    anti_patterns?: string[];
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

class AdapterError extends Error {
  constructor(message: string, public field: string) {
    super(`[Adapter] ${field}: ${message}`);
    this.name = 'AdapterError';
  }
}

function validateRequired<T>(value: T | undefined | null, field: string): T {
  if (value === undefined || value === null) {
    throw new AdapterError(`Required field missing`, field);
  }
  return value;
}

// ============================================================================
// ADAPTER IMPLEMENTATION
// ============================================================================

/**
 * Load and adapt a site-design contract to IR
 *
 * @param trackId - Track identifier (directory name)
 * @param tracksRoot - Root path to tracks directory (default: ./tracks)
 * @returns SiteDesignIR - Normalized intermediate representation
 * @throws AdapterError if required fields are missing
 */
export function loadContract(trackId: string, tracksRoot: string = './tracks'): SiteDesignIR {
  const contractPath = join(tracksRoot, trackId, 'site-design.contract.yaml');

  // Read and parse YAML
  const raw = readFileSync(contractPath, 'utf-8');
  const contract: RawContract = parse(raw);

  // Validate contract type
  if (contract.kind !== 'site-design') {
    throw new AdapterError(`Expected kind 'site-design', got '${contract.kind}'`, 'kind');
  }

  if (contract.scope !== 'track-instance') {
    throw new AdapterError(`Expected scope 'track-instance', got '${contract.scope}'`, 'scope');
  }

  return adaptContract(contract, trackId);
}

/**
 * Adapt raw contract to IR with defaults
 */
function adaptContract(contract: RawContract, trackId: string): SiteDesignIR {
  // Extract with defaults
  const colors = contract.tokens?.colors || {};
  const typography = contract.tokens?.typography || {};
  const spacing = contract.tokens?.spacing || {};
  const borders = contract.tokens?.borders || {};
  const style = contract.style || {};
  const layout = contract.constraints?.layout || {};
  const motion = contract.constraints?.motion || {};
  const images = contract.constraints?.images || {};
  const accessibility = contract.ux?.accessibility || {};

  // Build IR with validation and defaults
  const ir: SiteDesignIR = {
    site: {
      name: contract.site?.name || trackId,
      stack: contract.site?.stack || [],
    },

    theme: {
      colors: {
        primary: validateRequired(colors.primary, 'tokens.colors.primary'),
        background: validateRequired(colors.background, 'tokens.colors.background'),
        secondary: colors.secondary,
        surface: colors.surface,
        text: colors.text,
      },
      fonts: {
        primary: validateRequired(typography.primary_font, 'tokens.typography.primary_font'),
        heading: typography.heading_font || typography.primary_font,
        mono: typography.mono_font,
      },
      mode: (style.default_mode as 'light' | 'dark') || 'light',
      allowedModes: (style.allowed_modes as ('light' | 'dark')[]) || ['light'],
    },

    layout: {
      maxWidth: layout.max_width_px || 1200,
      contentMaxWidth: layout.content_max_width_px,
      breakpoints: layout.breakpoints,
    },

    spacing: {
      baseUnit: spacing.base_unit || 8,
      scale: spacing.scale || [0, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128],
    },

    borders: {
      radius: borders.radius || { none: 0, sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
    },

    constraints: {
      motionAllowed: motion.allow_heavy_runtime_animation ?? false,
      maxAnimationDuration: motion.max_animation_duration_ms || 500,
      preferReducedMotion: motion.prefer_reduced_motion ?? true,
    },

    ux: {
      minContrast: accessibility.min_contrast_ratio || 4.5,
      forbidden: contract.ux?.anti_patterns || [],
      requireFocusIndicators: accessibility.require_focus_indicators ?? true,
      requireAltText: images.require_alt_text ?? true,
    },
  };

  return ir;
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  const trackId = process.argv[2];

  if (!trackId) {
    console.error('Usage: npx tsx site-design.adapter.ts <track-id>');
    process.exit(1);
  }

  try {
    const ir = loadContract(trackId);
    console.log(JSON.stringify(ir, null, 2));
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
