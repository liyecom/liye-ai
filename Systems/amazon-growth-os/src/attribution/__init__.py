"""
Attribution Module - External Traffic Attribution System.

Amazon Growth OS - Traffic Source Tracking & ROI Analysis
Version: 1.0

Provides:
- Amazon Attribution link generation
- Campaign tracking across channels (TikTok, Instagram, Email, etc.)
- ROI calculation and budget optimization
- Multi-channel performance reporting
"""

from .link_generator import (
    AttributionLinkGenerator,
    AttributionTag,
    Publisher,
    UTMParams
)
from .campaign_tracker import (
    CampaignTracker,
    Campaign,
    CampaignMetrics,
    CampaignStatus
)
from .roi_calculator import (
    ROICalculator,
    ChannelROI,
    BudgetRecommendation
)

__all__ = [
    # Link Generator
    'AttributionLinkGenerator',
    'AttributionTag',
    'Publisher',
    'UTMParams',
    # Campaign Tracker
    'CampaignTracker',
    'Campaign',
    'CampaignMetrics',
    'CampaignStatus',
    # ROI Calculator
    'ROICalculator',
    'ChannelROI',
    'BudgetRecommendation'
]
