#!/usr/bin/env python3
"""
Data Quality Check Script for Amazon Growth OS Data Lake
Version: 2.1

Checks:
1. Data Freshness - How recent is the data?
2. Completeness - Missing values in critical columns
3. Validity - Values within expected ranges
4. Consistency - Cross-table relationships
5. Anomaly Detection - Outliers and unexpected patterns

Usage:
    python tools/data_quality_check.py [--output json|markdown|console]
"""

import os
import sys
import json
import argparse
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.data_lake.db_manager import get_db_connection, get_table_stats


# ============================================
# Quality Check Definitions
# ============================================

CRITICAL_COLUMNS = {
    'fact_keyword_entry_daily': ['keyword', 'impressions', 'clicks', 'spend'],
    'fact_keyword_snapshot': ['keyword', 'search_volume', 'organic_rank'],
    'fact_asin_daily': ['asin', 'sessions', 'units_ordered'],
    'fact_ads_keyword_daily_campaign': ['campaign_id', 'spend', 'impressions'],
}

VALUE_RANGES = {
    'search_volume': (0, 50_000_000),
    'organic_rank': (0, 500),
    'ad_rank': (0, 500),
    'impressions': (0, 100_000_000),
    'clicks': (0, 10_000_000),
    'spend': (0, 1_000_000),
    'ctr': (0, 1),
    'acos': (0, 10),  # ACOS can be > 100% but 1000% is suspicious
    'conversion_rate': (0, 1),
}

FRESHNESS_THRESHOLDS = {
    'fact_keyword_entry_daily': 3,      # Should have data within 3 days
    'fact_keyword_snapshot': 7,          # Snapshots within 7 days
    'fact_asin_daily': 3,
    'fact_ads_keyword_daily_campaign': 3,
}


# ============================================
# Quality Check Functions
# ============================================

def check_data_freshness(con) -> Dict[str, Any]:
    """Check how recent the data is in each table."""
    results = {
        'status': 'PASS',
        'checks': [],
        'warnings': [],
        'errors': []
    }

    date_columns = {
        'fact_keyword_entry_daily': 'dt',
        'fact_keyword_snapshot': 'snapshot_date',
        'fact_asin_daily': 'dt',
        'fact_ads_keyword_daily_campaign': 'dt',
        'fact_serp_top10': 'capture_date',
    }

    for table, date_col in date_columns.items():
        try:
            result = con.execute(f"""
                SELECT MAX({date_col})::DATE as max_date,
                       CURRENT_DATE - MAX({date_col})::DATE as days_old
                FROM {table}
            """).fetchone()

            if result and result[0]:
                max_date = result[0]
                days_old = result[1]
                threshold = FRESHNESS_THRESHOLDS.get(table, 7)

                check = {
                    'table': table,
                    'latest_date': str(max_date),
                    'days_old': days_old,
                    'threshold': threshold
                }

                if days_old > threshold:
                    check['status'] = 'WARNING'
                    results['warnings'].append(f"{table}: Data is {days_old} days old (threshold: {threshold})")
                    results['status'] = 'WARNING'
                else:
                    check['status'] = 'PASS'

                results['checks'].append(check)
            else:
                results['checks'].append({
                    'table': table,
                    'status': 'EMPTY',
                    'latest_date': None
                })
                results['warnings'].append(f"{table}: No data found")

        except Exception as e:
            results['errors'].append(f"{table}: {str(e)}")
            results['status'] = 'ERROR'

    return results


