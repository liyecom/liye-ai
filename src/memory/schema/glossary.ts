/**
 * Glossary Schema for Memory as a Product (MaaP)
 * Supports Multi-Domain Stack architecture (T1-ready)
 *
 * Version: 1.0.0
 * Status: Schema-only (runtime not yet activated)
 */

// =============================================================================
// Term Definition
// =============================================================================

/**
 * A single glossary term/concept
 */
export interface GlossaryTerm {
  /** Unique identifier for the concept (lowercase, underscore-separated) */
  concept_id: string;

  /** Display name of the term */
  term: string;

  /** Full definition text */
  definition: string;

  /** Formula or calculation (if applicable) */
  formula?: string;

  /** Semantic version of this term definition */
  version: string;

  /** Alternative names/spellings */
  aliases?: string[];

  /** Related terms (by concept_id) */
  related?: string[];

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Glossary File Structure
// =============================================================================

/**
 * Metadata for a glossary file
 */
export interface GlossaryMetadata {
  /** Domain this glossary belongs to */
  domain: string;

  /** Semantic version of the entire glossary */
  version: string;

  /** ISO timestamp of last update */
  last_updated: string;

  /** Optional description */
  description?: string;

  /** Drift detection settings */
  drift_detection?: {
    strictness: 'strict' | 'warn' | 'off';
    require_version_citation: boolean;
    allow_synonyms: boolean;
  };
}

/**
 * Complete glossary file structure
 */
export interface GlossaryFile {
  metadata: GlossaryMetadata;
  glossary: GlossaryTerm[];
}

// =============================================================================
// Multi-Domain Support (T1-ready)
// =============================================================================

/**
 * A domain in the multi-domain stack
 */
export interface Domain {
  /** Unique domain identifier */
  name: string;

  /** Detection confidence (0.0 - 1.0) */
  confidence: number;

  /** Paths to glossary files for this domain */
  glossary_paths: string[];

  /** Whether this is the primary (active) domain */
  is_primary: boolean;

  /** Detection reason/method */
  detection_reason?: string;

  /** Additional domain metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Multi-domain Memory Brief structure
 */
export interface MemoryBrief {
  /** ISO timestamp of generation */
  timestamp: string;

  /** Task that triggered the brief */
  task: string;

  /** All detected domains (ordered by confidence) */
  domains: Domain[];

  /** Convenience accessor for primary domain */
  primary_domain: string | null;

  /** Merged glossary terms from all domains */
  terms: GlossaryTerm[];

  /** Cross-domain term conflicts (if any) */
  conflicts?: TermConflict[];
}

/**
 * Conflict when same term exists in multiple domains
 */
export interface TermConflict {
  /** The conflicting term */
  term: string;

  /** Domains that define this term */
  domains: string[];

  /** Resolution strategy applied */
  resolution: 'primary_wins' | 'explicit_required' | 'merged';

  /** The winning definition (if resolved) */
  resolved_definition?: GlossaryTerm;
}

// =============================================================================
// Citation Types
// =============================================================================

/**
 * A citation reference to a glossary term
 */
export interface TermCitation {
  /** Path to the glossary file */
  path: string;

  /** Term being cited */
  term: string;

  /** Version of the term */
  version: string;

  /** Whether this is a cross-domain citation */
  cross_domain?: boolean;

  /** Source domain (if cross-domain) */
  source_domain?: string;
}

/**
 * Parse a citation string into structured form
 *
 * Formats:
 * - Full:      (ref: knowledge/glossary/amazon-advertising.yaml#acos@1.0.0)
 * - Shorthand: [[ACoS@1.0.0]]
 * - Inline:    acos@1.0.0
 */
export function parseCitation(citation: string): TermCitation | null {
  // Full format
  const fullMatch = citation.match(/\(ref:\s*([^#]+)#([^@]+)@([^)]+)\)/);
  if (fullMatch) {
    return {
      path: fullMatch[1].trim(),
      term: fullMatch[2].trim(),
      version: fullMatch[3].trim(),
    };
  }

  // Shorthand format
  const shortMatch = citation.match(/\[\[([^@\]]+)@([^\]]+)\]\]/);
  if (shortMatch) {
    return {
      path: '', // Unknown, needs resolution
      term: shortMatch[1].trim(),
      version: shortMatch[2].trim(),
    };
  }

  // Inline format
  const inlineMatch = citation.match(/^([^@]+)@(.+)$/);
  if (inlineMatch) {
    return {
      path: '', // Unknown, needs resolution
      term: inlineMatch[1].trim(),
      version: inlineMatch[2].trim(),
    };
  }

  return null;
}

/**
 * Format a citation for output
 */
export function formatCitation(
  citation: TermCitation,
  format: 'full' | 'short' | 'inline' = 'full'
): string {
  switch (format) {
    case 'full':
      return `(ref: ${citation.path}#${citation.term}@${citation.version})`;
    case 'short':
      return `[[${citation.term}@${citation.version}]]`;
    case 'inline':
      return `${citation.term}@${citation.version}`;
  }
}

// =============================================================================
// Drift Detection Types
// =============================================================================

/**
 * Drift violation types
 */
export type DriftViolationType =
  | 'UNREGISTERED_TERM'
  | 'MISSING_CITATION'
  | 'VERSION_MISMATCH'
  | 'CROSS_DOMAIN_UNMARKED';

/**
 * A single drift violation
 */
export interface DriftViolation {
  /** Type of violation */
  type: DriftViolationType;

  /** The violating term */
  term: string;

  /** Location in output (line number, context) */
  location: string;

  /** Expected value (if applicable) */
  expected?: string;

  /** Found value (if applicable) */
  found?: string;

  /** Suggested action */
  action: string;
}

/**
 * Result of drift detection scan
 */
export interface DriftScanResult {
  /** Whether the scan passed */
  passed: boolean;

  /** List of violations (empty if passed) */
  violations: DriftViolation[];

  /** Scan timestamp */
  timestamp: string;

  /** Domain context */
  domain: string;

  /** Glossary version used */
  glossary_version: string;
}

// =============================================================================
// Output Contract Types
// =============================================================================

/**
 * Output contract requirements
 */
export interface OutputContract {
  /** Primary domain for this output */
  primary_domain: string;

  /** Required citation format */
  citation_format: 'full' | 'short' | 'inline';

  /** Whether cross-domain citations must be marked */
  require_cross_domain_marker: boolean;

  /** Drift detection strictness */
  drift_strictness: 'strict' | 'warn' | 'off';

  /** Terms that must be cited if used */
  mandatory_citation_terms: string[];
}

/**
 * Default output contract
 */
export const DEFAULT_OUTPUT_CONTRACT: OutputContract = {
  primary_domain: 'general',
  citation_format: 'full',
  require_cross_domain_marker: true,
  drift_strictness: 'strict',
  mandatory_citation_terms: [],
};

// =============================================================================
// Type Guards
// =============================================================================

export function isGlossaryTerm(obj: unknown): obj is GlossaryTerm {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'concept_id' in obj &&
    'term' in obj &&
    'definition' in obj &&
    'version' in obj
  );
}

export function isDomain(obj: unknown): obj is Domain {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'name' in obj &&
    'confidence' in obj &&
    'glossary_paths' in obj &&
    'is_primary' in obj
  );
}
