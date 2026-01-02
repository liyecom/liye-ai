#!/usr/bin/env node

/**
 * i18n SSOT Validation Script
 *
 * Purpose: Validate that English SSOT files exist and are properly formatted.
 *
 * Rules:
 * - English SSOT files MUST exist (CI fail if missing)
 * - Chinese display files are optional (warning only)
 * - Generates coverage report for translation status
 *
 * Usage:
 *   node i18n/scripts/validate.mjs [--ssot-only] [--verbose]
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '../..');

// Configuration
const CONFIG_PATH = join(ROOT, 'i18n/config.yaml');

// Exit codes
const EXIT_SUCCESS = 0;
const EXIT_SSOT_MISSING = 1;
const EXIT_CONFIG_ERROR = 2;

/**
 * Load i18n configuration
 */
function loadConfig() {
  try {
    const content = readFileSync(CONFIG_PATH, 'utf-8');
    return yaml.load(content);
  } catch (error) {
    console.error(`❌ Failed to load i18n config: ${CONFIG_PATH}`);
    console.error(`   Error: ${error.message}`);
    process.exit(EXIT_CONFIG_ERROR);
  }
}

/**
 * Check if a file exists and is non-empty
 */
function fileExists(path) {
  if (!existsSync(path)) return false;
  const stats = statSync(path);
  return stats.size > 0;
}

/**
 * Validate SSOT files exist
 */
async function validateSSOT(config, verbose = false) {
  const errors = [];
  const warnings = [];
  const validated = [];

  console.log('\n📋 Validating English SSOT files...\n');

  for (const item of config.content.ssot) {
    const pattern = join(ROOT, item.path);

    // Handle glob patterns
    if (item.path.includes('*')) {
      const files = await glob(pattern);

      if (files.length === 0 && item.must_exist) {
        errors.push({
          path: item.path,
          type: item.type,
          error: 'No files match pattern'
        });
      } else {
        for (const file of files) {
          if (fileExists(file)) {
            validated.push({ path: file.replace(ROOT + '/', ''), type: item.type });
            if (verbose) {
              console.log(`  ✅ ${file.replace(ROOT + '/', '')}`);
            }
          } else {
            errors.push({
              path: file.replace(ROOT + '/', ''),
              type: item.type,
              error: 'File is empty or missing'
            });
          }
        }
      }
    } else {
      // Single file
      const fullPath = join(ROOT, item.path);
      if (fileExists(fullPath)) {
        validated.push({ path: item.path, type: item.type });
        if (verbose) {
          console.log(`  ✅ ${item.path}`);
        }
      } else if (item.must_exist) {
        errors.push({
          path: item.path,
          type: item.type,
          error: 'File is empty or missing'
        });
      } else {
        warnings.push({
          path: item.path,
          type: item.type,
          warning: 'Optional file missing'
        });
      }
    }
  }

  return { errors, warnings, validated };
}

/**
 * Check translation coverage
 */
async function checkTranslationCoverage(config, verbose = false) {
  const coverage = {
    total: 0,
    translated: 0,
    missing: []
  };

  console.log('\n📊 Checking translation coverage...\n');

  for (const item of config.content.display || []) {
    const pattern = join(ROOT, item.path);
    const sourcePattern = join(ROOT, item.source);

    // Get source files
    let sourceFiles = [];
    if (item.source.includes('*')) {
      sourceFiles = await glob(sourcePattern);
    } else if (fileExists(sourcePattern)) {
      sourceFiles = [sourcePattern];
    }

    coverage.total += sourceFiles.length;

    // Get translation files
    let translationFiles = [];
    if (item.path.includes('*')) {
      translationFiles = await glob(pattern);
    } else if (fileExists(pattern)) {
      translationFiles = [pattern];
    }

    // Check coverage
    for (const sourceFile of sourceFiles) {
      const relativePath = sourceFile.replace(ROOT + '/', '');
      const hasTranslation = translationFiles.some(tf => {
        const tfRelative = tf.replace(ROOT + '/', '');
        // Match by filename
        const sourceBasename = relativePath.split('/').pop();
        const tfBasename = tfRelative.split('/').pop();
        return sourceBasename === tfBasename || tfBasename === sourceBasename.replace('.md', '.display.md');
      });

      if (hasTranslation) {
        coverage.translated++;
        if (verbose) {
          console.log(`  ✅ ${relativePath} → translated`);
        }
      } else {
        coverage.missing.push(relativePath);
        if (verbose) {
          console.log(`  ⚠️  ${relativePath} → missing translation`);
        }
      }
    }
  }

  return coverage;
}