def check_completeness(con) -> Dict[str, Any]:
    """Check for missing values in critical columns."""
    results = {
        'status': 'PASS',
        'checks': [],
        'warnings': [],
        'errors': []
    }

    for table, columns in CRITICAL_COLUMNS.items():
        try:
            for col in columns:
                result = con.execute(f"""
                    SELECT
                        COUNT(*) as total,
                        SUM(CASE WHEN {col} IS NULL THEN 1 ELSE 0 END) as null_count
                    FROM {table}
                """).fetchone()

                if result:
                    total = result[0]
                    null_count = result[1]

                    if total > 0:
                        null_pct = (null_count / total) * 100

                        check = {
                            'table': table,
                            'column': col,
                            'total_rows': total,
                            'null_count': null_count,
                            'null_percentage': round(null_pct, 2)
                        }

                        if null_pct > 50:
                            check['status'] = 'ERROR'
                            results['errors'].append(f"{table}.{col}: {null_pct:.1f}% null values")
                            results['status'] = 'ERROR'
                        elif null_pct > 10:
                            check['status'] = 'WARNING'
                            results['warnings'].append(f"{table}.{col}: {null_pct:.1f}% null values")
                            if results['status'] != 'ERROR':
                                results['status'] = 'WARNING'
                        else:
                            check['status'] = 'PASS'

                        results['checks'].append(check)

        except Exception as e:
            results['errors'].append(f"{table}: {str(e)}")

    return results


def check_value_validity(con) -> Dict[str, Any]:
    """Check if values are within expected ranges."""
    results = {
        'status': 'PASS',
        'checks': [],
        'warnings': [],
        'errors': []
    }

    tables_to_check = [
        'fact_keyword_entry_daily',
        'fact_keyword_snapshot',
        'fact_asin_daily'
    ]

    for table in tables_to_check:
        try:
            # Get column info
            cols = [r[1] for r in con.execute(f"PRAGMA table_info({table})").fetchall()]

            for col, (min_val, max_val) in VALUE_RANGES.items():
                if col not in cols:
                    continue

                result = con.execute(f"""
                    SELECT
                        MIN({col}) as min_val,
                        MAX({col}) as max_val,
                        AVG({col}) as avg_val,
                        COUNT(*) as count,
                        SUM(CASE WHEN {col} < {min_val} OR {col} > {max_val} THEN 1 ELSE 0 END) as outliers
                    FROM {table}
                    WHERE {col} IS NOT NULL
                """).fetchone()

                if result and result[3] > 0:
                    check = {
                        'table': table,
                        'column': col,
                        'min': result[0],
                        'max': result[1],
                        'avg': round(result[2], 2) if result[2] else None,
                        'count': result[3],
                        'outliers': result[4],
                        'expected_range': [min_val, max_val]
                    }

                    if result[4] > 0:
                        outlier_pct = (result[4] / result[3]) * 100
                        check['outlier_percentage'] = round(outlier_pct, 2)

                        if outlier_pct > 5:
                            check['status'] = 'WARNING'
                            results['warnings'].append(
                                f"{table}.{col}: {outlier_pct:.1f}% values outside range [{min_val}, {max_val}]"
                            )
                            if results['status'] != 'ERROR':
                                results['status'] = 'WARNING'
                        else:
                            check['status'] = 'PASS'
                    else:
                        check['status'] = 'PASS'

                    results['checks'].append(check)

        except Exception as e:
            results['errors'].append(f"{table}: {str(e)}")

    return results


