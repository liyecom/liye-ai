"""
Notifications Module - Multi-Channel Alert System.

Amazon Growth OS - Mobile and Desktop Notifications
Version: 1.0

Provides:
- Multi-channel notifications (Email, Slack, Push, Webhook)
- Template-based message rendering
- Rate limiting and quiet hours
- Notification history and analytics
"""

from .notification_engine import (
    NotificationEngine,
    Notification,
    NotificationResult,
    NotificationChannel,
    NotificationPriority,
    NotificationStatus
)

__all__ = [
    'NotificationEngine',
    'Notification',
    'NotificationResult',
    'NotificationChannel',
    'NotificationPriority',
    'NotificationStatus'
]
