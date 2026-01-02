"""
Policy Registry

Loads and manages policy definitions from YAML files.

WARNING: Registry is READ-ONLY at runtime.
         Policies are loaded once during initialization.
         No runtime writes are permitted (Self-Protecting).
"""

import os
from pathlib import Path
from typing import List, Optional

import yaml

from .models import Policy, PolicySeverity
from .exceptions import PolicyRegistryError, PolicyValidationError


class PolicyRegistry:
    """
    Policy Registry - loads and provides access to policy definitions.

    Thread-safe, immutable after initialization.

    WARNING: Registry is READ-ONLY. Modification at runtime is prohibited.
             This is a self-protecting mechanism.
    """

    # Default path to policy YAML files
    DEFAULT_POLICY_DIR = Path(__file__).parent / "policies"

    def __init__(self, policy_dir: Optional[Path] = None):
        """
        Initialize the registry and load policies.

        Args:
            policy_dir: Path to directory containing policy YAML files.
                       Defaults to src/runtime/policy/policies/
        """
        self._policy_dir = policy_dir or self.DEFAULT_POLICY_DIR
        self._policies: List[Policy] = []
        self._policy_map: dict = {}
        self._loaded = False

    def load_policies(self) -> List[Policy]:
        """
        Load all policies from the policy directory.

        Returns:
            List of loaded Policy objects

        Raises:
            PolicyRegistryError: If loading fails
            PolicyValidationError: If any policy is invalid
        """
        if self._loaded:
            return self._policies

        if not self._policy_dir.exists():
            raise PolicyRegistryError(f"Policy directory not found: {self._policy_dir}")

        policy_files = list(self._policy_dir.glob("POL_*.yaml"))

        if not policy_files:
            raise PolicyRegistryError(f"No policy files found in: {self._policy_dir}")

        policies = []
        seen_ids = set()

        for policy_file in sorted(policy_files):
            try:
                policy = self._load_policy_file(policy_file)

                # Validate unique ID
                if policy.id in seen_ids:
                    raise PolicyValidationError(
                        f"Duplicate policy ID: {policy.id}",
                        policy_id=policy.id
                    )

                seen_ids.add(policy.id)
                policies.append(policy)
                self._policy_map[policy.id] = policy

            except yaml.YAMLError as e:
                raise PolicyRegistryError(f"Failed to parse {policy_file}: {e}")
            except Exception as e:
                if isinstance(e, (PolicyRegistryError, PolicyValidationError)):
                    raise
                raise PolicyRegistryError(f"Failed to load {policy_file}: {e}")

        self._policies = policies
        self._loaded = True

        return self._policies

    def _load_policy_file(self, policy_file: Path) -> Policy:
        """
        Load a single policy from a YAML file.

        Args:
            policy_file: Path to the YAML file

        Returns:
            Policy object

        Raises:
            PolicyValidationError: If the policy is invalid
        """
        with open(policy_file, "r", encoding="utf-8") as f:
            content = f.read()

        if not content.strip():
            raise PolicyValidationError(
                f"Policy file is empty: {policy_file.name}",
                policy_id=policy_file.stem
            )

        data = yaml.safe_load(content)

        if not isinstance(data, dict):
            raise PolicyValidationError(
                f"Policy must be a YAML mapping: {policy_file.name}",
                policy_id=policy_file.stem
            )

        # Validate required fields
        required_fields = ["id", "name", "description", "severity", "conditions"]
        missing = [f for f in required_fields if f not in data]
        if missing:
            raise PolicyValidationError(
                f"Missing required fields: {missing}",
                policy_id=data.get("id", policy_file.stem)
            )

        # Parse severity
        try:
            severity = PolicySeverity(data["severity"])
        except ValueError:
            raise PolicyValidationError(
                f"Invalid severity: {data['severity']}. Must be 'allow' or 'deny'",
                policy_id=data["id"]
            )

        return Policy(
            id=data["id"],
            name=data["name"],
            description=data["description"],
            severity=severity,
            conditions=data["conditions"]
        )

    def get_all(self) -> List[Policy]:
        """
        Get all loaded policies.

        Returns:
            List of Policy objects

        Raises:
            PolicyRegistryError: If policies haven't been loaded
        """
        if not self._loaded:
            self.load_policies()
        return self._policies.copy()  # Return copy to prevent modification

    def get_by_id(self, policy_id: str) -> Optional[Policy]:
        """
        Get a specific policy by ID.

        Args:
            policy_id: The policy ID (e.g., "POL_001")

        Returns:
            Policy object or None if not found
        """
        if not self._loaded:
            self.load_policies()
        return self._policy_map.get(policy_id)

    def __len__(self) -> int:
        """Return the number of loaded policies."""
        if not self._loaded:
            self.load_policies()
        return len(self._policies)

    def __iter__(self):
        """Iterate over policies."""
        if not self._loaded:
            self.load_policies()
        return iter(self._policies)
