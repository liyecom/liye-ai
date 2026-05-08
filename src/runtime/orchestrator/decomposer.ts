/**
 * LiYe AI Rule-Based Decomposer
 * Location: src/runtime/orchestrator/decomposer.ts
 *
 * Intent + Crew YAML -> TaskPlan (no LLM calls, pure YAML parsing)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Intent, PlanTask, TaskPlan, CapabilityRequirement } from './types';

interface CrewYAML {
  crew: {
    id: string;
    name: string;
    version?: string;
    domain: string;
  };
  agents: Array<{
    role: 'lead' | 'member' | 'specialist';
    agent_id: string;
    responsibilities?: string[];
  }>;
  process: {
    type: 'sequential' | 'hierarchical' | 'parallel';
    allow_delegation?: boolean;
    verbose?: boolean;
  };
  goals?: {
    primary?: string;
    secondary?: string[];
  };
}

interface AgentYAMLForDecompose {
  agent: {
    id: string;
    name: string;
    domain: string;
  };
  persona?: {
    role?: string;
  };
  skills?: {
    atomic?: string[];
  };
}

/**
 * English stopwords — excluded from crew matching to prevent wildcard hits.
 * Includes articles, prepositions, conjunctions, common verbs.
 */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'not', 'no', 'nor',
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
  'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could',
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as',
  'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'up', 'down', 'out', 'off', 'over', 'under', 'between',
  'this', 'that', 'these', 'those', 'it', 'its',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'some', 'any',
  'if', 'then', 'than', 'so', 'too', 'very',
  'about', 'also', 'just', 'how', 'what', 'when', 'where', 'which', 'who',
  'given', 'using', 'based',
  // Organizational words (appear in crew names but aren't business-meaningful)
  'team', 'group', 'unit', 'squad', 'crew',
]);

/** Minimum token length for crew matching */
const MIN_TOKEN_LENGTH = 3;

/** Minimum score ratio (matched / total intent tokens) to accept a crew match */
const MIN_MATCH_RATIO = 0.15;

/** Minimum shared prefix length for fuzzy stem matching */
const MIN_PREFIX_LENGTH = 5;

/**
 * Tokenize text into meaningful words for crew matching.
 * Filters stopwords and tokens shorter than MIN_TOKEN_LENGTH.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\-_,.:;!?()]+/)
    .filter(w => w.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(w));
}

/**
 * Check if two tokens match, either exactly or by shared prefix (stem match).
 * Prefix matching requires both tokens >= MIN_PREFIX_LENGTH chars and
 * sharing MIN_PREFIX_LENGTH leading characters.
 * Examples: analyze↔analysis, verify↔verified, insight↔insights
 */
function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= MIN_PREFIX_LENGTH && b.length >= MIN_PREFIX_LENGTH) {
    return a.substring(0, MIN_PREFIX_LENGTH) === b.substring(0, MIN_PREFIX_LENGTH);
  }
  return false;
}

/**
 * Check if a token matches any token in a set (exact or prefix).
 */
