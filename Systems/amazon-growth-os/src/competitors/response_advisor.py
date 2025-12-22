"""
Response Advisor - Competitive Response Recommendations.

Provides strategic recommendations for responding to
competitor price changes and market dynamics.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any
from pathlib import Path
import yaml

from .price_tracker import PriceTracker, Competitor, StockStatus
from .alert_engine import PriceAlert, AlertType, AlertSeverity


class ResponseStrategy(Enum):
    """Types of competitive responses."""
    MATCH_PRICE = "match_price"
    PARTIAL_MATCH = "partial_match"
    HOLD_PRICE = "hold_price"
    INCREASE_PRICE = "increase_price"
    ADD_COUPON = "add_coupon"
    BUNDLE_OFFER = "bundle_offer"
    INCREASE_ADS = "increase_ads"
    DIFFERENTIATE = "differentiate"
    WAIT_AND_WATCH = "wait_and_watch"


@dataclass
class MarketAnalysis:
    """Analysis of current market conditions."""
    our_price: float
    our_margin: float  # As percentage (e.g., 0.25 = 25%)
    our_bsr: Optional[int] = None
    our_rating: float = 0.0
    our_review_count: int = 0

    # Market position
    avg_competitor_price: float = 0.0
    min_competitor_price: float = 0.0
    max_competitor_price: float = 0.0
    price_rank: int = 0  # 1 = cheapest
    total_competitors: int = 0

    # Market dynamics
    competitors_with_drops: int = 0
    competitors_with_increases: int = 0
    competitors_oos: int = 0

    # Calculated metrics
    @property
    def price_vs_avg(self) -> float:
        """Our price vs market average (positive = we're more expensive)."""
        if self.avg_competitor_price > 0:
            return ((self.our_price - self.avg_competitor_price) /
                   self.avg_competitor_price) * 100
        return 0.0

    @property
    def price_gap_to_leader(self) -> float:
        """Gap between our price and cheapest competitor."""
        if self.min_competitor_price > 0:
            return ((self.our_price - self.min_competitor_price) /
                   self.min_competitor_price) * 100
        return 0.0

    @property
    def market_health(self) -> str:
        """Assess overall market health."""
        if self.competitors_with_drops > self.total_competitors * 0.5:
            return "price_war"
        elif self.competitors_oos > self.total_competitors * 0.3:
            return "supply_constrained"
        elif self.competitors_with_increases > self.total_competitors * 0.3:
            return "rising_prices"
        else:
            return "stable"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'our_price': self.our_price,
            'our_margin': self.our_margin,
            'our_bsr': self.our_bsr,
            'our_rating': self.our_rating,
            'our_review_count': self.our_review_count,
            'avg_competitor_price': self.avg_competitor_price,
            'min_competitor_price': self.min_competitor_price,
            'max_competitor_price': self.max_competitor_price,
            'price_rank': self.price_rank,
            'total_competitors': self.total_competitors,
            'price_vs_avg': self.price_vs_avg,
            'price_gap_to_leader': self.price_gap_to_leader,
            'market_health': self.market_health
        }


@dataclass
class CompetitiveResponse:
    """A recommended competitive response."""
    strategy: ResponseStrategy
    priority: int  # 1 = highest priority
    title: str
    description: str
    rationale: str

    # Implementation details
    action_items: List[str] = field(default_factory=list)
    estimated_impact: str = ""
    risk_level: str = "low"  # low, medium, high

    # Financial impact
    price_change: Optional[float] = None  # Absolute change
    new_price: Optional[float] = None
    margin_impact: float = 0.0  # Percentage points change

    # Timing
    urgency: str = "normal"  # immediate, urgent, normal, can_wait
    implementation_time: str = ""  # e.g., "1-2 hours"

    # Context
    trigger_alert: Optional[PriceAlert] = None
    applicable_conditions: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'strategy': self.strategy.value,
            'priority': self.priority,
            'title': self.title,
            'description': self.description,
            'rationale': self.rationale,
            'action_items': self.action_items,
            'estimated_impact': self.estimated_impact,
            'risk_level': self.risk_level,
            'price_change': self.price_change,
            'new_price': self.new_price,
            'margin_impact': self.margin_impact,
            'urgency': self.urgency,
            'implementation_time': self.implementation_time
        }


