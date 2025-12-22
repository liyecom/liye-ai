"""
Inventory Manager - Inventory-Budget Linkage System.

Amazon Growth OS - Inventory Management
Version: 1.0

This module:
1. Tracks inventory levels for each ASIN
2. Calculates days of cover based on sales velocity
3. Determines budget modifiers based on inventory status
4. Integrates with bid adjustment system
5. Provides alerts and recommendations
"""

import os
import yaml
import logging
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
from enum import Enum
import pandas as pd

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Base directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class InventoryStatus(Enum):
    """Inventory status levels based on days of cover."""
    STOCKOUT = "stockout"
    CRITICAL = "critical"
    WARNING = "warning"
    CAUTION = "caution"
    HEALTHY = "healthy"
    OVERSTOCK = "overstock"


@dataclass
class BudgetModifier:
    """Budget modification recommendation based on inventory."""
    asin: str
    current_inventory: int
    days_of_cover: float
    status: InventoryStatus
    budget_modifier: float
    max_daily_spend: Optional[float]
    pause_new_keywords: bool
    reason: str
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'asin': self.asin,
            'current_inventory': self.current_inventory,
            'days_of_cover': round(self.days_of_cover, 1),
            'status': self.status.value,
            'budget_modifier': self.budget_modifier,
            'max_daily_spend': self.max_daily_spend,
            'pause_new_keywords': self.pause_new_keywords,
            'reason': self.reason,
            'created_at': self.created_at.isoformat()
        }


