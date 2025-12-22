"""
Attribution Tool for CrewAI Agents.

Provides external traffic attribution capabilities to CrewAI agents
for managing campaigns and analyzing ROI.
"""

from typing import Dict, Optional, Any
import json

# CrewAI integration with fallback
try:
    from crewai.tools import BaseTool
except ImportError:
    class BaseTool:
        def __init__(self):
            pass


class AttributionTool(BaseTool):
    """
    Tool for managing external traffic attribution.

    Allows agents to:
    - Create attribution links for campaigns
    - Track campaign performance
    - Analyze ROI by channel
    - Get budget recommendations
    """

    name: str = "External Traffic Attribution"
    description: str = """
    Manage external traffic attribution for Amazon listings.

    Actions:
    - create_link: Create an attribution tracking link
    - create_campaign: Create a new campaign
    - record_metrics: Record campaign metrics
    - analyze_roi: Analyze ROI by channel
    - get_recommendations: Get budget recommendations

    Input format (JSON):
    {
        "action": "create_link|create_campaign|record_metrics|analyze_roi|get_recommendations",
        "params": {action-specific parameters}
    }
    """

    def __init__(
        self,
        config_path: Optional[str] = None,
        db_path: Optional[str] = None,
        brand_prefix: str = "TIMO"
    ):
        """Initialize attribution tool."""
        super().__init__()
        self.config_path = config_path
        self.db_path = db_path
        self.brand_prefix = brand_prefix
        self._link_generator = None
        self._campaign_tracker = None
        self._roi_calculator = None

    def _get_link_generator(self):
        """Lazy initialization of link generator."""
        if self._link_generator is None:
            from src.attribution.link_generator import AttributionLinkGenerator
            self._link_generator = AttributionLinkGenerator(
                config_path=self.config_path,
                brand_prefix=self.brand_prefix,
                db_path=self.db_path
            )
        return self._link_generator

    def _get_campaign_tracker(self):
        """Lazy initialization of campaign tracker."""
        if self._campaign_tracker is None:
            from src.attribution.campaign_tracker import CampaignTracker
            self._campaign_tracker = CampaignTracker(
                config_path=self.config_path,
                db_path=self.db_path
            )
        return self._campaign_tracker

    def _get_roi_calculator(self):
        """Lazy initialization of ROI calculator."""
        if self._roi_calculator is None:
            from src.attribution.roi_calculator import ROICalculator
            self._roi_calculator = ROICalculator(
                config_path=self.config_path,
                campaign_tracker=self._get_campaign_tracker()
            )
        return self._roi_calculator

    def _run(self, query: str) -> str:
        """Execute the tool with the given query."""
        try:
            if isinstance(query, str):
                try:
                    params = json.loads(query)
                except json.JSONDecodeError:
                    params = self._parse_text_query(query)
            else:
                params = query

            action = params.get('action', 'analyze_roi')
            action_params = params.get('params', {})

            if action == 'create_link':
                return self._create_link(action_params)
            elif action == 'create_campaign':
                return self._create_campaign(action_params)
            elif action == 'record_metrics':
                return self._record_metrics(action_params)
            elif action == 'analyze_roi':
                return self._analyze_roi(action_params)
            elif action == 'get_recommendations':
                return self._get_recommendations(action_params)
            elif action == 'list_publishers':
                return self._list_publishers()
            else:
                return f"Unknown action: {action}"

        except Exception as e:
            return f"Error: {str(e)}"

    def _parse_text_query(self, query: str) -> Dict:
        """Parse natural language query."""
        query_lower = query.lower()

        if 'link' in query_lower or 'url' in query_lower:
            return {'action': 'create_link'}
        elif 'campaign' in query_lower and 'create' in query_lower:
            return {'action': 'create_campaign'}
        elif 'roi' in query_lower or 'analysis' in query_lower:
            return {'action': 'analyze_roi'}
        elif 'budget' in query_lower or 'recommend' in query_lower:
            return {'action': 'get_recommendations'}
        elif 'publisher' in query_lower or 'channel' in query_lower:
            return {'action': 'list_publishers'}

        return {'action': 'analyze_roi'}

    def _create_link(self, params: Dict) -> str:
        """Create an attribution tracking link."""
        generator = self._get_link_generator()

        tag = generator.create_attribution_tag(
            campaign_name=params.get('campaign_name', 'default_campaign'),
            publisher_id=params.get('publisher_id', 'social_tiktok'),
            asin=params.get('asin'),
            marketplace=params.get('marketplace', 'US'),
            influencer_id=params.get('influencer_id'),
            notes=params.get('notes', '')
        )

        return f"""
## Attribution Link Created

**Tag ID**: {tag.tag_id}
**Campaign**: {tag.campaign_name}
**Publisher**: {tag.publisher.name}
**ASIN**: {tag.asin or 'N/A'}

### Tracking URL
```
{tag.tracking_url}
```

### UTM Parameters
- Source: {tag.utm_params.source if tag.utm_params else 'N/A'}
- Medium: {tag.utm_params.medium if tag.utm_params else 'N/A'}
- Campaign: {tag.utm_params.campaign if tag.utm_params else 'N/A'}

Share this URL with the influencer/publisher for tracking.
"""

    def _create_campaign(self, params: Dict) -> str:
        """Create a new campaign."""
        from src.attribution.campaign_tracker import CampaignType

        tracker = self._get_campaign_tracker()

        # Parse campaign type
        type_str = params.get('campaign_type', 'influencer').upper()
        try:
            campaign_type = CampaignType[type_str]
        except KeyError:
            campaign_type = CampaignType.INFLUENCER

        campaign = tracker.create_campaign(
            name=params.get('name', 'New Campaign'),
            campaign_type=campaign_type,
            publisher=params.get('publisher', 'TikTok'),
            asin=params.get('asin'),
            budget=params.get('budget', 0.0),
            notes=params.get('notes', '')
        )

        return f"""
## Campaign Created

**ID**: {campaign.campaign_id}
**Name**: {campaign.name}
**Type**: {campaign.campaign_type.value}
**Publisher**: {campaign.publisher}
**Budget**: ${campaign.budget:,.2f}
**Status**: {campaign.status.value}

Use campaign ID to record metrics and track performance.
"""

    def _record_metrics(self, params: Dict) -> str:
        """Record campaign metrics."""
        from src.attribution.campaign_tracker import CampaignMetrics

        tracker = self._get_campaign_tracker()

        campaign_id = params.get('campaign_id')
        if not campaign_id:
            return "Error: campaign_id is required"

        metrics = CampaignMetrics(
            impressions=params.get('impressions', 0),
            clicks=params.get('clicks', 0),
            orders=params.get('orders', 0),
            revenue=params.get('revenue', 0.0),
            ad_spend=params.get('ad_spend', 0.0),
            influencer_fee=params.get('influencer_fee', 0.0),
            new_to_brand_orders=params.get('new_customers', 0)
        )

        tracker.record_metrics(campaign_id, metrics)

        return f"""
## Metrics Recorded

**Campaign**: {campaign_id}
**Impressions**: {metrics.impressions:,}
**Clicks**: {metrics.clicks:,}
**Orders**: {metrics.orders}
**Revenue**: ${metrics.revenue:,.2f}
**Cost**: ${metrics.total_cost:,.2f}
**ROAS**: {metrics.roas:.2f}x
"""

    def _analyze_roi(self, params: Dict) -> str:
        """Analyze ROI by channel."""
        tracker = self._get_campaign_tracker()
        calculator = self._get_roi_calculator()

        campaigns = tracker.list_campaigns()

        if not campaigns:
            return "No campaigns found. Create campaigns and record metrics first."

        total_budget = params.get('total_budget')
        report = calculator.generate_roi_report(campaigns, total_budget)

        return report

    def _get_recommendations(self, params: Dict) -> str:
        """Get budget recommendations."""
        tracker = self._get_campaign_tracker()
        calculator = self._get_roi_calculator()

        campaigns = tracker.list_campaigns()
        if not campaigns:
            return "No campaigns found."

        total_budget = params.get('total_budget', 5000.0)
        channel_roi = calculator.calculate_channel_roi(campaigns)
        recommendations = calculator.generate_budget_recommendations(
            channel_roi, total_budget
        )

        lines = [
            f"## Budget Recommendations",
            f"(Based on ${total_budget:,.2f} total budget)",
            "",
            "| Priority | Channel | Current | Recommended | Action |",
            "|----------|---------|---------|-------------|--------|"
        ]

        for rec in recommendations:
            action = "Scale Up 📈" if rec.change_amount > 0 else "Reduce 📉"
            if abs(rec.change_percent) < 0.1:
                action = "Maintain ➡️"
            lines.append(
                f"| {rec.priority} | {rec.channel} | ${rec.current_budget:,.0f} | "
                f"${rec.recommended_budget:,.0f} | {action} |"
            )

        lines.extend([
            "",
            "### Reasoning",
            ""
        ])

        for rec in recommendations:
            lines.append(f"- **{rec.channel}**: {rec.reason}")

        return "\n".join(lines)

    def _list_publishers(self) -> str:
        """List available publishers."""
        generator = self._get_link_generator()
        publishers = generator.list_publishers()

        lines = [
            "## Available Publishers/Channels",
            "",
            "| ID | Name | Type | Default Campaign Type |",
            "|----|------|------|----------------------|"
        ]

        for pub in publishers:
            lines.append(
                f"| {pub.id} | {pub.name} | {pub.type} | {pub.default_campaign_type} |"
            )

        return "\n".join(lines)
