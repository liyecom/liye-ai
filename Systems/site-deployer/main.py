#!/usr/bin/env python3
"""Site Deployer - Automated deployment system for station groups."""

import os
import sys
import argparse
import logging
from pathlib import Path
from typing import List, Dict
from concurrent.futures import ThreadPoolExecutor, as_completed
import yaml
from tqdm import tqdm

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from deployers.vercel import VercelDeployer
from integrations.umami import UmamiIntegration


class SiteDeployer:
    """Main deployment orchestrator."""

    def __init__(self, config_path: str = 'config/default.yaml'):
        """
        Initialize the deployer.

        Args:
            config_path: Path to configuration file
        """
        self.config = self._load_config(config_path)
        self._setup_logging()

        # Initialize deployer based on platform
        platform = self.config.get('deployment', {}).get('platform', 'vercel')

        if platform == 'vercel':
            self.deployer = VercelDeployer(self.config)
        else:
            raise ValueError(f"Unsupported platform: {platform}")

        # Initialize integrations
        self.umami = UmamiIntegration(self.config)

        self.logger.info(f"Initialized Site Deployer with platform: {platform}")

    def _load_config(self, config_path: str) -> Dict:
        """
        Load configuration from YAML file.

        Args:
            config_path: Path to config file

        Returns:
            Configuration dictionary
        """
        config_file = Path(__file__).parent / config_path

        if not config_file.exists():
            raise FileNotFoundError(f"Configuration file not found: {config_file}")

        with open(config_file, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)

    def _setup_logging(self):
        """Setup logging configuration."""
        log_config = self.config.get('logging', {})
        level = getattr(logging, log_config.get('level', 'INFO'))

        # Create logs directory if needed
        log_file = log_config.get('file', 'logs/site-deployer.log')
        log_path = Path(__file__).parent / log_file
        log_path.parent.mkdir(parents=True, exist_ok=True)

        # Configure logging
        handlers = []

        if log_config.get('console', True):
            handlers.append(logging.StreamHandler())

        if log_file:
            handlers.append(logging.FileHandler(log_path))

        logging.basicConfig(
            level=level,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=handlers
        )

        self.logger = logging.getLogger('SiteDeployer')

    def load_sites(self, sites_config_path: str) -> List[Dict]:
        """
        Load site configurations.

        Args:
            sites_config_path: Path to sites configuration file

        Returns:
            List of site configurations
        """
        sites_file = Path(__file__).parent / sites_config_path

        if not sites_file.exists():
            raise FileNotFoundError(f"Sites configuration file not found: {sites_file}")

        with open(sites_file, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
            return data.get('sites', [])

    def deploy_site(self, site_config: Dict) -> Dict:
        """
        Deploy a single site.

        Args:
            site_config: Site configuration

        Returns:
            Deployment result
        """
        site_name = site_config.get('name', 'unknown')
        self.logger.info(f"Starting deployment for: {site_name}")

        try:
            # Step 1: Deploy to platform
            result = self.deployer.deploy(site_config)

            if result['status'] != 'success':
                self.logger.error(f"Deployment failed for {site_name}: {result['message']}")
                return result

            deployed_url = result['url']
            self.logger.info(f"Deployment successful: {deployed_url}")

            # Step 2: Setup Umami analytics
            if site_config.get('analytics', {}).get('umami', {}).get('enabled', True):
                self.logger.info(f"Setting up Umami analytics for {site_name}")
                website_id = self.umami.setup_for_site(site_config, deployed_url)

                if website_id:
                    self.logger.info(f"Umami setup complete. Website ID: {website_id}")
                    result['umami_website_id'] = website_id
                else:
                    self.logger.warning("Umami setup failed or skipped")

            # Step 3: Submit sitemap (if configured)
            # TODO: Implement Google Search Console integration

            return result

        except Exception as e:
            self.logger.error(f"Deployment error for {site_name}: {str(e)}")
            return {
                'status': 'failed',
                'message': str(e),
                'url': None,
                'deployment_id': None
            }

    def deploy_batch(self, sites: List[Dict], max_workers: int = 5) -> Dict:
        """
        Deploy multiple sites in parallel.

        Args:
            sites: List of site configurations
            max_workers: Maximum number of parallel deployments

        Returns:
            Dict with overall results
        """
        self.logger.info(f"Starting batch deployment of {len(sites)} sites")

        results = {
            'total': len(sites),
            'successful': 0,
            'failed': 0,
            'details': []
        }

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all deployment tasks
            future_to_site = {
                executor.submit(self.deploy_site, site): site
                for site in sites
            }

            # Process completed deployments with progress bar
            with tqdm(total=len(sites), desc="Deploying sites") as pbar:
                for future in as_completed(future_to_site):
                    site = future_to_site[future]
                    site_name = site.get('name', 'unknown')

                    try:
                        result = future.result()
                        result['site_name'] = site_name

                        if result['status'] == 'success':
                            results['successful'] += 1
                            pbar.set_postfix_str(f"✓ {site_name}")
                        else:
                            results['failed'] += 1
                            pbar.set_postfix_str(f"✗ {site_name}")

                        results['details'].append(result)
                    except Exception as e:
                        self.logger.error(f"Exception processing {site_name}: {str(e)}")
                        results['failed'] += 1
                        results['details'].append({
                            'site_name': site_name,
                            'status': 'failed',
                            'message': str(e)
                        })

                    pbar.update(1)

        # Print summary
        self.logger.info("\n" + "=" * 60)
        self.logger.info("DEPLOYMENT SUMMARY")
        self.logger.info("=" * 60)
        self.logger.info(f"Total sites: {results['total']}")
        self.logger.info(f"Successful: {results['successful']}")
        self.logger.info(f"Failed: {results['failed']}")
        self.logger.info("=" * 60)

        return results


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Site Deployer - Automated deployment for station groups'
    )

    parser.add_argument(
        '--config',
        default='config/sites.yaml',
        help='Path to sites configuration file (default: config/sites.yaml)'
    )

    parser.add_argument(
        '--site',
        help='Deploy specific site by name'
    )

    parser.add_argument(
        '--workers',
        type=int,
        default=5,
        help='Number of parallel deployments (default: 5)'
    )

    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Validate configuration without deploying'
    )

    args = parser.parse_args()

    try:
        # Initialize deployer
        deployer = SiteDeployer()

        # Load site configurations
        sites = deployer.load_sites(args.config)

        if not sites:
            print("No sites configured for deployment")
            return 1

        # Filter for specific site if requested
        if args.site:
            sites = [s for s in sites if s.get('name') == args.site]
            if not sites:
                print(f"Site not found: {args.site}")
                return 1

        print(f"\nFound {len(sites)} site(s) to deploy:")
        for site in sites:
            print(f"  - {site.get('name')} ({site.get('domain', 'no domain')})")

        if args.dry_run:
            print("\nDry run mode - no actual deployment will occur")
            return 0

        # Confirm deployment
        response = input("\nProceed with deployment? [y/N]: ")
        if response.lower() != 'y':
            print("Deployment cancelled")
            return 0

        # Deploy
        results = deployer.deploy_batch(sites, max_workers=args.workers)

        # Return exit code based on results
        return 0 if results['failed'] == 0 else 1

    except KeyboardInterrupt:
        print("\n\nDeployment interrupted by user")
        return 130
    except Exception as e:
        print(f"\nFatal error: {str(e)}")
        logging.exception("Fatal error occurred")
        return 1


if __name__ == '__main__':
    sys.exit(main())
