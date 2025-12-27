"""
Brand Health Tool for CrewAI Agents.

Provides brand health monitoring and strategic recommendations
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


class BrandHealthTool(BaseTool):
    """
    Tool for monitoring brand health and getting strategy recommendations.

    Allows agents to:
    - Track product ratings and reviews
    - Calculate brand health scores
    - Get strategic recommendations (expand vs defend)
    - Generate brand reports
    """

    name: str = "Brand Health Monitor"
    description: str = """
    Monitor brand health and get strategic recommendations.

    Actions:
    - add_product: Add a product to track
    - record_rating: Record a rating observation
    - record_reviews: Record review metrics
    - record_search: Record brand search volume
    - calculate_health: Calculate brand health score
    - get_strategy: Get strategy recommendation
    - get_report: Generate comprehensive brand report

    Input format (JSON):
    {
        "action": "add_product|record_rating|record_reviews|record_search|calculate_health|get_strategy|get_report",
        "params": {action-specific parameters}
    }
    """

    def __init__(
        self,
        config_path: Optional[str] = None,
        db_path: Optional[str] = None
    ):
        """Initialize brand health tool."""
        super().__init__()
        self.config_path = config_path
        self.db_path = db_path
        self._tracker = None
        self._scorer = None
        self._advisor = None

    def _get_tracker(self):
        """Lazy initialization of metrics tracker."""
        if self._tracker is None:
            from src.brand.metrics_tracker import BrandMetricsTracker
            self._tracker = BrandMetricsTracker(
                config_path=self.config_path,
                db_path=self.db_path
            )
        return self._tracker

    def _get_scorer(self):
        """Lazy initialization of health scorer."""
        if self._scorer is None:
            from src.brand.health_scorer import BrandHealthScorer
            self._scorer = BrandHealthScorer(
                config_path=self.config_path,
                metrics_tracker=self._get_tracker()
            )
        return self._scorer

    def _get_advisor(self):
        """Lazy initialization of strategy advisor."""
        if self._advisor is None:
            from src.brand.strategy_advisor import BrandStrategyAdvisor
            self._advisor = BrandStrategyAdvisor(
                config_path=self.config_path,
                metrics_tracker=self._get_tracker(),
                health_scorer=self._get_scorer()
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

            action = params.get('action', 'calculate_health')
            action_params = params.get('params', {})

            if action == 'add_product':
                return self._add_product(action_params)
            elif action == 'record_rating':
                return self._record_rating(action_params)
            elif action == 'record_reviews':
                return self._record_reviews(action_params)
            elif action == 'record_search':
                return self._record_search(action_params)
            elif action == 'calculate_health':
                return self._calculate_health(action_params)
            elif action == 'get_strategy':
                return self._get_strategy(action_params)
            elif action == 'get_report':
                return self._get_report(action_params)
            else:
                return f"Unknown action: {action}"

        except Exception as e:
            return f"Error: {str(e)}"

    def _parse_text_query(self, query: str) -> Dict:
        """Parse natural language query."""
        query_lower = query.lower()

        if 'add' in query_lower and 'product' in query_lower:
            return {'action': 'add_product'}
        elif 'rating' in query_lower and ('record' in query_lower or 'track' in query_lower):
            return {'action': 'record_rating'}
        elif 'review' in query_lower:
            return {'action': 'record_reviews'}
        elif 'search' in query_lower:
            return {'action': 'record_search'}
        elif 'health' in query_lower or 'score' in query_lower:
            return {'action': 'calculate_health'}
        elif 'strategy' in query_lower or 'recommend' in query_lower:
            return {'action': 'get_strategy'}
        elif 'report' in query_lower:
            return {'action': 'get_report'}

        return {'action': 'calculate_health'}

    def _add_product(self, params: Dict) -> str:
        """Add a product to track."""
        tracker = self._get_tracker()

        product = tracker.add_product(
            asin=params.get('asin', ''),
            name=params.get('name', 'Unknown Product'),
            current_rating=params.get('rating', 0.0),
            review_count=params.get('review_count', 0),
            bsr=params.get('bsr'),
            contribution_pct=params.get('contribution_pct', 0.0)
        )

        return f"""
## Product Added

**ASIN**: {product.asin}
**Name**: {product.name}
**Current Rating**: {product.current_rating:.1f}⭐
**Reviews**: {product.review_count:,}
**Contribution**: {product.contribution_pct:.1f}%