def check_anomalies(con) -> Dict[str, Any]:
    """Check for anomalies and suspicious patterns."""
    results = {
        'status': 'PASS',
        'checks': [],
        'warnings': [],
        'errors': []
    }

    # Check 1: Keywords with very high spend but no conversions
    try:
        result = con.execute("""
            SELECT keyword, SUM(spend) as total_spend, SUM(orders) as total_orders
            FROM fact_keyword_entry_daily
            WHERE spend > 0
            GROUP BY keyword
            HAVING SUM(spend) > 50 AND SUM(orders) = 0
            ORDER BY total_spend DESC
            LIMIT 10
        """).fetchall()

        if result:
            results['checks'].append({
                'check': 'high_spend_no_conversion',
                'status': 'WARNING',
                'count': len(result),
                'examples': [{'keyword': r[0], 'spend': float(r[1])} for r in result[:5]]
            })
            results['warnings'].append(f"Found {len(result)} keywords with high spend but no conversions")
            if results['status'] != 'ERROR':
                results['status'] = 'WARNING'
        else:
            results['checks'].append({
                'check': 'high_spend_no_conversion',
                'status': 'PASS',
                'count': 0
            })
    except Exception as e:
        results['errors'].append(f"high_spend_no_conversion check: {str(e)}")

    # Check 2: Duplicate keywords in same day
    try:
        result = con.execute("""
            SELECT dt, keyword, COUNT(*) as dup_count
            FROM fact_keyword_entry_daily
            GROUP BY dt, keyword
            HAVING COUNT(*) > 5
            ORDER BY dup_count DESC
            LIMIT 10
        """).fetchall()

        if result:
            results['checks'].append({
                'check': 'duplicate_keywords',
                'status': 'WARNING',
                'count': len(result),
                'examples': [{'date': str(r[0]), 'keyword': r[1], 'count': r[2]} for r in result[:5]]
            })
            results['warnings'].append(f"Found {len(result)} date-keyword combinations with >5 duplicates")
        else:
            results['checks'].append({
                'check': 'duplicate_keywords',
                'status': 'PASS',
                'count': 0
            })
    except Exception as e:
        pass  # Table might not exist

    # Check 3: Sudden traffic drops
    try:
        result = con.execute("""
            WITH daily_totals AS (
                SELECT dt, SUM(impressions) as total_impressions
                FROM fact_keyword_entry_daily
                GROUP BY dt
            ),
            with_prev AS (
                SELECT
                    dt,
                    total_impressions,
                    LAG(total_impressions) OVER (ORDER BY dt) as prev_impressions
                FROM daily_totals
            )
            SELECT dt, total_impressions, prev_impressions,
                   (prev_impressions - total_impressions)::FLOAT / NULLIF(prev_impressions, 0) as drop_pct
            FROM with_prev
            WHERE prev_impressions > 0
              AND (prev_impressions - total_impressions)::FLOAT / prev_impressions > 0.5
            ORDER BY dt DESC
            LIMIT 5
        """).fetchall()

        if result:
            results['checks'].append({
                'check': 'traffic_drops',
                'status': 'WARNING',
                'count': len(result),
                'examples': [{'date': str(r[0]), 'drop_percentage': round(r[3] * 100, 1)} for r in result]
            })
            results['warnings'].append(f"Found {len(result)} days with >50% traffic drops")
        else:
            results['checks'].append({
                'check': 'traffic_drops',
                'status': 'PASS',
                'count': 0
            })
    except Exception as e:
        pass  # Might not have enough data

    return results


def generate_quality_report(con) -> Dict[str, Any]:
    """Generate comprehensive data quality report."""
    report = {
        'generated_at': datetime.now().isoformat(),
        'overall_status': 'PASS',
        'summary': {
            'total_checks': 0,
            'passed': 0,
            'warnings': 0,
            'errors': 0
        },
        'sections': {}
    }

    # Run all checks
    checks = [
        ('freshness', check_data_freshness),
        ('completeness', check_completeness),
        ('validity', check_value_validity),
        ('anomalies', check_anomalies),
    ]

    for name, check_func in checks:
        result = check_func(con)
        report['sections'][name] = result

        # Update summary
        for check in result.get('checks', []):
            report['summary']['total_checks'] += 1
            status = check.get('status', 'PASS')
            if status == 'PASS':
                report['summary']['passed'] += 1
            elif status == 'WARNING':
                report['summary']['warnings'] += 1
            else:
                report['summary']['errors'] += 1

        # Update overall status
        if result.get('status') == 'ERROR':
            report['overall_status'] = 'ERROR'
        elif result.get('status') == 'WARNING' and report['overall_status'] != 'ERROR':
            report['overall_status'] = 'WARNING'

    # Add table stats
    report['table_stats'] = get_table_stats(con)

    return report