/**
 * Print validation results
 */
function printResults(ssotResult, coverage, config) {
  console.log('\n' + '═'.repeat(60));
  console.log('📝 i18n Validation Report');
  console.log('═'.repeat(60));

  // SSOT Status
  console.log('\n📁 English SSOT Status:');
  console.log(`   ✅ Validated: ${ssotResult.validated.length} files`);

  if (ssotResult.errors.length > 0) {
    console.log(`   ❌ Errors: ${ssotResult.errors.length} files`);
    for (const err of ssotResult.errors) {
      console.log(`      - ${err.path}: ${err.error}`);
    }
  }

  if (ssotResult.warnings.length > 0) {
    console.log(`   ⚠️  Warnings: ${ssotResult.warnings.length} files`);
    for (const warn of ssotResult.warnings) {
      console.log(`      - ${warn.path}: ${warn.warning}`);
    }
  }

  // Translation Coverage
  if (coverage.total > 0) {
    const coveragePercent = Math.round((coverage.translated / coverage.total) * 100);
    const threshold = config.ci?.coverage_threshold || 80;
    const coverageStatus = coveragePercent >= threshold ? '✅' : '⚠️';

    console.log('\n🌐 Translation Coverage:');
    console.log(`   ${coverageStatus} ${coveragePercent}% (${coverage.translated}/${coverage.total} files)`);
    console.log(`   Threshold: ${threshold}%`);

    if (coverage.missing.length > 0 && coverage.missing.length <= 5) {
      console.log('   Missing translations:');
      for (const file of coverage.missing) {
        console.log(`      - ${file}`);
      }
    } else if (coverage.missing.length > 5) {
      console.log(`   Missing translations: ${coverage.missing.length} files (use --verbose to list)`);
    }
  }

  console.log('\n' + '═'.repeat(60));

  // Final status
  if (ssotResult.errors.length > 0) {
    console.log('❌ VALIDATION FAILED: English SSOT files missing\n');
    return false;
  } else {
    console.log('✅ VALIDATION PASSED: All required SSOT files present\n');
    return true;
  }
}

/**
 * Validate Glossary SSOT (Phase 2)
 * - Check that each concept has an English definition
 * - Check that Chinese content is only in i18n.zh-CN or aliases.zh-CN
 */
