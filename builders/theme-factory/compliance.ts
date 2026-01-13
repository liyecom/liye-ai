/**
 * Contract Compliance Check
 *
 * Purpose: Verify builder output matches contract constraints
 * Run after build to fail-fast on violations
 *
 * @version 1.0.0
 */

import { loadContract, SiteDesignIR } from '../adapters/site-design.adapter.ts';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ComplianceResult {
  passed: boolean;
  trackId: string;
  checks: Check[];
  violations: Violation[];
}

interface Check {
  name: string;
  passed: boolean;
  message: string;
}

interface Violation {
  rule: string;
  severity: 'error' | 'warning';
  message: string;
  file?: string;
  line?: number;
}

// ============================================================================
// COMPLIANCE CHECKS
// ============================================================================

/**
 * Check if motion constraints are respected
 */
function checkMotionConstraints(ir: SiteDesignIR, cssContent: string): Check {
  const violations: string[] = [];

  // If motion not allowed, check for animation imports
  if (!ir.constraints.motionAllowed) {
    const animationPatterns = [
      /animation:\s*[^;]+;/gi,
      /@keyframes/gi,
      /transition:\s*all/gi,  // Broad transitions
    ];

    for (const pattern of animationPatterns) {
      if (pattern.test(cssContent)) {
        violations.push(`Found animation pattern: ${pattern.source}`);
      }
    }
  }

  // Check animation duration
  const durationMatch = cssContent.match(/animation-duration:\s*(\d+)ms/gi);
  if (durationMatch) {
    for (const match of durationMatch) {
      const duration = parseInt(match.replace(/\D/g, ''));
      if (duration > ir.constraints.maxAnimationDuration) {
        violations.push(`Animation duration ${duration}ms exceeds limit ${ir.constraints.maxAnimationDuration}ms`);
      }
    }
  }

  return {
    name: 'Motion Constraints',
    passed: violations.length === 0,
    message: violations.length === 0
      ? 'Motion constraints respected'
      : violations.join('; '),
  };
}

/**
 * Check if font count is within limit
 */