function matchesAny(token: string, tokenSet: Set<string>): boolean {
  if (tokenSet.has(token)) return true;
  if (token.length >= MIN_PREFIX_LENGTH) {
    for (const candidate of tokenSet) {
      if (candidate.length >= MIN_PREFIX_LENGTH &&
          token.substring(0, MIN_PREFIX_LENGTH) === candidate.substring(0, MIN_PREFIX_LENGTH)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Derive capability tags by tokenizing atomic capability identifiers.
 * Pure string manipulation; no cross-layer import.
 */
function extractCapabilityTags(capabilityIds: string[]): string[] {
  const tags = new Set<string>();
  for (const id of capabilityIds) {
    for (const part of id.split('_')) {
      if (part.length > 1) tags.add(part);
    }
  }
  return [...tags];
}

export class RuleBasedDecomposer {
  private crewDirs: string[];
  private agentDirs: string[];

  constructor(crewDirs: string[] = ['Crews/'], agentDirs: string[] = ['Agents/']) {
    this.crewDirs = crewDirs;
    this.agentDirs = agentDirs;
  }

  /**
   * Decompose an Intent into a TaskPlan
   * 1. Match Intent.goal keywords -> find Crew YAML
   * 2. Parse Crew agents + process.type
   * 3. Each agent role -> PlanTask with capability requirements from Agent YAML
   * 4. Build depends_on based on process.type
   */
  async decompose(intent: Intent): Promise<TaskPlan> {
    // Find matching crew
    const crew = this.findMatchingCrew(intent);

    if (!crew) {
      // Fallback: single task from intent
      return {
        intent_id: intent.id,
        tasks: [{
          id: `${intent.id}_t1`,
          description: intent.goal,
          capability: {
            tags: intent.goal.toLowerCase().split(/\s+/).filter(w => w.length > 2),
            domain: intent.domain,
          },
          inputs: intent.context ?? {},
        }],
        source: 'rule',
      };
    }

    // Build PlanTasks from crew agents
    const tasks: PlanTask[] = [];
    const agentTaskIds: Map<string, string> = new Map();
    let leadTaskId: string | undefined;

    for (let i = 0; i < crew.agents.length; i++) {
      const agentEntry = crew.agents[i];
      const taskId = `${intent.id}_t${i + 1}`;
      agentTaskIds.set(agentEntry.agent_id, taskId);

      if (agentEntry.role === 'lead') {
        leadTaskId = taskId;
      }

      // Load agent YAML to get capability requirements
      const capability = this.loadAgentCapability(agentEntry.agent_id, intent.domain);

      const task: PlanTask = {
        id: taskId,
        description: agentEntry.responsibilities?.join('; ') ?? `Execute ${agentEntry.agent_id} role`,
        capability,
        inputs: intent.context ?? {},
      };

      tasks.push(task);
    }

    // Build depends_on based on process.type
    this.buildDependencies(tasks, crew.process.type, leadTaskId);

    return {
      intent_id: intent.id,
      tasks,
      source: 'crew_yaml',
    };
  }

  /**
   * Find a Crew YAML matching intent goal keywords.
   *
   * [P0 Fix] Replaced includes()-based matching with:
   *   1. Tokenize intent and crew text (split + lowercase)
   *   2. Filter stopwords + tokens < 3 chars
   *   3. Exact token overlap (no substring matching)
   *   4. Score = overlap count
   *   5. Reject if score/intentTokens < MIN_MATCH_RATIO
   *   6. Return null (no-match) if no crew passes threshold
   */
  private findMatchingCrew(intent: Intent): CrewYAML | null {
    const intentTokens = tokenize(intent.goal);
    if (intentTokens.length === 0) return null;

    let bestMatch: { crew: CrewYAML; score: number } | null = null;

    for (const dir of this.crewDirs) {
      const resolved = path.resolve(dir);
      if (!fs.existsSync(resolved)) continue;

      const crewFiles = this.findYAMLFiles(resolved);

      for (const filePath of crewFiles) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const crew = yaml.load(content) as CrewYAML;
          if (!crew?.crew?.id) continue;

          // Domain filter
          if (intent.domain && crew.crew.domain !== intent.domain) continue;

          // Two-tier crew token sets:
          // Tier 1 (strong): crew name + id — high-signal identifiers
          // Tier 2 (all): name + id + goals — full matching surface
          const nameIdText = [crew.crew.name, crew.crew.id].join(' ');
          const nameIdTokens = new Set(tokenize(nameIdText));

          const allText = [
            crew.crew.name,
            crew.crew.id,
            crew.goals?.primary ?? '',
            ...(crew.goals?.secondary ?? []),
          ].join(' ');
          const allTokenSet = new Set(tokenize(allText));

          // Token overlap scoring (exact + prefix stem matching)
          let score = 0;
          let nameIdHits = 0;
          for (const token of intentTokens) {
            if (matchesAny(token, allTokenSet)) {
              score++;
              if (matchesAny(token, nameIdTokens)) nameIdHits++;
            }
          }

          // Threshold logic:
          // - Single-token intents: token must hit crew name/id (strong signal)
          // - Multi-token intents: require score >= 2, OR
          //   score >= 1 with at least one name/id hit (crew identity match)
          // This prevents:
          //   - vague single-word matches on goals (e.g., "topic")
          //   - low-signal matches where only generic tokens overlap
          if (score === 0) continue;
          if (intentTokens.length === 1) {
            if (nameIdHits === 0) continue;
          } else {
            if (score < 2 && nameIdHits === 0) continue;
          }

          // Additional: minimum match ratio still applies
          const ratio = score / intentTokens.length;
          if (ratio < MIN_MATCH_RATIO) continue;

          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { crew, score };
          }
        } catch {
          // Skip invalid files
        }
      }
    }

    return bestMatch?.crew ?? null;
  }

  /**
   * Load capability requirement from Agent YAML
   */
  private loadAgentCapability(agentId: string, domain?: string): CapabilityRequirement {
    for (const dir of this.agentDirs) {
      const resolved = path.resolve(dir);
      if (!fs.existsSync(resolved)) continue;

      const yamlFiles = this.findYAMLFiles(resolved);

      for (const filePath of yamlFiles) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const agent = yaml.load(content) as AgentYAMLForDecompose;
          if (agent?.agent?.id !== agentId) continue;

          const skills = agent.skills?.atomic ?? [];
          const roleTags = agent.persona?.role
            ? agent.persona.role.toLowerCase().split(/\s+/).filter(w => w.length > 1)
            : [];

          return {
            tags: [...new Set([...extractCapabilityTags(skills), ...roleTags])],
            domain: domain ?? agent.agent.domain,
          };
        } catch {
          continue;
        }
      }
    }

    // Fallback: use agent_id as tag
    return {
      tags: agentId.split('-').filter(t => t.length > 1),
      domain,
    };
  }

  /**
   * Build dependency graph based on process type
   */
  private buildDependencies(
    tasks: PlanTask[],
    processType: string,
    leadTaskId?: string
  ): void {
    if (processType === 'sequential') {
      // Chain: each depends on previous
      for (let i = 1; i < tasks.length; i++) {
        tasks[i].depends_on = [tasks[i - 1].id];
      }
    } else if (processType === 'parallel') {
      // No dependencies
    } else if (processType === 'hierarchical') {
      // Lead first, members depend on lead
      if (leadTaskId) {
        for (const task of tasks) {
          if (task.id !== leadTaskId) {
            task.depends_on = [leadTaskId];
          }
        }
      }
    }
  }

  /**
   * Recursively find all YAML files in a directory
   */
  private findYAMLFiles(dir: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...this.findYAMLFiles(fullPath));
      } else if (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')) {
        files.push(fullPath);
      }
    }

    return files;
  }
}

// Export internals for testing
export { tokenize, tokensMatch, matchesAny, STOPWORDS, MIN_TOKEN_LENGTH, MIN_MATCH_RATIO, MIN_PREFIX_LENGTH };

export default RuleBasedDecomposer;
