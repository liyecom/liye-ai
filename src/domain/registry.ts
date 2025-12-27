/**
 * LiYe AI Domain Registry
 * Location: src/domain/registry.ts
 *
 * Central registry for all domains in the system
 * Domain = WHERE in the four-layer architecture (Method/Runtime/Skill/Domain)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

// === Types ===

export interface DomainConfig {
  domain: {
    id: string;
    name: string;
    version: string;
    description: string;
    layer?: 'application' | 'core';
  };
  agents?: {
    enabled: string[];
    orchestrator: string;
  };
  workflows?: {
    available: string[];
    default: string;
  };
  skills?: {
    atomic: string[];
    composite: string[];
  };
  evolution?: {
    enabled: boolean;
    graduation_threshold?: number;
  };
}

export interface RegisteredDomain {
  id: string;
  name: string;
  version: string;
  description: string;
  layer: 'application' | 'core';
  path: string;
  config: DomainConfig;
  status: 'active' | 'deprecated' | 'development';
}

// === Domain Registry ===

export class DomainRegistry {
  private domains: Map<string, RegisteredDomain> = new Map();
  private basePath: string;

  constructor(basePath: string = 'src/domain') {
    this.basePath = basePath;
  }

  /**
   * Scan and register all domains in the domain directory
   */
  async scanDomains(): Promise<void> {
    const domainPath = path.resolve(this.basePath);

    if (!fs.existsSync(domainPath)) {
      console.warn(`Domain path does not exist: ${domainPath}`);
      return;
    }

    const entries = fs.readdirSync(domainPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const configPath = path.join(domainPath, entry.name, 'config.yaml');

        if (fs.existsSync(configPath)) {
          await this.registerFromConfig(entry.name, configPath);
        }
      }
    }
  }

  /**
   * Register a domain from its config.yaml file
   */
  async registerFromConfig(domainId: string, configPath: string): Promise<void> {
    try {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = yaml.load(configContent) as DomainConfig;

      if (!config.domain) {
        console.warn(`Invalid config for domain ${domainId}: missing 'domain' section`);
        return;
      }

      const registered: RegisteredDomain = {
        id: config.domain.id || domainId,
        name: config.domain.name,
        version: config.domain.version,
        description: config.domain.description,
        layer: config.domain.layer || 'application',
        path: path.dirname(configPath),
        config,
        status: 'active'
      };

      this.domains.set(registered.id, registered);
      console.log(`Registered domain: ${registered.id} (${registered.layer})`);
    } catch (error) {
      console.error(`Failed to register domain ${domainId}:`, error);
    }
  }

  /**
   * Get a registered domain by ID
   */
  get(domainId: string): RegisteredDomain | undefined {
    return this.domains.get(domainId);
  }

  /**
   * Get all registered domains
   */
  getAll(): RegisteredDomain[] {
    return Array.from(this.domains.values());
  }

  /**
   * Get domains by layer
   */
  getByLayer(layer: 'application' | 'core'): RegisteredDomain[] {
    return this.getAll().filter(d => d.layer === layer);
  }

  /**
   * Get application domains (excludes core infrastructure like geo-os)
   */
  getApplicationDomains(): RegisteredDomain[] {
    return this.getByLayer('application');
  }

  /**
   * Get core infrastructure domains
   */
  getCoreDomains(): RegisteredDomain[] {
    return this.getByLayer('core');
  }

  /**
   * Check if a domain is registered
   */
  has(domainId: string): boolean {
    return this.domains.has(domainId);
  }

  /**
   * Get domain count
   */
  count(): number {
    return this.domains.size;
  }

  /**
   * Get summary of all domains
   */
  summary(): string {
    const lines: string[] = [
      '=== LiYe AI Domain Registry ===',
      '',
      'Core Infrastructure:',
    ];

    for (const domain of this.getCoreDomains()) {
      lines.push(`  - ${domain.id}: ${domain.name} (v${domain.version})`);
    }

    lines.push('', 'Application Domains:');

    for (const domain of this.getApplicationDomains()) {
      lines.push(`  - ${domain.id}: ${domain.name} (v${domain.version})`);
      if (domain.config.agents?.enabled) {
        lines.push(`    Agents: ${domain.config.agents.enabled.length}`);
      }
      if (domain.config.workflows?.available) {
        lines.push(`    Workflows: ${domain.config.workflows.available.length}`);
      }
    }

    lines.push('', `Total: ${this.count()} domains`);

    return lines.join('\n');
  }
}

// === Singleton Instance ===

let registryInstance: DomainRegistry | null = null;

export function getDomainRegistry(): DomainRegistry {
  if (!registryInstance) {
    registryInstance = new DomainRegistry();
  }
  return registryInstance;
}

// === CLI Entry Point ===

async function main() {
  const registry = getDomainRegistry();
  await registry.scanDomains();
  console.log(registry.summary());
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export default DomainRegistry;
