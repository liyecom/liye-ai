"""
Background Task Scheduler for Amazon Growth OS.

Handles scheduled tasks:
- Daily ETL data loading
- Bid adjustment analysis
- Inventory checks
- Knowledge base indexing
- Data quality checks
"""

import os
import sys
import time
import logging
import schedule
from datetime import datetime
from typing import Callable, Dict, Any

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Base directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, BASE_DIR)


class Scheduler:
    """
    Background task scheduler for Amazon Growth OS.

    Example usage:
        scheduler = Scheduler()
        scheduler.setup_daily_tasks()
        scheduler.run()  # Blocks and runs forever
    """

    def __init__(self):
        """Initialize the scheduler."""
        self.tasks: Dict[str, Dict[str, Any]] = {}
        self._running = False

    def register_task(self, name: str, func: Callable, schedule_time: str,
                     description: str = "") -> None:
        """Register a scheduled task."""
        self.tasks[name] = {
            'func': func,
            'schedule_time': schedule_time,
            'description': description,
            'last_run': None,
            'last_status': None
        }
        logger.info(f"Registered task: {name} at {schedule_time}")

    def run_task(self, name: str) -> bool:
        """Run a specific task by name."""
        if name not in self.tasks:
            logger.error(f"Task not found: {name}")
            return False

        task = self.tasks[name]
        logger.info(f"Running task: {name}")

        try:
            start_time = datetime.now()
            task['func']()
            end_time = datetime.now()

            task['last_run'] = end_time
            task['last_status'] = 'success'
            task['duration'] = (end_time - start_time).total_seconds()

            logger.info(f"Task {name} completed in {task['duration']:.2f}s")
            return True

        except Exception as e:
            task['last_run'] = datetime.now()
            task['last_status'] = f'error: {str(e)}'
            logger.error(f"Task {name} failed: {e}")
            return False

    def setup_daily_tasks(self) -> None:
        """Setup standard daily tasks."""
        # ETL Data Loading (3:00 AM)
        self.register_task(
            'etl_daily',
            self._run_etl,
            '03:00',
            'Daily ETL data loading from CSV files'
        )
        schedule.every().day.at("03:00").do(lambda: self.run_task('etl_daily'))

        # Bid Analysis (6:00 AM)
        self.register_task(
            'bid_analysis',
            self._run_bid_analysis,
            '06:00',
            'Daily bid adjustment recommendations'
        )
        schedule.every().day.at("06:00").do(lambda: self.run_task('bid_analysis'))

        # Inventory Check (7:00 AM)
        self.register_task(
            'inventory_check',
            self._run_inventory_check,
            '07:00',
            'Daily inventory status check and alerts'
        )
        schedule.every().day.at("07:00").do(lambda: self.run_task('inventory_check'))

        # Data Quality Check (4:00 AM)
        self.register_task(
            'data_quality',
            self._run_data_quality,
            '04:00',
            'Daily data quality validation'
        )
        schedule.every().day.at("04:00").do(lambda: self.run_task('data_quality'))

        # Knowledge Base Indexing (2:00 AM)
        self.register_task(
            'kb_index',
            self._run_kb_index,
            '02:00',
            'Daily knowledge base incremental indexing'
        )
        schedule.every().day.at("02:00").do(lambda: self.run_task('kb_index'))

        logger.info("Daily tasks scheduled")

    def _run_etl(self) -> None:
        """Run ETL data loading."""
        from src.data_lake.etl_loader import run_etl
        result = run_etl()
        logger.info(f"ETL result: {result}")

    def _run_bid_analysis(self) -> None:
        """Run bid adjustment analysis."""
        from src.bidding.bid_engine import BidEngine
        engine = BidEngine()
        decisions = engine.analyze_and_recommend(lookback_days=7)
        results = engine.execute(decisions, mode='dry_run')

        # Generate and save report
        report = engine.generate_report(decisions)
        report_path = os.path.join(
            BASE_DIR, "reports", "markdown",
            f"bid_report_{datetime.now().strftime('%Y%m%d')}.md"
        )
        os.makedirs(os.path.dirname(report_path), exist_ok=True)
        with open(report_path, 'w') as f:
            f.write(report)

        logger.info(f"Bid analysis: {len(decisions)} recommendations generated")

    def _run_inventory_check(self) -> None:
        """Run inventory status check."""
        from src.inventory.inventory_manager import InventoryManager
        manager = InventoryManager()

        # Get alerts
        alerts = manager.get_critical_alerts()
        if alerts:
            logger.warning(f"Inventory alerts: {len(alerts)} critical issues")
            for alert in alerts:
                logger.warning(f"  - {alert['asin']}: {alert['status']} - {alert['action_required']}")

        # Generate report
        report = manager.generate_report()
        report_path = os.path.join(
            BASE_DIR, "reports", "markdown",
            f"inventory_report_{datetime.now().strftime('%Y%m%d')}.md"
        )
        os.makedirs(os.path.dirname(report_path), exist_ok=True)
        with open(report_path, 'w') as f:
            f.write(report)

    def _run_data_quality(self) -> None:
        """Run data quality checks."""
        from tools.data_quality_check import run_quality_check
        report = run_quality_check(output_format='json')
        logger.info(f"Data quality: {report.get('overall_status', 'UNKNOWN')}")

    def _run_kb_index(self) -> None:
        """Run knowledge base indexing."""
        try:
            from scripts.incremental_index import main as run_index
            run_index()
            logger.info("Knowledge base indexing completed")
        except Exception as e:
            logger.warning(f"KB indexing skipped: {e}")

    def run(self, blocking: bool = True) -> None:
        """
        Start the scheduler.

        Args:
            blocking: If True, blocks forever. If False, runs once and returns.
        """
        self._running = True
        logger.info("Scheduler started")

        if blocking:
            while self._running:
                schedule.run_pending()
                time.sleep(60)  # Check every minute
        else:
            schedule.run_pending()

    def stop(self) -> None:
        """Stop the scheduler."""
        self._running = False
        logger.info("Scheduler stopped")

    def status(self) -> Dict[str, Any]:
        """Get scheduler status."""
        return {
            'running': self._running,
            'tasks': {
                name: {
                    'schedule_time': task['schedule_time'],
                    'description': task['description'],
                    'last_run': task['last_run'].isoformat() if task['last_run'] else None,
                    'last_status': task['last_status']
                }
                for name, task in self.tasks.items()
            },
            'next_run': schedule.next_run()
        }


def main():
    """CLI entry point for the scheduler."""
    import argparse

    parser = argparse.ArgumentParser(description='Amazon Growth OS Background Scheduler')
    parser.add_argument('--run-task', type=str, help='Run a specific task immediately')
    parser.add_argument('--list-tasks', action='store_true', help='List all scheduled tasks')
    parser.add_argument('--daemon', action='store_true', help='Run as daemon (blocking)')

    args = parser.parse_args()

    scheduler = Scheduler()
    scheduler.setup_daily_tasks()

    if args.list_tasks:
        print("\n=== Scheduled Tasks ===")
        for name, task in scheduler.tasks.items():
            print(f"\n{name}:")
            print(f"  Schedule: {task['schedule_time']}")
            print(f"  Description: {task['description']}")

    elif args.run_task:
        success = scheduler.run_task(args.run_task)
        sys.exit(0 if success else 1)

    elif args.daemon:
        print("Starting scheduler daemon...")
        print("Press Ctrl+C to stop")
        try:
            scheduler.run(blocking=True)
        except KeyboardInterrupt:
            scheduler.stop()
            print("\nScheduler stopped")

    else:
        parser.print_help()


if __name__ == '__main__':
    main()