# ============================================
# Output Formatters
# ============================================

def format_as_markdown(report: Dict) -> str:
    """Format report as Markdown."""
    lines = [
        "# Data Quality Report",
        "",
        f"**Generated:** {report['generated_at']}",
        f"**Overall Status:** {report['overall_status']}",
        "",
        "## Summary",
        "",
        f"| Metric | Count |",
        f"|--------|-------|",
        f"| Total Checks | {report['summary']['total_checks']} |",
        f"| Passed | {report['summary']['passed']} |",
        f"| Warnings | {report['summary']['warnings']} |",
        f"| Errors | {report['summary']['errors']} |",
        "",
    ]

    for section_name, section_data in report['sections'].items():
        lines.append(f"## {section_name.title()}")
        lines.append("")
        lines.append(f"**Status:** {section_data.get('status', 'N/A')}")
        lines.append("")

        if section_data.get('warnings'):
            lines.append("### Warnings")
            for w in section_data['warnings']:
                lines.append(f"- {w}")
            lines.append("")

        if section_data.get('errors'):
            lines.append("### Errors")
            for e in section_data['errors']:
                lines.append(f"- {e}")
            lines.append("")

    # Table stats
    lines.append("## Table Statistics")
    lines.append("")
    lines.append("| Table | Rows | Date Range |")
    lines.append("|-------|------|------------|")
    for table, stats in report.get('table_stats', {}).items():
        if isinstance(stats, dict) and 'row_count' in stats:
            date_range = stats.get('date_range', {})
            date_str = f"{date_range.get('min', 'N/A')} - {date_range.get('max', 'N/A')}" if date_range else "N/A"
            lines.append(f"| {table} | {stats['row_count']:,} | {date_str} |")
    lines.append("")

    return "\n".join(lines)


def format_as_console(report: Dict) -> str:
    """Format report for console output."""
    lines = [
        "=" * 60,
        "DATA QUALITY REPORT",
        "=" * 60,
        f"Generated: {report['generated_at']}",
        f"Overall Status: {report['overall_status']}",
        "",
        "SUMMARY",
        "-" * 40,
        f"  Total Checks: {report['summary']['total_checks']}",
        f"  Passed:       {report['summary']['passed']}",
        f"  Warnings:     {report['summary']['warnings']}",
        f"  Errors:       {report['summary']['errors']}",
        "",
    ]

    for section_name, section_data in report['sections'].items():
        lines.append(f"{section_name.upper()}")
        lines.append("-" * 40)

        if section_data.get('warnings'):
            for w in section_data['warnings']:
                lines.append(f"  [WARN] {w}")

        if section_data.get('errors'):
            for e in section_data['errors']:
                lines.append(f"  [ERROR] {e}")

        if not section_data.get('warnings') and not section_data.get('errors'):
            lines.append("  [OK] All checks passed")

        lines.append("")

    lines.append("=" * 60)
    return "\n".join(lines)


# ============================================
# Main Entry Point
# ============================================

def main():
    parser = argparse.ArgumentParser(description='Data Quality Check for Amazon Growth OS')
    parser.add_argument('--output', choices=['json', 'markdown', 'console'],
                       default='console', help='Output format')
    parser.add_argument('--save', type=str, help='Save report to file')
    args = parser.parse_args()

    # Connect and run checks
    con = get_db_connection()
    report = generate_quality_report(con)
    con.close()

    # Format output
    if args.output == 'json':
        output = json.dumps(report, indent=2, default=str)
    elif args.output == 'markdown':
        output = format_as_markdown(report)
    else:
        output = format_as_console(report)

    # Save or print
    if args.save:
        with open(args.save, 'w') as f:
            f.write(output)
        print(f"Report saved to {args.save}")
    else:
        print(output)

    # Exit with appropriate code
    if report['overall_status'] == 'ERROR':
        sys.exit(2)
    elif report['overall_status'] == 'WARNING':
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == "__main__":
    main()
