"""
Brand Strategy Advisor for Amazon Growth OS.

Provides strategic recommendations for brand defense vs expansion
based on health scores, market conditions, and competitive position.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from enum import Enum
import yaml

from .metrics_tracker import BrandMetricsTracker, RatingTrend
from .health_scorer import BrandHealthScorer, HealthScore, HealthLevel


class StrategyType(Enum):
    """Brand strategy types."""
    AGGRESSIVE_EXPANSION = "aggressive_expansion"
    CONTROLLED_EXPANSION = "controlled_expansion"
    MAINTENANCE = "maintenance"
    DEFENSIVE = "defensive"
    CRISIS_MANAGEMENT = "crisis_management"


class ActionPriority(Enum):
    """Action priority levels."""
    IMMEDIATE = "immediate"      # Do now
    HIGH = "high"                # This week
    MEDIUM = "medium"            # This month
    LOW = "low"                  # When resources allow


@dataclass
class StrategicAction:
    """A recommended strategic action."""
    title: str
    description: str
    priority: ActionPriority
    category: str  # marketing, product, customer_service, listing, ppc
    expected_impact: str
    resources_required: str
    timeline: str
    kpis: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return {
            'title': self.title,
            'description': self.description,
            'priority': self.priority.value,
            'category': self.category,
            'expected_impact': self.expected_impact,
            'resources_required': self.resources_required,
            'timeline': self.timeline,
            'kpis': self.kpis
        }


@dataclass
class StrategyRecommendation:
    """Complete strategy recommendation."""
    timestamp: datetime
    strategy_type: StrategyType
    health_score: float
    health_level: HealthLevel
    rationale: str
    actions: List[StrategicAction]
    risks: List[str]
    opportunities: List[str]
    budget_allocation: Dict[str, float]

    def to_dict(self) -> Dict:
        return {
            'timestamp': self.timestamp.isoformat(),
            'strategy_type': self.strategy_type.value,
            'health_score': round(self.health_score, 1),
            'health_level': self.health_level.value,
            'rationale': self.rationale,
            'actions': [a.to_dict() for a in self.actions],
            'risks': self.risks,
            'opportunities': self.opportunities,
            'budget_allocation': self.budget_allocation
        }


class BrandStrategyAdvisor:
    """
    Generates strategic recommendations for brand management.

    Analyzes brand health, competitive position, and market conditions
    to recommend expansion vs defense strategies with specific actions.
    """

    def __init__(
        self,
        config_path: Optional[str] = None,
        metrics_tracker: Optional[BrandMetricsTracker] = None,
        health_scorer: Optional[BrandHealthScorer] = None
    ):
        """Initialize strategy advisor."""
        self.config_path = config_path or "config/brand_health.yaml"
        self.config = self._load_config()
        self.metrics_tracker = metrics_tracker
        self.health_scorer = health_scorer

        # Recommendation history
        self.recommendation_history: List[StrategyRecommendation] = []

    def _load_config(self) -> Dict:
        """Load configuration from YAML file."""
        try:
            with open(self.config_path, 'r') as f:
                return yaml.safe_load(f)
        except FileNotFoundError:
            return self._default_config()

    def _default_config(self) -> Dict:
        """Default configuration if file not found."""
        return {
            'strategy': {
                'expansion_triggers': {
                    'min_health_score': 70,
                    'min_rating': 4.5,
                    'positive_sentiment_pct': 70
                },
                'defense_triggers': {
                    'max_health_score': 60,
                    'rating_drop': 0.2,
                    'negative_sentiment_spike': 20
                }
            }
        }

    def recommend_strategy(
        self,
        health_score: Optional[HealthScore] = None,
        competitor_gap: float = 0.0,
        market_growth: str = "stable",
        budget_available: float = 10000.0
    ) -> StrategyRecommendation:
        """
        Generate comprehensive strategy recommendation.

        Args:
            health_score: Current brand health score (or will calculate)
            competitor_gap: Rating gap vs competitors (positive = we're ahead)
            market_growth: Market growth trend ("growing", "stable", "declining")
            budget_available: Monthly budget for brand activities

        Returns:
            Complete strategy recommendation with actions
        """
        # Get health score if not provided
        if health_score is None:
            if self.health_scorer:
                health_score = self.health_scorer.calculate_score()
            else:
                # Create default score
                health_score = HealthScore(
                    timestamp=datetime.now(),
                    total_score=60.0,
                    health_level=HealthLevel.FAIR,
                    components=[],
                    strengths=[],
                    weaknesses=[]
                )

        # Determine strategy type
        strategy_type = self._determine_strategy(
            health_score,
            competitor_gap,
            market_growth
        )

        # Generate rationale
        rationale = self._generate_rationale(
            strategy_type,
            health_score,
            competitor_gap,
            market_growth
        )

        # Generate actions
        actions = self._generate_actions(
            strategy_type,
            health_score,
            budget_available
        )

        # Identify risks and opportunities
        risks = self._identify_risks(strategy_type, health_score, competitor_gap)
        opportunities = self._identify_opportunities(strategy_type, health_score, market_growth)

        # Generate budget allocation
        budget_allocation = self._allocate_budget(strategy_type, budget_available)

        recommendation = StrategyRecommendation(
            timestamp=datetime.now(),
            strategy_type=strategy_type,
            health_score=health_score.total_score,
            health_level=health_score.health_level,
            rationale=rationale,
            actions=actions,
            risks=risks,
            opportunities=opportunities,
            budget_allocation=budget_allocation
        )

        self.recommendation_history.append(recommendation)
        return recommendation

    def _determine_strategy(
        self,
        health_score: HealthScore,
        competitor_gap: float,
        market_growth: str
    ) -> StrategyType:
        """Determine appropriate strategy based on conditions."""
        score = health_score.total_score
        level = health_score.health_level

        triggers = self.config.get('strategy', {})
        expansion_triggers = triggers.get('expansion_triggers', {})
        defense_triggers = triggers.get('defense_triggers', {})

        # Crisis management for critical health
        if level == HealthLevel.CRITICAL:
            return StrategyType.CRISIS_MANAGEMENT

        # Defensive for poor health or significant competitor gap
        if level == HealthLevel.POOR or competitor_gap < -0.3:
            return StrategyType.DEFENSIVE

        # Aggressive expansion for excellent health in growing market
        if level == HealthLevel.EXCELLENT and market_growth == "growing" and competitor_gap >= 0:
            return StrategyType.AGGRESSIVE_EXPANSION

        # Controlled expansion for good health
        if level == HealthLevel.GOOD and competitor_gap >= -0.1:
            return StrategyType.CONTROLLED_EXPANSION

        # Default to maintenance
        return StrategyType.MAINTENANCE

    def _generate_rationale(
        self,
        strategy_type: StrategyType,
        health_score: HealthScore,
        competitor_gap: float,
        market_growth: str
    ) -> str:
        """Generate rationale for the recommended strategy."""
        rationales = {
            StrategyType.AGGRESSIVE_EXPANSION: (
                f"With a health score of {health_score.total_score:.0f}/100 ({health_score.health_level.value}) "
                f"and {market_growth} market conditions, aggressive expansion is recommended. "
                f"The brand is well-positioned to capture market share and launch new initiatives."
            ),
            StrategyType.CONTROLLED_EXPANSION: (
                f"The brand's {health_score.health_level.value} health ({health_score.total_score:.0f}/100) "
                f"supports controlled expansion. Focus on incremental growth while maintaining "
                f"current market position. Monitor competitor response closely."
            ),
            StrategyType.MAINTENANCE: (
                f"With a health score of {health_score.total_score:.0f}/100, maintenance mode is recommended. "
                f"Preserve current market position, optimize existing operations, and prepare "
                f"for future expansion when conditions improve."
            ),
            StrategyType.DEFENSIVE: (
                f"Brand health ({health_score.total_score:.0f}/100) indicates defensive posture is needed. "
                f"Competitor gap of {competitor_gap:+.1f} stars requires immediate attention. "
                f"Focus on stabilizing ratings and protecting market share."
            ),
            StrategyType.CRISIS_MANAGEMENT: (
                f"Critical brand health ({health_score.total_score:.0f}/100) requires immediate intervention. "
                f"All resources should focus on addressing fundamental issues before "
                f"considering any growth initiatives."
            )
        }
        return rationales.get(strategy_type, "Strategy selected based on current conditions.")

    def _generate_actions(
        self,
        strategy_type: StrategyType,
        health_score: HealthScore,
        budget: float
    ) -> List[StrategicAction]:
        """Generate specific actions for the strategy."""
        actions = []

        if strategy_type == StrategyType.AGGRESSIVE_EXPANSION:
            actions.extend([
                StrategicAction(
                    title="Launch Product Line Extension",
                    description="Introduce 2-3 new variants targeting adjacent segments",
                    priority=ActionPriority.HIGH,
                    category="product",
                    expected_impact="20-30% revenue growth potential",
                    resources_required="$5,000-10,000 product development",
                    timeline="60-90 days",
                    kpis=["New SKU sales", "Cannibalization rate", "Market share"]
                ),
                StrategicAction(
                    title="Increase PPC on Brand Keywords",
                    description="Defend and expand brand keyword coverage",
                    priority=ActionPriority.IMMEDIATE,
                    category="ppc",
                    expected_impact="Protect brand traffic, increase visibility",
                    resources_required="30% budget increase for brand campaigns",
                    timeline="Ongoing",
                    kpis=["Brand keyword impression share", "ACOS", "Brand searches"]
                ),
                StrategicAction(
                    title="Invest in Premium A+ Content",
                    description="Create Premium A+ with video and enhanced visuals",
                    priority=ActionPriority.MEDIUM,
                    category="listing",
                    expected_impact="5-15% conversion rate improvement",
                    resources_required="$2,000-5,000 content creation",
                    timeline="30-45 days",
                    kpis=["Conversion rate", "Average session duration"]
                ),
                StrategicAction(
                    title="Expand to New Marketplaces",
                    description="Launch in UK/DE/JP Amazon marketplaces",
                    priority=ActionPriority.MEDIUM,
                    category="marketing",
                    expected_impact="30-50% addressable market expansion",
                    resources_required="$3,000-8,000 per marketplace",
                    timeline="90-120 days",
                    kpis=["International sales %", "Market penetration"]
                )
            ])

        elif strategy_type == StrategyType.CONTROLLED_EXPANSION:
            actions.extend([
                StrategicAction(
                    title="Optimize High-Potential Keywords",
                    description="Increase bids on top 20 converting keywords",
                    priority=ActionPriority.IMMEDIATE,
                    category="ppc",
                    expected_impact="10-15% sales increase",
                    resources_required="15% budget reallocation",
                    timeline="Immediate",
                    kpis=["ROAS", "Keyword rank", "Conversion rate"]
                ),
                StrategicAction(
                    title="Launch Review Generation Campaign",
                    description="Implement Vine program and follow-up email sequence",
                    priority=ActionPriority.HIGH,
                    category="customer_service",
                    expected_impact="30-50% increase in review velocity",
                    resources_required="$500-1,000/month",
                    timeline="30 days to see results",
                    kpis=["Review count", "Review velocity", "Rating trend"]
                ),
                StrategicAction(
                    title="A/B Test Title Variations",
                    description="Test keyword placement and benefit emphasis in titles",
                    priority=ActionPriority.MEDIUM,
                    category="listing",
                    expected_impact="5-10% CTR improvement",
                    resources_required="Time investment only",
                    timeline="4-6 weeks per test",
                    kpis=["CTR", "Sessions", "Conversion rate"]
                )
            ])

        elif strategy_type == StrategyType.MAINTENANCE:
            actions.extend([
                StrategicAction(
                    title="Maintain Review Response Rate",
                    description="Respond to all reviews within 24 hours",
                    priority=ActionPriority.HIGH,
                    category="customer_service",
                    expected_impact="Protect current rating, build loyalty",
                    resources_required="1-2 hours/day",
                    timeline="Ongoing",
                    kpis=["Response rate", "Response time", "Customer satisfaction"]
                ),
                StrategicAction(
                    title="Monitor Competitor Activity",
                    description="Track competitor prices, promotions, and new products weekly",
                    priority=ActionPriority.MEDIUM,
                    category="marketing",
                    expected_impact="Early warning for competitive threats",
                    resources_required="2-3 hours/week",
                    timeline="Ongoing",
                    kpis=["Price position", "Competitor new products", "Market share"]
                ),
                StrategicAction(
                    title="Optimize Underperforming SKUs",
                    description="Review and improve bottom 20% of SKUs",
                    priority=ActionPriority.MEDIUM,
                    category="product",
                    expected_impact="Improve portfolio efficiency",
                    resources_required="Analysis + incremental improvements",
                    timeline="30-60 days",
                    kpis=["SKU profitability", "Inventory turnover"]
                )
            ])

        elif strategy_type == StrategyType.DEFENSIVE:
            actions.extend([
                StrategicAction(
                    title="Address Negative Reviews Immediately",
                    description="Respond to all negative reviews with solutions within 12 hours",
                    priority=ActionPriority.IMMEDIATE,
                    category="customer_service",
                    expected_impact="Slow rating decline, recover customers",
                    resources_required="Dedicated team member",
                    timeline="Immediate and ongoing",
                    kpis=["Negative review count", "Resolution rate", "Rating recovery"]
                ),
                StrategicAction(
                    title="Add FAQ Section to Listing",
                    description="Address top 5 customer complaints proactively in Q&A",
                    priority=ActionPriority.HIGH,
                    category="listing",
                    expected_impact="Reduce negative reviews by 20-30%",
                    resources_required="2-4 hours content creation",
                    timeline="Immediate",
                    kpis=["Q&A engagement", "Related negative review volume"]
                ),
                StrategicAction(
                    title="Review Product Quality with Supplier",
                    description="Analyze negative reviews for quality issues, address with supplier",
                    priority=ActionPriority.HIGH,
                    category="product",
                    expected_impact="Improve product quality at source",
                    resources_required="Supplier communication + QC improvement",
                    timeline="30-60 days for implementation",
                    kpis=["Defect rate", "Return rate", "Quality-related reviews"]
                ),
                StrategicAction(
                    title="Defend Brand Keywords",
                    description="Increase bids on brand keywords to prevent competitor conquest",
                    priority=ActionPriority.IMMEDIATE,
                    category="ppc",
                    expected_impact="Protect existing customers and brand equity",
                    resources_required="20-30% budget for brand defense",
                    timeline="Immediate",
                    kpis=["Brand impression share", "Competitor conquest rate"]
                )
            ])

        elif strategy_type == StrategyType.CRISIS_MANAGEMENT:
            actions.extend([
                StrategicAction(
                    title="Emergency Customer Outreach",
                    description="Contact recent negative reviewers directly with refunds/replacements",
                    priority=ActionPriority.IMMEDIATE,
                    category="customer_service",
                    expected_impact="Potential review updates, brand recovery",
                    resources_required="Dedicated crisis team, refund budget",
                    timeline="24-48 hours",
                    kpis=["Review updates", "Customer recovery rate"]
                ),
                StrategicAction(
                    title="Pause Underperforming Campaigns",
                    description="Stop all PPC with ACOS > 40%, focus budget on winners",
                    priority=ActionPriority.IMMEDIATE,
                    category="ppc",
                    expected_impact="Stop bleeding, preserve budget",
                    resources_required="Campaign audit",
                    timeline="Immediate",
                    kpis=["Overall ACOS", "Budget efficiency"]
                ),
                StrategicAction(
                    title="Product Quality Audit",
                    description="Full review of recent production batches and customer complaints",
                    priority=ActionPriority.IMMEDIATE,
                    category="product",
                    expected_impact="Identify root cause of issues",
                    resources_required="QC team, possibly third-party audit",
                    timeline="7-14 days",
                    kpis=["Defect identification rate", "Root cause found"]
                ),
                StrategicAction(
                    title="Consider Listing Refresh",
                    description="If product issues fixed, consider relisting with improvements",
                    priority=ActionPriority.HIGH,
                    category="listing",
                    expected_impact="Fresh start with improved product",
                    resources_required="New ASIN creation, initial reviews",
                    timeline="30-60 days",
                    kpis=["New listing rating", "Sales velocity"]
                )
            ])

        return actions

    def _identify_risks(
        self,
        strategy_type: StrategyType,
        health_score: HealthScore,
        competitor_gap: float
    ) -> List[str]:
        """Identify risks associated with the strategy."""
        risks = []

        if strategy_type in [StrategyType.AGGRESSIVE_EXPANSION, StrategyType.CONTROLLED_EXPANSION]:
            risks.extend([
                "Competitor response may include price wars",
                "New product launches may cannibalize existing sales",
                "Overextension could strain resources"
            ])

        if health_score.health_level in [HealthLevel.FAIR, HealthLevel.POOR]:
            risks.append("Expansion before stabilization may backfire")

        if competitor_gap < 0:
            risks.append(f"Competitor rating advantage ({abs(competitor_gap):.1f} stars) may limit growth")

        if strategy_type == StrategyType.CRISIS_MANAGEMENT:
            risks.extend([
                "Brand damage may be irreversible",
                "Customer trust difficult to rebuild",
                "Negative reviews may continue accumulating"
            ])

        return risks[:5]  # Top 5 risks

    def _identify_opportunities(
        self,
        strategy_type: StrategyType,
        health_score: HealthScore,
        market_growth: str
    ) -> List[str]:
        """Identify opportunities for the strategy."""
        opportunities = []

        if market_growth == "growing":
            opportunities.append("Growing market provides expansion runway")

        if health_score.health_level in [HealthLevel.EXCELLENT, HealthLevel.GOOD]:
            opportunities.extend([
                "Strong brand equity supports premium pricing",
                "Positive reviews create competitive moat",
                "Customer loyalty enables cross-selling"
            ])

        if strategy_type == StrategyType.DEFENSIVE:
            opportunities.extend([
                "Crisis resolution can strengthen customer relationships",
                "Addressing issues builds long-term trust",
                "Improved product quality creates differentiation"
            ])

        # Add from health score strengths
        opportunities.extend(health_score.strengths)

        return list(set(opportunities))[:5]  # Top 5 unique opportunities

    def _allocate_budget(
        self,
        strategy_type: StrategyType,
        total_budget: float
    ) -> Dict[str, float]:
        """Allocate budget across categories based on strategy."""
        allocations = {
            StrategyType.AGGRESSIVE_EXPANSION: {
                "ppc": 0.40,
                "product_development": 0.25,
                "content": 0.15,
                "customer_service": 0.10,
                "reserve": 0.10
            },
            StrategyType.CONTROLLED_EXPANSION: {
                "ppc": 0.45,
                "product_development": 0.15,
                "content": 0.15,
                "customer_service": 0.15,
                "reserve": 0.10
            },
            StrategyType.MAINTENANCE: {
                "ppc": 0.35,
                "product_development": 0.10,
                "content": 0.15,
                "customer_service": 0.20,
                "reserve": 0.20
            },
            StrategyType.DEFENSIVE: {
                "ppc": 0.30,
                "product_development": 0.10,
                "content": 0.10,
                "customer_service": 0.35,
                "reserve": 0.15
            },
            StrategyType.CRISIS_MANAGEMENT: {
                "ppc": 0.15,
                "product_development": 0.20,
                "content": 0.05,
                "customer_service": 0.45,
                "reserve": 0.15
            }
        }

        allocation_pcts = allocations.get(strategy_type, allocations[StrategyType.MAINTENANCE])

        return {
            category: round(total_budget * pct, 2)
            for category, pct in allocation_pcts.items()
        }

    def generate_strategy_report(
        self,
        recommendation: Optional[StrategyRecommendation] = None
    ) -> str:
        """Generate comprehensive strategy report."""
        if recommendation is None:
            if not self.recommendation_history:
                return "No strategy recommendations generated yet."
            recommendation = self.recommendation_history[-1]

        brand_name = self.config.get('brand', {}).get('name', 'Unknown Brand')

        strategy_icons = {
            'aggressive_expansion': '🚀',
            'controlled_expansion': '📈',
            'maintenance': '🛡️',
            'defensive': '⚔️',
            'crisis_management': '🚨'
        }
        strategy_icon = strategy_icons.get(recommendation.strategy_type.value, '📊')

        priority_icons = {
            'immediate': '🔴',
            'high': '🟠',
            'medium': '🟡',
            'low': '🟢'
        }

        lines = [
            f"# Brand Strategy Recommendation: {brand_name}",
            f"*Generated: {recommendation.timestamp.strftime('%Y-%m-%d %H:%M')}*",
            "",
            f"## {strategy_icon} Recommended Strategy: {recommendation.strategy_type.value.replace('_', ' ').title()}",
            "",
            f"**Health Score**: {recommendation.health_score:.0f}/100 ({recommendation.health_level.value.title()})",
            "",
            "### Rationale",
            "",
            recommendation.rationale,
            "",
            "---",
            "",
            "## Action Plan",
            ""
        ]

        # Group actions by priority
        for priority in ActionPriority:
            priority_actions = [a for a in recommendation.actions if a.priority == priority]
            if priority_actions:
                icon = priority_icons.get(priority.value, '⚪')
                lines.append(f"### {icon} {priority.value.title()} Priority")
                lines.append("")

                for i, action in enumerate(priority_actions, 1):
                    lines.extend([
                        f"#### {i}. {action.title}",
                        "",
                        f"*Category: {action.category.replace('_', ' ').title()}*",
                        "",
                        f"{action.description}",
                        "",
                        f"- **Expected Impact**: {action.expected_impact}",
                        f"- **Resources**: {action.resources_required}",
                        f"- **Timeline**: {action.timeline}",
                        f"- **KPIs**: {', '.join(action.kpis)}",
                        ""
                    ])

        # Budget allocation
        lines.extend([
            "---",
            "",
            "## Budget Allocation",
            "",
            "| Category | Allocation |",
            "|----------|------------|"
        ])

        for category, amount in sorted(
            recommendation.budget_allocation.items(),
            key=lambda x: x[1],
            reverse=True
        ):
            pct = (amount / sum(recommendation.budget_allocation.values())) * 100
            lines.append(f"| {category.replace('_', ' ').title()} | ${amount:,.0f} ({pct:.0f}%) |")

        # Risks and opportunities
        if recommendation.risks:
            lines.extend([
                "",
                "## ⚠️ Key Risks",
                ""
            ])
            for risk in recommendation.risks:
                lines.append(f"- {risk}")

        if recommendation.opportunities:
            lines.extend([
                "",
                "## 💡 Opportunities",
                ""
            ])
            for opp in recommendation.opportunities:
                lines.append(f"- {opp}")

        return "\n".join(lines)
