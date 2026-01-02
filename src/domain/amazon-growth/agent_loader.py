#!/usr/bin/env python3
"""
Agent Loader - SSOT from Agents/ directory
===========================================

This module loads agent definitions from the canonical Agents/ directory,
converting them to CrewAI-compatible format at runtime.

SSOT Principle:
- Agent definitions ONLY exist in Agents/amazon-growth/
- This loader converts them to CrewAI format dynamically
- No generated files are committed to the repository

Usage:
    # As module
    from agent_loader import load_agents_from_ssot
    agents_config = load_agents_from_ssot()

    # As CLI
    python agent_loader.py --dry-run        # Validate only
    python agent_loader.py --report         # Generate report
    python agent_loader.py --verbose        # Detailed output

Version: 2.0.0 (v6.1.1 hardening)
"""

import os
import sys
import json
import argparse
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional

try:
    import yaml
except ImportError:
    print("Error: PyYAML not installed. Run: pip install pyyaml")
    sys.exit(1)


# Configuration
EXPECTED_AGENT_COUNT = 12  # Native agents (not including aliases)
REQUIRED_YAML_FIELDS = ['agent']  # Top-level required fields
REQUIRED_AGENT_FIELDS = ['id', 'name']  # Required in 'agent' section


class AgentLoaderError(Exception):
    """Custom exception for agent loading errors."""
    pass


class DuplicateAgentError(AgentLoaderError):
    """Raised when duplicate agent IDs are found."""
    pass


class MissingFieldError(AgentLoaderError):
    """Raised when required fields are missing."""
    pass


def get_repo_root() -> Path:
    """Get the repository root directory."""
    current = Path(__file__).parent
    return current.parent.parent.parent


def get_agents_dir() -> Path:
    """Get the canonical Agents/ directory path."""
    repo_root = get_repo_root()
    agents_dir = repo_root / "Agents" / "amazon-growth"

    if not agents_dir.exists():
        raise FileNotFoundError(f"Agents directory not found: {agents_dir}")

    return agents_dir


def validate_agent_yaml(agent_yaml: Dict[str, Any], filename: str) -> List[str]:
    """
    Validate agent YAML structure.

    Returns:
        List of validation errors (empty if valid)
    """
    errors = []

    # Check top-level required fields
    for field in REQUIRED_YAML_FIELDS:
        if field not in agent_yaml:
            errors.append(f"Missing top-level field '{field}' in {filename}")

    # Check agent section fields
    agent_section = agent_yaml.get('agent', {})
    for field in REQUIRED_AGENT_FIELDS:
        if field not in agent_section:
            errors.append(f"Missing 'agent.{field}' in {filename}")

    return errors


