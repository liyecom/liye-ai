"""
Brand Metrics Tracker for Amazon Growth OS.

Tracks rating trajectories, review metrics, and brand search volume
to monitor overall brand health over time.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from enum import Enum
import yaml
import statistics


class RatingTrend(Enum):
    """Rating trajectory direction."""
    IMPROVING = "improving"
    STABLE = "stable"
    DECLINING = "declining"
    VOLATILE = "volatile"


class SentimentCategory(Enum):
    """Review sentiment categories."""
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"


@dataclass
class RatingSnapshot:
    """Point-in-time rating observation."""
    timestamp: datetime
    rating: float
    review_count: int
    new_reviews_24h: int = 0

    def to_dict(self) -> Dict:
        return {
            'timestamp': self.timestamp.isoformat(),
            'rating': self.rating,
            'review_count': self.review_count,
            'new_reviews_24h': self.new_reviews_24h
        }


@dataclass
class ReviewMetrics:
    """Aggregated review metrics for a period."""
    period_start: datetime
    period_end: datetime
    total_reviews: int
    positive_count: int
    neutral_count: int
    negative_count: int
    avg_sentiment_score: float
    top_topics: Dict[str, int] = field(default_factory=dict)

    @property
    def positive_pct(self) -> float:
        if self.total_reviews == 0:
            return 0.0
        return (self.positive_count / self.total_reviews) * 100

    @property
    def negative_pct(self) -> float:
        if self.total_reviews == 0:
            return 0.0
        return (self.negative_count / self.total_reviews) * 100

    def to_dict(self) -> Dict:
        return {
            'period_start': self.period_start.isoformat(),
            'period_end': self.period_end.isoformat(),
            'total_reviews': self.total_reviews,
            'positive_count': self.positive_count,
            'neutral_count': self.neutral_count,
            'negative_count': self.negative_count,
            'positive_pct': round(self.positive_pct, 1),
            'negative_pct': round(self.negative_pct, 1),
            'avg_sentiment_score': round(self.avg_sentiment_score, 3),
            'top_topics': self.top_topics
        }


@dataclass
class BrandSearchMetrics:
    """Brand search volume metrics."""
    timestamp: datetime
    brand_keyword: str
    search_volume: int
    search_trend: str  # "increasing", "stable", "decreasing"
    share_of_voice: float  # % vs competitors
    competitor_volumes: Dict[str, int] = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return {
            'timestamp': self.timestamp.isoformat(),
            'brand_keyword': self.brand_keyword,
            'search_volume': self.search_volume,
            'search_trend': self.search_trend,
            'share_of_voice': round(self.share_of_voice, 2),
            'competitor_volumes': self.competitor_volumes
        }


@dataclass
class ProductMetrics:
    """Individual product (ASIN) metrics."""
    asin: str
    name: str
    current_rating: float
    review_count: int
    bsr: Optional[int] = None
    contribution_pct: float = 0.0
    rating_history: List[RatingSnapshot] = field(default_factory=list)

    def get_rating_trend(self, days: int = 30) -> RatingTrend:
        """Calculate rating trend over specified period."""
        if len(self.rating_history) < 2:
            return RatingTrend.STABLE

        cutoff = datetime.now() - timedelta(days=days)
        recent = [s for s in self.rating_history if s.timestamp >= cutoff]

        if len(recent) < 2:
            return RatingTrend.STABLE

        # Sort by timestamp
        recent.sort(key=lambda x: x.timestamp)

        # Calculate average of first and second half
        mid = len(recent) // 2
        first_half_avg = statistics.mean([s.rating for s in recent[:mid]]) if mid > 0 else recent[0].rating
        second_half_avg = statistics.mean([s.rating for s in recent[mid:]]) if mid < len(recent) else recent[-1].rating

        diff = second_half_avg - first_half_avg

        # Check for volatility
        if len(recent) >= 3:
            stdev = statistics.stdev([s.rating for s in recent])
            if stdev > 0.15:
                return RatingTrend.VOLATILE

        if diff > 0.05:
            return RatingTrend.IMPROVING
        elif diff < -0.05:
            return RatingTrend.DECLINING
        else:
            return RatingTrend.STABLE

    def to_dict(self) -> Dict:
        return {
            'asin': self.asin,
            'name': self.name,
            'current_rating': self.current_rating,
            'review_count': self.review_count,
            'bsr': self.bsr,
            'contribution_pct': self.contribution_pct,
            'rating_trend': self.get_rating_trend().value,
            'history_points': len(self.rating_history)
        }


class BrandMetricsTracker:
    """
    Tracks brand metrics including ratings, reviews, and search volume.

    Provides historical analysis and trend detection for brand health monitoring.
    """

    def __init__(
        self,
        config_path: Optional[str] = None,
        db_path: Optional[str] = None
    ):
        """Initialize brand metrics tracker."""
        self.config_path = config_path or "config/brand_health.yaml"
        self.db_path = db_path
        self.config = self._load_config()

        # In-memory storage
        self.products: Dict[str, ProductMetrics] = {}
        self.review_metrics: List[ReviewMetrics] = []
        self.search_metrics: List[BrandSearchMetrics] = []

        # Initialize from config
        self._init_from_config()

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
            'brand': {'name': 'Unknown Brand'},
            'ratings': {
                'current_rating': 0.0,
                'target_rating': 4.5,
                'thresholds': {
                    'critical_drop': 0.2,
                    'warning_drop': 0.1
                }
            },
            'sentiment': {
                'thresholds': {
                    'positive': 0.6,
                    'neutral': 0.4
                }
            }
        }

    def _init_from_config(self):
        """Initialize products from configuration."""
        portfolio = self.config.get('portfolio', {})

        # Add hero products
        for product in portfolio.get('hero_products', []):
            self.add_product(
                asin=product.get('asin', ''),
                name=product.get('name', 'Unknown'),
                contribution_pct=product.get('contribution_pct', 0.0)
            )

        # Add secondary products
        for product in portfolio.get('secondary_products', []):
            self.add_product(
                asin=product.get('asin', ''),
                name=product.get('name', 'Unknown'),
                contribution_pct=product.get('contribution_pct', 0.0)
            )

    def add_product(
        self,
        asin: str,
        name: str,
        current_rating: float = 0.0,
        review_count: int = 0,
        bsr: Optional[int] = None,
        contribution_pct: float = 0.0
    ) -> ProductMetrics:
        """Add a product to track."""
        product = ProductMetrics(
            asin=asin,
            name=name,
            current_rating=current_rating,
            review_count=review_count,
            bsr=bsr,
            contribution_pct=contribution_pct
        )
        self.products[asin] = product
        return product

    def record_rating(
        self,
        asin: str,
        rating: float,
        review_count: int,
        new_reviews_24h: int = 0,
        timestamp: Optional[datetime] = None
    ) -> Optional[RatingSnapshot]:
        """Record a rating observation for a product."""
        if asin not in self.products:
            return None

        snapshot = RatingSnapshot(
            timestamp=timestamp or datetime.now(),
            rating=rating,
            review_count=review_count,
            new_reviews_24h=new_reviews_24h
        )

        product = self.products[asin]
        product.current_rating = rating
        product.review_count = review_count
        product.rating_history.append(snapshot)

        return snapshot

    def record_review_metrics(
        self,
        period_start: datetime,
        period_end: datetime,
        total_reviews: int,
        positive_count: int,
        neutral_count: int,
        negative_count: int,
        avg_sentiment_score: float,
        top_topics: Optional[Dict[str, int]] = None
    ) -> ReviewMetrics:
        """Record aggregated review metrics for a period."""
        metrics = ReviewMetrics(
            period_start=period_start,
            period_end=period_end,
            total_reviews=total_reviews,
            positive_count=positive_count,
            neutral_count=neutral_count,
            negative_count=negative_count,
            avg_sentiment_score=avg_sentiment_score,
            top_topics=top_topics or {}
        )
        self.review_metrics.append(metrics)
        return metrics

    def record_brand_search(
        self,
        brand_keyword: str,
        search_volume: int,
        competitor_volumes: Optional[Dict[str, int]] = None,
        timestamp: Optional[datetime] = None
    ) -> BrandSearchMetrics:
        """Record brand search volume metrics."""
        competitor_volumes = competitor_volumes or {}

        # Calculate share of voice
        total_volume = search_volume + sum(competitor_volumes.values())
        share_of_voice = (search_volume / total_volume * 100) if total_volume > 0 else 0.0

        # Determine trend from history
        trend = self._calculate_search_trend(brand_keyword, search_volume)

        metrics = BrandSearchMetrics(
            timestamp=timestamp or datetime.now(),
            brand_keyword=brand_keyword,
            search_volume=search_volume,
            search_trend=trend,
            share_of_voice=share_of_voice,
            competitor_volumes=competitor_volumes
        )
        self.search_metrics.append(metrics)
        return metrics

    def _calculate_search_trend(self, keyword: str, current_volume: int) -> str:
        """Calculate search volume trend from history."""
        # Get previous metrics for this keyword
        history = [m for m in self.search_metrics if m.brand_keyword == keyword]

        if len(history) < 2:
            return "stable"

        # Compare with average of last 3 periods
        recent = history[-3:] if len(history) >= 3 else history
        avg_volume = statistics.mean([m.search_volume for m in recent])

        change_pct = ((current_volume - avg_volume) / avg_volume * 100) if avg_volume > 0 else 0

        if change_pct > 10:
            return "increasing"
        elif change_pct < -10:
            return "decreasing"
        else:
            return "stable"

    def get_portfolio_rating(self) -> float:
        """Get weighted average rating across portfolio."""
        if not self.products:
            return 0.0

        total_weight = sum(p.contribution_pct for p in self.products.values())
        if total_weight == 0:
            # Equal weight if no contribution data
            return statistics.mean([p.current_rating for p in self.products.values()])

        weighted_sum = sum(
            p.current_rating * p.contribution_pct
            for p in self.products.values()
        )
        return weighted_sum / total_weight

    def get_portfolio_trend(self) -> RatingTrend:
        """Get overall portfolio rating trend."""
        trends = [p.get_rating_trend() for p in self.products.values()]

        if not trends:
            return RatingTrend.STABLE

        # Count trend directions
        improving = sum(1 for t in trends if t == RatingTrend.IMPROVING)
        declining = sum(1 for t in trends if t == RatingTrend.DECLINING)
        volatile = sum(1 for t in trends if t == RatingTrend.VOLATILE)

        # Majority wins
        if volatile > len(trends) / 2:
            return RatingTrend.VOLATILE
        elif improving > declining:
            return RatingTrend.IMPROVING
        elif declining > improving:
            return RatingTrend.DECLINING
        else:
            return RatingTrend.STABLE

    def get_review_summary(self, days: int = 30) -> Dict:
        """Get review metrics summary for recent period."""
        cutoff = datetime.now() - timedelta(days=days)
        recent = [m for m in self.review_metrics if m.period_end >= cutoff]

        if not recent:
            return {
                'period_days': days,
                'total_reviews': 0,
                'positive_pct': 0.0,
                'negative_pct': 0.0,
                'avg_sentiment': 0.0,
                'top_topics': {}
            }

        total = sum(m.total_reviews for m in recent)
        positive = sum(m.positive_count for m in recent)
        negative = sum(m.negative_count for m in recent)

        # Aggregate topics
        topics: Dict[str, int] = {}
        for m in recent:
            for topic, count in m.top_topics.items():
                topics[topic] = topics.get(topic, 0) + count

        # Sort topics by count
        sorted_topics = dict(sorted(topics.items(), key=lambda x: x[1], reverse=True)[:5])

        return {
            'period_days': days,
            'total_reviews': total,
            'positive_pct': round((positive / total * 100) if total > 0 else 0, 1),
            'negative_pct': round((negative / total * 100) if total > 0 else 0, 1),
            'avg_sentiment': round(
                statistics.mean([m.avg_sentiment_score for m in recent]), 3
            ) if recent else 0.0,
            'top_topics': sorted_topics
        }

    def get_search_summary(self) -> Dict:
        """Get brand search volume summary."""
        if not self.search_metrics:
            return {
                'total_brand_volume': 0,
                'share_of_voice': 0.0,
                'trend': 'unknown',
                'keywords': {}
            }

        # Get latest metrics for each keyword
        latest: Dict[str, BrandSearchMetrics] = {}
        for m in self.search_metrics:
            if m.brand_keyword not in latest or m.timestamp > latest[m.brand_keyword].timestamp:
                latest[m.brand_keyword] = m

        total_volume = sum(m.search_volume for m in latest.values())
        avg_sov = statistics.mean([m.share_of_voice for m in latest.values()]) if latest else 0.0

        # Determine overall trend
        trends = [m.search_trend for m in latest.values()]
        if trends.count("increasing") > trends.count("decreasing"):
            overall_trend = "increasing"
        elif trends.count("decreasing") > trends.count("increasing"):
            overall_trend = "decreasing"
        else:
            overall_trend = "stable"

        return {
            'total_brand_volume': total_volume,
            'share_of_voice': round(avg_sov, 2),
            'trend': overall_trend,
            'keywords': {k: v.search_volume for k, v in latest.items()}
        }

    def get_competitor_comparison(self) -> Dict:
        """Compare brand metrics with competitors."""
        target_rating = self.config.get('ratings', {}).get('target_rating', 4.5)
        competitor_avg = self.config.get('ratings', {}).get('competitor_avg_rating', 4.5)

        portfolio_rating = self.get_portfolio_rating()
        rating_gap = portfolio_rating - competitor_avg

        # Search volume comparison
        search_summary = self.get_search_summary()

        return {
            'our_rating': round(portfolio_rating, 2),
            'competitor_avg_rating': competitor_avg,
            'target_rating': target_rating,
            'rating_gap_vs_competitors': round(rating_gap, 2),
            'rating_gap_vs_target': round(portfolio_rating - target_rating, 2),
            'our_share_of_voice': search_summary.get('share_of_voice', 0.0),
            'competitive_position': self._assess_position(rating_gap, search_summary.get('share_of_voice', 0.0))
        }

    def _assess_position(self, rating_gap: float, share_of_voice: float) -> str:
        """Assess competitive position."""
        if rating_gap >= 0.2 and share_of_voice >= 30:
            return "market_leader"
        elif rating_gap >= 0 and share_of_voice >= 20:
            return "strong_contender"
        elif rating_gap >= -0.2 and share_of_voice >= 10:
            return "competitive"
        elif rating_gap >= -0.3:
            return "needs_improvement"
        else:
            return "at_risk"

    def generate_metrics_report(self) -> str:
        """Generate a comprehensive metrics report."""
        brand_name = self.config.get('brand', {}).get('name', 'Unknown Brand')
        portfolio_rating = self.get_portfolio_rating()
        portfolio_trend = self.get_portfolio_trend()
        review_summary = self.get_review_summary()
        search_summary = self.get_search_summary()
        competitor_comparison = self.get_competitor_comparison()

        trend_icons = {
            'improving': '📈',
            'stable': '➡️',
            'declining': '📉',
            'volatile': '📊'
        }
        trend_icon = trend_icons.get(portfolio_trend.value, '➡️')

        position_icons = {
            'market_leader': '👑',
            'strong_contender': '🥈',
            'competitive': '⚔️',
            'needs_improvement': '⚠️',
            'at_risk': '🚨'
        }
        position = competitor_comparison.get('competitive_position', 'unknown')
        position_icon = position_icons.get(position, '❓')

        lines = [
            f"# Brand Metrics Report: {brand_name}",
            f"*Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}*",
            "",
            "## Portfolio Overview",
            "",
            f"| Metric | Value |",
            f"|--------|-------|",
            f"| Products Tracked | {len(self.products)} |",
            f"| Portfolio Rating | {portfolio_rating:.2f} ⭐ |",
            f"| Rating Trend | {trend_icon} {portfolio_trend.value.title()} |",
            f"| Target Rating | {self.config.get('ratings', {}).get('target_rating', 4.5):.1f} |",
            f"| Gap to Target | {competitor_comparison.get('rating_gap_vs_target', 0):+.2f} |",
            "",
            "## Product Breakdown",
            "",
            "| ASIN | Name | Rating | Reviews | Trend | Contribution |",
            "|------|------|--------|---------|-------|--------------|"
        ]

        for p in sorted(self.products.values(), key=lambda x: x.contribution_pct, reverse=True):
            trend = p.get_rating_trend()
            trend_icon = trend_icons.get(trend.value, '➡️')
            lines.append(
                f"| {p.asin} | {p.name[:20]} | {p.current_rating:.1f}⭐ | "
                f"{p.review_count:,} | {trend_icon} | {p.contribution_pct:.1f}% |"
            )

        lines.extend([
            "",
            "## Review Sentiment (Last 30 Days)",
            "",
            f"| Metric | Value |",
            f"|--------|-------|",
            f"| Total Reviews | {review_summary.get('total_reviews', 0):,} |",
            f"| Positive | {review_summary.get('positive_pct', 0):.1f}% |",
            f"| Negative | {review_summary.get('negative_pct', 0):.1f}% |",
            f"| Avg Sentiment | {review_summary.get('avg_sentiment', 0):.2f} |",
            ""
        ])

        if review_summary.get('top_topics'):
            lines.append("**Top Topics:**")
            for topic, count in review_summary.get('top_topics', {}).items():
                lines.append(f"- {topic}: {count} mentions")
            lines.append("")

        lines.extend([
            "## Brand Search Volume",
            "",
            f"| Metric | Value |",
            f"|--------|-------|",
            f"| Total Brand Volume | {search_summary.get('total_brand_volume', 0):,} |",
            f"| Share of Voice | {search_summary.get('share_of_voice', 0):.1f}% |",
            f"| Volume Trend | {search_summary.get('trend', 'unknown').title()} |",
            ""
        ])

        lines.extend([
            "## Competitive Position",
            "",
            f"| Metric | Value |",
            f"|--------|-------|",
            f"| Our Rating | {competitor_comparison.get('our_rating', 0):.2f}⭐ |",
            f"| Competitor Avg | {competitor_comparison.get('competitor_avg_rating', 0):.2f}⭐ |",
            f"| Rating Gap | {competitor_comparison.get('rating_gap_vs_competitors', 0):+.2f} |",
            f"| Position | {position_icon} {position.replace('_', ' ').title()} |",
            ""
        ])

        return "\n".join(lines)
