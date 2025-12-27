"""
Bidding module for Amazon Growth OS.

Provides automated bid adjustment with guardrails for PPC campaigns.
"""

from .bid_engine import BidEngine, BidDecision, BidAction

__all__ = ['BidEngine', 'BidDecision', 'BidAction']