class InventoryManager:
    """
    Manages inventory-budget linkage for Amazon ASINs.

    Example usage:
        manager = InventoryManager()

        # Update inventory for an ASIN
        manager.update_inventory('B0C5Q9Y6YF', 150)

        # Get budget recommendations
        recommendations = manager.get_budget_recommendations()

        # Check specific ASIN
        status = manager.get_asin_status('B0C5Q9Y6YF')
    """

    def __init__(self, config_path: Optional[str] = None):
        """Initialize the inventory manager with configuration."""
        self.config_path = config_path or os.path.join(
            BASE_DIR, "config", "inventory_rules.yaml"
        )
        self.config = self._load_config()
        self._db_connection = None

    def _load_config(self) -> Dict[str, Any]:
        """Load inventory rules configuration from YAML."""
        try:
            with open(self.config_path, 'r') as f:
                config = yaml.safe_load(f)
            logger.info(f"Loaded inventory config from {self.config_path}")
            return config
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
            raise

    def _get_db_connection(self):
        """Get DuckDB connection."""
        if self._db_connection is None:
            import sys
            sys.path.insert(0, os.path.join(BASE_DIR, "src"))
            from data_lake.db_manager import get_db_connection
            self._db_connection = get_db_connection()
        return self._db_connection

    def _ensure_inventory_table(self):
        """Ensure inventory status table exists."""
        con = self._get_db_connection()
        con.execute("""
            CREATE TABLE IF NOT EXISTS dim_inventory_status (
                asin VARCHAR,
                snapshot_date DATE,
                available_units INT,
                reserved_units INT DEFAULT 0,
                inbound_units INT DEFAULT 0,
                days_of_cover DECIMAL(10,2),
                sales_velocity DECIMAL(10,4),
                status VARCHAR,
                restock_recommended BOOLEAN DEFAULT FALSE,
                restock_quantity INT,
                data_source VARCHAR DEFAULT 'manual',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (asin, snapshot_date)
            )
        """)
        logger.debug("Ensured dim_inventory_status table exists")

    def update_inventory(self, asin: str, available_units: int,
                        reserved_units: int = 0, inbound_units: int = 0,
                        data_source: str = 'manual') -> BudgetModifier:
        """
        Update inventory for an ASIN and calculate status.

        Args:
            asin: The Amazon ASIN
            available_units: Currently available FBA units
            reserved_units: Units reserved for orders
            inbound_units: Units in transit to FBA
            data_source: Source of the data (manual, api, csv)

        Returns:
            BudgetModifier with recommendation
        """
        self._ensure_inventory_table()
        con = self._get_db_connection()

        # Calculate sales velocity
        velocity = self._calculate_sales_velocity(asin)

        # Calculate days of cover
        if velocity > 0:
            days_of_cover = available_units / velocity
        else:
            days_of_cover = 999 if available_units > 0 else 0

        # Determine status
        status = self._determine_status(available_units, days_of_cover)

        # Calculate restock recommendation
        restock_recommended, restock_qty = self._calculate_restock(
            asin, available_units, velocity
        )

        # Insert/update inventory record
        con.execute("""
            INSERT OR REPLACE INTO dim_inventory_status
            (asin, snapshot_date, available_units, reserved_units, inbound_units,
             days_of_cover, sales_velocity, status, restock_recommended,
             restock_quantity, data_source, updated_at)
            VALUES (?, CURRENT_DATE, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """, [
            asin, available_units, reserved_units, inbound_units,
            days_of_cover, velocity, status.value, restock_recommended,
            restock_qty, data_source
        ])

        # Get budget modifier
        modifier = self._get_budget_modifier(asin, available_units, days_of_cover, status)

        logger.info(f"Updated inventory for {asin}: {available_units} units, "
                   f"{days_of_cover:.1f} days cover, status={status.value}")

        return modifier

    def _calculate_sales_velocity(self, asin: str) -> float:
        """Calculate daily sales velocity using EMA or simple average."""
        con = self._get_db_connection()
        lookback = self.config['velocity'].get('lookback_days', 14)
        method = self.config['velocity'].get('smoothing_method', 'simple')
        min_sales = self.config['velocity'].get('min_sales_for_forecast', 3)

        try:
            # Get daily orders from fact_asin_daily or fact_keyword_entry_daily
            df = con.execute(f"""
                SELECT dt, SUM(orders) as daily_orders
                FROM fact_keyword_entry_daily
                WHERE asin = ?
                  AND dt >= CURRENT_DATE - {lookback}
                GROUP BY dt
                ORDER BY dt
            """, [asin]).df()

            if len(df) == 0 or df['daily_orders'].sum() < min_sales:
                # Try fact_asin_daily if no data in keyword table
                df = con.execute(f"""
                    SELECT dt, units_ordered as daily_orders
                    FROM fact_asin_daily
                    WHERE asin = ?
                      AND dt >= CURRENT_DATE - {lookback}
                    ORDER BY dt
                """, [asin]).df()

            if len(df) == 0 or df['daily_orders'].sum() < min_sales:
                logger.warning(f"Insufficient sales data for {asin}, using default velocity")
                return 0.5  # Default to 0.5 units/day

            if method == 'ema':
                alpha = self.config['velocity'].get('ema_alpha', 0.3)
                df['ema'] = df['daily_orders'].ewm(alpha=alpha).mean()
                velocity = df['ema'].iloc[-1]
            else:  # simple average
                velocity = df['daily_orders'].mean()

            return max(0.1, velocity)  # Minimum velocity of 0.1/day

        except Exception as e:
            logger.warning(f"Error calculating velocity for {asin}: {e}")
            return 0.5

    def _determine_status(self, available_units: int, days_of_cover: float) -> InventoryStatus:
        """Determine inventory status based on thresholds."""
        thresholds = self.config['thresholds']

        if available_units == 0:
            return InventoryStatus.STOCKOUT
        elif days_of_cover < thresholds['critical']:
            return InventoryStatus.CRITICAL
        elif days_of_cover < thresholds['warning']:
            return InventoryStatus.WARNING
        elif days_of_cover < thresholds['caution']:
            return InventoryStatus.CAUTION
        elif days_of_cover > thresholds['overstock']:
            return InventoryStatus.OVERSTOCK
        else:
            return InventoryStatus.HEALTHY

    def _calculate_restock(self, asin: str, available_units: int,
                          velocity: float) -> Tuple[bool, int]:
        """Calculate if restock is needed and quantity."""
        restock_config = self.config['restock']
        lead_time = restock_config.get('lead_time_days', 21)
        safety_stock = restock_config.get('safety_stock_days', 7)

        # Check for ASIN-specific overrides
        asin_overrides = self.config.get('asin_overrides') or {}
        overrides = asin_overrides.get(asin, {})
        lead_time = overrides.get('lead_time_days', lead_time)

        # Reorder point = (Lead time + Safety stock) * Daily velocity
        reorder_point = (lead_time + safety_stock) * velocity

        if available_units <= reorder_point:
            # Calculate order quantity (enough for 60 days after lead time)
            target_days = 60
            target_inventory = (target_days + lead_time) * velocity
            order_qty = max(0, int(target_inventory - available_units))
            return True, order_qty
        else:
            return False, 0

    def _get_budget_modifier(self, asin: str, available_units: int,
                            days_of_cover: float, status: InventoryStatus) -> BudgetModifier:
        """Get budget modifier recommendation based on inventory status."""
        modifiers = self.config['budget_modifiers']

        # Handle stockout
        if status == InventoryStatus.STOCKOUT:
            if self.config['actions'].get('auto_pause_at_stockout', True):
                return BudgetModifier(
                    asin=asin,
                    current_inventory=available_units,
                    days_of_cover=days_of_cover,
                    status=status,
                    budget_modifier=0.0,
                    max_daily_spend=0.0,
                    pause_new_keywords=True,
                    reason="STOCKOUT - All ads paused"
                )

        # Get modifier config for status
        status_key = status.value
        mod_config = modifiers.get(status_key, modifiers['healthy'])

        return BudgetModifier(
            asin=asin,
            current_inventory=available_units,
            days_of_cover=days_of_cover,
            status=status,
            budget_modifier=mod_config['modifier'],
            max_daily_spend=mod_config.get('max_daily_spend_usd'),
            pause_new_keywords=mod_config.get('pause_new_keywords', False),
            reason=mod_config['description']
        )

    def get_asin_status(self, asin: str) -> Optional[Dict[str, Any]]:
        """Get current inventory status for an ASIN."""
        self._ensure_inventory_table()
        con = self._get_db_connection()

        try:
            result = con.execute("""
                SELECT *
                FROM dim_inventory_status
                WHERE asin = ?
                ORDER BY snapshot_date DESC
                LIMIT 1
            """, [asin]).fetchone()

            if result:
                columns = [desc[0] for desc in con.description]
                return dict(zip(columns, result))
            return None
        except Exception as e:
            logger.error(f"Error getting status for {asin}: {e}")
            return None

    def get_all_inventory_status(self) -> pd.DataFrame:
        """Get inventory status for all tracked ASINs."""
        self._ensure_inventory_table()
        con = self._get_db_connection()

        try:
            return con.execute("""
                SELECT
                    asin,
                    available_units,
                    days_of_cover,
                    sales_velocity,
                    status,
                    restock_recommended,
                    restock_quantity,
                    updated_at
                FROM dim_inventory_status
                WHERE snapshot_date = (
                    SELECT MAX(snapshot_date) FROM dim_inventory_status
                )
                ORDER BY days_of_cover ASC
            """).df()
        except Exception as e:
            logger.error(f"Error getting inventory status: {e}")
            return pd.DataFrame()

    def get_budget_recommendations(self) -> List[BudgetModifier]:
        """
        Get budget modification recommendations for all ASINs.

        Returns list of BudgetModifier objects for ASINs that need attention.
        """
        df = self.get_all_inventory_status()

        if len(df) == 0:
            logger.warning("No inventory data found")
            return []

        recommendations = []
        for _, row in df.iterrows():
            status = InventoryStatus(row['status'])

            # Only include non-healthy statuses
            if status != InventoryStatus.HEALTHY:
                modifier = self._get_budget_modifier(
                    row['asin'],
                    row['available_units'],
                    row['days_of_cover'],
                    status
                )
                recommendations.append(modifier)

        return recommendations

    def get_critical_alerts(self) -> List[Dict[str, Any]]:
        """Get list of critical inventory alerts."""
        df = self.get_all_inventory_status()

        if len(df) == 0:
            return []

        alerts = []
        for _, row in df.iterrows():
            status = InventoryStatus(row['status'])

            if status in [InventoryStatus.STOCKOUT, InventoryStatus.CRITICAL]:
                alerts.append({
                    'asin': row['asin'],
                    'status': status.value,
                    'available_units': row['available_units'],
                    'days_of_cover': row['days_of_cover'],
                    'action_required': 'URGENT RESTOCK' if row['restock_recommended'] else 'PAUSE ADS',
                    'restock_quantity': row['restock_quantity']
                })

        return alerts

    def bulk_update_inventory(self, inventory_data: List[Dict[str, Any]],
                             data_source: str = 'bulk_import') -> Dict[str, Any]:
        """
        Bulk update inventory for multiple ASINs.

        Args:
            inventory_data: List of dicts with 'asin' and 'available_units' keys
            data_source: Source of the data

        Returns:
            Summary of updates
        """
        results = {
            'updated': 0,
            'errors': 0,
            'recommendations': []
        }

        for item in inventory_data:
            try:
                asin = item.get('asin')
                units = item.get('available_units', 0)
                reserved = item.get('reserved_units', 0)
                inbound = item.get('inbound_units', 0)

                modifier = self.update_inventory(
                    asin, units, reserved, inbound, data_source
                )
                results['updated'] += 1
                results['recommendations'].append(modifier.to_dict())
            except Exception as e:
                logger.error(f"Error updating {item.get('asin')}: {e}")
                results['errors'] += 1

        return results

    def generate_report(self) -> str:
        """Generate a markdown report of inventory status."""
        df = self.get_all_inventory_status()
        recommendations = self.get_budget_recommendations()
        alerts = self.get_critical_alerts()

        report = []
        report.append("# Inventory Status Report")
        report.append(f"\n**Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append(f"**Total ASINs Tracked**: {len(df)}")
        report.append("")

        # Alerts section
        if alerts:
            report.append("## Critical Alerts")
            report.append("")
            for alert in alerts:
                report.append(f"- **{alert['asin']}**: {alert['status'].upper()} - "
                            f"{alert['available_units']} units, "
                            f"{alert['days_of_cover']:.1f} days cover. "
                            f"Action: {alert['action_required']}")
            report.append("")

        # Status summary
        if len(df) > 0:
            report.append("## Status Summary")
            report.append("")
            status_counts = df['status'].value_counts().to_dict()
            for status, count in status_counts.items():
                report.append(f"- **{status}**: {count} ASIN(s)")
            report.append("")

            # Detailed table
            report.append("## Inventory Details")
            report.append("")
            report.append("| ASIN | Units | Days Cover | Velocity | Status | Restock? |")
            report.append("|------|-------|------------|----------|--------|----------|")

            for _, row in df.iterrows():
                restock = f"Yes ({row['restock_quantity']})" if row['restock_recommended'] else "No"
                report.append(
                    f"| {row['asin']} | {row['available_units']} | "
                    f"{row['days_of_cover']:.1f} | {row['sales_velocity']:.2f}/day | "
                    f"{row['status']} | {restock} |"
                )

        # Budget recommendations
        if recommendations:
            report.append("")
            report.append("## Budget Modification Recommendations")
            report.append("")
            report.append("| ASIN | Status | Budget Modifier | Max Daily | Pause New KW? | Reason |")
            report.append("|------|--------|-----------------|-----------|---------------|--------|")

            for rec in recommendations:
                max_daily = f"${rec.max_daily_spend:.0f}" if rec.max_daily_spend else "N/A"
                pause = "Yes" if rec.pause_new_keywords else "No"
                report.append(
                    f"| {rec.asin} | {rec.status.value} | {rec.budget_modifier:.0%} | "
                    f"{max_daily} | {pause} | {rec.reason} |"
                )

        return "\n".join(report)


def main():
    """CLI entry point for inventory manager."""
    import argparse

    parser = argparse.ArgumentParser(description='Amazon Inventory Manager')
    parser.add_argument('--update', nargs=2, metavar=('ASIN', 'UNITS'),
                       help='Update inventory for an ASIN')
    parser.add_argument('--status', type=str, metavar='ASIN',
                       help='Get status for an ASIN')
    parser.add_argument('--report', action='store_true',
                       help='Generate inventory report')
    parser.add_argument('--alerts', action='store_true',
                       help='Show critical alerts')

    args = parser.parse_args()

    manager = InventoryManager()

    if args.update:
        asin, units = args.update
        modifier = manager.update_inventory(asin, int(units))
        print(f"\nUpdated {asin}:")
        print(f"  Status: {modifier.status.value}")
        print(f"  Days of Cover: {modifier.days_of_cover:.1f}")
        print(f"  Budget Modifier: {modifier.budget_modifier:.0%}")
        print(f"  Reason: {modifier.reason}")

    elif args.status:
        status = manager.get_asin_status(args.status)
        if status:
            print(f"\nInventory Status for {args.status}:")
            for key, value in status.items():
                print(f"  {key}: {value}")
        else:
            print(f"No inventory data found for {args.status}")

    elif args.alerts:
        alerts = manager.get_critical_alerts()
        if alerts:
            print("\nCritical Alerts:")
            for alert in alerts:
                print(f"  - {alert['asin']}: {alert['status']} - {alert['action_required']}")
        else:
            print("No critical alerts")

    elif args.report:
        report = manager.generate_report()
        print(report)

        # Save report
        report_path = os.path.join(BASE_DIR, "reports", "markdown",
                                   f"inventory_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md")
        os.makedirs(os.path.dirname(report_path), exist_ok=True)
        with open(report_path, 'w') as f:
            f.write(report)
        print(f"\nReport saved to: {report_path}")

    else:
        # Default: show all inventory status
        df = manager.get_all_inventory_status()
        if len(df) > 0:
            print("\nCurrent Inventory Status:")
            print(df.to_string())
        else:
            print("No inventory data found. Use --update ASIN UNITS to add data.")


if __name__ == '__main__':
    main()
