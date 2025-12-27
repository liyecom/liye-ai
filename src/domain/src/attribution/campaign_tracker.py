"""
Campaign Tracker - External Traffic Campaign Management.

Tracks campaign performance across multiple channels including
TikTok, Instagram, Email, Affiliates, and Influencers.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Any
from pathlib import Path
import yaml
import uuid


class CampaignStatus(Enum):
    """Campaign lifecycle status."""
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class CampaignType(Enum):
    """Types of campaigns."""
    INFLUENCER = "influencer"
    PAID_ADS = "paid_ads"
    ORGANIC = "organic"
    OWNED = "owned"  # Email, owned social
    EARNED = "earned"  # PR, guest posts
    PARTNER = "partner"  # Affiliates


@dataclass
class CampaignMetrics:
    """Metrics for a campaign or time period."""
    # Traffic metrics
    impressions: int = 0
    clicks: int = 0
    unique_clicks: int = 0
    reach: int = 0

    # Engagement metrics
    detail_page_views: int = 0
    add_to_carts: int = 0

    # Conversion metrics
    orders: int = 0
    units_sold: int = 0
    revenue: float = 0.0
    new_to_brand_orders: int = 0

    # Cost metrics
    ad_spend: float = 0.0
    influencer_fee: float = 0.0
    affiliate_commission: float = 0.0
    content_cost: float = 0.0
    other_cost: float = 0.0

    @property
    def total_cost(self) -> float:
        """Calculate total campaign cost."""
        return (
            self.ad_spend +
            self.influencer_fee +
            self.affiliate_commission +
            self.content_cost +
            self.other_cost
        )

    @property
    def ctr(self) -> float:
        """Click-through rate."""
        return self.clicks / self.impressions if self.impressions > 0 else 0.0

    @property
    def cvr(self) -> float:
        """Conversion rate."""
        return self.orders / self.clicks if self.clicks > 0 else 0.0

    @property
    def cpc(self) -> float:
        """Cost per click."""
        return self.total_cost / self.clicks if self.clicks > 0 else 0.0

    @property
    def cpa(self) -> float:
        """Cost per acquisition."""
        return self.total_cost / self.orders if self.orders > 0 else 0.0

    @property
    def roas(self) -> float:
        """Return on ad spend."""
        return self.revenue / self.total_cost if self.total_cost > 0 else 0.0

    @property
    def aov(self) -> float:
        """Average order value."""
        return self.revenue / self.orders if self.orders > 0 else 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            # Raw metrics
            'impressions': self.impressions,
            'clicks': self.clicks,
            'unique_clicks': self.unique_clicks,
            'reach': self.reach,
            'detail_page_views': self.detail_page_views,
            'add_to_carts': self.add_to_carts,
            'orders': self.orders,
            'units_sold': self.units_sold,
            'revenue': self.revenue,
            'new_to_brand_orders': self.new_to_brand_orders,
            # Costs
            'ad_spend': self.ad_spend,
            'influencer_fee': self.influencer_fee,
            'affiliate_commission': self.affiliate_commission,
            'content_cost': self.content_cost,
            'other_cost': self.other_cost,
            'total_cost': self.total_cost,
            # Calculated KPIs
            'ctr': self.ctr,
            'cvr': self.cvr,
            'cpc': self.cpc,
            'cpa': self.cpa,
            'roas': self.roas,
            'aov': self.aov
        }

    def merge(self, other: 'CampaignMetrics') -> 'CampaignMetrics':
        """Merge two metrics objects (for aggregation)."""
        return CampaignMetrics(
            impressions=self.impressions + other.impressions,
            clicks=self.clicks + other.clicks,
            unique_clicks=self.unique_clicks + other.unique_clicks,
            reach=self.reach + other.reach,
            detail_page_views=self.detail_page_views + other.detail_page_views,
            add_to_carts=self.add_to_carts + other.add_to_carts,
            orders=self.orders + other.orders,
            units_sold=self.units_sold + other.units_sold,
            revenue=self.revenue + other.revenue,
            new_to_brand_orders=self.new_to_brand_orders + other.new_to_brand_orders,
            ad_spend=self.ad_spend + other.ad_spend,
            influencer_fee=self.influencer_fee + other.influencer_fee,
            affiliate_commission=self.affiliate_commission + other.affiliate_commission,
            content_cost=self.content_cost + other.content_cost,
            other_cost=self.other_cost + other.other_cost
        )


@dataclass
class DailyMetrics:
    """Daily metrics snapshot."""
    date: datetime
    metrics: CampaignMetrics


@dataclass
class Campaign:
    """An external traffic campaign."""
    campaign_id: str
    name: str
    campaign_type: CampaignType
    publisher: str  # e.g., TikTok, Instagram, Email
    status: CampaignStatus = CampaignStatus.DRAFT

    # Target product
    asin: Optional[str] = None
    marketplace: str = "US"

    # Timing
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.now)

    # Budget
    budget: float = 0.0
    budget_spent: float = 0.0

    # Attribution tags associated with this campaign
    attribution_tag_ids: List[str] = field(default_factory=list)

    # Aggregated metrics
    total_metrics: CampaignMetrics = field(default_factory=CampaignMetrics)

    # Daily breakdown
    daily_metrics: List[DailyMetrics] = field(default_factory=list)

    # Metadata
    notes: str = ""
    influencer_ids: List[str] = field(default_factory=list)

    @property
    def is_active(self) -> bool:
        """Check if campaign is currently active."""
        return self.status == CampaignStatus.ACTIVE

    @property
    def days_running(self) -> int:
        """Days since campaign started."""
        if self.start_date:
            return (datetime.now() - self.start_date).days
        return 0

    @property
    def budget_remaining(self) -> float:
        """Remaining budget."""
        return max(0, self.budget - self.budget_spent)

    @property
    def budget_utilization(self) -> float:
        """Budget utilization percentage."""
        return self.budget_spent / self.budget if self.budget > 0 else 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'campaign_id': self.campaign_id,
            'name': self.name,
            'campaign_type': self.campaign_type.value,
            'publisher': self.publisher,
            'status': self.status.value,
            'asin': self.asin,
            'marketplace': self.marketplace,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'created_at': self.created_at.isoformat(),
            'budget': self.budget,
            'budget_spent': self.budget_spent,
            'budget_remaining': self.budget_remaining,
            'budget_utilization': self.budget_utilization,
            'days_running': self.days_running,
            'attribution_tag_ids': self.attribution_tag_ids,
            'total_metrics': self.total_metrics.to_dict(),
            'influencer_ids': self.influencer_ids,
            'notes': self.notes
        }


class CampaignTracker:
    """
    Track and manage external traffic campaigns.

    Features:
    - Create and manage campaigns across channels
    - Track daily metrics and costs
    - Aggregate performance data
    - Alert on budget and performance thresholds
    - Generate performance reports
    """

    def __init__(
        self,
        config_path: Optional[str] = None,
        db_path: Optional[str] = None
    ):
        """Initialize campaign tracker."""
        self.config = self._load_config(config_path)
        self.db_path = db_path
        self._db_conn = None
        self.campaigns: Dict[str, Campaign] = {}

        if self.db_path:
            self._init_database()

    def _load_config(self, config_path: Optional[str]) -> Dict:
        """Load configuration."""
        if config_path and Path(config_path).exists():
            with open(config_path, 'r') as f:
                return yaml.safe_load(f)
        return {}

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
            CREATE TABLE IF NOT EXISTS dim_attribution_campaigns (
                campaign_id VARCHAR PRIMARY KEY,
                name VARCHAR NOT NULL,
                campaign_type VARCHAR,
                publisher VARCHAR,
                status VARCHAR,
                asin VARCHAR,
                marketplace VARCHAR,
                start_date TIMESTAMP,
                end_date TIMESTAMP,
                created_at TIMESTAMP,
                budget DECIMAL(10,2),
                budget_spent DECIMAL(10,2),
                notes TEXT
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS fact_attribution_daily (
                id INTEGER PRIMARY KEY,
                campaign_id VARCHAR NOT NULL,
                date DATE NOT NULL,
                impressions INTEGER DEFAULT 0,
                clicks INTEGER DEFAULT 0,
                unique_clicks INTEGER DEFAULT 0,
                reach INTEGER DEFAULT 0,
                detail_page_views INTEGER DEFAULT 0,
                add_to_carts INTEGER DEFAULT 0,
                orders INTEGER DEFAULT 0,
                units_sold INTEGER DEFAULT 0,
                revenue DECIMAL(10,2) DEFAULT 0,
                new_to_brand_orders INTEGER DEFAULT 0,
                ad_spend DECIMAL(10,2) DEFAULT 0,
                influencer_fee DECIMAL(10,2) DEFAULT 0,
                affiliate_commission DECIMAL(10,2) DEFAULT 0,
                content_cost DECIMAL(10,2) DEFAULT 0,
                other_cost DECIMAL(10,2) DEFAULT 0,
                UNIQUE(campaign_id, date)
            )
        """)

    def _save_campaign(self, campaign: Campaign):
        """Save campaign to database."""
        conn = self._get_db_connection()
        if conn is None:
            return

        conn.execute("""
            INSERT OR REPLACE INTO dim_attribution_campaigns
            (campaign_id, name, campaign_type, publisher, status, asin,
             marketplace, start_date, end_date, created_at, budget, budget_spent, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            campaign.campaign_id,
            campaign.name,
            campaign.campaign_type.value,
            campaign.publisher,
            campaign.status.value,
            campaign.asin,
            campaign.marketplace,
            campaign.start_date,
            campaign.end_date,
            campaign.created_at,
            campaign.budget,
            campaign.budget_spent,
            campaign.notes
        ])

    def _save_daily_metrics(self, campaign_id: str, date: datetime, metrics: CampaignMetrics):
        """Save daily metrics to database."""
        conn = self._get_db_connection()
        if conn is None:
            return

        conn.execute("""
            INSERT OR REPLACE INTO fact_attribution_daily
            (campaign_id, date, impressions, clicks, unique_clicks, reach,
             detail_page_views, add_to_carts, orders, units_sold, revenue,
             new_to_brand_orders, ad_spend, influencer_fee, affiliate_commission,
             content_cost, other_cost)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            campaign_id,
            date.date(),
            metrics.impressions,
            metrics.clicks,
            metrics.unique_clicks,
            metrics.reach,
            metrics.detail_page_views,
            metrics.add_to_carts,
            metrics.orders,
            metrics.units_sold,
            metrics.revenue,
            metrics.new_to_brand_orders,
            metrics.ad_spend,
            metrics.influencer_fee,
            metrics.affiliate_commission,
            metrics.content_cost,
            metrics.other_cost
        ])

    def create_campaign(
        self,
        name: str,
        campaign_type: CampaignType,
        publisher: str,
        asin: Optional[str] = None,
        budget: float = 0.0,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        notes: str = ""
    ) -> Campaign:
        """Create a new campaign."""
        campaign_id = str(uuid.uuid4())[:8].upper()

        campaign = Campaign(
            campaign_id=campaign_id,
            name=name,
            campaign_type=campaign_type,
            publisher=publisher,
            asin=asin,
            budget=budget,
            start_date=start_date,
            end_date=end_date,
            notes=notes
        )

        self.campaigns[campaign_id] = campaign
        self._save_campaign(campaign)

        return campaign

    def start_campaign(self, campaign_id: str) -> bool:
        """Start a campaign."""
        if campaign_id not in self.campaigns:
            return False

        campaign = self.campaigns[campaign_id]
        if campaign.status not in [CampaignStatus.DRAFT, CampaignStatus.SCHEDULED]:
            return False

        campaign.status = CampaignStatus.ACTIVE
        campaign.start_date = datetime.now()
        self._save_campaign(campaign)

        return True

    def pause_campaign(self, campaign_id: str) -> bool:
        """Pause a campaign."""
        if campaign_id not in self.campaigns:
            return False

        campaign = self.campaigns[campaign_id]
        if campaign.status != CampaignStatus.ACTIVE:
            return False

        campaign.status = CampaignStatus.PAUSED
        self._save_campaign(campaign)

        return True

    def complete_campaign(self, campaign_id: str) -> bool:
        """Mark campaign as completed."""
        if campaign_id not in self.campaigns:
            return False

        campaign = self.campaigns[campaign_id]
        campaign.status = CampaignStatus.COMPLETED
        campaign.end_date = datetime.now()
        self._save_campaign(campaign)

        return True

    def record_metrics(
        self,
        campaign_id: str,
        metrics: CampaignMetrics,
        date: Optional[datetime] = None
    ):
        """Record metrics for a campaign."""
        if campaign_id not in self.campaigns:
            return

        campaign = self.campaigns[campaign_id]
        date = date or datetime.now()

        # Add to daily metrics
        daily = DailyMetrics(date=date, metrics=metrics)
        campaign.daily_metrics.append(daily)

        # Update total metrics
        campaign.total_metrics = campaign.total_metrics.merge(metrics)

        # Update budget spent
        campaign.budget_spent += metrics.total_cost

        # Save to database
        self._save_daily_metrics(campaign_id, date, metrics)
        self._save_campaign(campaign)

    def get_campaign(self, campaign_id: str) -> Optional[Campaign]:
        """Get campaign by ID."""
        return self.campaigns.get(campaign_id)

    def list_campaigns(
        self,
        status: Optional[CampaignStatus] = None,
        publisher: Optional[str] = None,
        campaign_type: Optional[CampaignType] = None
    ) -> List[Campaign]:
        """List campaigns with optional filters."""
        campaigns = list(self.campaigns.values())

        if status:
            campaigns = [c for c in campaigns if c.status == status]

        if publisher:
            campaigns = [c for c in campaigns if c.publisher == publisher]

        if campaign_type:
            campaigns = [c for c in campaigns if c.campaign_type == campaign_type]

        return sorted(campaigns, key=lambda x: x.created_at, reverse=True)

    def get_channel_summary(self) -> Dict[str, CampaignMetrics]:
        """Get aggregated metrics by channel/publisher."""
        summary: Dict[str, CampaignMetrics] = {}

        for campaign in self.campaigns.values():
            publisher = campaign.publisher
            if publisher not in summary:
                summary[publisher] = CampaignMetrics()
            summary[publisher] = summary[publisher].merge(campaign.total_metrics)

        return summary

    def get_campaign_type_summary(self) -> Dict[str, CampaignMetrics]:
        """Get aggregated metrics by campaign type."""
        summary: Dict[str, CampaignMetrics] = {}

        for campaign in self.campaigns.values():
            ctype = campaign.campaign_type.value
            if ctype not in summary:
                summary[ctype] = CampaignMetrics()
            summary[ctype] = summary[ctype].merge(campaign.total_metrics)

        return summary

    def check_alerts(self, campaign_id: str) -> List[Dict[str, Any]]:
        """Check for alert conditions on a campaign."""
        campaign = self.get_campaign(campaign_id)
        if not campaign:
            return []

        alerts = []
        config = self.config.get('reporting', {}).get('alerts', [])

        metrics = campaign.total_metrics

        # Budget alerts
        if campaign.budget > 0:
            if campaign.budget_remaining < metrics.total_cost * 2:
                alerts.append({
                    'type': 'budget_depleted',
                    'severity': 'warning',
                    'message': f"Budget nearly depleted: ${campaign.budget_remaining:.2f} remaining"
                })

        # Performance alerts
        if metrics.clicks > 100:  # Minimum data
            if metrics.roas < 1.0 and metrics.total_cost > 50:
                alerts.append({
                    'type': 'low_roas',
                    'severity': 'critical',
                    'message': f"Low ROAS: {metrics.roas:.2f}x (spent ${metrics.total_cost:.2f})"
                })

            expected_cvr = self.config.get('campaign_types', {}).get(
                campaign.campaign_type.value, {}
            ).get('expected_conversion_rate', 0.02)

            if metrics.cvr < expected_cvr * 0.5:
                alerts.append({
                    'type': 'low_conversion',
                    'severity': 'warning',
                    'message': f"CVR {metrics.cvr*100:.2f}% below expected {expected_cvr*100:.1f}%"
                })

        return alerts

    def generate_report(self, campaign_id: Optional[str] = None) -> str:
        """Generate a performance report."""
        lines = [
            "=" * 60,
            "EXTERNAL TRAFFIC ATTRIBUTION REPORT",
            "=" * 60,
            "",
            f"Report Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            ""
        ]

        if campaign_id:
            # Single campaign report
            campaign = self.get_campaign(campaign_id)
            if not campaign:
                return "Campaign not found."

            lines.extend(self._campaign_report_section(campaign))
        else:
            # Summary report
            lines.append("## Overview")
            lines.append("")
            lines.append(f"- Total Campaigns: {len(self.campaigns)}")
            active = len([c for c in self.campaigns.values() if c.is_active])
            lines.append(f"- Active Campaigns: {active}")
            lines.append("")

            # Channel summary
            lines.append("## Performance by Channel")
            lines.append("")
            lines.append("| Channel | Clicks | Orders | Revenue | Cost | ROAS |")
            lines.append("|---------|--------|--------|---------|------|------|")

            for channel, metrics in self.get_channel_summary().items():
                lines.append(
                    f"| {channel} | {metrics.clicks:,} | {metrics.orders} | "
                    f"${metrics.revenue:,.2f} | ${metrics.total_cost:,.2f} | "
                    f"{metrics.roas:.2f}x |"
                )

            lines.append("")

            # Campaign type summary
            lines.append("## Performance by Campaign Type")
            lines.append("")
            lines.append("| Type | Clicks | Orders | Revenue | ROAS |")
            lines.append("|------|--------|--------|---------|------|")

            for ctype, metrics in self.get_campaign_type_summary().items():
                lines.append(
                    f"| {ctype.title()} | {metrics.clicks:,} | {metrics.orders} | "
                    f"${metrics.revenue:,.2f} | {metrics.roas:.2f}x |"
                )

            lines.append("")

            # Individual campaigns
            lines.append("## Campaign Details")
            lines.append("")

            for campaign in self.list_campaigns():
                lines.extend(self._campaign_summary_row(campaign))

        lines.append("")
        lines.append("=" * 60)

        return "\n".join(lines)

    def _campaign_report_section(self, campaign: Campaign) -> List[str]:
        """Generate detailed report section for a campaign."""
        lines = [
            f"## Campaign: {campaign.name}",
            "",
            f"- **ID**: {campaign.campaign_id}",
            f"- **Type**: {campaign.campaign_type.value}",
            f"- **Publisher**: {campaign.publisher}",
            f"- **Status**: {campaign.status.value}",
            f"- **Days Running**: {campaign.days_running}",
            ""
        ]

        if campaign.asin:
            lines.append(f"- **ASIN**: {campaign.asin}")

        # Budget
        lines.extend([
            "",
            "### Budget",
            f"- Total: ${campaign.budget:,.2f}",
            f"- Spent: ${campaign.budget_spent:,.2f}",
            f"- Remaining: ${campaign.budget_remaining:,.2f}",
            f"- Utilization: {campaign.budget_utilization*100:.1f}%",
            ""
        ])

        # Performance metrics
        metrics = campaign.total_metrics
        lines.extend([
            "### Performance Metrics",
            "",
            "| Metric | Value |",
            "|--------|-------|",
            f"| Impressions | {metrics.impressions:,} |",
            f"| Clicks | {metrics.clicks:,} |",
            f"| CTR | {metrics.ctr*100:.2f}% |",
            f"| Detail Page Views | {metrics.detail_page_views:,} |",
            f"| Add to Carts | {metrics.add_to_carts:,} |",
            f"| Orders | {metrics.orders} |",
            f"| CVR | {metrics.cvr*100:.2f}% |",
            f"| Revenue | ${metrics.revenue:,.2f} |",
            f"| AOV | ${metrics.aov:.2f} |",
            "",
            "### Cost & ROI",
            "",
            f"| Metric | Value |",
            f"|--------|-------|",
            f"| Total Cost | ${metrics.total_cost:,.2f} |",
            f"| CPC | ${metrics.cpc:.2f} |",
            f"| CPA | ${metrics.cpa:.2f} |",
            f"| ROAS | {metrics.roas:.2f}x |",
            ""
        ])

        # Alerts
        alerts = self.check_alerts(campaign.campaign_id)
        if alerts:
            lines.append("### Alerts")
            lines.append("")
            for alert in alerts:
                icon = "🔴" if alert['severity'] == 'critical' else "⚠️"
                lines.append(f"- {icon} {alert['message']}")
            lines.append("")

        return lines

    def _campaign_summary_row(self, campaign: Campaign) -> List[str]:
        """Generate summary row for a campaign."""
        metrics = campaign.total_metrics
        status_icon = "🟢" if campaign.is_active else "⚪"

        return [
            f"### {status_icon} {campaign.name}",
            f"- Publisher: {campaign.publisher} | Type: {campaign.campaign_type.value}",
            f"- Clicks: {metrics.clicks:,} | Orders: {metrics.orders} | "
            f"Revenue: ${metrics.revenue:,.2f} | ROAS: {metrics.roas:.2f}x",
            ""
        ]
