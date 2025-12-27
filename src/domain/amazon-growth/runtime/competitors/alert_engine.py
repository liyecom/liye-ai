"""
Price Alert Engine - Competitive Price Change Alerts.

Monitors price changes and generates alerts based on
configurable thresholds and conditions.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Any
from pathlib import Path
import yaml
import uuid

from .price_tracker import PriceTracker, Competitor, StockStatus


class AlertSeverity(Enum):
    """Alert severity levels."""
    INFO = "info"
    OPPORTUNITY = "opportunity"
    WARNING = "warning"
    CRITICAL = "critical"
    URGENT = "urgent"


class AlertType(Enum):
    """Types of price alerts."""
    PRICE_DROP = "price_drop"
    PRICE_INCREASE = "price_increase"
    UNDERCUT = "undercut"
    PRICE_WAR = "price_war"
    COMPETITOR_OOS = "competitor_oos"
    COMPETITOR_LOW_STOCK = "competitor_low_stock"
    NEW_DEAL = "new_deal"
    DEAL_ENDED = "deal_ended"
    MARKET_LEADER_MOVE = "market_leader_move"


@dataclass
class PriceAlert:
    """A price-related alert."""
    alert_id: str
    alert_type: AlertType
    severity: AlertSeverity
    competitor_asin: str
    competitor_name: str
    title: str
    description: str
    timestamp: datetime = field(default_factory=datetime.now)

    # Price change details
    old_price: Optional[float] = None
    new_price: Optional[float] = None
    change_amount: float = 0.0
    change_percent: float = 0.0

    # Context
    our_price: Optional[float] = None
    market_avg_price: Optional[float] = None

    # Status
    is_read: bool = False
    is_acted: bool = False
    action_taken: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'alert_id': self.alert_id,
            'alert_type': self.alert_type.value,
            'severity': self.severity.value,
            'competitor_asin': self.competitor_asin,
            'competitor_name': self.competitor_name,
            'title': self.title,
            'description': self.description,
            'timestamp': self.timestamp.isoformat(),
            'old_price': self.old_price,
            'new_price': self.new_price,
            'change_amount': self.change_amount,
            'change_percent': self.change_percent,
            'our_price': self.our_price,
            'market_avg_price': self.market_avg_price,
            'is_read': self.is_read,
            'is_acted': self.is_acted,
            'action_taken': self.action_taken
        }


class PriceAlertEngine:
    """
    Generate and manage price alerts.

    Features:
    - Monitor price changes against thresholds
    - Detect competitive threats and opportunities
    - Manage alert lifecycle
    - Aggregate and prioritize alerts
    """

    def __init__(
        self,
        config_path: Optional[str] = None,
        price_tracker: Optional[PriceTracker] = None,
        db_path: Optional[str] = None
    ):
        """Initialize alert engine."""
        self.config = self._load_config(config_path)
        self.tracker = price_tracker
        self.db_path = db_path
        self._db_conn = None

        # Alert storage
        self.alerts: Dict[str, PriceAlert] = {}
        self.alert_history: List[PriceAlert] = []

        # Load thresholds from config
        self._load_thresholds()

        if self.db_path:
            self._init_database()

    def _load_config(self, config_path: Optional[str]) -> Dict:
        """Load configuration."""
        if config_path and Path(config_path).exists():
            with open(config_path, 'r') as f:
                return yaml.safe_load(f)
        return {}

    def _load_thresholds(self):
        """Load alert thresholds from config."""
        alerts_config = self.config.get('alerts', {})

        # Price drop thresholds
        self.price_drop_thresholds = []
        for threshold in alerts_config.get('price_drop', {}).get('thresholds', []):
            self.price_drop_thresholds.append({
                'name': threshold.get('name'),
                'percent': threshold.get('percent', 10),
                'severity': AlertSeverity(threshold.get('severity', 'warning'))
            })

        # Price increase thresholds
        self.price_increase_thresholds = []
        for threshold in alerts_config.get('price_increase', {}).get('thresholds', []):
            self.price_increase_thresholds.append({
                'name': threshold.get('name'),
                'percent': threshold.get('percent', 10),
                'severity': AlertSeverity(threshold.get('severity', 'info'))
            })

        # Default thresholds if none configured
        if not self.price_drop_thresholds:
            self.price_drop_thresholds = [
                {'name': 'significant_drop', 'percent': 10, 'severity': AlertSeverity.WARNING},
                {'name': 'major_drop', 'percent': 20, 'severity': AlertSeverity.CRITICAL},
                {'name': 'flash_sale', 'percent': 30, 'severity': AlertSeverity.URGENT}
            ]

        if not self.price_increase_thresholds:
            self.price_increase_thresholds = [
                {'name': 'minor_increase', 'percent': 10, 'severity': AlertSeverity.INFO},
                {'name': 'major_increase', 'percent': 20, 'severity': AlertSeverity.OPPORTUNITY}
            ]

    def _get_db_connection(self):
        """Get DuckDB connection."""
        if self._db_conn is None and self.db_path:
            try:
                import duckdb
                self._db_conn = duckdb.connect(self.db_path)
            except ImportError:
                pass
        return self._db_conn

    def _init_database(self):
        """Initialize database tables."""
        conn = self._get_db_connection()
        if conn is None:
            return

        conn.execute("""
            CREATE TABLE IF NOT EXISTS fact_price_alerts (
                alert_id VARCHAR PRIMARY KEY,
                alert_type VARCHAR,
                severity VARCHAR,
                competitor_asin VARCHAR,
                competitor_name VARCHAR,
                title VARCHAR,
                description TEXT,
                timestamp TIMESTAMP,
                old_price DECIMAL(10,2),
                new_price DECIMAL(10,2),
                change_amount DECIMAL(10,2),
                change_percent DECIMAL(10,4),
                our_price DECIMAL(10,2),
                is_read BOOLEAN,
                is_acted BOOLEAN,
                action_taken TEXT
            )
        """)

    def _save_alert(self, alert: PriceAlert):
        """Save alert to database."""
        conn = self._get_db_connection()
        if conn is None:
            return

        conn.execute("""
            INSERT OR REPLACE INTO fact_price_alerts
            (alert_id, alert_type, severity, competitor_asin, competitor_name,
             title, description, timestamp, old_price, new_price,
             change_amount, change_percent, our_price, is_read, is_acted, action_taken)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            alert.alert_id,
            alert.alert_type.value,
            alert.severity.value,
            alert.competitor_asin,
            alert.competitor_name,
            alert.title,
            alert.description,
            alert.timestamp,
            alert.old_price,
            alert.new_price,
            alert.change_amount,
            alert.change_percent,
            alert.our_price,
            alert.is_read,
            alert.is_acted,
            alert.action_taken
        ])

    def check_price_alerts(
        self,
        competitor: Competitor,
        our_price: Optional[float] = None
    ) -> List[PriceAlert]:
        """
        Check for price-related alerts on a competitor.

        Args:
            competitor: The competitor to check
            our_price: Our current price for comparison

        Returns:
            List of generated alerts
        """
        alerts = []

        # Get recent price change
        change = competitor.price_history.get_price_change(days=1)

        if change:
            absolute, percent = change
            current_price = competitor.current_price

            # Check price drops
            if percent < 0:
                for threshold in self.price_drop_thresholds:
                    if abs(percent) >= threshold['percent']:
                        alert = self._create_price_drop_alert(
                            competitor, absolute, percent, threshold, our_price
                        )
                        alerts.append(alert)
                        break  # Only one alert per threshold tier

            # Check price increases
            elif percent > 0:
                for threshold in self.price_increase_thresholds:
                    if percent >= threshold['percent']:
                        alert = self._create_price_increase_alert(
                            competitor, absolute, percent, threshold, our_price
                        )
                        alerts.append(alert)
                        break

            # Check undercut
            if our_price and current_price < our_price * 0.95:
                alert = self._create_undercut_alert(competitor, current_price, our_price)
                alerts.append(alert)

        # Check stock status
        if competitor.stock_status == StockStatus.OUT_OF_STOCK:
            alert = self._create_oos_alert(competitor)
            alerts.append(alert)
        elif competitor.stock_status == StockStatus.LOW_STOCK:
            alert = self._create_low_stock_alert(competitor)
            alerts.append(alert)

        # Check for deals
        if competitor.price_history.prices:
            latest = competitor.price_history.prices[-1]
            if latest.is_deal:
                alert = self._create_deal_alert(competitor, latest.deal_type)
                alerts.append(alert)

        # Store alerts
        for alert in alerts:
            self.alerts[alert.alert_id] = alert
            self.alert_history.append(alert)
            self._save_alert(alert)

        return alerts

    def _create_price_drop_alert(
        self,
        competitor: Competitor,
        absolute: float,
        percent: float,
        threshold: Dict,
        our_price: Optional[float]
    ) -> PriceAlert:
        """Create a price drop alert."""
        old_price = competitor.current_price - absolute if competitor.current_price else 0

        return PriceAlert(
            alert_id=str(uuid.uuid4())[:8],
            alert_type=AlertType.PRICE_DROP,
            severity=threshold['severity'],
            competitor_asin=competitor.asin,
            competitor_name=competitor.brand or competitor.title[:30],
            title=f"Price Drop: {competitor.brand or 'Competitor'} ({threshold['name']})",
            description=f"{competitor.brand or 'Competitor'} dropped price by {abs(percent):.1f}% "
                       f"(${old_price:.2f} → ${competitor.current_price:.2f})",
            old_price=old_price,
            new_price=competitor.current_price,
            change_amount=absolute,
            change_percent=percent,
            our_price=our_price
        )

    def _create_price_increase_alert(
        self,
        competitor: Competitor,
        absolute: float,
        percent: float,
        threshold: Dict,
        our_price: Optional[float]
    ) -> PriceAlert:
        """Create a price increase alert."""
        old_price = competitor.current_price - absolute if competitor.current_price else 0

        return PriceAlert(
            alert_id=str(uuid.uuid4())[:8],
            alert_type=AlertType.PRICE_INCREASE,
            severity=threshold['severity'],
            competitor_asin=competitor.asin,
            competitor_name=competitor.brand or competitor.title[:30],
            title=f"Opportunity: {competitor.brand or 'Competitor'} raised price",
            description=f"{competitor.brand or 'Competitor'} increased price by {percent:.1f}% "
                       f"(${old_price:.2f} → ${competitor.current_price:.2f})",
            old_price=old_price,
            new_price=competitor.current_price,
            change_amount=absolute,
            change_percent=percent,
            our_price=our_price
        )

    def _create_undercut_alert(
        self,
        competitor: Competitor,
        competitor_price: float,
        our_price: float
    ) -> PriceAlert:
        """Create an undercut alert."""
        undercut_amount = our_price - competitor_price
        undercut_percent = (undercut_amount / our_price) * 100

        return PriceAlert(
            alert_id=str(uuid.uuid4())[:8],
            alert_type=AlertType.UNDERCUT,
            severity=AlertSeverity.WARNING,
            competitor_asin=competitor.asin,
            competitor_name=competitor.brand or competitor.title[:30],
            title=f"Undercut: {competitor.brand or 'Competitor'} priced below us",
            description=f"{competitor.brand or 'Competitor'} is now ${undercut_amount:.2f} "
                       f"({undercut_percent:.1f}%) cheaper than us",
            new_price=competitor_price,
            our_price=our_price,
            change_amount=-undercut_amount,
            change_percent=-undercut_percent
        )

    def _create_oos_alert(self, competitor: Competitor) -> PriceAlert:
        """Create an out-of-stock alert."""
        return PriceAlert(
            alert_id=str(uuid.uuid4())[:8],
            alert_type=AlertType.COMPETITOR_OOS,
            severity=AlertSeverity.OPPORTUNITY,
            competitor_asin=competitor.asin,
            competitor_name=competitor.brand or competitor.title[:30],
            title=f"Opportunity: {competitor.brand or 'Competitor'} Out of Stock",
            description=f"{competitor.brand or 'Competitor'} is out of stock. "
                       f"Opportunity to capture their customers with increased ads/visibility."
        )

    def _create_low_stock_alert(self, competitor: Competitor) -> PriceAlert:
        """Create a low stock alert."""
        return PriceAlert(
            alert_id=str(uuid.uuid4())[:8],
            alert_type=AlertType.COMPETITOR_LOW_STOCK,
            severity=AlertSeverity.INFO,
            competitor_asin=competitor.asin,
            competitor_name=competitor.brand or competitor.title[:30],
            title=f"Info: {competitor.brand or 'Competitor'} Low Stock",
            description=f"{competitor.brand or 'Competitor'} appears to be running low on inventory."
        )

    def _create_deal_alert(
        self,
        competitor: Competitor,
        deal_type: Optional[str]
    ) -> PriceAlert:
        """Create a deal/promotion alert."""
        deal_desc = deal_type or "running a deal"

        return PriceAlert(
            alert_id=str(uuid.uuid4())[:8],
            alert_type=AlertType.NEW_DEAL,
            severity=AlertSeverity.WARNING,
            competitor_asin=competitor.asin,
            competitor_name=competitor.brand or competitor.title[:30],
            title=f"Deal Alert: {competitor.brand or 'Competitor'} {deal_desc}",
            description=f"{competitor.brand or 'Competitor'} is {deal_desc}. "
                       f"Monitor for impact on your sales.",
            new_price=competitor.current_price
        )

    def check_price_war(
        self,
        days: int = 7,
        min_drops: int = 3
    ) -> Optional[PriceAlert]:
        """
        Detect potential price war conditions.

        Args:
            days: Time window to check
            min_drops: Minimum number of competitors that dropped prices

        Returns:
            Price war alert if detected, None otherwise
        """
        if not self.tracker:
            return None

        drops = []
        for competitor in self.tracker.list_competitors():
            change = competitor.price_history.get_price_change(days)
            if change and change[1] < -5:  # >5% drop
                drops.append(competitor)

        if len(drops) >= min_drops:
            alert = PriceAlert(
                alert_id=str(uuid.uuid4())[:8],
                alert_type=AlertType.PRICE_WAR,
                severity=AlertSeverity.CRITICAL,
                competitor_asin="MULTIPLE",
                competitor_name=f"{len(drops)} competitors",
                title="⚠️ Potential Price War Detected",
                description=f"{len(drops)} competitors dropped prices >5% in the last {days} days. "
                           f"Competitors: {', '.join(c.brand or c.asin for c in drops[:5])}"
            )
            self.alerts[alert.alert_id] = alert
            self.alert_history.append(alert)
            self._save_alert(alert)
            return alert

        return None

    def run_all_checks(self, our_price: Optional[float] = None) -> List[PriceAlert]:
        """Run all alert checks on tracked competitors."""
        all_alerts = []

        if not self.tracker:
            return all_alerts

        # Check each competitor
        for competitor in self.tracker.list_competitors():
            alerts = self.check_price_alerts(competitor, our_price)
            all_alerts.extend(alerts)

        # Check for price war
        price_war = self.check_price_war()
        if price_war:
            all_alerts.append(price_war)

        return all_alerts

    def get_alert(self, alert_id: str) -> Optional[PriceAlert]:
        """Get alert by ID."""
        return self.alerts.get(alert_id)

    def list_alerts(
        self,
        severity: Optional[AlertSeverity] = None,
        alert_type: Optional[AlertType] = None,
        unread_only: bool = False,
        limit: int = 50
    ) -> List[PriceAlert]:
        """List alerts with optional filters."""
        alerts = list(self.alerts.values())

        if severity:
            alerts = [a for a in alerts if a.severity == severity]

        if alert_type:
            alerts = [a for a in alerts if a.alert_type == alert_type]

        if unread_only:
            alerts = [a for a in alerts if not a.is_read]

        # Sort by severity and timestamp
        severity_order = {
            AlertSeverity.URGENT: 0,
            AlertSeverity.CRITICAL: 1,
            AlertSeverity.WARNING: 2,
            AlertSeverity.OPPORTUNITY: 3,
            AlertSeverity.INFO: 4
        }
        alerts.sort(key=lambda x: (severity_order.get(x.severity, 5), -x.timestamp.timestamp()))

        return alerts[:limit]

    def mark_read(self, alert_id: str):
        """Mark alert as read."""
        if alert_id in self.alerts:
            self.alerts[alert_id].is_read = True
            self._save_alert(self.alerts[alert_id])

    def mark_acted(self, alert_id: str, action: str):
        """Mark alert as acted upon."""
        if alert_id in self.alerts:
            self.alerts[alert_id].is_acted = True
            self.alerts[alert_id].action_taken = action
            self._save_alert(self.alerts[alert_id])

    def get_summary(self) -> Dict[str, Any]:
        """Get alert summary statistics."""
        alerts = list(self.alerts.values())

        by_severity = {}
        by_type = {}

        for alert in alerts:
            sev = alert.severity.value
            by_severity[sev] = by_severity.get(sev, 0) + 1

            atype = alert.alert_type.value
            by_type[atype] = by_type.get(atype, 0) + 1

        return {
            'total_alerts': len(alerts),
            'unread': sum(1 for a in alerts if not a.is_read),
            'unacted': sum(1 for a in alerts if not a.is_acted),
            'by_severity': by_severity,
            'by_type': by_type,
            'timestamp': datetime.now().isoformat()
        }

    def generate_report(self) -> str:
        """Generate alert summary report."""
        lines = [
            "=" * 60,
            "PRICE ALERT SUMMARY",
            "=" * 60,
            "",
            f"Report Time: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            ""
        ]

        summary = self.get_summary()
        lines.extend([
            f"**Total Alerts**: {summary['total_alerts']}",
            f"**Unread**: {summary['unread']}",
            f"**Requiring Action**: {summary['unacted']}",
            ""
        ])

        # Alerts by severity
        lines.append("## By Severity")
        lines.append("")
        for sev, count in sorted(summary['by_severity'].items()):
            icon = {"urgent": "🔴", "critical": "🟠", "warning": "🟡",
                   "opportunity": "🟢", "info": "🔵"}.get(sev, "⚪")
            lines.append(f"- {icon} {sev.title()}: {count}")
        lines.append("")

        # Recent alerts
        recent = self.list_alerts(limit=10)
        if recent:
            lines.extend([
                "## Recent Alerts",
                "",
                "| Time | Severity | Type | Competitor | Description |",
                "|------|----------|------|------------|-------------|"
            ])

            for alert in recent:
                time_str = alert.timestamp.strftime('%H:%M')
                lines.append(
                    f"| {time_str} | {alert.severity.value} | {alert.alert_type.value} | "
                    f"{alert.competitor_name[:15]} | {alert.description[:40]}... |"
                )

        lines.extend(["", "=" * 60])

        return "\n".join(lines)
