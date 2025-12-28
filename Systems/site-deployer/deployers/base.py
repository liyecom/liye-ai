"""Base deployer class for all deployment platforms."""

from abc import ABC, abstractmethod
from typing import Dict, Optional
import logging


class BaseDeployer(ABC):
    """Abstract base class for deployment platforms."""

    def __init__(self, config: Dict):
        """
        Initialize the deployer.

        Args:
            config: Configuration dictionary
        """
        self.config = config
        self.logger = logging.getLogger(self.__class__.__name__)

    @abstractmethod
    def deploy(self, site_config: Dict) -> Dict:
        """
        Deploy a site.

        Args:
            site_config: Site-specific configuration

        Returns:
            Dict containing deployment results with keys:
                - url: Deployed site URL
                - status: 'success' or 'failed'
                - message: Deployment message
                - deployment_id: Platform-specific deployment ID
        """
        pass

    @abstractmethod
    def get_deployment_status(self, deployment_id: str) -> Dict:
        """
        Check deployment status.

        Args:
            deployment_id: Platform-specific deployment ID

        Returns:
            Dict with status information
        """
        pass

    @abstractmethod
    def rollback(self, deployment_id: str) -> bool:
        """
        Rollback to a previous deployment.

        Args:
            deployment_id: Deployment to rollback to

        Returns:
            bool: True if rollback succeeded
        """
        pass

    def validate_config(self, site_config: Dict) -> bool:
        """
        Validate site configuration.

        Args:
            site_config: Site configuration to validate

        Returns:
            bool: True if configuration is valid
        """
        required_fields = ['name', 'source_path']
        for field in required_fields:
            if field not in site_config:
                self.logger.error(f"Missing required field: {field}")
                return False
        return True

    def build_site(self, site_config: Dict) -> bool:
        """
        Build the site locally before deployment.

        Args:
            site_config: Site configuration

        Returns:
            bool: True if build succeeded
        """
        import subprocess
        import os

        source_path = site_config['source_path']
        framework = site_config.get('framework', self.config.get('build', {}).get('framework', 'astro'))

        self.logger.info(f"Building site at {source_path}")

        try:
            # Install dependencies
            install_cmd = self.config.get('build', {}).get('install_command', 'npm install')
            subprocess.run(
                install_cmd,
                shell=True,
                cwd=source_path,
                check=True,
                capture_output=True,
                text=True
            )

            # Build
            build_cmd = self.config.get('build', {}).get('build_command', 'npm run build')
            result = subprocess.run(
                build_cmd,
                shell=True,
                cwd=source_path,
                check=True,
                capture_output=True,
                text=True
            )

            self.logger.info("Build successful")
            return True

        except subprocess.CalledProcessError as e:
            self.logger.error(f"Build failed: {e.stderr}")
            return False
