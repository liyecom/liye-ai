"""
Competitor Monitoring Tool for CrewAI Agents.

Provides competitor price tracking and response recommendations
to CrewAI agents.
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


class CompetitorMonitorTool(BaseTool):
    """
    Tool for monitoring competitor prices and getting recommendations.

    Allows agents to:
    - Add and track competitors
    - Monitor price changes
    - Get price alerts
    - Receive competitive response recommendations
    """

    name: str = "Competitor Price Monitor"
    description: str = """
    Monitor competitor prices and get strategic recommendations.

    Actions:
    - add_competitor: Add a new competitor to track
    - record_price: Record a price observation
    - get_alerts: Get current price alerts
    - analyze_market: Analyze market position
    - get_recommendations: Get competitive response recommendations
    - generate_report: Generate competitor monitoring report

    Input format (JSON):
    {
        "action": "add_competitor|record_price|get_alerts|analyze_market|get_recommendations|generate_report",
        "params": {action-specific parameters}
    }
    """

    def __init__(
        self,
        config_path: Optional[str] = None,
        db_path: Optional[str] = None
    ):
        """Initialize competitor tool."""
        super().__init__()
        self.config_path = config_path
        self.db_path = db_path
        self._tracker = None
        self._alert_engine = None
        self._advisor = None

    def _get_tracker(self):
        """Lazy initialization of price tracker."""
        if self._tracker is None:
            from src.competitors.price_tracker import PriceTracker
            self._tracker = PriceTracker(
                config_path=self.config_path,
                db_path=self.db_path
            )
        return self._tracker

    def _get_alert_engine(self):
        """Lazy initialization of alert engine."""
        if self._alert_engine is None:
            from src.competitors.alert_engine import PriceAlertEngine
            self._alert_engine = PriceAlertEngine(
                config_path=self.config_path,
                price_tracker=self._get_tracker(),
                db_path=self.db_path
            )
        return self._alert_engine

    def _get_advisor(self):
        """Lazy initialization of response advisor."""
        if self._advisor is None:
            from src.competitors.response_advisor import ResponseAdvisor
            self._advisor = ResponseAdvisor(
                config_path=self.config_path,
                price_tracker=self._get_tracker()
            )
        return self._advisor

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

            action = params.get('action', 'get_alerts')
            action_params = params.get('params', {})

            if action == 'add_competitor':
                return self._add_competitor(action_params)
            elif action == 'record_price':
                return self._record_price(action_params)
            elif action == 'get_alerts':
                return self._get_alerts(action_params)
            elif action == 'analyze_market':
                return self._analyze_market(action_params)
            elif action == 'get_recommendations':
                return self._get_recommendations(action_params)
            elif action == 'generate_report':
                return self._generate_report(action_params)
            else:
                return f"Unknown action: {action}"

        except Exception as e:
            return f"Error: {str(e)}"

    def _parse_text_query(self, query: str) -> Dict:
        """Parse natural language query."""
        query_lower = query.lower()

        if 'add' in query_lower and 'competitor' in query_lower:
            return {'action': 'add_competitor'}
        elif 'price' in query_lower and 'record' in query_lower:
            return {'action': 'record_price'}
        elif 'alert' in query_lower:
            return {'action': 'get_alerts'}
        elif 'market' in query_lower or 'position' in query_lower:
            return {'action': 'analyze_market'}
        elif 'recommend' in query_lower or 'response' in query_lower:
            return {'action': 'get_recommendations'}
        elif 'report' in query_lower:
            return {'action': 'generate_report'}

        return {'action': 'get_alerts'}

    def _add_competitor(self, params: Dict) -> str:
        """Add a new competitor."""
        tracker = self._get_tracker()

        competitor = tracker.add_competitor(
            asin=params.get('asin', ''),
            title=params.get('title', 'Unknown Product'),
            brand=params.get('brand'),
            category=params.get('category'),
            initial_price=params.get('price'),
            bsr=params.get('bsr'),
            rating=params.get('rating', 0.0),
            review_count=params.get('review_count', 0),
            notes=params.get('notes', '')
        )

        return f"""
## Competitor Added

**ASIN**: {competitor.asin}
**Title**: {competitor.title}
**Brand**: {competitor.brand or 'N/A'}
**Current Price**: ${competitor.current_price:.2f} if competitor.current_price else 'N/A'
**BSR**: {competitor.bsr or 'N/A'}
**Rating**: {competitor.rating}⭐
**Reviews**: {competitor.review_count:,}
**Priority Score**: {competitor.priority_score:.1f}/100

Competitor is now being tracked for price changes.
"""

    def _record_price(self, params: Dict) -> str:
        """Record a price observation."""
        from src.competitors.price_tracker import StockStatus

        tracker = self._get_tracker()

        asin = params.get('asin', '')
        price = params.get('price', 0.0)
        stock = params.get('stock_status', 'in_stock')

        try:
            stock_status = StockStatus(stock)
        except ValueError:
            stock_status = StockStatus.IN_STOCK

        price_point = tracker.record_price(
            asin=asin,
            current_price=price,
            list_price=params.get('list_price'),
            sale_price=params.get('sale_price'),
            coupon_discount=params.get('coupon', 0.0),
            stock_status=stock_status,
            is_deal=params.get('is_deal', False),
            deal_type=params.get('deal_type'),
            bsr=params.get('bsr'),
            rating=params.get('rating'),
            review_count=params.get('review_count')
        )

        if price_point:
            return f"""
