"""
Attribution Link Generator.

Generates Amazon Attribution tags and tracking URLs for external
traffic campaigns across various channels.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Any
from urllib.parse import urlencode, urlparse, parse_qs
from pathlib import Path
import yaml
import uuid
import hashlib


@dataclass
class Publisher:
    """A traffic source/publisher."""
    id: str
    name: str
    type: str  # social, email, content, affiliate, influencer, pr, audio, other
    default_campaign_type: str


@dataclass
class UTMParams:
    """UTM tracking parameters."""
    source: str  # e.g., tiktok, instagram
    medium: str  # e.g., social, email, cpc
    campaign: str  # e.g., summer_sale_2025
    content: Optional[str] = None  # e.g., video1, carousel2
    term: Optional[str] = None  # e.g., keyword
    influencer_id: Optional[str] = None
    creative_id: Optional[str] = None
    placement: Optional[str] = None

    def to_dict(self) -> Dict[str, str]:
        """Convert to URL parameters dictionary."""
        params = {
            'utm_source': self.source,
            'utm_medium': self.medium,
            'utm_campaign': self.campaign
        }
        if self.content:
            params['utm_content'] = self.content
        if self.term:
            params['utm_term'] = self.term
        if self.influencer_id:
            params['inf_id'] = self.influencer_id
        if self.creative_id:
            params['cr_id'] = self.creative_id
        if self.placement:
            params['placement'] = self.placement
        return params


@dataclass
class AttributionTag:
    """An Amazon Attribution tag."""
    tag_id: str
    name: str
    publisher: Publisher
    campaign_name: str
    asin: Optional[str] = None
    amazon_url: str = ""
    tracking_url: str = ""
    utm_params: Optional[UTMParams] = None
    created_at: datetime = field(default_factory=datetime.now)
    notes: str = ""

    # Amazon Attribution specific fields
    amazon_attribution_tag: Optional[str] = None  # The actual Amazon tag string
    click_url: str = ""  # Amazon click tracking URL

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'tag_id': self.tag_id,
            'name': self.name,
            'publisher_id': self.publisher.id,
            'publisher_name': self.publisher.name,
            'campaign_name': self.campaign_name,
            'asin': self.asin,
            'amazon_url': self.amazon_url,
            'tracking_url': self.tracking_url,
            'utm_params': self.utm_params.to_dict() if self.utm_params else None,
            'created_at': self.created_at.isoformat(),
            'notes': self.notes,
            'amazon_attribution_tag': self.amazon_attribution_tag,
            'click_url': self.click_url
        }


class AttributionLinkGenerator:
    """
    Generate Amazon Attribution links and tracking URLs.

    Features:
    - Generate unique attribution tags for each campaign/publisher
    - Build tracking URLs with UTM parameters
    - Support multiple Amazon marketplaces
    - Batch link generation for influencer campaigns
    - Export to CSV/spreadsheet format
    """

    # Amazon marketplace domains
    MARKETPLACES = {
        'US': 'amazon.com',
        'CA': 'amazon.ca',
        'UK': 'amazon.co.uk',
        'DE': 'amazon.de',
        'FR': 'amazon.fr',
        'IT': 'amazon.it',
        'ES': 'amazon.es',
        'JP': 'amazon.co.jp',
        'AU': 'amazon.com.au',
        'MX': 'amazon.com.mx'
    }

    def __init__(
        self,
        config_path: Optional[str] = None,
        brand_prefix: str = "TIMO",
        db_path: Optional[str] = None
    ):
        """Initialize link generator."""
        self.config = self._load_config(config_path)
        self.brand_prefix = brand_prefix
        self.db_path = db_path
        self._db_conn = None

        # Load publishers from config
        self.publishers = self._load_publishers()
        self.tags: Dict[str, AttributionTag] = {}

        if self.db_path:
            self._init_database()

    def _load_config(self, config_path: Optional[str]) -> Dict:
        """Load configuration."""
        if config_path and Path(config_path).exists():
            with open(config_path, 'r') as f:
                return yaml.safe_load(f)
        return {}

    def _load_publishers(self) -> Dict[str, Publisher]:
        """Load publishers from configuration."""
        publishers = {}
        tag_settings = self.config.get('amazon_attribution', {}).get('tag_settings', {})

        for pub_config in tag_settings.get('publishers', []):
            publisher = Publisher(
                id=pub_config.get('id'),
                name=pub_config.get('name'),
                type=pub_config.get('type'),
                default_campaign_type=pub_config.get('default_campaign_type')
            )
            publishers[publisher.id] = publisher

        # Add default publishers if none configured
        if not publishers:
            default_publishers = [
                Publisher('social_tiktok', 'TikTok', 'social', 'influencer'),
                Publisher('social_instagram', 'Instagram', 'social', 'influencer'),
                Publisher('social_facebook', 'Facebook', 'social', 'paid_ads'),
                Publisher('email_newsletter', 'Email Newsletter', 'email', 'owned'),
                Publisher('affiliate', 'Affiliate', 'affiliate', 'partner'),
                Publisher('influencer', 'Influencer', 'influencer', 'paid'),
            ]
            for pub in default_publishers:
                publishers[pub.id] = pub

        return publishers

    def _get_db_connection(self):
        """Get DuckDB connection."""
        if self._db_conn is None and self.db_path:
            try:
                import duckdb
                self._db_conn = duckdb.connect(self.db_path)
            except ImportError:
                pass
        return self._db_conn

    def _init_database(self):
        """Initialize database tables."""
        conn = self._get_db_connection()
        if conn is None:
            return

        conn.execute("""
            CREATE TABLE IF NOT EXISTS dim_attribution_tags (
                tag_id VARCHAR PRIMARY KEY,
                name VARCHAR NOT NULL,
                publisher_id VARCHAR NOT NULL,
                publisher_name VARCHAR,
                campaign_name VARCHAR,
                asin VARCHAR,
                amazon_url TEXT,
                tracking_url TEXT,
                utm_source VARCHAR,
                utm_medium VARCHAR,
                utm_campaign VARCHAR,
                utm_content VARCHAR,
                created_at TIMESTAMP,
                notes TEXT,
                amazon_attribution_tag VARCHAR,
                click_url TEXT
            )
        """)

    def _save_tag(self, tag: AttributionTag):
        """Save tag to database."""
        conn = self._get_db_connection()
        if conn is None:
            return

        utm = tag.utm_params
        conn.execute("""
            INSERT OR REPLACE INTO dim_attribution_tags
            (tag_id, name, publisher_id, publisher_name, campaign_name, asin,
             amazon_url, tracking_url, utm_source, utm_medium, utm_campaign,
             utm_content, created_at, notes, amazon_attribution_tag, click_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            tag.tag_id,
            tag.name,
            tag.publisher.id,
            tag.publisher.name,
            tag.campaign_name,
            tag.asin,
            tag.amazon_url,
            tag.tracking_url,
            utm.source if utm else None,
            utm.medium if utm else None,
            utm.campaign if utm else None,
            utm.content if utm else None,
            tag.created_at,
            tag.notes,
            tag.amazon_attribution_tag,
            tag.click_url
        ])

    def get_publisher(self, publisher_id: str) -> Optional[Publisher]:
        """Get publisher by ID."""
        return self.publishers.get(publisher_id)

    def list_publishers(self) -> List[Publisher]:
        """List all available publishers."""
        return list(self.publishers.values())

    def generate_tag_id(self, campaign_name: str, publisher_id: str) -> str:
        """Generate a unique tag ID."""
        # Create a short hash from campaign + publisher + timestamp
        raw = f"{campaign_name}_{publisher_id}_{datetime.now().isoformat()}"
        hash_str = hashlib.md5(raw.encode()).hexdigest()[:8]
        return f"{self.brand_prefix}_{hash_str}".upper()

    def build_amazon_url(
        self,
        asin: str,
        marketplace: str = 'US',
        keywords: Optional[str] = None
    ) -> str:
        """
        Build Amazon product URL.

        Args:
            asin: Amazon ASIN
            marketplace: Marketplace code (US, UK, DE, etc.)
            keywords: Optional search keywords for affiliate-style URL
        """
        domain = self.MARKETPLACES.get(marketplace, 'amazon.com')

        if keywords:
            # Keyword-based URL (better for some affiliate programs)
            encoded_keywords = keywords.replace(' ', '+')
            return f"https://www.{domain}/s?k={encoded_keywords}"
        else:
            # Direct product URL
            return f"https://www.{domain}/dp/{asin}"

    def build_tracking_url(
        self,
        base_url: str,
        utm_params: UTMParams,
        amazon_tag: Optional[str] = None
    ) -> str:
        """
        Build complete tracking URL with UTM parameters.

        Args:
            base_url: The Amazon product URL
            utm_params: UTM tracking parameters
            amazon_tag: Optional Amazon Attribution tag to append
        """
        # Parse existing URL
        parsed = urlparse(base_url)
        existing_params = parse_qs(parsed.query)

        # Add UTM parameters
        all_params = {k: v[0] if isinstance(v, list) else v for k, v in existing_params.items()}
        all_params.update(utm_params.to_dict())

        # Add Amazon Attribution tag if provided
        if amazon_tag:
            all_params['maas'] = amazon_tag

        # Reconstruct URL
        query_string = urlencode(all_params)
        tracking_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
        if query_string:
            tracking_url += f"?{query_string}"

        return tracking_url

    def create_attribution_tag(
        self,
        campaign_name: str,
        publisher_id: str,
        asin: Optional[str] = None,
        marketplace: str = 'US',
        utm_content: Optional[str] = None,
        influencer_id: Optional[str] = None,
        notes: str = ""
    ) -> AttributionTag:
        """
        Create a new attribution tag with tracking URL.

        Args:
            campaign_name: Name of the campaign
            publisher_id: ID of the publisher/channel
            asin: Optional ASIN to track
            marketplace: Amazon marketplace
            utm_content: Optional content identifier
            influencer_id: Optional influencer ID for tracking
            notes: Additional notes

        Returns:
            AttributionTag object with generated URLs
        """
        publisher = self.get_publisher(publisher_id)
        if not publisher:
            # Create a generic publisher
            publisher = Publisher(
                id=publisher_id,
                name=publisher_id.replace('_', ' ').title(),
                type='other',
                default_campaign_type='unknown'
            )

        # Generate tag ID
        tag_id = self.generate_tag_id(campaign_name, publisher_id)

        # Build UTM params
        utm_params = UTMParams(
            source=publisher.name.lower().replace(' ', '_'),
            medium=publisher.type,
            campaign=campaign_name.lower().replace(' ', '_'),
            content=utm_content,
            influencer_id=influencer_id
        )

        # Build Amazon URL
        amazon_url = ""
        if asin:
            amazon_url = self.build_amazon_url(asin, marketplace)

        # Build tracking URL
        tracking_url = ""
        if amazon_url:
            tracking_url = self.build_tracking_url(amazon_url, utm_params)

        # Create tag name
        tag_name = f"{self.brand_prefix}_{campaign_name}_{publisher.name}"
        if influencer_id:
            tag_name += f"_{influencer_id}"

        tag = AttributionTag(
            tag_id=tag_id,
            name=tag_name,
            publisher=publisher,
            campaign_name=campaign_name,
            asin=asin,
            amazon_url=amazon_url,
            tracking_url=tracking_url,
            utm_params=utm_params,
            notes=notes
        )

        # Store in memory
        self.tags[tag_id] = tag

        # Save to database
        self._save_tag(tag)

        return tag

    def create_influencer_batch(
        self,
        campaign_name: str,
        publisher_id: str,
        influencer_ids: List[str],
        asin: str,
        marketplace: str = 'US'
    ) -> List[AttributionTag]:
        """
        Create attribution tags for multiple influencers.

        Args:
            campaign_name: Campaign name
            publisher_id: Publisher/platform ID
            influencer_ids: List of influencer identifiers
            asin: Product ASIN
            marketplace: Amazon marketplace

        Returns:
            List of AttributionTag objects
        """
        tags = []
        for influencer_id in influencer_ids:
            tag = self.create_attribution_tag(
                campaign_name=campaign_name,
                publisher_id=publisher_id,
                asin=asin,
                marketplace=marketplace,
                influencer_id=influencer_id,
                notes=f"Influencer campaign - {influencer_id}"
            )
            tags.append(tag)
        return tags

    def get_tag(self, tag_id: str) -> Optional[AttributionTag]:
        """Get tag by ID."""
        return self.tags.get(tag_id)

    def list_tags(
        self,
        campaign_name: Optional[str] = None,
        publisher_id: Optional[str] = None
    ) -> List[AttributionTag]:
        """List tags with optional filters."""
        tags = list(self.tags.values())

        if campaign_name:
            tags = [t for t in tags if t.campaign_name == campaign_name]

        if publisher_id:
            tags = [t for t in tags if t.publisher.id == publisher_id]

        return sorted(tags, key=lambda x: x.created_at, reverse=True)

    def export_to_csv(self, tags: List[AttributionTag]) -> str:
        """Export tags to CSV format."""
        lines = [
            "Tag ID,Name,Publisher,Campaign,ASIN,Tracking URL,UTM Source,UTM Medium,UTM Campaign,Created At"
        ]

        for tag in tags:
            utm = tag.utm_params
            lines.append(
                f"{tag.tag_id},"
                f"\"{tag.name}\","
                f"{tag.publisher.name},"
                f"{tag.campaign_name},"
                f"{tag.asin or ''},"
                f"\"{tag.tracking_url}\","
                f"{utm.source if utm else ''},"
                f"{utm.medium if utm else ''},"
                f"{utm.campaign if utm else ''},"
                f"{tag.created_at.strftime('%Y-%m-%d %H:%M')}"
            )

        return "\n".join(lines)

    def export_for_influencers(self, tags: List[AttributionTag]) -> str:
        """
        Export tags in a format suitable for sharing with influencers.

        Returns markdown formatted text with just the essential info.
        """
        lines = [
            "# Attribution Links for Influencer Campaign",
            "",
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            "",
            "## Your Unique Tracking Links",
            "",
            "Please use ONLY your assigned link when promoting this product.",
            "",
            "| Influencer | Tracking Link |",
            "|------------|---------------|"
        ]

        for tag in tags:
            influencer = tag.utm_params.influencer_id if tag.utm_params else tag.tag_id
            lines.append(f"| {influencer} | {tag.tracking_url} |")

        lines.extend([
            "",
            "---",
            "",
            "**Important Notes:**",
            "- Use this exact link in your bio, swipe-up, or post",
            "- Do not modify or shorten the URL",
            "- All clicks and purchases will be tracked to your account",
            ""
        ])

        return "\n".join(lines)

    def generate_report(self) -> str:
        """Generate a summary report of all attribution tags."""
        lines = [
            "=" * 60,
            "ATTRIBUTION TAG SUMMARY REPORT",
            "=" * 60,
            "",
            f"**Total Tags Created**: {len(self.tags)}",
            f"**Report Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            ""
        ]

        # Group by campaign
        campaigns: Dict[str, List[AttributionTag]] = {}
        for tag in self.tags.values():
            if tag.campaign_name not in campaigns:
                campaigns[tag.campaign_name] = []
            campaigns[tag.campaign_name].append(tag)

        lines.append("## Campaigns")
        lines.append("")

        for campaign_name, campaign_tags in campaigns.items():
            lines.append(f"### {campaign_name}")
            lines.append(f"- Tags: {len(campaign_tags)}")

            # Group by publisher
            publishers: Dict[str, int] = {}
            for tag in campaign_tags:
                pub_name = tag.publisher.name
                publishers[pub_name] = publishers.get(pub_name, 0) + 1

            lines.append("- Publishers:")
            for pub, count in publishers.items():
                lines.append(f"  - {pub}: {count} tags")
            lines.append("")

        # List all publishers used
        lines.append("## Publishers Used")
        lines.append("")
        publisher_counts: Dict[str, int] = {}
        for tag in self.tags.values():
            pub = tag.publisher.name
            publisher_counts[pub] = publisher_counts.get(pub, 0) + 1

        for pub, count in sorted(publisher_counts.items(), key=lambda x: -x[1]):
            lines.append(f"- {pub}: {count} tags")

        lines.append("")
        lines.append("=" * 60)

        return "\n".join(lines)
