/**
 * LiYe AI Domain Layer Index
 * Location: src/domain/index.ts
 *
 * Domain Layer = WHERE in the four-layer architecture
 *
 * Responsibilities:
 * - Orchestrate Method, Skill, and Runtime layers
 * - Implement domain-specific business logic
 * - Configure domain-specific agents and workflows
 *
 * Architecture (Domain-Centric Fan-Out):
 *
 *         ┌─────────────────┐
 *         │     Domain      │  ← You are here
 *         │    (WHERE)      │
 *         └────────┬────────┘
 *                  │
 *      ┌───────────┼───────────┐
 *      ↓           ↓           ↓
 * ┌─────────┐ ┌─────────┐ ┌─────────┐
 * │ Method  │ │  Skill  │ │ Runtime │
 * │  (WHY)  │ │ (WHAT)  │ │  (HOW)  │
 * └─────────┘ └─────────┘ └─────────┘
 */

// === Registry ===
export { DomainRegistry, getDomainRegistry } from './registry';
export type { DomainConfig, RegisteredDomain } from './registry';

// === Domain Manifest ===
export const DOMAINS = {
  // Core Infrastructure
  'geo-os': {
    id: 'geo-os',
    name: 'GEO OS Knowledge Engine',
    layer: 'core',
    description: 'Core knowledge extraction and processing engine',
    path: 'src/domain/geo-os'
  },

  // Application Domains
  'amazon-growth': {
    id: 'amazon-growth',
    name: 'Amazon Growth Operations',
    layer: 'application',
    description: 'Multi-agent system for Amazon product lifecycle management',
    path: 'src/domain/amazon-growth'
  },

  'medical-research': {
    id: 'medical-research',
    name: 'Medical Research Intelligence',
    layer: 'application',
    description: 'AI-powered medical research and evidence synthesis',
    path: 'src/domain/medical-research'
  }
} as const;

// === Types ===
export type DomainId = keyof typeof DOMAINS;

// === Helper Functions ===

/**
 * Get domain configuration path
 */
export function getDomainConfigPath(domainId: DomainId): string {
  return `${DOMAINS[domainId].path}/config.yaml`;
}

/**
 * Get domain agents directory
 */
export function getDomainAgentsPath(domainId: DomainId): string {
  return `${DOMAINS[domainId].path}/agents`;
}

/**
 * Get domain skills directory
 */
export function getDomainSkillsPath(domainId: DomainId): string {
  return `${DOMAINS[domainId].path}/skills`;
}

/**
 * Get domain workflows directory
 */
export function getDomainWorkflowsPath(domainId: DomainId): string {
  return `${DOMAINS[domainId].path}/workflows`;
}

/**
 * List all available domain IDs
 */
export function listDomains(): DomainId[] {
  return Object.keys(DOMAINS) as DomainId[];
}

/**
 * Check if a domain ID is valid
 */
export function isValidDomain(domainId: string): domainId is DomainId {
  return domainId in DOMAINS;
}
