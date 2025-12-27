"""
Notification Engine for Amazon Growth OS.

Multi-channel notification system supporting email, Slack,
push notifications, and webhooks.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from enum import Enum
import yaml
import json
import os


class NotificationChannel(Enum):
    """Supported notification channels."""
    EMAIL = "email"
    SLACK = "slack"
    PUSH = "push"
    WEBHOOK = "webhook"
    CONSOLE = "console"


class NotificationPriority(Enum):
    """Notification priority levels."""
    CRITICAL = "critical"
    URGENT = "urgent"
    WARNING = "warning"
    OPPORTUNITY = "opportunity"
    INFO = "info"


class NotificationStatus(Enum):
    """Status of a notification."""
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    BATCHED = "batched"
    SUPPRESSED = "suppressed"


@dataclass
class Notification:
    """A notification to be sent."""
    id: str
    alert_type: str
    priority: NotificationPriority
    title: str
    body: str
    data: Dict = field(default_factory=dict)
    channels: List[NotificationChannel] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    sent_at: Optional[datetime] = None
    status: NotificationStatus = NotificationStatus.PENDING
    error: Optional[str] = None

    def to_dict(self) -> Dict:
        return {
            'id': self.id,
            'alert_type': self.alert_type,
            'priority': self.priority.value,
            'title': self.title,
            'body': self.body,
            'data': self.data,
            'channels': [c.value for c in self.channels],
            'created_at': self.created_at.isoformat(),
            'sent_at': self.sent_at.isoformat() if self.sent_at else None,
            'status': self.status.value,
            'error': self.error
        }


@dataclass
class NotificationResult:
    """Result of sending a notification."""
    notification_id: str
    channel: NotificationChannel
    success: bool
    timestamp: datetime = field(default_factory=datetime.now)
    response: Optional[str] = None
    error: Optional[str] = None

    def to_dict(self) -> Dict:
        return {
            'notification_id': self.notification_id,
            'channel': self.channel.value,
            'success': self.success,
            'timestamp': self.timestamp.isoformat(),
            'response': self.response,
            'error': self.error
        }


class NotificationEngine:
    """
    Multi-channel notification engine.

    Handles:
    - Channel configuration and routing
    - Template rendering
    - Rate limiting and batching
    - Quiet hours
    - Delivery tracking
    """

    def __init__(
        self,
        config_path: Optional[str] = None
    ):
        """Initialize notification engine."""
        self.config_path = config_path or "config/notifications.yaml"
        self.config = self._load_config()

        # Notification history
        self.notification_history: List[Notification] = []
        self.result_history: List[NotificationResult] = []

        # Rate limiting state
        self.last_sent: Dict[str, datetime] = {}
        self.hourly_counts: Dict[str, int] = {}
        self.hourly_reset: datetime = datetime.now()

        # Pending batch
        self.pending_batch: List[Notification] = []

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
            'channels': {
                'console': {'enabled': True}
            },
            'routing': {
                'severity_routing': {
                    'critical': {'channels': ['console'], 'immediate': True},
                    'info': {'channels': ['console']}
                }
            },
            'templates': {},
            'rate_limits': {
                'per_hour': {'console': 100},
                'cooldown': {}
            }
        }

    def _generate_id(self) -> str:
        """Generate unique notification ID."""
        import uuid
        return f"notif_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"

    def _is_channel_enabled(self, channel: NotificationChannel) -> bool:
        """Check if a channel is enabled."""
        channel_config = self.config.get('channels', {}).get(channel.value, {})
        return channel_config.get('enabled', False)

    def _is_quiet_hours(self) -> bool:
        """Check if currently in quiet hours."""
        quiet_config = self.config.get('routing', {}).get('quiet_hours', {})
        if not quiet_config.get('enabled', False):
            return False

        now = datetime.now()
        start_str = quiet_config.get('start', '22:00')
        end_str = quiet_config.get('end', '07:00')

        start_hour, start_min = map(int, start_str.split(':'))
        end_hour, end_min = map(int, end_str.split(':'))

        current_minutes = now.hour * 60 + now.minute
        start_minutes = start_hour * 60 + start_min
        end_minutes = end_hour * 60 + end_min

        if start_minutes > end_minutes:
            # Quiet hours span midnight
            return current_minutes >= start_minutes or current_minutes < end_minutes
        else:
            return start_minutes <= current_minutes < end_minutes

    def _check_rate_limit(self, channel: NotificationChannel) -> bool:
        """Check if rate limit allows sending."""
        # Reset hourly counts if needed
        if datetime.now() - self.hourly_reset > timedelta(hours=1):
            self.hourly_counts = {}
            self.hourly_reset = datetime.now()

        limits = self.config.get('rate_limits', {}).get('per_hour', {})
        limit = limits.get(channel.value, 100)

        current = self.hourly_counts.get(channel.value, 0)
        return current < limit

    def _check_cooldown(self, alert_type: str) -> bool:
        """Check if cooldown period has passed."""
        cooldowns = self.config.get('rate_limits', {}).get('cooldown', {})
        cooldown_minutes = cooldowns.get(alert_type, 0)

        if cooldown_minutes == 0:
            return True

        last = self.last_sent.get(alert_type)
        if last is None:
            return True

        return datetime.now() - last > timedelta(minutes=cooldown_minutes)

    def _get_channels_for_alert(
        self,
        alert_type: str,
        priority: NotificationPriority
    ) -> List[NotificationChannel]:
        """Determine which channels to use for an alert."""
        routing = self.config.get('routing', {})

        # Check type-specific routing first
        type_routing = routing.get('type_routing', {}).get(alert_type, {})
        if type_routing:
            channel_names = type_routing.get('channels', [])
        else:
            # Fall back to severity routing
            severity_routing = routing.get('severity_routing', {}).get(priority.value, {})
            channel_names = severity_routing.get('channels', ['console'])

        # Filter to enabled channels
        channels = []
        for name in channel_names:
            try:
                channel = NotificationChannel(name)
                if self._is_channel_enabled(channel):
                    channels.append(channel)
            except ValueError:
                pass

        # Always include console as fallback
        if not channels and self._is_channel_enabled(NotificationChannel.CONSOLE):
            channels.append(NotificationChannel.CONSOLE)

        return channels

    def _render_template(
        self,
        template_name: str,
        data: Dict
    ) -> tuple:
        """Render notification title and body from template."""
        templates = self.config.get('templates', {})
        template = templates.get(template_name, {})

        title = template.get('title', 'Notification')
        body_template = template.get('body', '{message}')

        # Simple template rendering
        try:
            body = body_template.format(**data)
        except KeyError:
            body = str(data)

        return title, body

    def send_notification(
        self,
        alert_type: str,
        priority: NotificationPriority,
        data: Dict,
        template_name: Optional[str] = None,
        force: bool = False
    ) -> Notification:
        """
        Send a notification across configured channels.

        Args:
            alert_type: Type of alert (e.g., 'price_alert', 'review_alert')
            priority: Priority level
            data: Data to include in notification
            template_name: Template to use for rendering
            force: Bypass quiet hours and rate limits

        Returns:
            Notification object with status
        """
        # Check quiet hours (except critical and forced)
        if not force and priority != NotificationPriority.CRITICAL:
            if self._is_quiet_hours():
                return self._create_suppressed_notification(
                    alert_type, priority, data, "Quiet hours"
                )

        # Check cooldown
        if not force and not self._check_cooldown(alert_type):
            return self._create_suppressed_notification(
                alert_type, priority, data, "Cooldown period"
            )

        # Get channels
        channels = self._get_channels_for_alert(alert_type, priority)
        if not channels:
            return self._create_suppressed_notification(
                alert_type, priority, data, "No enabled channels"
            )

        # Render template
        template = template_name or alert_type
        title, body = self._render_template(template, data)

        # Create notification
        notification = Notification(
            id=self._generate_id(),
            alert_type=alert_type,
            priority=priority,
            title=title,
            body=body,
            data=data,
            channels=channels
        )

        # Send to each channel
        results = []
        for channel in channels:
            if not force and not self._check_rate_limit(channel):
                results.append(NotificationResult(
                    notification_id=notification.id,
                    channel=channel,
                    success=False,
                    error="Rate limit exceeded"
                ))
                continue

            result = self._send_to_channel(notification, channel)
            results.append(result)

            if result.success:
                # Update rate limiting state
                self.hourly_counts[channel.value] = self.hourly_counts.get(channel.value, 0) + 1

        # Update notification status
        successful = any(r.success for r in results)
        if successful:
            notification.status = NotificationStatus.SENT
            notification.sent_at = datetime.now()
            self.last_sent[alert_type] = datetime.now()
        else:
            notification.status = NotificationStatus.FAILED
            notification.error = "; ".join(r.error for r in results if r.error)

        # Store in history
        self.notification_history.append(notification)
        self.result_history.extend(results)

        return notification

    def _create_suppressed_notification(
        self,
        alert_type: str,
        priority: NotificationPriority,
        data: Dict,
        reason: str
    ) -> Notification:
        """Create a suppressed notification."""
        notification = Notification(
            id=self._generate_id(),
            alert_type=alert_type,
            priority=priority,
            title=reason,
            body="",
            data=data,
            channels=[],
            status=NotificationStatus.SUPPRESSED,
            error=reason
        )
        self.notification_history.append(notification)
        return notification

    def _send_to_channel(
        self,
        notification: Notification,
        channel: NotificationChannel
    ) -> NotificationResult:
        """Send notification to a specific channel."""
        try:
            if channel == NotificationChannel.CONSOLE:
                return self._send_console(notification)
            elif channel == NotificationChannel.SLACK:
                return self._send_slack(notification)
            elif channel == NotificationChannel.EMAIL:
                return self._send_email(notification)
            elif channel == NotificationChannel.PUSH:
                return self._send_push(notification)
            elif channel == NotificationChannel.WEBHOOK:
                return self._send_webhook(notification)
            else:
                return NotificationResult(
                    notification_id=notification.id,
                    channel=channel,
                    success=False,
                    error=f"Unknown channel: {channel.value}"
                )
        except Exception as e:
            return NotificationResult(
                notification_id=notification.id,
                channel=channel,
                success=False,
                error=str(e)
            )

    def _send_console(self, notification: Notification) -> NotificationResult:
        """Send to console (for testing/development)."""
        priority_colors = {
            'critical': '\033[91m',  # Red
            'urgent': '\033[93m',    # Yellow
            'warning': '\033[33m',   # Orange
            'opportunity': '\033[92m', # Green
            'info': '\033[94m'       # Blue
        }
        reset = '\033[0m'

        channel_config = self.config.get('channels', {}).get('console', {})
        use_color = channel_config.get('color_output', True)

        if use_color:
            color = priority_colors.get(notification.priority.value, '')
            print(f"\n{color}[{notification.priority.value.upper()}]{reset} {notification.title}")
        else:
            print(f"\n[{notification.priority.value.upper()}] {notification.title}")

        print(f"{notification.body}")
        print(f"---")

        return NotificationResult(
            notification_id=notification.id,
            channel=NotificationChannel.CONSOLE,
            success=True,
            response="Printed to console"
        )

    def _send_slack(self, notification: Notification) -> NotificationResult:
        """Send to Slack via webhook."""
        channel_config = self.config.get('channels', {}).get('slack', {})
        webhook_url = channel_config.get('webhook_url') or os.environ.get('SLACK_WEBHOOK_URL')

        if not webhook_url:
            return NotificationResult(
                notification_id=notification.id,
                channel=NotificationChannel.SLACK,
                success=False,
                error="Slack webhook URL not configured"
            )

        # Get color from template
        templates = self.config.get('templates', {})
        template = templates.get(notification.alert_type, {})
        color_map = template.get('slack_color', {})
        color = color_map.get(notification.priority.value, '#808080')

        # Build Slack message
        message = {
            "attachments": [{
                "color": color,
                "title": notification.title,
                "text": notification.body,
                "footer": "Amazon Growth OS",
                "ts": int(notification.created_at.timestamp())
            }]
        }

        # In production, this would use requests library
        # For now, simulate success
        return NotificationResult(
            notification_id=notification.id,
            channel=NotificationChannel.SLACK,
            success=True,
            response="Simulated Slack send"
        )

    def _send_email(self, notification: Notification) -> NotificationResult:
        """Send email notification."""
        channel_config = self.config.get('channels', {}).get('email', {})

        if not channel_config.get('settings', {}).get('smtp_host'):
            return NotificationResult(
                notification_id=notification.id,
                channel=NotificationChannel.EMAIL,
                success=False,
                error="Email not configured"
            )

        # In production, this would use smtplib or email service
        return NotificationResult(
            notification_id=notification.id,
            channel=NotificationChannel.EMAIL,
            success=True,
            response="Simulated email send"
        )

    def _send_push(self, notification: Notification) -> NotificationResult:
        """Send push notification."""
        channel_config = self.config.get('channels', {}).get('push', {})
        provider = channel_config.get('provider', 'pushover')

        # In production, this would use push notification APIs
        return NotificationResult(
            notification_id=notification.id,
            channel=NotificationChannel.PUSH,
            success=True,
            response=f"Simulated {provider} push"
        )

    def _send_webhook(self, notification: Notification) -> NotificationResult:
        """Send to custom webhook."""
        channel_config = self.config.get('channels', {}).get('webhook', {})
        url = channel_config.get('url')

        if not url:
            return NotificationResult(
                notification_id=notification.id,
                channel=NotificationChannel.WEBHOOK,
                success=False,
                error="Webhook URL not configured"
            )

        # In production, this would use requests library
        return NotificationResult(
            notification_id=notification.id,
            channel=NotificationChannel.WEBHOOK,
            success=True,
            response="Simulated webhook"
        )

    def get_history(
        self,
        limit: int = 50,
        status: Optional[NotificationStatus] = None,
        priority: Optional[NotificationPriority] = None
    ) -> List[Dict]:
        """Get notification history with optional filters."""
        notifications = self.notification_history[-limit:]

        if status:
            notifications = [n for n in notifications if n.status == status]

        if priority:
            notifications = [n for n in notifications if n.priority == priority]

        return [n.to_dict() for n in reversed(notifications)]

    def get_statistics(self) -> Dict:
        """Get notification statistics."""
        total = len(self.notification_history)
        if total == 0:
            return {
                'total': 0,
                'by_status': {},
                'by_priority': {},
                'by_channel': {}
            }

        by_status = {}
        by_priority = {}
        by_channel = {}

        for n in self.notification_history:
            by_status[n.status.value] = by_status.get(n.status.value, 0) + 1
            by_priority[n.priority.value] = by_priority.get(n.priority.value, 0) + 1
            for c in n.channels:
                by_channel[c.value] = by_channel.get(c.value, 0) + 1

        return {
            'total': total,
            'by_status': by_status,
            'by_priority': by_priority,
            'by_channel': by_channel
        }

    def generate_report(self) -> str:
        """Generate notification system report."""
        stats = self.get_statistics()

        lines = [
            "# Notification System Report",
            f"*Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}*",
            "",
            "## Statistics",
            "",
            f"| Metric | Value |",
            f"|--------|-------|",
            f"| Total Notifications | {stats['total']} |"
        ]

        if stats['by_status']:
            lines.append("")
            lines.append("### By Status")
            lines.append("")
            for status, count in sorted(stats['by_status'].items()):
                lines.append(f"- {status}: {count}")

        if stats['by_priority']:
            lines.append("")
            lines.append("### By Priority")
            lines.append("")
            for priority, count in sorted(stats['by_priority'].items()):
                lines.append(f"- {priority}: {count}")

        if stats['by_channel']:
            lines.append("")
            lines.append("### By Channel")
            lines.append("")
            for channel, count in sorted(stats['by_channel'].items()):
                lines.append(f"- {channel}: {count}")

        # Recent notifications
        recent = self.get_history(limit=5)
        if recent:
            lines.extend([
                "",
                "## Recent Notifications",
                "",
                "| Time | Type | Priority | Status |",
                "|------|------|----------|--------|"
            ])
            for n in recent:
                time_str = n['created_at'][:19]
                lines.append(
                    f"| {time_str} | {n['alert_type']} | "
                    f"{n['priority']} | {n['status']} |"
                )

        return "\n".join(lines)