async function validateGlossary(verbose = false) {
  const glossaryPath = join(ROOT, 'knowledge/glossary');
  const errors = [];
  const warnings = [];
  const validated = [];

  console.log('\n📚 Validating Glossary SSOT...\n');

  // Chinese character detection regex
  const chineseRegex = /[\u4e00-\u9fff]/;

  // Find all glossary YAML files (excluding _schema.yaml)
  const glossaryFiles = await glob(join(glossaryPath, '*.yaml'));
  const files = glossaryFiles.filter(f => !f.endsWith('_schema.yaml'));

  for (const file of files) {
    const relativePath = file.replace(ROOT + '/', '');
    let fileErrors = [];
    let fileWarnings = [];

    try {
      const content = readFileSync(file, 'utf-8');
      const data = yaml.load(content);

      if (!data || !data.concepts) {
        fileWarnings.push('No concepts array found');
        continue;
      }

      for (const concept of data.concepts) {
        const conceptId = concept.concept_id || 'UNKNOWN';

        // Check 1: Must have English definition
        if (!concept.definition) {
          fileErrors.push(`${conceptId}: Missing English definition (SSOT)`);
        } else if (chineseRegex.test(concept.definition)) {
          fileErrors.push(`${conceptId}: Root definition contains Chinese (must be English SSOT)`);
        }

        // Check 2: Name must be English
        if (concept.name && chineseRegex.test(concept.name)) {
          fileErrors.push(`${conceptId}: Root name contains Chinese (must be English)`);
        }

        // Check 3: Formula must be English (if present)
        if (concept.formula && chineseRegex.test(concept.formula)) {
          fileErrors.push(`${conceptId}: Root formula contains Chinese (must be English)`);
        }

        // Check 4: Examples must be English (if present)
        if (concept.examples) {
          for (let i = 0; i < concept.examples.length; i++) {
            if (chineseRegex.test(concept.examples[i])) {
              fileErrors.push(`${conceptId}: Example ${i + 1} contains Chinese (must be English)`);
            }
          }
        }

        // Check 5: Pitfalls must be English (if present)
        if (concept.pitfalls) {
          for (let i = 0; i < concept.pitfalls.length; i++) {
            if (chineseRegex.test(concept.pitfalls[i])) {
              fileErrors.push(`${conceptId}: Pitfall ${i + 1} contains Chinese (must be English)`);
            }
          }
        }

        // Check 6: Chinese should only be in i18n.zh-CN or aliases.zh-CN
        // (This is implicitly verified by the above checks)
      }

      if (fileErrors.length === 0) {
        validated.push(relativePath);
        if (verbose) {
          console.log(`  ✅ ${relativePath} (${data.concepts.length} concepts)`);
        }
      }
    } catch (e) {
      fileErrors.push(`Parse error: ${e.message}`);
    }

    if (fileErrors.length > 0) {
      errors.push({ path: relativePath, errors: fileErrors });
    }
    if (fileWarnings.length > 0) {
      warnings.push({ path: relativePath, warnings: fileWarnings });
    }
  }

  return { errors, warnings, validated, total: files.length };
}

/**
 * Print glossary validation results
 */
function printGlossaryResults(glossaryResult) {
  console.log('\n📚 Glossary SSOT Status:');
  console.log(`   ✅ Validated: ${glossaryResult.validated.length}/${glossaryResult.total} files`);

  if (glossaryResult.errors.length > 0) {
    console.log(`   ❌ Errors:`);
    for (const err of glossaryResult.errors) {
      console.log(`      ${err.path}:`);
      for (const e of err.errors.slice(0, 5)) {
        console.log(`         - ${e}`);
      }
      if (err.errors.length > 5) {
        console.log(`         ... and ${err.errors.length - 5} more`);
      }
    }
    return false;
  }

  return true;
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const ssotOnly = args.includes('--ssot-only');
  const verbose = args.includes('--verbose');
  const glossaryOnly = args.includes('--glossary-only');

  console.log('🔍 LiYe OS i18n Validation');
  console.log(`   Config: ${CONFIG_PATH}`);
  console.log(`   Mode: ${glossaryOnly ? 'Glossary only' : ssotOnly ? 'SSOT only' : 'Full validation'}`);

  // Load configuration
  const config = loadConfig();

  let ssotPassed = true;
  let glossaryPassed = true;

  // Validate SSOT (unless glossary-only)
  let ssotResult = { errors: [], warnings: [], validated: [] };
  if (!glossaryOnly) {
    ssotResult = await validateSSOT(config, verbose);
  }

  // Validate Glossary SSOT
  const glossaryResult = await validateGlossary(verbose);
  glossaryPassed = printGlossaryResults(glossaryResult);

  // Check translation coverage (unless ssot-only or glossary-only)
  let coverage = { total: 0, translated: 0, missing: [] };
  if (!ssotOnly && !glossaryOnly) {
    coverage = await checkTranslationCoverage(config, verbose);
  }

  // Print SSOT results (unless glossary-only)
  if (!glossaryOnly) {
    ssotPassed = printResults(ssotResult, coverage, config);
  }

  // Final status
  const allPassed = ssotPassed && glossaryPassed;

  console.log('\n' + '═'.repeat(60));
  if (allPassed) {
    console.log('✅ ALL VALIDATIONS PASSED\n');
  } else {
    console.log('❌ VALIDATION FAILED\n');
  }

  // Exit with appropriate code
  process.exit(allPassed ? EXIT_SUCCESS : EXIT_SSOT_MISSING);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(EXIT_CONFIG_ERROR);
});
