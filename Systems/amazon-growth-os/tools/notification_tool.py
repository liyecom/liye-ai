"""
Notification Tool for CrewAI Agents.

Provides multi-channel notification capabilities
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


class NotificationTool(BaseTool):
    """
    Tool for sending multi-channel notifications.

    Allows agents to:
    - Send notifications to various channels
    - Check notification history
    - Get notification statistics
    """

    name: str = "Notification System"
    description: str = """
    Send multi-channel notifications and manage alerts.

    Actions:
    - send: Send a notification
    - get_history: Get notification history
    - get_stats: Get notification statistics
    - test: Send a test notification

    Priorities: critical, urgent, warning, opportunity, info

    Input format (JSON):
    {
        "action": "send|get_history|get_stats|test",
        "params": {
            "alert_type": "price_alert|review_alert|brand_health|acos_alert",
            "priority": "critical|urgent|warning|opportunity|info",
            "data": {...}
        }
    }
    """

    def __init__(
        self,
        config_path: Optional[str] = None
    ):
        """Initialize notification tool."""
        super().__init__()
        self.config_path = config_path
        self._engine = None

    def _get_engine(self):
        """Lazy initialization of notification engine."""
        if self._engine is None:
            from src.notifications.notification_engine import NotificationEngine
            self._engine = NotificationEngine(
                config_path=self.config_path
            )
        return self._engine

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

            action = params.get('action', 'send')
            action_params = params.get('params', {})

            if action == 'send':
                return self._send_notification(action_params)
            elif action == 'get_history':
                return self._get_history(action_params)
            elif action == 'get_stats':
                return self._get_stats()
            elif action == 'test':
                return self._send_test()
            else:
                return f"Unknown action: {action}"

        except Exception as e:
            return f"Error: {str(e)}"

    def _parse_text_query(self, query: str) -> Dict:
        """Parse natural language query."""
        query_lower = query.lower()

        if 'test' in query_lower:
            return {'action': 'test'}
        elif 'history' in query_lower:
            return {'action': 'get_history'}
        elif 'stats' in query_lower or 'statistics' in query_lower:
            return {'action': 'get_stats'}
        elif 'send' in query_lower or 'notify' in query_lower or 'alert' in query_lower:
            return {'action': 'send', 'params': {'message': query}}

        return {'action': 'get_stats'}

    def _send_notification(self, params: Dict) -> str:
        """Send a notification."""
        from src.notifications.notification_engine import NotificationPriority

        engine = self._get_engine()

        alert_type = params.get('alert_type', 'info')
        priority_str = params.get('priority', 'info')
        data = params.get('data', {})
        template = params.get('template')
        force = params.get('force', False)

        # Parse priority
        try:
            priority = NotificationPriority(priority_str)
        except ValueError:
            priority = NotificationPriority.INFO

        # Add message to data if provided separately
        if 'message' in params:
            data['message'] = params['message']

        notification = engine.send_notification(
            alert_type=alert_type,
            priority=priority,
            data=data,
            template_name=template,
            force=force
        )

        status_icons = {
            'sent': '✅',
            'failed': '❌',
            'suppressed': '🔇',
            'pending': '⏳',
            'batched': '📦'
        }
        icon = status_icons.get(notification.status.value, '❓')

        lines = [
            f"## {icon} Notification {notification.status.value.title()}",
            "",
            f"**ID**: `{notification.id}`",
            f"**Type**: {notification.alert_type}",
            f"**Priority**: {notification.priority.value}",
            f"**Channels**: {', '.join(c.value for c in notification.channels) or 'None'}",
        ]

        if notification.error:
            lines.append(f"**Note**: {notification.error}")

        return "\n".join(lines)

    def _get_history(self, params: Dict) -> str:
        """Get notification history."""
        engine = self._get_engine()

        limit = params.get('limit', 10)
        history = engine.get_history(limit=limit)

        if not history:
            return "No notifications in history."

        lines = [
            "## Notification History",
            "",
            "| Time | Type | Priority | Status |",
            "|------|------|----------|--------|"
        ]

        status_icons = {
            'sent': '✅',
            'failed': '❌',
            'suppressed': '🔇'
        }

        for n in history:
            time_str = n['created_at'][11:19]  # HH:MM:SS
            icon = status_icons.get(n['status'], '❓')
            lines.append(
                f"| {time_str} | {n['alert_type']} | "
                f"{n['priority']} | {icon} {n['status']} |"
            )

        return "\n".join(lines)

    def _get_stats(self) -> str:
        """Get notification statistics."""
        engine = self._get_engine()
        return engine.generate_report()

    def _send_test(self) -> str:
        """Send a test notification."""
        from src.notifications.notification_engine import NotificationPriority

        engine = self._get_engine()

        notification = engine.send_notification(
            alert_type="test",
            priority=NotificationPriority.INFO,
            data={
                'message': 'This is a test notification from Amazon Growth OS.',
                'timestamp': 'now'
            },
            force=True
        )

        return f"""
## Test Notification Sent

**ID**: `{notification.id}`
**Status**: {notification.status.value}
**Channels**: {', '.join(c.value for c in notification.channels)}

If you configured Slack, email, or push notifications,
you should receive the test message on those channels.
"""
