"""
Reviews Module - Review Monitoring and Alert System.

Amazon Growth OS - VOC (Voice of Customer) Intelligence
Version: 1.0

Provides:
- Review data collection and storage
- Sentiment analysis (positive/negative/neutral)
- Topic extraction (size, quality, cleaning, etc.)
- Alert engine for negative review spikes
- Competitor mention tracking
"""

from .review_monitor import (
    ReviewMonitor,
    Review,
    ReviewAlert,
    AlertType,
    Sentiment,
    ReviewTopic
)

__all__ = [
    'ReviewMonitor',
    'Review',
    'ReviewAlert',
    'AlertType',
    'Sentiment',
    'ReviewTopic'
]