## Price Recorded

**ASIN**: {asin}
**Price**: ${price_point.current_price:.2f}
**Effective Price**: ${price_point.effective_price:.2f}
**Stock Status**: {price_point.stock_status.value}
**Is Deal**: {'Yes' if price_point.is_deal else 'No'}
**Timestamp**: {price_point.timestamp.strftime('%Y-%m-%d %H:%M')}
"""
        else:
            return f"Error: Competitor {asin} not found. Add it first."

    def _get_alerts(self, params: Dict) -> str:
        """Get current price alerts."""
        alert_engine = self._get_alert_engine()
        our_price = params.get('our_price')

        # Run checks
        alerts = alert_engine.run_all_checks(our_price)

        if not alerts:
            return "No price alerts at this time. Market is stable."

        lines = [
            "## Price Alerts",
            "",
            f"**Total Alerts**: {len(alerts)}",
            ""
        ]

        severity_icons = {
            'urgent': '🔴', 'critical': '🟠', 'warning': '🟡',
            'opportunity': '🟢', 'info': '🔵'
        }

        for alert in alerts:
            icon = severity_icons.get(alert.severity.value, '⚪')
            lines.extend([
                f"### {icon} {alert.title}",
                f"- **Type**: {alert.alert_type.value}",
                f"- **Severity**: {alert.severity.value}",
                f"- **Competitor**: {alert.competitor_name}",
                f"- **Description**: {alert.description}",
                ""
            ])

            if alert.old_price and alert.new_price:
                lines.append(f"- **Price Change**: ${alert.old_price:.2f} → ${alert.new_price:.2f} ({alert.change_percent:+.1f}%)")
                lines.append("")

        return "\n".join(lines)

    def _analyze_market(self, params: Dict) -> str:
        """Analyze market position."""
        advisor = self._get_advisor()

        our_price = params.get('our_price', 0.0)
        our_cost = params.get('our_cost', 0.0)

        market = advisor.analyze_market(
            our_price=our_price,
            our_cost=our_cost,
            our_bsr=params.get('our_bsr'),
            our_rating=params.get('our_rating', 0.0),
            our_review_count=params.get('our_review_count', 0)
        )

        health_icons = {
            'stable': '🟢', 'rising_prices': '📈', 'price_war': '⚔️',
            'supply_constrained': '📦'
        }
        health_icon = health_icons.get(market.market_health, '⚪')

        return f"""
## Market Analysis

### Our Position
- **Our Price**: ${market.our_price:.2f}
- **Our Margin**: {market.our_margin*100:.1f}%
- **Price Rank**: #{market.price_rank} of {market.total_competitors + 1}
- **vs Market Avg**: {market.price_vs_avg:+.1f}%

### Market Conditions
- **Competitors Tracked**: {market.total_competitors}
- **Market Health**: {health_icon} {market.market_health}
- **Price Range**: ${market.min_competitor_price:.2f} - ${market.max_competitor_price:.2f}
- **Avg Price**: ${market.avg_competitor_price:.2f}

### Market Dynamics
- **Competitors with Price Drops**: {market.competitors_with_drops}
- **Competitors with Price Increases**: {market.competitors_with_increases}
- **Competitors Out of Stock**: {market.competitors_oos}
"""

    def _get_recommendations(self, params: Dict) -> str:
        """Get competitive response recommendations."""
        advisor = self._get_advisor()
        alert_engine = self._get_alert_engine()

        our_price = params.get('our_price', 0.0)
        our_cost = params.get('our_cost', 0.0)

        # Analyze market
        market = advisor.analyze_market(
            our_price=our_price,
            our_cost=our_cost,
            our_bsr=params.get('our_bsr'),
            our_rating=params.get('our_rating', 0.0),
            our_review_count=params.get('our_review_count', 0)
        )

        # Get alerts
        alerts = alert_engine.run_all_checks(our_price)

        # Get recommendations
        recs = advisor.get_top_recommendations(alerts, market, our_cost, limit=5)

        if not recs:
            return "No immediate actions recommended. Market position is stable."

        lines = [
            "## Competitive Response Recommendations",
            "",
            f"**Market Position**: #{market.price_rank} (Margin: {market.our_margin*100:.1f}%)",
            ""
        ]

        urgency_icons = {
            'immediate': '🔴', 'urgent': '🟠', 'normal': '🟡', 'can_wait': '🟢'
        }

        for i, rec in enumerate(recs, 1):
            icon = urgency_icons.get(rec.urgency, '⚪')
            lines.extend([
                f"### {i}. {icon} {rec.title}",
                "",
                f"**Strategy**: {rec.strategy.value}",
                f"**Urgency**: {rec.urgency}",
                f"**Risk**: {rec.risk_level}",
                "",
                f"{rec.description}",
                "",
                f"*Rationale*: {rec.rationale}",
                ""
            ])

            if rec.action_items:
                lines.append("**Action Items**:")
                for item in rec.action_items:
                    lines.append(f"- [ ] {item}")
                lines.append("")

        return "\n".join(lines)

    def _generate_report(self, params: Dict) -> str:
        """Generate competitor monitoring report."""
        tracker = self._get_tracker()
        our_asin = params.get('our_asin')

        return tracker.generate_report(our_asin)