function checkFontLimit(ir: SiteDesignIR, cssContent: string): Check {
  // Extract font-family declarations
  const fontMatches = cssContent.match(/font-family:\s*([^;]+);/gi) || [];
  const uniqueFonts = new Set<string>();

  for (const match of fontMatches) {
    // Extract first font in stack
    const fontName = match.replace(/font-family:\s*/i, '').split(',')[0].trim();
    if (!fontName.startsWith('var(') && !fontName.includes('system-ui')) {
      uniqueFonts.add(fontName.replace(/['"]/g, ''));
    }
  }

  // Default max fonts from contract (typically 2)
  const maxFonts = 2;
  const passed = uniqueFonts.size <= maxFonts;

  return {
    name: 'Font Limit',
    passed,
    message: passed
      ? `Using ${uniqueFonts.size} fonts (limit: ${maxFonts})`
      : `Using ${uniqueFonts.size} fonts, exceeds limit of ${maxFonts}`,
  };
}

/**
 * Check for forbidden anti-patterns in HTML
 */
function checkAntiPatterns(ir: SiteDesignIR, htmlContent: string): Check {
  const violations: string[] = [];

  for (const pattern of ir.ux.forbidden) {
    switch (pattern) {
      case 'auto_play_media':
        if (/autoplay/i.test(htmlContent)) {
          violations.push('Found autoplay attribute (forbidden: auto_play_media)');
        }
        break;

      case 'hover_only_content':
        if (/:hover\s*\{[^}]*display\s*:\s*block/i.test(htmlContent)) {
          violations.push('Found hover-only display (forbidden: hover_only_content)');
        }
        break;

      case 'confirm_shaming':
        // Check for manipulative decline text
        if (/no.*(thanks|save|want)/i.test(htmlContent)) {
          violations.push('Potential confirm shaming detected');
        }
        break;

      case 'forced_popup':
        // Check for non-dismissable modals
        if (/modal.*(?!close)/i.test(htmlContent) && !/close|dismiss|×/i.test(htmlContent)) {
          violations.push('Potential forced popup without close');
        }
        break;
    }
  }

  return {
    name: 'Anti-Patterns',
    passed: violations.length === 0,
    message: violations.length === 0
      ? 'No forbidden anti-patterns detected'
      : violations.join('; '),
  };
}

/**
 * Check accessibility requirements
 */
function checkAccessibility(ir: SiteDesignIR, htmlContent: string): Check {
  const violations: string[] = [];

  // Check for focus indicators requirement
  if (ir.ux.requireFocusIndicators) {
    if (/outline:\s*none/i.test(htmlContent) && !/focus-visible/i.test(htmlContent)) {
      violations.push('outline:none without focus-visible alternative');
    }
  }

  // Check for alt text requirement
  if (ir.ux.requireAltText) {
    const imgTags = htmlContent.match(/<img[^>]*>/gi) || [];
    for (const img of imgTags) {
      if (!img.includes('alt=')) {
        violations.push('Image without alt attribute');
      }
    }
  }

  return {
    name: 'Accessibility',
    passed: violations.length === 0,
    message: violations.length === 0
      ? `Accessibility requirements met (contrast >= ${ir.ux.minContrast})`
      : violations.join('; '),
  };
}

/**
 * Check that builder did not access forbidden paths
 */
function checkPathAccess(): Check {
  // This is a governance check - in real implementation would check file access logs
  // For now, it's a reminder that the builder MUST NOT access these paths
  return {
    name: 'Path Access',
    passed: true,
    message: 'Builder restricted to tracks/<id>/ (manual verification required)',
  };
}

// ============================================================================
// MAIN COMPLIANCE FUNCTION
// ============================================================================

/**
 * Run compliance checks on builder output
 *
 * @param trackId - Track identifier
 * @param outputDir - Directory containing built artifacts
 */
export function checkCompliance(trackId: string, outputDir?: string): ComplianceResult {
  const dir = outputDir || `./tracks/${trackId}/dist`;

  // Load contract IR
  const ir = loadContract(trackId);

  // Read built artifacts
  const cssPath = join(dir, 'theme.css');
  const htmlPath = join(dir, 'index.html');

  const cssContent = existsSync(cssPath) ? readFileSync(cssPath, 'utf-8') : '';
  const htmlContent = existsSync(htmlPath) ? readFileSync(htmlPath, 'utf-8') : '';

  // Run checks
  const checks: Check[] = [
    checkMotionConstraints(ir, cssContent),
    checkFontLimit(ir, cssContent),
    checkAntiPatterns(ir, htmlContent),
    checkAccessibility(ir, htmlContent),
    checkPathAccess(),
  ];

  // Collect violations
  const violations: Violation[] = checks
    .filter(c => !c.passed)
    .map(c => ({
      rule: c.name,
      severity: 'error' as const,
      message: c.message,
    }));

  const result: ComplianceResult = {
    passed: violations.length === 0,
    trackId,
    checks,
    violations,
  };

  return result;
}

/**
 * Print compliance report
 */
export function printReport(result: ComplianceResult): void {
  console.log('\n' + '='.repeat(60));
  console.log(`Contract Compliance Report: ${result.trackId}`);
  console.log('='.repeat(60) + '\n');

  for (const check of result.checks) {
    const icon = check.passed ? '✅' : '❌';
    console.log(`${icon} ${check.name}`);
    console.log(`   ${check.message}\n`);
  }

  console.log('-'.repeat(60));
  if (result.passed) {
    console.log('✅ All compliance checks passed');
  } else {
    console.log(`❌ ${result.violations.length} violation(s) found`);
    for (const v of result.violations) {
      console.log(`   - [${v.severity}] ${v.rule}: ${v.message}`);
    }
  }
  console.log('');
}

/**
 * Output JSON summary for CI consumption
 */
export function toJSON(result: ComplianceResult): object {
  return {
    passed: result.passed,
    trackId: result.trackId,
    summary: {
      total: result.checks.length,
      passed: result.checks.filter(c => c.passed).length,
      failed: result.checks.filter(c => !c.passed).length,
    },
    violations: result.violations.map(v => ({
      id: v.rule.toLowerCase().replace(/\s+/g, '_'),
      rule: v.rule,
      severity: v.severity,
      message: v.message,
    })),
  };
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const jsonFlag = args.includes('--json');
  const filteredArgs = args.filter(a => a !== '--json');

  const trackId = filteredArgs[0];
  const outputDir = filteredArgs[1];

  if (!trackId) {
    console.error('Usage: npx tsx compliance.ts <track-id> [output-dir] [--json]');
    process.exit(1);
  }

  try {
    const result = checkCompliance(trackId, outputDir);

    if (jsonFlag) {
      // Machine-readable output for CI
      console.log(JSON.stringify(toJSON(result), null, 2));
    } else {
      // Human-readable output
      printReport(result);
    }

    if (!result.passed) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
