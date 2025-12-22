"""
Brand Health Scoring Engine for Amazon Growth OS.

Calculates a comprehensive brand health index based on multiple metrics
including ratings, reviews, sentiment, and brand search volume.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from enum import Enum
import yaml

from .metrics_tracker import (
    BrandMetricsTracker,
    RatingTrend,
    SentimentCategory
)


class HealthLevel(Enum):
    """Brand health level classification."""
    EXCELLENT = "excellent"      # 80-100
    GOOD = "good"                # 65-79
    FAIR = "fair"                # 50-64
    POOR = "poor"                # 35-49
    CRITICAL = "critical"        # 0-34


@dataclass
class ComponentScore:
    """Individual component score with details."""
    name: str
    weight: float
    raw_score: float  # 0-100
    weighted_score: float
    details: Dict = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return {
            'name': self.name,
            'weight': self.weight,
            'raw_score': round(self.raw_score, 1),
            'weighted_score': round(self.weighted_score, 2),
            'details': self.details
        }


@dataclass
class HealthScore:
    """Complete brand health score."""
    timestamp: datetime
    total_score: float
    health_level: HealthLevel
    components: List[ComponentScore]
    strengths: List[str]
    weaknesses: List[str]
    trend_vs_last: Optional[float] = None  # Change from last score

    def to_dict(self) -> Dict:
        return {
            'timestamp': self.timestamp.isoformat(),
            'total_score': round(self.total_score, 1),
            'health_level': self.health_level.value,
            'components': [c.to_dict() for c in self.components],
            'strengths': self.strengths,
            'weaknesses': self.weaknesses,
            'trend_vs_last': round(self.trend_vs_last, 1) if self.trend_vs_last else None
        }


class BrandHealthScorer:
    """
    Calculates comprehensive brand health scores.

    Uses weighted components including:
    - Rating score (current vs target)
    - Rating trend (trajectory direction)
    - Review sentiment (positive/negative ratio)
    - Review velocity (new reviews per period)
    - Brand search volume
    - Share of voice
    - Seller feedback (account health)
    """

    def __init__(
        self,
        config_path: Optional[str] = None,
        metrics_tracker: Optional[BrandMetricsTracker] = None
    ):
        """Initialize health scorer."""
        self.config_path = config_path or "config/brand_health.yaml"
        self.config = self._load_config()
        self.metrics_tracker = metrics_tracker

        # Score history
        self.score_history: List[HealthScore] = []

        # Load weights from config
        weights_config = self.config.get('health_score', {}).get('weights', {})
        self.weights = {
            'rating_score': weights_config.get('rating_score', 25),
            'rating_trend': weights_config.get('rating_trend', 15),
            'review_sentiment': weights_config.get('review_sentiment', 20),
            'review_velocity': weights_config.get('review_velocity', 10),
            'brand_search': weights_config.get('brand_search', 15),
            'share_of_voice': weights_config.get('share_of_voice', 10),
            'seller_feedback': weights_config.get('seller_feedback', 5)
        }

        # Normalize weights to 100
        total_weight = sum(self.weights.values())
        if total_weight != 100:
            factor = 100 / total_weight
            self.weights = {k: v * factor for k, v in self.weights.items()}

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
            'ratings': {
                'target_rating': 4.5,
                'competitor_avg_rating': 4.5
            },
            'health_score': {
                'weights': {
                    'rating_score': 25,
                    'rating_trend': 15,
                    'review_sentiment': 20,
                    'review_velocity': 10,
                    'brand_search': 15,
                    'share_of_voice': 10,
                    'seller_feedback': 5
                },
                'ranges': {
                    'excellent': 80,
                    'good': 65,
                    'fair': 50,
                    'poor': 35,
                    'critical': 0
                }
            }
        }

    def calculate_score(
        self,
        current_rating: Optional[float] = None,
        rating_trend: Optional[str] = None,
        positive_review_pct: Optional[float] = None,
        review_velocity: Optional[int] = None,
        brand_search_volume: Optional[int] = None,
        share_of_voice: Optional[float] = None,
        seller_feedback_score: Optional[float] = None
    ) -> HealthScore:
        """
        Calculate comprehensive brand health score.

        Args:
            current_rating: Current average rating (1.0-5.0)
            rating_trend: Trend direction ("improving", "stable", "declining", "volatile")
            positive_review_pct: % of positive reviews (0-100)
            review_velocity: New reviews per week
            brand_search_volume: Monthly brand keyword searches
            share_of_voice: % of search volume vs competitors (0-100)
            seller_feedback_score: Amazon seller feedback score (0-100)

        Returns:
            HealthScore with components and recommendations
        """
        components = []
        strengths = []
        weaknesses = []

        # Get data from metrics tracker if available
        if self.metrics_tracker:
            if current_rating is None:
                current_rating = self.metrics_tracker.get_portfolio_rating()
            if rating_trend is None:
                rating_trend = self.metrics_tracker.get_portfolio_trend().value

            review_summary = self.metrics_tracker.get_review_summary()
            if positive_review_pct is None:
                positive_review_pct = review_summary.get('positive_pct', 50)

            search_summary = self.metrics_tracker.get_search_summary()
            if share_of_voice is None:
                share_of_voice = search_summary.get('share_of_voice', 0)

        # Set defaults for missing values
        current_rating = current_rating or 4.0
        rating_trend = rating_trend or "stable"
        positive_review_pct = positive_review_pct or 50.0
        review_velocity = review_velocity or 10
        brand_search_volume = brand_search_volume or 1000
        share_of_voice = share_of_voice or 10.0
        seller_feedback_score = seller_feedback_score or 90.0

        # 1. Rating Score (how close to target)
        target_rating = self.config.get('ratings', {}).get('target_rating', 4.5)
        rating_score = self._calculate_rating_score(current_rating, target_rating)
        components.append(ComponentScore(
            name="Rating Score",
            weight=self.weights['rating_score'],
            raw_score=rating_score,
            weighted_score=rating_score * self.weights['rating_score'] / 100,
            details={
                'current_rating': current_rating,
                'target_rating': target_rating,
                'gap': round(current_rating - target_rating, 2)
            }
        ))
        if rating_score >= 80:
            strengths.append(f"Strong rating ({current_rating:.1f}⭐) close to target")
        elif rating_score < 50:
            weaknesses.append(f"Rating ({current_rating:.1f}⭐) significantly below target ({target_rating})")

        # 2. Rating Trend
        trend_score = self._calculate_trend_score(rating_trend)
        components.append(ComponentScore(
            name="Rating Trend",
            weight=self.weights['rating_trend'],
            raw_score=trend_score,
            weighted_score=trend_score * self.weights['rating_trend'] / 100,
            details={'trend': rating_trend}
        ))
        if rating_trend == "improving":
            strengths.append("Rating trend is improving")
        elif rating_trend == "declining":
            weaknesses.append("Rating trend is declining - needs attention")

        # 3. Review Sentiment
        sentiment_score = self._calculate_sentiment_score(positive_review_pct)
        components.append(ComponentScore(
            name="Review Sentiment",
            weight=self.weights['review_sentiment'],
            raw_score=sentiment_score,
            weighted_score=sentiment_score * self.weights['review_sentiment'] / 100,
            details={'positive_pct': positive_review_pct}
        ))
        if positive_review_pct >= 80:
            strengths.append(f"Excellent sentiment ({positive_review_pct:.0f}% positive)")
        elif positive_review_pct < 60:
            weaknesses.append(f"Poor sentiment ({positive_review_pct:.0f}% positive) needs improvement")

        # 4. Review Velocity
        velocity_score = self._calculate_velocity_score(review_velocity)
        components.append(ComponentScore(
            name="Review Velocity",
            weight=self.weights['review_velocity'],
            raw_score=velocity_score,
            weighted_score=velocity_score * self.weights['review_velocity'] / 100,
            details={'reviews_per_week': review_velocity}
        ))
        if review_velocity >= 20:
            strengths.append(f"High review velocity ({review_velocity}/week)")
        elif review_velocity < 5:
            weaknesses.append("Low review velocity - consider review generation campaign")

        # 5. Brand Search Volume
        search_score = self._calculate_search_score(brand_search_volume)
        components.append(ComponentScore(
            name="Brand Search",
            weight=self.weights['brand_search'],
            raw_score=search_score,
            weighted_score=search_score * self.weights['brand_search'] / 100,
            details={'monthly_volume': brand_search_volume}
        ))
        if brand_search_volume >= 5000:
            strengths.append(f"Strong brand awareness ({brand_search_volume:,} monthly searches)")
        elif brand_search_volume < 500:
            weaknesses.append("Low brand search volume - invest in brand building")

        # 6. Share of Voice
        sov_score = self._calculate_sov_score(share_of_voice)
        components.append(ComponentScore(
            name="Share of Voice",
            weight=self.weights['share_of_voice'],
            raw_score=sov_score,
            weighted_score=sov_score * self.weights['share_of_voice'] / 100,
            details={'share_pct': share_of_voice}
        ))
        if share_of_voice >= 30:
            strengths.append(f"Market leader in search ({share_of_voice:.0f}% SoV)")
        elif share_of_voice < 10:
            weaknesses.append("Low share of voice vs competitors")

        # 7. Seller Feedback
        feedback_score = min(100, seller_feedback_score)
        components.append(ComponentScore(
            name="Seller Feedback",
            weight=self.weights['seller_feedback'],
            raw_score=feedback_score,
            weighted_score=feedback_score * self.weights['seller_feedback'] / 100,
            details={'feedback_score': seller_feedback_score}
        ))
        if seller_feedback_score >= 95:
            strengths.append("Excellent seller account health")
        elif seller_feedback_score < 80:
            weaknesses.append("Seller feedback below threshold - address customer issues")

        # Calculate total score
        total_score = sum(c.weighted_score for c in components)

        # Determine health level
        health_level = self._get_health_level(total_score)

        # Calculate trend vs last
        trend_vs_last = None
        if self.score_history:
            trend_vs_last = total_score - self.score_history[-1].total_score

        # Create score object
        score = HealthScore(
            timestamp=datetime.now(),
            total_score=total_score,
            health_level=health_level,
            components=components,
            strengths=strengths[:3],  # Top 3
            weaknesses=weaknesses[:3],  # Top 3
            trend_vs_last=trend_vs_last
        )

        # Store in history
        self.score_history.append(score)

        return score

    def _calculate_rating_score(self, current: float, target: float) -> float:
        """Calculate score based on rating vs target."""
        if current >= target:
            return 100.0
        elif current >= target - 0.1:
            return 90.0
        elif current >= target - 0.2:
            return 75.0
        elif current >= target - 0.3:
            return 60.0
        elif current >= target - 0.5:
            return 40.0
        else:
            return max(0, 20 + (current - 3.0) * 20)

    def _calculate_trend_score(self, trend: str) -> float:
        """Calculate score based on rating trend."""
        trend_scores = {
            'improving': 100.0,
            'stable': 70.0,
            'declining': 30.0,
            'volatile': 50.0
        }
        return trend_scores.get(trend.lower(), 50.0)

    def _calculate_sentiment_score(self, positive_pct: float) -> float:
        """Calculate score based on positive review percentage."""
        if positive_pct >= 90:
            return 100.0
        elif positive_pct >= 80:
            return 90.0
        elif positive_pct >= 70:
            return 75.0
        elif positive_pct >= 60:
            return 55.0
        elif positive_pct >= 50:
            return 35.0
        else:
            return max(0, positive_pct * 0.7)

    def _calculate_velocity_score(self, reviews_per_week: int) -> float:
        """Calculate score based on review velocity."""
        if reviews_per_week >= 30:
            return 100.0
        elif reviews_per_week >= 20:
            return 85.0
        elif reviews_per_week >= 10:
            return 70.0
        elif reviews_per_week >= 5:
            return 50.0
        elif reviews_per_week >= 2:
            return 30.0
        else:
            return max(0, reviews_per_week * 15)

    def _calculate_search_score(self, monthly_volume: int) -> float:
        """Calculate score based on brand search volume."""
        if monthly_volume >= 10000:
            return 100.0
        elif monthly_volume >= 5000:
            return 85.0
        elif monthly_volume >= 2000:
            return 70.0
        elif monthly_volume >= 1000:
            return 55.0
        elif monthly_volume >= 500:
            return 40.0
        else:
            return max(0, monthly_volume / 500 * 40)

    def _calculate_sov_score(self, share_pct: float) -> float:
        """Calculate score based on share of voice."""
        if share_pct >= 40:
            return 100.0
        elif share_pct >= 30:
            return 85.0
        elif share_pct >= 20:
            return 70.0
        elif share_pct >= 15:
            return 55.0
        elif share_pct >= 10:
            return 40.0
        else:
            return max(0, share_pct * 4)

    def _get_health_level(self, score: float) -> HealthLevel:
        """Determine health level from score."""
        ranges = self.config.get('health_score', {}).get('ranges', {})

        if score >= ranges.get('excellent', 80):
            return HealthLevel.EXCELLENT
        elif score >= ranges.get('good', 65):
            return HealthLevel.GOOD
        elif score >= ranges.get('fair', 50):
            return HealthLevel.FAIR
        elif score >= ranges.get('poor', 35):
            return HealthLevel.POOR
        else:
            return HealthLevel.CRITICAL

    def get_score_trend(self, days: int = 30) -> Dict:
        """Get score trend over time."""
        cutoff = datetime.now() - timedelta(days=days)
        recent = [s for s in self.score_history if s.timestamp >= cutoff]

        if len(recent) < 2:
            return {
                'period_days': days,
                'data_points': len(recent),
                'trend': 'insufficient_data',
                'change': 0.0
            }

        first_score = recent[0].total_score
        last_score = recent[-1].total_score
        change = last_score - first_score

        if change > 5:
            trend = "improving"
        elif change < -5:
            trend = "declining"
        else:
            trend = "stable"

        return {
            'period_days': days,
            'data_points': len(recent),
            'start_score': round(first_score, 1),
            'end_score': round(last_score, 1),
            'change': round(change, 1),
            'trend': trend
        }

    def generate_health_report(self, score: Optional[HealthScore] = None) -> str:
        """Generate detailed health score report."""
        if score is None:
            if not self.score_history:
                return "No health scores calculated yet."
            score = self.score_history[-1]

        brand_name = self.config.get('brand', {}).get('name', 'Unknown Brand')

        level_icons = {
            'excellent': '🟢',
            'good': '🔵',
            'fair': '🟡',
            'poor': '🟠',
            'critical': '🔴'
        }
        level_icon = level_icons.get(score.health_level.value, '⚪')

        trend_indicator = ""
        if score.trend_vs_last is not None:
            if score.trend_vs_last > 0:
                trend_indicator = f" (↑{score.trend_vs_last:+.1f})"
            elif score.trend_vs_last < 0:
                trend_indicator = f" (↓{score.trend_vs_last:.1f})"

        lines = [
            f"# Brand Health Report: {brand_name}",
            f"*Generated: {score.timestamp.strftime('%Y-%m-%d %H:%M')}*",
            "",
            "## Overall Health Score",
            "",
            f"### {level_icon} {score.total_score:.1f}/100 - {score.health_level.value.title()}{trend_indicator}",
            "",
            "---",
            "",
            "## Score Components",
            "",
            "| Component | Weight | Score | Contribution |",
            "|-----------|--------|-------|--------------|"
        ]

        for c in sorted(score.components, key=lambda x: x.weighted_score, reverse=True):
            score_bar = "█" * int(c.raw_score / 10) + "░" * (10 - int(c.raw_score / 10))
            lines.append(
                f"| {c.name} | {c.weight:.0f}% | {c.raw_score:.0f} {score_bar} | {c.weighted_score:.1f} |"
            )

        if score.strengths:
            lines.extend([
                "",
                "## 💪 Strengths",
                ""
            ])
            for s in score.strengths:
                lines.append(f"- {s}")

        if score.weaknesses:
            lines.extend([
                "",
                "## ⚠️ Areas for Improvement",
                ""
            ])
            for w in score.weaknesses:
                lines.append(f"- {w}")

        # Add component details
        lines.extend([
            "",
            "## Component Details",
            ""
        ])

        for c in score.components:
            lines.append(f"### {c.name}")
            for key, value in c.details.items():
                lines.append(f"- **{key.replace('_', ' ').title()}**: {value}")
            lines.append("")

        # Add recommendations based on health level
        lines.extend([
            "## Recommended Actions",
            ""
        ])

        strategy_actions = self.config.get('strategy', {}).get('actions', {})

        if score.health_level in [HealthLevel.EXCELLENT, HealthLevel.GOOD]:
            lines.append("**Strategy: Expansion** 🚀")
            for action in strategy_actions.get('expansion', [])[:3]:
                lines.append(f"- [ ] {action}")
        elif score.health_level == HealthLevel.FAIR:
            lines.append("**Strategy: Maintenance** 🛡️")
            for action in strategy_actions.get('maintenance', [])[:3]:
                lines.append(f"- [ ] {action}")
        else:
            lines.append("**Strategy: Defense** 🏥")
            for action in strategy_actions.get('defense', [])[:3]:
                lines.append(f"- [ ] {action}")

        return "\n".join(lines)
