"""Umami Analytics integration."""

import os
import logging
from typing import Dict, Optional
import httpx


class UmamiIntegration:
    """Handle Umami analytics integration."""

    def __init__(self, config: Dict):
        """
        Initialize Umami integration.

        Args:
            config: Configuration dictionary
        """
        self.config = config
        self.logger = logging.getLogger(self.__class__.__name__)

        umami_config = config.get('umami', {})
        self.api_url = umami_config.get('api_url', 'https://umami-iota-blush.vercel.app')
        self.enabled = umami_config.get('enabled', True)

        # Get credentials from environment
        self.username = os.getenv('UMAMI_USERNAME', 'admin')
        self.password = os.getenv('UMAMI_PASSWORD')

        self.client = httpx.Client(base_url=self.api_url, timeout=30)
        self.token = None

    def login(self) -> bool:
        """
        Login to Umami and get auth token.

        Returns:
            bool: True if login successful
        """
        if not self.password:
            self.logger.warning("UMAMI_PASSWORD not set, skipping login")
            return False

        try:
            response = self.client.post(
                '/api/auth/login',
                json={
                    'username': self.username,
                    'password': self.password
                }
            )
            response.raise_for_status()
            data = response.json()
            self.token = data.get('token')

            if self.token:
                # Update client headers with auth token
                self.client.headers.update({
                    'Authorization': f'Bearer {self.token}'
                })
                self.logger.info("Successfully logged in to Umami")
                return True

            return False
        except Exception as e:
            self.logger.error(f"Failed to login to Umami: {str(e)}")
            return False

    def create_website(self, name: str, domain: str, team_id: Optional[str] = None) -> Optional[str]:
        """
        Create a new website in Umami.

        Args:
            name: Website name
            domain: Website domain
            team_id: Optional team ID

        Returns:
            Website ID if successful, None otherwise
        """
        if not self.enabled:
            self.logger.info("Umami integration disabled")
            return None

        # Login if not already authenticated
        if not self.token:
            if not self.login():
                self.logger.warning("Could not authenticate with Umami, skipping website creation")
                return None

        try:
            payload = {
                'name': name,
                'domain': domain
            }

            if team_id:
                payload['teamId'] = team_id

            response = self.client.post('/api/websites', json=payload)
            response.raise_for_status()
            data = response.json()

            website_id = data.get('id')
            self.logger.info(f"Created Umami website: {name} (ID: {website_id})")
            return website_id
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 400:
                # Website might already exist
                self.logger.warning(f"Website {domain} might already exist in Umami")
                # Try to find existing website
                return self.find_website_by_domain(domain)
            else:
                self.logger.error(f"Failed to create Umami website: {str(e)}")
                return None
        except Exception as e:
            self.logger.error(f"Failed to create Umami website: {str(e)}")
            return None

    def find_website_by_domain(self, domain: str) -> Optional[str]:
        """
        Find website ID by domain.

        Args:
            domain: Website domain

        Returns:
            Website ID if found, None otherwise
        """
        try:
            response = self.client.get('/api/websites')
            response.raise_for_status()
            websites = response.json().get('data', [])

            for website in websites:
                if website.get('domain') == domain:
                    return website.get('id')

            return None
        except Exception as e:
            self.logger.error(f"Failed to find website: {str(e)}")
            return None

    def get_tracking_code(self, website_id: str) -> Optional[str]:
        """
        Get tracking script code for a website.

        Args:
            website_id: Umami website ID

        Returns:
            Tracking script HTML or None
        """
        if not website_id:
            return None

        # Generate tracking script
        script = f'<script defer src="{self.api_url}/script.js" data-website-id="{website_id}"></script>'
        return script

    def inject_tracking_code(self, site_config: Dict, tracking_code: str) -> bool:
        """
        Inject Umami tracking code into site's base layout.

        Args:
            site_config: Site configuration
            tracking_code: Tracking script to inject

        Returns:
            bool: True if injection successful
        """
        if not self.config.get('umami', {}).get('auto_inject', True):
            self.logger.info("Auto-injection disabled")
            return False

        # For Astro sites, inject into src/layouts/BaseLayout.astro
        source_path = site_config['source_path']
        framework = site_config.get('framework', 'astro')

        if framework == 'astro':
            layout_file = os.path.join(source_path, 'src/layouts/BaseLayout.astro')

            if not os.path.exists(layout_file):
                self.logger.warning(f"Layout file not found: {layout_file}")
                return False

            try:
                with open(layout_file, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Check if tracking code already exists
                if 'umami' in content.lower() or tracking_code in content:
                    self.logger.info("Umami tracking code already present")
                    return True

                # Inject before </head>
                if '</head>' in content:
                    content = content.replace('</head>', f'    {tracking_code}\n  </head>')

                    with open(layout_file, 'w', encoding='utf-8') as f:
                        f.write(content)

                    self.logger.info("Successfully injected Umami tracking code")
                    return True
                else:
                    self.logger.warning("Could not find </head> tag in layout file")
                    return False
            except Exception as e:
                self.logger.error(f"Failed to inject tracking code: {str(e)}")
                return False
        else:
            self.logger.warning(f"Auto-injection not supported for framework: {framework}")
            return False

    def setup_for_site(self, site_config: Dict, deployed_url: str) -> Optional[str]:
        """
        Complete Umami setup for a site.

        Args:
            site_config: Site configuration
            deployed_url: URL where site is deployed

        Returns:
            Website ID if successful, None otherwise
        """
        if not self.enabled:
            return None

        # Check if website ID already in config
        website_id = site_config.get('analytics', {}).get('umami', {}).get('website_id')

        if website_id:
            self.logger.info(f"Using existing Umami website ID: {website_id}")
            return website_id

        # Create new website
        name = site_config.get('name', '')
        domain = site_config.get('domain', deployed_url)

        website_id = self.create_website(name, domain)

        if website_id:
            # Get tracking code
            tracking_code = self.get_tracking_code(website_id)

            if tracking_code:
                # Inject tracking code
                self.inject_tracking_code(site_config, tracking_code)

            return website_id

        return None

    def __del__(self):
        """Clean up HTTP client."""
        if hasattr(self, 'client'):
            self.client.close()