def convert_to_crewai_format(agent_yaml: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert Agents/ YAML format to CrewAI-compatible format.

    Input (Agents/ format):
        agent:
          name: Market Analyst
          id: market-analyst
        persona:
          role: Market Intelligence Analyst
          identity: Former category manager...
          focus: [...]
          core_principles: [...]

    Output (CrewAI format):
        role: Market Intelligence Analyst
        goal: Constructed from focus points
        backstory: Constructed from identity + principles
        verbose: true
    """
    agent_info = agent_yaml.get('agent', {})
    persona = agent_yaml.get('persona', {})

    # Extract role
    role = persona.get('role', agent_info.get('name', 'Unknown Agent'))

    # Construct goal from focus points
    focus_points = persona.get('focus', [])
    if focus_points:
        goal = "负责 " + "、".join(focus_points)
    else:
        goal = agent_info.get('whenToUse', 'Perform assigned tasks')

    # Construct backstory from identity and principles
    identity = persona.get('identity', '')
    principles = persona.get('core_principles', [])

    backstory_parts = []
    if identity:
        backstory_parts.append(identity.strip())
    if principles:
        backstory_parts.append("核心原则：" + "；".join(principles[:3]))

    backstory = "\n".join(backstory_parts) if backstory_parts else f"专业的 {role}"

    return {
        'role': role,
        'goal': goal,
        'backstory': backstory,
        'verbose': True,
        # Additional metadata for tracing
        '_source_id': agent_info.get('id', 'unknown'),
        '_source_name': agent_info.get('name', 'Unknown'),
        '_domain': agent_info.get('domain', 'amazon-growth'),
    }


def load_agents_from_ssot(strict: bool = True) -> Dict[str, Dict[str, Any]]:
    """
    Load all agents from the canonical Agents/ directory.

    Args:
        strict: If True, raise errors on validation failures

    Returns:
        Dict mapping agent_id to CrewAI-compatible config

    Raises:
        DuplicateAgentError: If duplicate agent IDs are found
        MissingFieldError: If required fields are missing
    """
    agents_dir = get_agents_dir()
    agents_config = {}
    seen_ids = {}  # Track {id: filename} for duplicate detection
    all_errors = []

    for yaml_file in sorted(agents_dir.glob("*.yaml")):
        try:
            with open(yaml_file, 'r', encoding='utf-8') as f:
                agent_yaml = yaml.safe_load(f)

            if agent_yaml is None:
                continue

            # Validate structure
            validation_errors = validate_agent_yaml(agent_yaml, yaml_file.name)
            if validation_errors:
                all_errors.extend(validation_errors)
                if strict:
                    continue

            # Get agent ID
            agent_id = agent_yaml.get('agent', {}).get('id', yaml_file.stem)
            agent_key = agent_id.replace('-', '_')

            # Check for duplicates
            if agent_key in seen_ids:
                error = f"Duplicate agent ID '{agent_id}' in {yaml_file.name} (first seen in {seen_ids[agent_key]})"
                if strict:
                    raise DuplicateAgentError(error)
                all_errors.append(error)
                continue

            seen_ids[agent_key] = yaml_file.name

            # Convert to CrewAI format
            crewai_config = convert_to_crewai_format(agent_yaml)
            agents_config[agent_key] = crewai_config

        except (DuplicateAgentError, MissingFieldError):
            raise
        except Exception as e:
            error = f"Failed to load {yaml_file.name}: {e}"
            all_errors.append(error)
            if strict:
                raise AgentLoaderError(error)

    if strict and all_errors:
        raise MissingFieldError(f"Validation errors: {all_errors}")

    # Add backwards compatibility aliases
    ALIASES = {
        'keyword_analyst': 'keyword_architect',
        'competitor_analyst': 'market_analyst',
    }

    for old_name, new_name in ALIASES.items():
        if new_name in agents_config and old_name not in agents_config:
            agents_config[old_name] = agents_config[new_name]

    return agents_config


def get_agent_config(agent_id: str) -> Dict[str, Any]:
    """
    Get a single agent's CrewAI-compatible config.

    Args:
        agent_id: Agent ID (with dashes, e.g., 'market-analyst')

    Returns:
        CrewAI-compatible config dict
    """
    agents = load_agents_from_ssot()
    agent_key = agent_id.replace('-', '_')

    if agent_key not in agents:
        raise KeyError(f"Agent not found: {agent_id}. Available: {list(agents.keys())}")

    return agents[agent_key]


def generate_report(agents: Dict[str, Dict[str, Any]], output_path: Optional[Path] = None) -> str:
    """
    Generate a loading report.

    Args:
        agents: Loaded agents config
        output_path: Optional path to write report

    Returns:
        Report content as string
    """
    timestamp = datetime.now().isoformat()
    agents_dir = get_agents_dir()

    # Group by domain
    by_domain = {}
    for agent_id, config in agents.items():
        domain = config.get('_domain', 'unknown')
        if domain not in by_domain:
            by_domain[domain] = []
        by_domain[domain].append(agent_id)

    # Build report
    lines = [
        "# Agent Loader Report",
        "",
        f"**Generated**: {timestamp}",
        f"**Source Directory**: `{agents_dir}`",
        f"**Total Agents**: {len(agents)}",
        "",
        "## Agent List",
        "",
        "| ID | Role | Domain |",
        "|----|------|--------|",
    ]

    for agent_id, config in sorted(agents.items()):
        role = config.get('role', 'N/A')[:40]
        domain = config.get('_domain', 'N/A')
        lines.append(f"| {agent_id} | {role} | {domain} |")

    lines.extend([
        "",
        "## Statistics",
        "",
        f"- Native agents: {len(agents) - 2}",  # Subtract aliases
        f"- Compatibility aliases: 2",
        f"- Total (with aliases): {len(agents)}",
        "",
        "## By Domain",
        "",
    ])

    for domain, agent_ids in by_domain.items():
        lines.append(f"### {domain}")
        for aid in sorted(agent_ids):
            lines.append(f"- {aid}")
        lines.append("")

    report = "\n".join(lines)

    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(report)
        print(f"Report written to: {output_path}")

    return report


def load_agents() -> Dict[str, Dict[str, Any]]:
    """Backwards compatibility alias for load_agents_from_ssot()."""
    return load_agents_from_ssot()


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description='LiYe OS Agent Loader - SSOT from Agents/ directory',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python agent_loader.py --dry-run     # Validate only, no external calls
  python agent_loader.py --report      # Generate report to Artifacts_Vault
  python agent_loader.py --verbose     # Show detailed agent info
        """
    )

    parser.add_argument('--dry-run', action='store_true',
                       help='Validate agents without external API calls')
    parser.add_argument('--report', action='store_true',
                       help='Generate report to Artifacts_Vault/reports/')
    parser.add_argument('--verbose', '-v', action='store_true',
                       help='Show detailed output')
    parser.add_argument('--json', action='store_true',
                       help='Output as JSON')
    parser.add_argument('--strict', action='store_true', default=True,
                       help='Fail on validation errors (default: True)')

    args = parser.parse_args()

    try:
        print("=== LiYe OS Agent Loader ===\n")
        print(f"SSOT Directory: {get_agents_dir()}\n")

        # Load agents
        agents = load_agents_from_ssot(strict=args.strict)

        print(f"Loaded {len(agents)} agents from SSOT\n")

        if args.json:
            # Remove internal metadata for clean JSON output
            clean_agents = {}
            for k, v in agents.items():
                clean_agents[k] = {key: val for key, val in v.items() if not key.startswith('_')}
            print(json.dumps(clean_agents, indent=2, ensure_ascii=False))
        elif args.verbose:
            for agent_id, config in sorted(agents.items()):
                print(f"- {agent_id}:")
                print(f"    role: {config['role']}")
                print(f"    goal: {config['goal'][:60]}...")
                print(f"    domain: {config.get('_domain', 'N/A')}")
                print()
        else:
            print("Agents:")
            for agent_id in sorted(agents.keys()):
                role = agents[agent_id].get('role', 'N/A')
                print(f"  - {agent_id}: {role}")

        if args.report:
            repo_root = get_repo_root()
            report_path = repo_root / "Artifacts_Vault" / "reports" / f"AGENT_LOADER_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
            generate_report(agents, report_path)

        if args.dry_run:
            print("\n[DRY-RUN] Validation complete. No external calls made.")
            print(f"[DRY-RUN] Agent count: {len(agents)}")
            print(f"[DRY-RUN] Expected: {EXPECTED_AGENT_COUNT + 2} (with aliases)")

            if len(agents) != EXPECTED_AGENT_COUNT + 2:
                print(f"[WARNING] Agent count mismatch!")
                return 1

        print("\n✅ PASS")
        return 0

    except (DuplicateAgentError, MissingFieldError, AgentLoaderError) as e:
        print(f"\n❌ FAIL: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
