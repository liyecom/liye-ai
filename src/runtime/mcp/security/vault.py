"""
MCP Credential Vault
====================

Secure credential storage for MCP servers.

This module provides:
- Environment variable-first credential retrieval
- Encrypted file-based fallback storage
- Credential lifecycle management

Priority Order:
1. Environment variables (e.g., SELLERSPRITE_API_KEY)
2. Encrypted vault file (~/.liye/mcp_vault.encrypted)
3. Error if not found

See: docs/architecture/MCP_SPEC.md §7.1
"""

import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional
import base64
import hashlib

logger = logging.getLogger(__name__)


class MCPVault:
    """
    Secure credential storage for MCP servers.

    Credentials are retrieved in priority order:
    1. Environment variables
    2. Encrypted vault file
    3. Error

    Environment Variable Naming:
        Server credentials use the pattern:
        {SERVER_NAME}_{KEY} (uppercase, hyphens to underscores)

        Examples:
        - sellersprite.api_key -> SELLERSPRITE_API_KEY
        - qdrant-knowledge.url -> QDRANT_KNOWLEDGE_URL

    Usage:
        vault = MCPVault()

        # Get credential (checks env first, then vault)
        api_key = vault.get_credential("sellersprite", "api_key")

        # Store credential (to vault file)
        vault.set_credential("sellersprite", "api_key", "sk-xxx")

        # Save vault to disk
        vault.save()
    """

    DEFAULT_VAULT_PATH = Path.home() / ".liye" / "mcp_vault.encrypted"

    def __init__(
        self,
        vault_path: Optional[Path] = None,
        master_key: Optional[str] = None,
        env_prefix: bool = True
    ):
        """
        Initialize the vault.

        Args:
            vault_path: Path to vault file (default: ~/.liye/mcp_vault.encrypted)
            master_key: Encryption key (default: from MCP_VAULT_KEY env var)
            env_prefix: Whether to check environment variables first
        """
        self._vault_path = vault_path or self.DEFAULT_VAULT_PATH
        self._master_key = master_key or os.environ.get("MCP_VAULT_KEY")
        self._env_prefix = env_prefix

        # In-memory credential cache
        self._cache: Dict[str, Dict[str, str]] = {}

        # Load existing vault if available
        self._load_vault()

    def _get_env_var_name(self, server_name: str, key: str) -> str:
        """
        Convert server name and key to environment variable name.

        Examples:
            sellersprite, api_key -> SELLERSPRITE_API_KEY
            qdrant-knowledge, url -> QDRANT_KNOWLEDGE_URL
        """
        server_part = server_name.upper().replace("-", "_")
        key_part = key.upper().replace("-", "_")
        return f"{server_part}_{key_part}"

    def get_credential(
        self,
        server_name: str,
        key: str,
        default: Optional[str] = None
    ) -> Optional[str]:
        """
        Get a credential value.

        Checks in order:
        1. Environment variable
        2. Vault cache
        3. Default value

        Args:
            server_name: MCP server name (e.g., "sellersprite")
            key: Credential key (e.g., "api_key")
            default: Default value if not found

        Returns:
            Credential value or default
        """
        # 1. Check environment variable
        if self._env_prefix:
            env_name = self._get_env_var_name(server_name, key)
            env_value = os.environ.get(env_name)
            if env_value:
                logger.debug(f"Credential {server_name}/{key} from env: {env_name}")
                return env_value

        # 2. Check vault cache
        if server_name in self._cache:
            if key in self._cache[server_name]:
                logger.debug(f"Credential {server_name}/{key} from vault")
                return self._cache[server_name][key]

        # 3. Return default
        if default is not None:
            return default

        logger.warning(f"Credential not found: {server_name}/{key}")
        return None

    def get_credential_or_error(
        self,
        server_name: str,
        key: str
    ) -> str:
        """
        Get a credential value or raise error.

        Args:
            server_name: MCP server name
            key: Credential key

        Returns:
            Credential value

        Raises:
            CredentialNotFoundError: If credential is not found
        """
        value = self.get_credential(server_name, key)
        if value is None:
            env_name = self._get_env_var_name(server_name, key)
            raise CredentialNotFoundError(
                f"Credential '{key}' not found for server '{server_name}'. "
                f"Set environment variable {env_name} or add to vault."
            )
        return value

    def set_credential(
        self,
        server_name: str,
        key: str,
        value: str
    ) -> None:
        """
        Store a credential in the vault.

        Note: This only updates the in-memory cache.
        Call save() to persist to disk.

        Args:
            server_name: MCP server name
            key: Credential key
            value: Credential value
        """
        if server_name not in self._cache:
            self._cache[server_name] = {}

        self._cache[server_name][key] = value
        logger.debug(f"Set credential: {server_name}/{key}")

    def delete_credential(
        self,
        server_name: str,
        key: Optional[str] = None
    ) -> None:
        """
        Delete a credential or all credentials for a server.

        Args:
            server_name: MCP server name
            key: Credential key (if None, deletes all for server)
        """
        if server_name not in self._cache:
            return

        if key is None:
            del self._cache[server_name]
            logger.info(f"Deleted all credentials for: {server_name}")
        elif key in self._cache[server_name]:
            del self._cache[server_name][key]
            logger.info(f"Deleted credential: {server_name}/{key}")

    def list_servers(self) -> list:
        """List all servers with stored credentials."""
        return list(self._cache.keys())

    def list_credentials(self, server_name: str) -> list:
        """List all credential keys for a server."""
        if server_name not in self._cache:
            return []
        return list(self._cache[server_name].keys())

    def _load_vault(self) -> None:
        """Load vault from disk."""
        if not self._vault_path.exists():
            logger.debug("No vault file found, starting fresh")
            return

        try:
            with open(self._vault_path, "rb") as f:
                encrypted_data = f.read()

            if self._master_key:
                # Decrypt
                data = self._decrypt(encrypted_data)
                self._cache = json.loads(data)
            else:
                # No encryption key - try reading as plain JSON
                # (for development/testing only)
                try:
                    self._cache = json.loads(encrypted_data.decode("utf-8"))
                    logger.warning("Vault loaded without encryption (development mode)")
                except:
                    logger.warning("Vault exists but cannot decrypt (no MCP_VAULT_KEY)")

            logger.info(f"Loaded vault with {len(self._cache)} servers")

        except Exception as e:
            logger.error(f"Failed to load vault: {e}")

    def save(self) -> None:
        """Save vault to disk."""
        # Ensure directory exists
        self._vault_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            data = json.dumps(self._cache, indent=2)

            if self._master_key:
                # Encrypt
                encrypted_data = self._encrypt(data)
                with open(self._vault_path, "wb") as f:
                    f.write(encrypted_data)
            else:
                # No encryption key - save as plain JSON
                # (for development/testing only)
                with open(self._vault_path, "w") as f:
                    f.write(data)
                logger.warning("Vault saved without encryption (development mode)")

            logger.info(f"Saved vault to {self._vault_path}")

        except Exception as e:
            logger.error(f"Failed to save vault: {e}")
            raise

    def _encrypt(self, data: str) -> bytes:
        """
        Encrypt data using master key.

        Uses simple XOR encryption for portability.
        For production, consider using cryptography library.
        """
        if not self._master_key:
            return data.encode("utf-8")

        # Derive key from master key
        key = hashlib.sha256(self._master_key.encode()).digest()

        # XOR encrypt
        data_bytes = data.encode("utf-8")
        encrypted = bytes(
            b ^ key[i % len(key)]
            for i, b in enumerate(data_bytes)
        )

        # Base64 encode for storage
        return base64.b64encode(encrypted)

    def _decrypt(self, encrypted_data: bytes) -> str:
        """Decrypt data using master key."""
        if not self._master_key:
            return encrypted_data.decode("utf-8")

        # Derive key from master key
        key = hashlib.sha256(self._master_key.encode()).digest()

        # Base64 decode
        encrypted = base64.b64decode(encrypted_data)

        # XOR decrypt
        decrypted = bytes(
            b ^ key[i % len(key)]
            for i, b in enumerate(encrypted)
        )

        return decrypted.decode("utf-8")


class CredentialNotFoundError(Exception):
    """Raised when a required credential is not found."""
    pass


# Global vault instance (lazy initialization)
_global_vault: Optional[MCPVault] = None


def get_vault() -> MCPVault:
    """Get or create the global vault instance."""
    global _global_vault
    if _global_vault is None:
        _global_vault = MCPVault()
    return _global_vault


def get_credential(server_name: str, key: str, default: Optional[str] = None) -> Optional[str]:
    """Convenience function to get credential from global vault."""
    return get_vault().get_credential(server_name, key, default)