class ResponseAdvisor:
    """
    Advise on competitive responses based on market conditions.

    Features:
    - Analyze market position
    - Generate response recommendations
    - Prioritize actions based on impact
    - Consider margin constraints
    """

    def __init__(
        self,
        config_path: Optional[str] = None,
        price_tracker: Optional[PriceTracker] = None
    ):
        """Initialize response advisor."""
        self.config = self._load_config(config_path)
        self.tracker = price_tracker

        # Load constraints from config
        roi_config = self.config.get('roi_calculation', {})
        self.min_margin = roi_config.get('constraints', {}).get('min_margin', 0.15)
        self.max_price_gap = roi_config.get('constraints', {}).get('max_price_gap_vs_leader', 0.20)

    def _load_config(self, config_path: Optional[str]) -> Dict:
        """Load configuration."""
        if config_path and Path(config_path).exists():
            with open(config_path, 'r') as f:
                return yaml.safe_load(f)
        return {}

    def analyze_market(
        self,
        our_price: float,
        our_cost: float,
        our_bsr: Optional[int] = None,
        our_rating: float = 0.0,
        our_review_count: int = 0
    ) -> MarketAnalysis:
        """Analyze current market position."""
        margin = (our_price - our_cost) / our_price if our_price > 0 else 0

        analysis = MarketAnalysis(
            our_price=our_price,
            our_margin=margin,
            our_bsr=our_bsr,
            our_rating=our_rating,
            our_review_count=our_review_count
        )

        if not self.tracker:
            return analysis

        competitors = self.tracker.list_competitors()
        if not competitors:
            return analysis

        # Calculate market stats
        prices = [c.current_price for c in competitors if c.current_price]

        if prices:
            analysis.avg_competitor_price = sum(prices) / len(prices)
            analysis.min_competitor_price = min(prices)
            analysis.max_competitor_price = max(prices)
            analysis.total_competitors = len(competitors)

            # Calculate our price rank
            cheaper_count = sum(1 for p in prices if p < our_price)
            analysis.price_rank = cheaper_count + 1

            # Count market dynamics
            for comp in competitors:
                change = comp.price_history.get_price_change(days=7)
                if change:
                    if change[1] < -5:
                        analysis.competitors_with_drops += 1
                    elif change[1] > 5:
                        analysis.competitors_with_increases += 1

                if comp.stock_status == StockStatus.OUT_OF_STOCK:
                    analysis.competitors_oos += 1

        return analysis

    def recommend_response_to_alert(
        self,
        alert: PriceAlert,
        market: MarketAnalysis,
        our_cost: float
    ) -> List[CompetitiveResponse]:
        """Generate response recommendations for a specific alert."""
        responses = []

        if alert.alert_type == AlertType.PRICE_DROP:
            responses = self._handle_price_drop(alert, market, our_cost)

        elif alert.alert_type == AlertType.PRICE_INCREASE:
            responses = self._handle_price_increase(alert, market, our_cost)

        elif alert.alert_type == AlertType.UNDERCUT:
            responses = self._handle_undercut(alert, market, our_cost)

        elif alert.alert_type == AlertType.COMPETITOR_OOS:
            responses = self._handle_competitor_oos(alert, market, our_cost)

        elif alert.alert_type == AlertType.PRICE_WAR:
            responses = self._handle_price_war(alert, market, our_cost)

        elif alert.alert_type == AlertType.NEW_DEAL:
            responses = self._handle_competitor_deal(alert, market, our_cost)

        # Sort by priority
        responses.sort(key=lambda x: x.priority)

        return responses

    def _handle_price_drop(
        self,
        alert: PriceAlert,
        market: MarketAnalysis,
        our_cost: float
    ) -> List[CompetitiveResponse]:
        """Handle competitor price drop."""
        responses = []
        competitor_new_price = alert.new_price or 0
        drop_percent = abs(alert.change_percent)

        # Option 1: Match price (if margin allows)
        match_margin = (competitor_new_price - our_cost) / competitor_new_price if competitor_new_price > 0 else 0

        if match_margin >= self.min_margin:
            responses.append(CompetitiveResponse(
                strategy=ResponseStrategy.MATCH_PRICE,
                priority=1,
                title="Match Competitor Price",
                description=f"Lower price to ${competitor_new_price:.2f} to match competitor",
                rationale=f"Margin after match ({match_margin*100:.1f}%) still above minimum ({self.min_margin*100:.1f}%)",
                action_items=[
                    f"Update price to ${competitor_new_price:.2f}",
                    "Monitor competitor response over 48 hours",
                    "Track conversion rate impact"
                ],
                estimated_impact="Maintain market share, slight margin compression",
                risk_level="low",
                price_change=competitor_new_price - market.our_price,
                new_price=competitor_new_price,
                margin_impact=(match_margin - market.our_margin) * 100,
                urgency="urgent" if drop_percent > 15 else "normal",
                implementation_time="Immediate"
            ))

        # Option 2: Partial match
        partial_price = market.our_price - (market.our_price - competitor_new_price) * 0.5
        partial_margin = (partial_price - our_cost) / partial_price if partial_price > 0 else 0

        if partial_margin >= self.min_margin:
            responses.append(CompetitiveResponse(
                strategy=ResponseStrategy.PARTIAL_MATCH,
                priority=2,
                title="Partial Price Match",
                description=f"Reduce price to ${partial_price:.2f} (halfway to competitor)",
                rationale="Balance between competitiveness and margin preservation",
                action_items=[
                    f"Update price to ${partial_price:.2f}",
                    "Emphasize value proposition in listing",
                    "Consider adding coupon for additional flexibility"
                ],
                estimated_impact="Maintain some competitiveness, preserve more margin",
                risk_level="low",
                price_change=partial_price - market.our_price,
                new_price=partial_price,
                margin_impact=(partial_margin - market.our_margin) * 100,
                urgency="normal",
                implementation_time="1-2 hours"
            ))

        # Option 3: Hold and differentiate
        if market.our_rating > 4.3 or market.our_review_count > 500:
            responses.append(CompetitiveResponse(
                strategy=ResponseStrategy.DIFFERENTIATE,
                priority=3,
                title="Hold Price, Emphasize Quality",
                description="Maintain current price, focus on value differentiation",
                rationale=f"Strong reviews ({market.our_rating}★, {market.our_review_count} reviews) support premium positioning",
                action_items=[
                    "Update listing to emphasize quality/features",
                    "Respond to recent reviews highlighting value",
                    "Consider A+ Content updates",
                    "Increase PPC on brand terms"
                ],
                estimated_impact="May lose some price-sensitive customers, protect margin",
                risk_level="medium",
                urgency="normal",
                implementation_time="1-2 days"
            ))

        # Option 4: Add coupon instead
        coupon_amount = min(market.our_price * 0.10, market.our_price - competitor_new_price)
        effective_price = market.our_price - coupon_amount

        responses.append(CompetitiveResponse(
            strategy=ResponseStrategy.ADD_COUPON,
            priority=4,
            title="Add Coupon (Temporary Response)",
            description=f"Add ${coupon_amount:.2f} coupon instead of permanent price cut",
            rationale="Flexible response that can be removed when competitor raises price back",
            action_items=[
                f"Create ${coupon_amount:.2f} coupon",
                "Set coupon expiration for 2 weeks",
                "Monitor competitor price for changes"
            ],
            estimated_impact="Competitive response without permanent margin impact",
            risk_level="low",
            price_change=-coupon_amount,
            new_price=effective_price,
            urgency="normal",
            implementation_time="30 minutes"
        ))

        return responses

    def _handle_price_increase(
        self,
        alert: PriceAlert,
        market: MarketAnalysis,
        our_cost: float
    ) -> List[CompetitiveResponse]:
        """Handle competitor price increase."""
        responses = []

        # Option 1: Hold price (enjoy relative improvement)
        responses.append(CompetitiveResponse(
            strategy=ResponseStrategy.HOLD_PRICE,
            priority=1,
            title="Hold Current Price",
            description="Maintain price, enjoy improved competitive position",
            rationale="Competitor raised price - no action needed. We're now more attractive.",
            action_items=[
                "Monitor sales velocity for improvement",
                "Consider slight PPC increase to capture extra demand"
            ],
            estimated_impact="Improved price competitiveness, potential sales increase",
            risk_level="low",
            urgency="can_wait"
        ))

        # Option 2: Test price increase (if market supports)
        if market.our_margin < 0.25 and market.price_rank <= 3:
            test_increase = market.our_price * 0.05  # 5% increase
            new_price = market.our_price + test_increase

            if new_price < alert.new_price:  # Still below competitor
                responses.append(CompetitiveResponse(
                    strategy=ResponseStrategy.INCREASE_PRICE,
                    priority=2,
                    title="Test Price Increase",
                    description=f"Test 5% price increase to ${new_price:.2f}",
                    rationale="Market may support higher prices. Low risk while competitor is higher.",
                    action_items=[
                        f"Increase price to ${new_price:.2f}",
                        "Monitor conversion rate closely for 5 days",
                        "Revert if conversion drops >20%"
                    ],
                    estimated_impact="Improved margin if successful",
                    risk_level="medium",
                    price_change=test_increase,
                    new_price=new_price,
                    margin_impact=5.0,
                    urgency="can_wait",
                    implementation_time="Immediate, monitor 5 days"
                ))

        return responses

    def _handle_undercut(
        self,
        alert: PriceAlert,
        market: MarketAnalysis,
        our_cost: float
    ) -> List[CompetitiveResponse]:
        """Handle being undercut by competitor."""
        return self._handle_price_drop(alert, market, our_cost)

    def _handle_competitor_oos(
        self,
        alert: PriceAlert,
        market: MarketAnalysis,
        our_cost: float
    ) -> List[CompetitiveResponse]:
        """Handle competitor out of stock."""
        responses = []

        # Option 1: Increase ads
        responses.append(CompetitiveResponse(
            strategy=ResponseStrategy.INCREASE_ADS,
            priority=1,
            title="Increase PPC to Capture Demand",
            description="Increase advertising spend to capture competitor's displaced customers",
            rationale="Competitor OOS - their customers need alternative. Strike now.",
            action_items=[
                "Increase PPC budget by 30-50%",
                "Add competitor ASIN targeting campaigns",
                "Increase bids on high-converting keywords",
                "Consider Sponsored Brands if not running"
            ],
            estimated_impact="Capture competitor's lost sales, expand customer base",
            risk_level="low",
            urgency="immediate",
            implementation_time="30 minutes"
        ))

        # Option 2: Test price increase
        if market.competitors_oos > market.total_competitors * 0.2:
            responses.append(CompetitiveResponse(
                strategy=ResponseStrategy.INCREASE_PRICE,
                priority=2,
                title="Test Premium Pricing",
                description="Test 5-10% price increase while supply is constrained",
                rationale="Multiple competitors OOS - supply constrained market may support higher prices",
                action_items=[
                    "Increase price by 5-10%",
                    "Monitor for competitors restocking",
                    "Revert within 48 hours if competitors return"
                ],
                estimated_impact="Improved margin during supply shortage",
                risk_level="medium",
                urgency="normal"
            ))

        return responses

    def _handle_price_war(
        self,
        alert: PriceAlert,
        market: MarketAnalysis,
        our_cost: float
    ) -> List[CompetitiveResponse]:
        """Handle price war conditions."""
        responses = []

        # Option 1: Wait and watch
        responses.append(CompetitiveResponse(
            strategy=ResponseStrategy.WAIT_AND_WATCH,
            priority=1,
            title="Monitor Without Immediate Action",
            description="Don't join the race to the bottom. Monitor for 48-72 hours.",
            rationale="Price wars often self-correct. Competitors may not sustain low prices.",
            action_items=[
                "Set daily price monitoring alerts",
                "Calculate your minimum sustainable price",
                "Prepare contingency responses",
                "Watch for competitors raising prices back"
            ],
            estimated_impact="Preserve margin, may lose some short-term sales",
            risk_level="medium",
            urgency="normal",
            implementation_time="Monitor for 48-72 hours"
        ))

        # Option 2: Differentiate
        responses.append(CompetitiveResponse(
            strategy=ResponseStrategy.DIFFERENTIATE,
            priority=2,
            title="Differentiate on Value",
            description="Focus on non-price factors: quality, service, brand",
            rationale="Win on value, not price. Protect margins long-term.",
            action_items=[
                "Update listing to emphasize unique features",
                "Highlight warranty/guarantee if applicable",
                "Improve A+ Content",
                "Increase brand advertising",
                "Consider bundling for value perception"
            ],
            estimated_impact="Build sustainable competitive advantage",
            risk_level="low",
            urgency="normal"
        ))

        # Option 3: Minimum viable price (last resort)
        min_price = our_cost / (1 - self.min_margin)
        if min_price < market.our_price:
            responses.append(CompetitiveResponse(
                strategy=ResponseStrategy.MATCH_PRICE,
                priority=3,
                title="Defensive Price Reduction (Last Resort)",
                description=f"Reduce to minimum viable price: ${min_price:.2f}",
                rationale="Only if market share loss is critical. Maintains minimum margin.",
                action_items=[
                    f"Set floor price at ${min_price:.2f}",
                    "Plan for margin recovery when war ends",
                    "Cut any unnecessary costs"
                ],
                estimated_impact="Preserve market share at minimum margin",
                risk_level="high",
                price_change=min_price - market.our_price,
                new_price=min_price,
                urgency="can_wait",
                applicable_conditions=["Only if losing significant market share"]
            ))

        return responses

    def _handle_competitor_deal(
        self,
        alert: PriceAlert,
        market: MarketAnalysis,
        our_cost: float
    ) -> List[CompetitiveResponse]:
        """Handle competitor running a deal."""
        responses = []

        # Option 1: Wait it out
        responses.append(CompetitiveResponse(
            strategy=ResponseStrategy.WAIT_AND_WATCH,
            priority=1,
            title="Wait for Deal to End",
            description="Deals are temporary. Don't permanently reduce price.",
            rationale="Deals typically last 1-7 days. Price will return to normal.",
            action_items=[
                "Monitor deal end date",
                "Track your sales impact",
                "Prepare post-deal recovery strategy"
            ],
            estimated_impact="Short-term sales dip, preserved margins",
            risk_level="low",
            urgency="can_wait"
        ))

        # Option 2: Counter with coupon
        responses.append(CompetitiveResponse(
            strategy=ResponseStrategy.ADD_COUPON,
            priority=2,
            title="Counter with Limited Coupon",
            description="Add temporary coupon to compete with deal",
            rationale="Flexible response that expires when competitor's deal ends",
            action_items=[
                "Create coupon matching deal discount",
                "Set expiration to match expected deal end",
                "Remove coupon when competitor's deal ends"
            ],
            estimated_impact="Maintain competitiveness during deal period",
            risk_level="low",
            urgency="normal"
        ))

        return responses

    def get_top_recommendations(
        self,
        alerts: List[PriceAlert],
        market: MarketAnalysis,
        our_cost: float,
        limit: int = 5
    ) -> List[CompetitiveResponse]:
        """Get top prioritized recommendations across all alerts."""
        all_responses = []

        for alert in alerts:
            responses = self.recommend_response_to_alert(alert, market, our_cost)
            for resp in responses:
                resp.trigger_alert = alert
            all_responses.extend(responses)

        # Sort by priority and urgency
        urgency_order = {'immediate': 0, 'urgent': 1, 'normal': 2, 'can_wait': 3}
        all_responses.sort(key=lambda x: (x.priority, urgency_order.get(x.urgency, 2)))

        # Deduplicate similar strategies
        seen_strategies = set()
        unique_responses = []
        for resp in all_responses:
            if resp.strategy not in seen_strategies:
                unique_responses.append(resp)
                seen_strategies.add(resp.strategy)

        return unique_responses[:limit]

    def generate_report(
        self,
        market: MarketAnalysis,
        recommendations: List[CompetitiveResponse]
    ) -> str:
        """Generate competitive response report."""
        lines = [
            "=" * 60,
            "COMPETITIVE RESPONSE RECOMMENDATIONS",
            "=" * 60,
            "",
            f"Report Time: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            ""
        ]

        # Market position
        lines.extend([
            "## Market Position",
            "",
            f"| Metric | Value |",
            f"|--------|-------|",
            f"| Our Price | ${market.our_price:.2f} |",
            f"| Our Margin | {market.our_margin*100:.1f}% |",
            f"| Price Rank | #{market.price_rank} of {market.total_competitors + 1} |",
            f"| vs Market Avg | {market.price_vs_avg:+.1f}% |",
            f"| Market Health | {market.market_health} |",
            ""
        ])

        # Recommendations
        if recommendations:
            lines.extend([
                "## Recommended Actions",
                ""
            ])

            for i, rec in enumerate(recommendations, 1):
                urgency_icon = {"immediate": "🔴", "urgent": "🟠", "normal": "🟡", "can_wait": "🟢"}.get(rec.urgency, "⚪")
                risk_icon = {"high": "⚠️", "medium": "⚡", "low": "✅"}.get(rec.risk_level, "")

                lines.extend([
                    f"### {i}. {rec.title}",
                    "",
                    f"**Strategy**: {rec.strategy.value}",
                    f"**Urgency**: {urgency_icon} {rec.urgency}",
                    f"**Risk**: {risk_icon} {rec.risk_level}",
                    "",
                    f"**Description**: {rec.description}",
                    "",
                    f"**Rationale**: {rec.rationale}",
                    ""
                ])

                if rec.new_price:
                    lines.append(f"**New Price**: ${rec.new_price:.2f} ({rec.price_change:+.2f})")

                if rec.action_items:
                    lines.append("")
                    lines.append("**Action Items**:")
                    for item in rec.action_items:
                        lines.append(f"- [ ] {item}")

                lines.append("")

        else:
            lines.append("No immediate actions recommended. Market position is stable.")

        lines.extend(["", "=" * 60])

        return "\n".join(lines)
