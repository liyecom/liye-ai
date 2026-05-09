/**
 * LiYe AI Capability Extractor
 * Location: src/control/extractor.ts
 *
 * Cold-start extraction: Agent YAML -> CapabilityContract[]
 * Reuses DomainRegistry.scanDomains() scan pattern
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { CapabilityContract, SideEffect } from './types';

// Known read-type skill name patterns
const READ_PATTERNS = [
  /_research$/,
  /_analysis$/,
  /_detection$/,
  /_monitoring$/,
  /_verification$/,
  /_extraction$/,
  /_recognition$/,
  /_management$/,     // citation_management, etc.
  /^web_search$/,
];

// Known write-type skill name patterns
const WRITE_PATTERNS = [
  /_optimization$/,
  /_adjustment$/,
  /_creation$/,
  /_modification$/,
  /_generation$/,
];

/**
 * [Fix #2] Infer side_effect from skill name (conservative, fail-closed)
 * - Known read patterns -> 'read'
 * - Known write patterns -> 'write'
 * - Unknown -> 'write' (conservative)
 * - delegation flag does NOT affect inference
 */
export function inferSideEffect(skillId: string): SideEffect {
  for (const pattern of READ_PATTERNS) {
    if (pattern.test(skillId)) return 'read';
  }
  for (const pattern of WRITE_PATTERNS) {
    if (pattern.test(skillId)) return 'write';
  }
  // Conservative: unknown defaults to write (fail-closed)
  return 'write';
}

/**
 * Extract tags from a skill_id by splitting on underscores
 * e.g. "market_research" -> ["market", "research"]
 */
function extractTagsFromSkillId(skillId: string): string[] {
  return skillId.split('_').filter(t => t.length > 0);
}

/**
 * Extract tags from persona role by splitting on spaces and lowercasing
 * e.g. "Market Analyst" -> ["market", "analyst"]
 */
function extractTagsFromRole(role: string): string[] {
  return role
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length > 1); // Skip single chars
}

interface AgentYAML {
  agent: {
    id: string;
    name: string;
    version?: string;
    domain: string;
  };
  persona?: {
    role?: string;
    goal?: string;
    backstory?: string;
  };
  skills?: {
    atomic?: string[];
    composite?: string[];
  };
  runtime?: {
    process?: string;
    memory?: boolean;
    delegation?: boolean;
    max_iterations?: number;
    timeout?: number;
  };
}

/**
 * Extract CapabilityContracts from a single Agent YAML file
 * Each atomic skill produces one independent contract
 */
export function extractFromAgentYAML(
  filePath: string,
  content?: string
): CapabilityContract[] {
  const raw = content ?? fs.readFileSync(filePath, 'utf-8');
  const parsed = yaml.load(raw) as AgentYAML;

  if (!parsed?.agent?.id) {
    return [];
  }

  const agentId = parsed.agent.id;
  const domain = parsed.agent.domain || 'unknown';
  const agentName = parsed.agent.name || agentId;
  const roleTags = parsed.persona?.role
    ? extractTagsFromRole(parsed.persona.role)
    : [];

  const atomicSkills = parsed.skills?.atomic || [];
  const contracts: CapabilityContract[] = [];

  for (const skillId of atomicSkills) {
    const skillTags = extractTagsFromSkillId(skillId);
    // Merge role tags into every contract (deduplicated)
    const allTags = [...new Set([...skillTags, ...roleTags])];

    contracts.push({
      id: `${agentId}:${skillId}`,
      kind: 'skill',
      name: `${agentName} - ${skillId}`,
      domain,
      tags: allTags,
      side_effect: inferSideEffect(skillId),
      source_path: filePath,
    });
  }

  return contracts;
}

/**
 * Extract agent metadata from YAML (for building AgentCard)
 */
export function extractAgentMeta(filePath: string, content?: string): {
  agent_id: string;
  name: string;
  domain: string;
  source_path: string;
} | null {
  const raw = content ?? fs.readFileSync(filePath, 'utf-8');
  const parsed = yaml.load(raw) as AgentYAML;

  if (!parsed?.agent?.id) return null;

  return {
    agent_id: parsed.agent.id,
    name: parsed.agent.name || parsed.agent.id,
    domain: parsed.agent.domain || 'unknown',
    source_path: filePath,
  };
}

/**
 * Scan a directory for Agent YAML files and extract all contracts
 * Reuses DomainRegistry.scanDomains() pattern: scan dirs, read YAML, register
 */
export function scanAgentYAMLs(dirs: string[]): {
  agentId: string;
  name: string;
  domain: string;
  sourcePath: string;
  contracts: CapabilityContract[];
}[] {
  const results: {
    agentId: string;
    name: string;
    domain: string;
    sourcePath: string;
    contracts: CapabilityContract[];
  }[] = [];

  for (const dir of dirs) {
    const resolved = path.resolve(dir);
    if (!fs.existsSync(resolved)) continue;

    const entries = fs.readdirSync(resolved, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== '_template') {
        // Scan subdirectory (e.g. Agents/core/)
        const subDir = path.join(resolved, entry.name);
        const subEntries = fs.readdirSync(subDir, { withFileTypes: true });

        for (const subEntry of subEntries) {
          if (subEntry.isFile() && (subEntry.name.endsWith('.yaml') || subEntry.name.endsWith('.yml'))) {
            const filePath = path.join(subDir, subEntry.name);
            processYAMLFile(filePath, results);
          }
        }
      } else if (entry.isFile() && !entry.name.startsWith('_') &&
                 (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))) {
        // YAML file directly in the dir
        const filePath = path.join(resolved, entry.name);
        processYAMLFile(filePath, results);
      }
    }
  }

  return results;
}

function processYAMLFile(
  filePath: string,
  results: {
    agentId: string;
    name: string;
    domain: string;
    sourcePath: string;
    contracts: CapabilityContract[];
  }[]
): void {
  try {
    const meta = extractAgentMeta(filePath);
    if (!meta) return;

    const contracts = extractFromAgentYAML(filePath);
    if (contracts.length === 0) return;

    results.push({
      agentId: meta.agent_id,
      name: meta.name,
      domain: meta.domain,
      sourcePath: meta.source_path,
      contracts,
    });
  } catch {
    // Skip invalid files silently
  }
}
