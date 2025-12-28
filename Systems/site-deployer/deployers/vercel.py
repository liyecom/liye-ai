"""Vercel deployment platform implementation."""

import os
import subprocess
from typing import Dict, Optional
import httpx
from .base import BaseDeployer


class VercelDeployer(BaseDeployer):
    """Deployer for Vercel platform."""

    def __init__(self, config: Dict):
        """
        Initialize Vercel deployer.

        Args:
            config: Configuration dictionary
        """
        super().__init__(config)
        self.api_token = os.getenv('VERCEL_TOKEN')
        if not self.api_token:
            raise ValueError("VERCEL_TOKEN environment variable is required")

        self.api_base_url = 'https://api.vercel.com'
        self.client = httpx.Client(
            base_url=self.api_base_url,
            headers={
                'Authorization': f'Bearer {self.api_token}',
                'Content-Type': 'application/json'
            },
            timeout=self.config.get('deployment', {}).get('timeout', 600)
        )

    def deploy(self, site_config: Dict) -> Dict:
        """
        Deploy a site to Vercel.

        Args:
            site_config: Site configuration

        Returns:
            Dict with deployment results
        """
        if not self.validate_config(site_config):
            return {
                'status': 'failed',
                'message': 'Invalid configuration',
                'url': None,
                'deployment_id': None
            }

        # Build the site locally
        if not self.build_site(site_config):
            return {
                'status': 'failed',
                'message': 'Build failed',
                'url': None,
                'deployment_id': None
            }

        # Deploy to Vercel using CLI
        try:
            result = self._deploy_with_cli(site_config)
            return result
        except Exception as e:
            self.logger.error(f"Deployment failed: {str(e)}")
            return {
                'status': 'failed',
                'message': str(e),
                'url': None,
                'deployment_id': None
            }

    def _deploy_with_cli(self, site_config: Dict) -> Dict:
        """
        Deploy using Vercel CLI.

        Args:
            site_config: Site configuration

        Returns:
            Dict with deployment results
        """
        source_path = site_config['source_path']
        name = site_config['name']

        self.logger.info(f"Deploying {name} to Vercel...")

        # Deploy to production
        cmd = f"vercel deploy --prod --yes --token={self.api_token}"

        if 'domain' in site_config:
            # Vercel will use the domain from project settings
            self.logger.info(f"Deploying to custom domain: {site_config['domain']}")

        result = subprocess.run(
            cmd,
            shell=True,
            cwd=source_path,
            capture_output=True,
            text=True
        )

        if result.returncode != 0:
            raise Exception(f"Vercel deployment failed: {result.stderr}")

        # Extract URL from output
        url = result.stdout.strip().split('\n')[-1].strip()

        self.logger.info(f"Deployment successful: {url}")

        return {
            'status': 'success',
            'message': 'Deployment completed',
            'url': url,
            'deployment_id': url.split('/')[-1] if '/' in url else url
        }

    def get_project_id(self, project_name: str) -> Optional[str]:
        """
        Get Vercel project ID by name.

        Args:
            project_name: Name of the project

        Returns:
            Project ID or None if not found
        """
        try:
            response = self.client.get('/v9/projects')
            response.raise_for_status()
            projects = response.json().get('projects', [])

            for project in projects:
                if project['name'] == project_name:
                    return project['id']

            return None
        except Exception as e:
            self.logger.error(f"Failed to get project ID: {str(e)}")
            return None

    def add_environment_variable(self, project_id: str, key: str, value: str) -> bool:
        """
        Add an environment variable to a Vercel project.

        Args:
            project_id: Vercel project ID
            key: Environment variable key
            value: Environment variable value

        Returns:
            bool: True if successful
        """
        try:
            response = self.client.post(
                f'/v10/projects/{project_id}/env',
                json={
                    'key': key,
                    'value': value,
                    'type': 'encrypted',
                    'target': ['production', 'preview', 'development']
                }
            )
            response.raise_for_status()
            self.logger.info(f"Added environment variable: {key}")
            return True
        except Exception as e:
            self.logger.error(f"Failed to add environment variable: {str(e)}")
            return False

    def get_deployment_status(self, deployment_id: str) -> Dict:
        """
        Check deployment status on Vercel.

        Args:
            deployment_id: Vercel deployment ID

        Returns:
            Dict with status information
        """
        try:
            response = self.client.get(f'/v13/deployments/{deployment_id}')
            response.raise_for_status()
            data = response.json()

            return {
                'status': data.get('readyState', 'UNKNOWN'),
                'url': data.get('url', ''),
                'created_at': data.get('createdAt', ''),
            }
        except Exception as e:
            self.logger.error(f"Failed to get deployment status: {str(e)}")
            return {'status': 'ERROR', 'message': str(e)}

    def rollback(self, deployment_id: str) -> bool:
        """
        Rollback to a previous deployment.

        Note: Vercel doesn't have a direct rollback API.
        You need to redeploy the previous version.

        Args:
            deployment_id: Deployment to rollback to

        Returns:
            bool: True if rollback succeeded
        """
        self.logger.warning("Vercel rollback requires redeployment of previous version")
        return False

    def __del__(self):
        """Clean up HTTP client."""
        if hasattr(self, 'client'):
            self.client.close()
