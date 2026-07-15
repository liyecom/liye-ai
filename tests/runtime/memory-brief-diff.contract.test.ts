import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import YAML from 'yaml';

const REPO_ROOT = process.cwd();
const BOOTSTRAP_SCRIPT = join(REPO_ROOT, '.claude/scripts/memory_bootstrap.mjs');
const DIFF_SCRIPT = join(REPO_ROOT, '.claude/scripts/memory_diff.mjs');
const DOMAIN_MAPPING = join(REPO_ROOT, '.claude/config/domain-mapping.yaml');
const GENERAL_GLOSSARY = join(REPO_ROOT, 'knowledge/glossary/general.yaml');

let sandboxRoot: string | null = null;

afterEach(() => {
  if (sandboxRoot) rmSync(sandboxRoot, { recursive: true, force: true });
  sandboxRoot = null;
});

function createSandbox(): string {
  const root = mkdtempSync(join(tmpdir(), 'memory-brief-contract-'));
  mkdirSync(join(root, '.claude/config'), { recursive: true });
  mkdirSync(join(root, '.claude/scripts'), { recursive: true });
  mkdirSync(join(root, 'knowledge/glossary'), { recursive: true });

  copyFileSync(DOMAIN_MAPPING, join(root, '.claude/config/domain-mapping.yaml'));
  copyFileSync(DIFF_SCRIPT, join(root, '.claude/scripts/memory_diff.mjs'));
  copyFileSync(GENERAL_GLOSSARY, join(root, 'knowledge/glossary/general.yaml'));

  return root;
}

function runBootstrap(root: string) {
  const output = execFileSync(
    process.execPath,
    [BOOTSTRAP_SCRIPT, 'governance memory glossary definition drift'],
    { cwd: root, encoding: 'utf8' },
  );
  return JSON.parse(output);
}

function toRequiredThreeColumnBrief(brief: string): string {
  return brief
    .split('\n')
    .map((line) => {
      if (line === '| Term | Definition (EN SSOT) | Formula | Version |') {
        return '| Term | Definition | Formula |';
      }
      if (line === '|------|---------------------|---------|---------|') {
        return '|------|------------|---------|';
      }
      if (line.startsWith('| **')) {
        const columns = line.split('|');
        return `|${columns.slice(1, 4).join('|')}|`;
      }
      return line;
    })
    .join('\n');
}

test('parses current producer output with definition and formula fields aligned', () => {
  sandboxRoot = createSandbox();
  const glossaryPath = join(sandboxRoot, 'knowledge/glossary/general.yaml');
  const briefPath = join(sandboxRoot, '.claude/.compiled/memory_brief.md');
  const glossary = YAML.parse(readFileSync(glossaryPath, 'utf8'));
  const expectedTermCount = Math.min(glossary.concepts.length, 30);

  const first = runBootstrap(sandboxRoot);
  const firstBrief = readFileSync(briefPath, 'utf8');

  expect(firstBrief).toContain('| Term | Definition (EN SSOT) | Formula | Version |');
  expect(first.diff.ok).toBe(true);
  expect(first.diff.terms_added).toBe(expectedTermCount);
  expect(first.diff.terms_added).toBeGreaterThan(0);

  const target = glossary.concepts[0];
  const previousFormula = target.formula || '-';
  target.formula = 'contract_formula_v2';
  writeFileSync(glossaryPath, YAML.stringify(glossary), 'utf8');

  const second = runBootstrap(sandboxRoot);
  const report = readFileSync(join(sandboxRoot, second.diff.diff_path), 'utf8');

  expect(second.diff.terms_added).toBe(0);
  expect(second.diff.terms_removed).toBe(0);
  expect(second.diff.terms_modified).toBe(1);
  expect(report).toContain(`#### ${target.name} (formula)`);
  expect(report).toContain(`- **From**: ${previousFormula}`);
  expect(report).toContain('- **To**: contract_formula_v2');

  target.definition = 'Contract definition v3';
  writeFileSync(glossaryPath, YAML.stringify(glossary), 'utf8');

  const third = runBootstrap(sandboxRoot);
  const definitionReport = readFileSync(join(sandboxRoot, third.diff.diff_path), 'utf8');

  expect(third.diff.terms_added).toBe(0);
  expect(third.diff.terms_removed).toBe(0);
  expect(third.diff.terms_modified).toBe(1);
  expect(definitionReport).toContain(`#### ${target.name} (definition)`);
  expect(definitionReport).toContain('- **To**: Contract definition v3...');
});

test('accepts the required three-column shape derived from producer output', () => {
  sandboxRoot = createSandbox();
  const briefPath = join(sandboxRoot, '.claude/.compiled/memory_brief.md');
  const historyPath = join(sandboxRoot, '.claude/.compiled/memory_history');
  const glossary = YAML.parse(
    readFileSync(join(sandboxRoot, 'knowledge/glossary/general.yaml'), 'utf8'),
  );
  const expectedTermCount = Math.min(glossary.concepts.length, 30);

  runBootstrap(sandboxRoot);
  const threeColumnBrief = toRequiredThreeColumnBrief(readFileSync(briefPath, 'utf8'));
  rmSync(historyPath, { recursive: true, force: true });
  writeFileSync(briefPath, threeColumnBrief, 'utf8');

  const output = execFileSync(
    process.execPath,
    [join(sandboxRoot, '.claude/scripts/memory_diff.mjs')],
    { cwd: sandboxRoot, encoding: 'utf8' },
  );
  const result = JSON.parse(output);

  expect(threeColumnBrief).toContain('| Term | Definition | Formula |');
  expect(result.ok).toBe(true);
  expect(result.terms_added).toBe(expectedTermCount);
  expect(result.terms_added).toBeGreaterThan(0);
});
