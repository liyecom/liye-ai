"""
Competitors Module - Competitor Price Monitoring System.

Amazon Growth OS - Competitive Intelligence & Price Tracking
Version: 1.0

Provides:
- Competitor identification and tracking
- Price history monitoring
- Price change alerts
- Competitive response recommendations
- Market dynamics analysis
"""

from .price_tracker import (
    PriceTracker,
    Competitor,
    PricePoint,
    PriceHistory,
    StockStatus
)
from .alert_engine import (
    PriceAlertEngine,
    PriceAlert,
    AlertSeverity,
    AlertType
)
from .response_advisor import (
    ResponseAdvisor,
    CompetitiveResponse,
    ResponseStrategy,
    MarketAnalysis
)

__all__ = [
    # Price Tracker
    'PriceTracker',
    'Competitor',
    'PricePoint',
    'PriceHistory',
    'StockStatus',
    # Alert Engine
    'PriceAlertEngine',
    'PriceAlert',
    'AlertSeverity',
    'AlertType',
    # Response Advisor
    'ResponseAdvisor',
    'CompetitiveResponse',
    'ResponseStrategy',
    'MarketAnalysis'
]
