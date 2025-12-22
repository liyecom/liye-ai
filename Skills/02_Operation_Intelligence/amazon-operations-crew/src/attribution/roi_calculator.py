"""
ROI Calculator - External Traffic Return on Investment Analysis.

Provides comprehensive ROI analysis, channel comparison,
and budget optimization recommendations.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from pathlib import Path
import yaml

from .campaign_tracker import CampaignTracker, Campaign, CampaignMetrics, CampaignType


@dataclass
class ChannelROI:
    """ROI analysis for a single channel."""
    channel: str
    channel_type: str  # social, email, affiliate, etc.

    # Investment
    total_investment: float = 0.0
    ad_spend: float = 0.0
    influencer_cost: float = 0.0
    content_cost: float = 0.0
    other_cost: float = 0.0

    # Returns
    revenue: float = 0.0
    orders: int = 0
    new_customers: int = 0

    # Traffic
    clicks: int = 0
    impressions: int = 0

    # Calculated metrics
    @property
    def roi(self) -> float:
        """Return on Investment (profit / cost)."""
        if self.total_investment == 0:
            return 0.0
        profit = self.revenue - self.total_investment
        return profit / self.total_investment

    @property
    def roas(self) -> float:
        """Return on Ad Spend."""
        return self.revenue / self.total_investment if self.total_investment > 0 else 0.0

    @property
    def cpa(self) -> float:
        """Cost per Acquisition."""
        return self.total_investment / self.orders if self.orders > 0 else 0.0

    @property
    def cpc(self) -> float:
        """Cost per Click."""
        return self.total_investment / self.clicks if self.clicks > 0 else 0.0

    @property
    def cvr(self) -> float:
        """Conversion Rate."""
        return self.orders / self.clicks if self.clicks > 0 else 0.0

    @property
    def aov(self) -> float:
        """Average Order Value."""
        return self.revenue / self.orders if self.orders > 0 else 0.0

    @property
    def customer_acquisition_cost(self) -> float:
        """Cost to acquire new customer."""
        return self.total_investment / self.new_customers if self.new_customers > 0 else 0.0

    @property
    def profit(self) -> float:
        """Net profit."""
        return self.revenue - self.total_investment

    @property
    def profit_margin(self) -> float:
        """Profit margin percentage."""
        return self.profit / self.revenue if self.revenue > 0 else 0.0

    @property
    def efficiency_score(self) -> float:
        """
        Composite efficiency score (0-100).
        Considers ROAS, CVR, and volume.
        """
        # Normalize metrics
        roas_score = min(100, self.roas * 25)  # ROAS 4x = 100 points
        cvr_score = min(100, self.cvr * 2000)  # CVR 5% = 100 points
        volume_score = min(100, self.orders * 2)  # 50 orders = 100 points

        # Weighted average
        return 0.5 * roas_score + 0.3 * cvr_score + 0.2 * volume_score

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'channel': self.channel,
            'channel_type': self.channel_type,
            'total_investment': self.total_investment,
            'revenue': self.revenue,
            'orders': self.orders,
            'new_customers': self.new_customers,
            'clicks': self.clicks,
            'impressions': self.impressions,
            'roi': self.roi,
            'roas': self.roas,
            'cpa': self.cpa,
            'cpc': self.cpc,
            'cvr': self.cvr,
            'aov': self.aov,
            'profit': self.profit,
            'profit_margin': self.profit_margin,
            'efficiency_score': self.efficiency_score
        }


@dataclass
class BudgetRecommendation:
    """Budget allocation recommendation."""
    channel: str
    current_budget: float
    recommended_budget: float
    change_amount: float
    change_percent: float
    reason: str
    priority: int  # 1 = highest priority
    expected_roas: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'channel': self.channel,
            'current_budget': self.current_budget,
            'recommended_budget': self.recommended_budget,
            'change_amount': self.change_amount,
            'change_percent': self.change_percent,
            'reason': self.reason,
            'priority': self.priority,
            'expected_roas': self.expected_roas
        }


class ROICalculator:
    """
    Calculate and analyze ROI across external traffic channels.

    Features:
    - Channel-by-channel ROI analysis
    - Campaign type comparison
    - Budget optimization recommendations
    - Trend analysis
    - Forecasting
    """

    def __init__(
        self,
        config_path: Optional[str] = None,
        campaign_tracker: Optional[CampaignTracker] = None
    ):
        """Initialize ROI calculator."""
        self.config = self._load_config(config_path)
        self.tracker = campaign_tracker

        # ROI thresholds from config
        roi_config = self.config.get('roi_calculation', {}).get('thresholds', {})
        self.thresholds = {
            'excellent': roi_config.get('excellent', 3.0),
            'good': roi_config.get('good', 2.0),
            'acceptable': roi_config.get('acceptable', 1.5),
            'poor': roi_config.get('poor', 1.0)
        }

    def _load_config(self, config_path: Optional[str]) -> Dict:
        """Load configuration."""
        if config_path and Path(config_path).exists():
            with open(config_path, 'r') as f:
                return yaml.safe_load(f)
        return {}

    def calculate_channel_roi(
        self,
        campaigns: List[Campaign]
    ) -> Dict[str, ChannelROI]:
        """
        Calculate ROI for each channel.

        Args:
            campaigns: List of campaigns to analyze

        Returns:
            Dictionary of channel name to ChannelROI
        """
        channel_data: Dict[str, ChannelROI] = {}

        for campaign in campaigns:
            channel = campaign.publisher
            metrics = campaign.total_metrics

            if channel not in channel_data:
                channel_data[channel] = ChannelROI(
                    channel=channel,
                    channel_type=self._get_channel_type(channel)
                )

            roi = channel_data[channel]

            # Aggregate investment
            roi.total_investment += metrics.total_cost
            roi.ad_spend += metrics.ad_spend
            roi.influencer_cost += metrics.influencer_fee
            roi.content_cost += metrics.content_cost
            roi.other_cost += metrics.other_cost + metrics.affiliate_commission

            # Aggregate returns
            roi.revenue += metrics.revenue
            roi.orders += metrics.orders
            roi.new_customers += metrics.new_to_brand_orders

            # Aggregate traffic
            roi.clicks += metrics.clicks
            roi.impressions += metrics.impressions

        return channel_data

    def calculate_campaign_type_roi(
        self,
        campaigns: List[Campaign]
    ) -> Dict[str, ChannelROI]:
        """Calculate ROI by campaign type."""
        type_data: Dict[str, ChannelROI] = {}

        for campaign in campaigns:
            ctype = campaign.campaign_type.value
            metrics = campaign.total_metrics

            if ctype not in type_data:
                type_data[ctype] = ChannelROI(
                    channel=ctype,
                    channel_type='campaign_type'
                )

            roi = type_data[ctype]

            roi.total_investment += metrics.total_cost
            roi.ad_spend += metrics.ad_spend
            roi.influencer_cost += metrics.influencer_fee
            roi.revenue += metrics.revenue
            roi.orders += metrics.orders
            roi.new_customers += metrics.new_to_brand_orders
            roi.clicks += metrics.clicks
            roi.impressions += metrics.impressions

        return type_data

    def _get_channel_type(self, channel: str) -> str:
        """Determine channel type from name."""
        channel_lower = channel.lower()

        if any(x in channel_lower for x in ['tiktok', 'instagram', 'facebook', 'pinterest', 'twitter']):
            return 'social'
        elif 'email' in channel_lower:
            return 'email'
        elif 'affiliate' in channel_lower:
            return 'affiliate'
        elif 'influencer' in channel_lower:
            return 'influencer'
        elif any(x in channel_lower for x in ['blog', 'content', 'seo']):
            return 'content'
        elif 'youtube' in channel_lower:
            return 'video'
        elif 'podcast' in channel_lower:
            return 'audio'
        else:
            return 'other'

    def rate_performance(self, roas: float) -> str:
        """Rate performance based on ROAS."""
        if roas >= self.thresholds['excellent']:
            return "Excellent"
        elif roas >= self.thresholds['good']:
            return "Good"
        elif roas >= self.thresholds['acceptable']:
            return "Acceptable"
        elif roas >= self.thresholds['poor']:
            return "Poor"
        else:
            return "Critical"

    def get_performance_icon(self, roas: float) -> str:
        """Get emoji icon for performance level."""
        if roas >= self.thresholds['excellent']:
            return "🟢"
        elif roas >= self.thresholds['good']:
            return "🔵"
        elif roas >= self.thresholds['acceptable']:
            return "🟡"
        elif roas >= self.thresholds['poor']:
            return "🟠"
        else:
            return "🔴"

    def generate_budget_recommendations(
        self,
        channel_roi: Dict[str, ChannelROI],
        total_budget: float,
        min_budget_per_channel: float = 100.0
    ) -> List[BudgetRecommendation]:
        """
        Generate budget reallocation recommendations.

        Args:
            channel_roi: Channel ROI data
            total_budget: Total budget to allocate
            min_budget_per_channel: Minimum budget per channel

        Returns:
            List of budget recommendations
        """
        recommendations = []

        # Sort channels by efficiency score
        sorted_channels = sorted(
            channel_roi.items(),
            key=lambda x: x[1].efficiency_score,
            reverse=True
        )

        # Calculate total current spend
        total_current = sum(roi.total_investment for _, roi in sorted_channels)
        if total_current == 0:
            total_current = total_budget

        # Allocate budget based on efficiency scores
        total_efficiency = sum(roi.efficiency_score for _, roi in sorted_channels)
        if total_efficiency == 0:
            total_efficiency = len(sorted_channels)  # Equal allocation fallback

        for priority, (channel, roi) in enumerate(sorted_channels, 1):
            # Current allocation
            current = roi.total_investment
            current_share = current / total_current if total_current > 0 else 0

            # Recommended allocation based on efficiency
            efficiency_share = roi.efficiency_score / total_efficiency
            recommended = max(min_budget_per_channel, total_budget * efficiency_share)

            # Change calculation
            change = recommended - current
            change_pct = change / current if current > 0 else (1.0 if change > 0 else 0.0)

            # Generate reason
            if roi.roas >= self.thresholds['excellent']:
                reason = f"Top performer: {roi.roas:.1f}x ROAS, {roi.cvr*100:.1f}% CVR. Scale up."
            elif roi.roas >= self.thresholds['good']:
                reason = f"Good performance: {roi.roas:.1f}x ROAS. Consider gradual increase."
            elif roi.roas >= self.thresholds['acceptable']:
                reason = f"Moderate performance: {roi.roas:.1f}x ROAS. Optimize before scaling."
            elif roi.roas >= self.thresholds['poor']:
                reason = f"Below target: {roi.roas:.1f}x ROAS. Reduce spend, focus on optimization."
            else:
                reason = f"Poor performance: {roi.roas:.1f}x ROAS. Pause or significantly reduce."

            recommendations.append(BudgetRecommendation(
                channel=channel,
                current_budget=current,
                recommended_budget=round(recommended, 2),
                change_amount=round(change, 2),
                change_percent=round(change_pct, 4),
                reason=reason,
                priority=priority,
                expected_roas=roi.roas
            ))

        return recommendations

    def calculate_aggregate_roi(
        self,
        campaigns: List[Campaign]
    ) -> ChannelROI:
        """Calculate aggregate ROI across all campaigns."""
        aggregate = ChannelROI(
            channel="All Channels",
            channel_type="aggregate"
        )

        for campaign in campaigns:
            metrics = campaign.total_metrics

            aggregate.total_investment += metrics.total_cost
            aggregate.ad_spend += metrics.ad_spend
            aggregate.influencer_cost += metrics.influencer_fee
            aggregate.content_cost += metrics.content_cost
            aggregate.other_cost += metrics.other_cost + metrics.affiliate_commission

            aggregate.revenue += metrics.revenue
            aggregate.orders += metrics.orders
            aggregate.new_customers += metrics.new_to_brand_orders
            aggregate.clicks += metrics.clicks
            aggregate.impressions += metrics.impressions

        return aggregate

    def generate_roi_report(
        self,
        campaigns: List[Campaign],
        total_budget: Optional[float] = None
    ) -> str:
        """Generate comprehensive ROI analysis report."""
        lines = [
            "=" * 70,
            "EXTERNAL TRAFFIC ROI ANALYSIS REPORT",
            "=" * 70,
            "",
            f"Report Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            f"Campaigns Analyzed: {len(campaigns)}",
            ""
        ]

        # Aggregate summary
        aggregate = self.calculate_aggregate_roi(campaigns)
        lines.extend([
            "## Overall Performance Summary",
            "",
            f"| Metric | Value |",
            f"|--------|-------|",
            f"| Total Investment | ${aggregate.total_investment:,.2f} |",
            f"| Total Revenue | ${aggregate.revenue:,.2f} |",
            f"| Total Orders | {aggregate.orders:,} |",
            f"| Net Profit | ${aggregate.profit:,.2f} |",
            f"| Overall ROAS | {aggregate.roas:.2f}x {self.get_performance_icon(aggregate.roas)} |",
            f"| Overall ROI | {aggregate.roi*100:.1f}% |",
            f"| Average CPA | ${aggregate.cpa:.2f} |",
            f"| Average AOV | ${aggregate.aov:.2f} |",
            ""
        ])

        # Channel performance
        channel_roi = self.calculate_channel_roi(campaigns)
        lines.extend([
            "## Channel Performance Comparison",
            "",
            "| Channel | Investment | Revenue | Orders | ROAS | CVR | Rating |",
            "|---------|------------|---------|--------|------|-----|--------|"
        ])

        for channel, roi in sorted(
            channel_roi.items(),
            key=lambda x: x[1].roas,
            reverse=True
        ):
            rating = self.rate_performance(roi.roas)
            icon = self.get_performance_icon(roi.roas)
            lines.append(
                f"| {channel} | ${roi.total_investment:,.0f} | ${roi.revenue:,.0f} | "
                f"{roi.orders} | {roi.roas:.2f}x | {roi.cvr*100:.1f}% | {icon} {rating} |"
            )

        lines.append("")

        # Campaign type performance
        type_roi = self.calculate_campaign_type_roi(campaigns)
        lines.extend([
            "## Performance by Campaign Type",
            "",
            "| Type | Investment | Revenue | ROAS | CPA | Efficiency |",
            "|------|------------|---------|------|-----|------------|"
        ])

        for ctype, roi in sorted(
            type_roi.items(),
            key=lambda x: x[1].efficiency_score,
            reverse=True
        ):
            lines.append(
                f"| {ctype.title()} | ${roi.total_investment:,.0f} | ${roi.revenue:,.0f} | "
                f"{roi.roas:.2f}x | ${roi.cpa:.2f} | {roi.efficiency_score:.0f}/100 |"
            )

        lines.append("")

        # Budget recommendations
        if total_budget:
            recommendations = self.generate_budget_recommendations(
                channel_roi, total_budget
            )

            lines.extend([
                f"## Budget Reallocation Recommendations",
                f"(Based on ${total_budget:,.2f} total budget)",
                "",
                "| Priority | Channel | Current | Recommended | Change | Reason |",
                "|----------|---------|---------|-------------|--------|--------|"
            ])

            for rec in recommendations:
                change_str = f"+${rec.change_amount:,.0f}" if rec.change_amount > 0 else f"-${abs(rec.change_amount):,.0f}"
                lines.append(
                    f"| {rec.priority} | {rec.channel} | ${rec.current_budget:,.0f} | "
                    f"${rec.recommended_budget:,.0f} | {change_str} | {rec.reason[:40]}... |"
                )

            lines.append("")

        # Key insights
        lines.extend([
            "## Key Insights",
            ""
        ])

        # Find best and worst performers
        if channel_roi:
            best = max(channel_roi.items(), key=lambda x: x[1].roas)
            worst = min(channel_roi.items(), key=lambda x: x[1].roas if x[1].roas > 0 else float('inf'))

            lines.append(f"🏆 **Best Performer**: {best[0]} with {best[1].roas:.2f}x ROAS")
            if worst[1].roas < self.thresholds['acceptable']:
                lines.append(f"⚠️ **Needs Attention**: {worst[0]} with {worst[1].roas:.2f}x ROAS")

            # New customer acquisition
            total_new = sum(roi.new_customers for roi in channel_roi.values())
            if total_new > 0:
                best_new = max(channel_roi.items(), key=lambda x: x[1].new_customers)
                lines.append(f"🆕 **Top for New Customers**: {best_new[0]} ({best_new[1].new_customers} new)")

            # Efficiency leader
            best_eff = max(channel_roi.items(), key=lambda x: x[1].efficiency_score)
            lines.append(f"⚡ **Most Efficient**: {best_eff[0]} (score: {best_eff[1].efficiency_score:.0f}/100)")

        lines.extend([
            "",
            "## Recommendations",
            ""
        ])

        # Generate actionable recommendations
        recommendations_text = self._generate_recommendations(channel_roi, aggregate)
        for rec in recommendations_text:
            lines.append(f"- {rec}")

        lines.extend(["", "=" * 70])

        return "\n".join(lines)

    def _generate_recommendations(
        self,
        channel_roi: Dict[str, ChannelROI],
        aggregate: ChannelROI
    ) -> List[str]:
        """Generate actionable recommendations."""
        recs = []

        # Overall health
        if aggregate.roas >= self.thresholds['excellent']:
            recs.append("✅ Overall external traffic performance is excellent. Consider scaling budget.")
        elif aggregate.roas >= self.thresholds['good']:
            recs.append("✅ Overall performance is good. Focus on optimizing underperformers.")
        elif aggregate.roas >= self.thresholds['acceptable']:
            recs.append("⚠️ Performance is acceptable but below target. Review channel mix.")
        else:
            recs.append("🔴 Performance is below acceptable. Urgent optimization needed.")

        # Channel-specific recommendations
        for channel, roi in channel_roi.items():
            if roi.roas >= self.thresholds['excellent'] and roi.total_investment < aggregate.total_investment * 0.3:
                recs.append(f"📈 {channel}: Excellent ROAS ({roi.roas:.1f}x) with low budget share. Scale up.")

            if roi.roas < self.thresholds['poor'] and roi.total_investment > 0:
                recs.append(f"📉 {channel}: Poor ROAS ({roi.roas:.1f}x). Pause and diagnose before continuing.")

            if roi.cvr < 0.01 and roi.clicks > 100:
                recs.append(f"🎯 {channel}: Low conversion ({roi.cvr*100:.2f}%). Improve landing page or targeting.")

        # Diversification
        if len(channel_roi) < 3:
            recs.append("🔄 Consider diversifying: fewer than 3 active channels detected.")

        return recs
