"""
Brand Module - Brand Health Index System.

Amazon Growth OS - Brand Intelligence & Strategy
Version: 1.0

Provides:
- Brand metrics tracking (ratings, reviews, search volume)
- Health score calculation (weighted multi-factor index)
- Strategic recommendations (expansion vs defense)
- Competitive position analysis
"""

from .metrics_tracker import (
    BrandMetricsTracker,
    RatingSnapshot,
    ReviewMetrics,
    BrandSearchMetrics,
    ProductMetrics,
    RatingTrend,
    SentimentCategory
)
from .health_scorer import (
    BrandHealthScorer,
    HealthScore,
    HealthLevel,
    ComponentScore
)
from .strategy_advisor import (
    BrandStrategyAdvisor,
    StrategyRecommendation,
    StrategicAction,
    StrategyType,
    ActionPriority
)

__all__ = [
    # Metrics Tracker
    'BrandMetricsTracker',
    'RatingSnapshot',
    'ReviewMetrics',
    'BrandSearchMetrics',
    'ProductMetrics',
    'RatingTrend',
    'SentimentCategory',
    # Health Scorer
    'BrandHealthScorer',
    'HealthScore',
    'HealthLevel',
    'ComponentScore',
    # Strategy Advisor
    'BrandStrategyAdvisor',
    'StrategyRecommendation',
    'StrategicAction',
    'StrategyType',
    'ActionPriority'
]