Product is now being tracked for brand health monitoring.
"""

    def _record_rating(self, params: Dict) -> str:
        """Record a rating observation."""
        tracker = self._get_tracker()

        asin = params.get('asin', '')
        rating = params.get('rating', 0.0)
        review_count = params.get('review_count', 0)

        snapshot = tracker.record_rating(
            asin=asin,
            rating=rating,
            review_count=review_count,
            new_reviews_24h=params.get('new_reviews_24h', 0)
        )

        if snapshot:
            return f"""
## Rating Recorded

**ASIN**: {asin}
**Rating**: {snapshot.rating:.1f}⭐
**Total Reviews**: {snapshot.review_count:,}
**New Reviews (24h)**: {snapshot.new_reviews_24h}
**Timestamp**: {snapshot.timestamp.strftime('%Y-%m-%d %H:%M')}
"""
        else:
            return f"Error: Product {asin} not found. Add it first."

    def _record_reviews(self, params: Dict) -> str:
        """Record review metrics."""
        from datetime import datetime, timedelta

        tracker = self._get_tracker()

        period_days = params.get('period_days', 7)
        end = datetime.now()
        start = end - timedelta(days=period_days)

        metrics = tracker.record_review_metrics(
            period_start=start,
            period_end=end,
            total_reviews=params.get('total_reviews', 0),
            positive_count=params.get('positive_count', 0),
            neutral_count=params.get('neutral_count', 0),
            negative_count=params.get('negative_count', 0),
            avg_sentiment_score=params.get('avg_sentiment_score', 0.5),
            top_topics=params.get('top_topics', {})
        )

        return f"""
## Review Metrics Recorded

**Period**: {start.strftime('%Y-%m-%d')} to {end.strftime('%Y-%m-%d')}
**Total Reviews**: {metrics.total_reviews}
**Positive**: {metrics.positive_count} ({metrics.positive_pct:.1f}%)
**Neutral**: {metrics.neutral_count}
**Negative**: {metrics.negative_count} ({metrics.negative_pct:.1f}%)
**Avg Sentiment**: {metrics.avg_sentiment_score:.2f}
"""

    def _record_search(self, params: Dict) -> str:
        """Record brand search volume."""
        tracker = self._get_tracker()

        metrics = tracker.record_brand_search(
            brand_keyword=params.get('keyword', 'brand'),
            search_volume=params.get('volume', 0),
            competitor_volumes=params.get('competitor_volumes', {})
        )

        return f"""
## Brand Search Recorded

**Keyword**: {metrics.brand_keyword}
**Search Volume**: {metrics.search_volume:,}
**Share of Voice**: {metrics.share_of_voice:.1f}%
**Trend**: {metrics.search_trend.title()}
"""

    def _calculate_health(self, params: Dict) -> str:
        """Calculate brand health score."""
        scorer = self._get_scorer()

        score = scorer.calculate_score(
            current_rating=params.get('rating'),
            rating_trend=params.get('trend'),
            positive_review_pct=params.get('positive_pct'),
            review_velocity=params.get('review_velocity'),
            brand_search_volume=params.get('search_volume'),
            share_of_voice=params.get('share_of_voice'),
            seller_feedback_score=params.get('seller_feedback')
        )

        return scorer.generate_health_report(score)

    def _get_strategy(self, params: Dict) -> str:
        """Get strategy recommendation."""
        advisor = self._get_advisor()

        recommendation = advisor.recommend_strategy(
            competitor_gap=params.get('competitor_gap', 0.0),
            market_growth=params.get('market_growth', 'stable'),
            budget_available=params.get('budget', 10000.0)
        )

        return advisor.generate_strategy_report(recommendation)

    def _get_report(self, params: Dict) -> str:
        """Generate comprehensive brand report."""
        report_type = params.get('type', 'all')

        lines = []

        if report_type in ['all', 'metrics']:
            tracker = self._get_tracker()
            lines.append(tracker.generate_metrics_report())
            lines.append("")

        if report_type in ['all', 'health']:
            scorer = self._get_scorer()
            score = scorer.calculate_score()
            lines.append(scorer.generate_health_report(score))
            lines.append("")

        if report_type in ['all', 'strategy']:
            advisor = self._get_advisor()
            recommendation = advisor.recommend_strategy()
            lines.append(advisor.generate_strategy_report(recommendation))

        return "\n".join(lines)
