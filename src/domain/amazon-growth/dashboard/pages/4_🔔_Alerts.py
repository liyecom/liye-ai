"""
Alerts Page - Anomalies and Critical Issues
"""

import streamlit as st
import pandas as pd
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from src.data_lake.db_manager import get_db_connection
from tools.data_quality_check import generate_quality_report

st.set_page_config(page_title="Alerts", page_icon="🔔", layout="wide")

st.title("🔔 Alert Center")
st.markdown("**Anomalies, Issues, and Action Items**")

try:
    con = get_db_connection()

    # Alert categories
    tab1, tab2, tab3, tab4 = st.tabs([
        "🚨 Critical", "⚠️ Warnings", "📊 Data Quality", "💰 Budget"
    ])

    with tab1:
        st.subheader("🚨 Critical Alerts")

        # High ACOS keywords
        df_high_acos = con.execute("""
            SELECT
                keyword,
                SUM(spend) as total_spend,
                SUM(sales) as total_sales,
                CASE WHEN SUM(sales) > 0
                     THEN (SUM(spend) / SUM(sales)) * 100
                     ELSE 999
                END as acos
            FROM fact_keyword_entry_daily
            WHERE dt >= CURRENT_DATE - 7
            GROUP BY keyword
            HAVING SUM(spend) > 10
               AND (SUM(sales) = 0 OR (SUM(spend) / SUM(sales)) > 0.5)
            ORDER BY total_spend DESC
            LIMIT 10
        """).df()

        if len(df_high_acos) > 0:
            st.error(f"Found {len(df_high_acos)} keywords with ACOS > 50% or zero sales")
            st.dataframe(
                df_high_acos,
                column_config={
                    "keyword": "Keyword",
                    "total_spend": st.column_config.NumberColumn("Spend", format="$%.2f"),
                    "total_sales": st.column_config.NumberColumn("Sales", format="$%.2f"),
                    "acos": st.column_config.NumberColumn("ACOS %", format="%.1f%%")
                },
                hide_index=True
            )
            st.markdown("**Recommended Action:** Pause or negate these keywords immediately.")
        else:
            st.success("No critical ACOS issues found!")

    with tab2:
        st.subheader("⚠️ Performance Warnings")

        # Keywords losing rank
        df_rank_drop = con.execute("""
            WITH rank_changes AS (
                SELECT
                    keyword,
                    organic_rank,
                    LAG(organic_rank) OVER (PARTITION BY keyword ORDER BY snapshot_date) as prev_rank,
                    snapshot_date
                FROM fact_keyword_snapshot
            )
            SELECT
                keyword,
                prev_rank as previous_rank,
                organic_rank as current_rank,
                organic_rank - prev_rank as rank_change
            FROM rank_changes
            WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM fact_keyword_snapshot)
              AND prev_rank IS NOT NULL
              AND organic_rank - prev_rank > 5
            ORDER BY rank_change DESC
            LIMIT 10
        """).df()

        if len(df_rank_drop) > 0:
            st.warning(f"Found {len(df_rank_drop)} keywords with significant rank drops")
            st.dataframe(df_rank_drop, hide_index=True)
            st.markdown("**Recommended Action:** Increase PPC bid or improve listing relevance.")
        else:
            st.success("No significant rank drops detected!")

        # Low CTR keywords
        df_low_ctr = con.execute("""
            SELECT
                keyword,
                SUM(impressions) as impressions,
                SUM(clicks) as clicks,
                CASE WHEN SUM(impressions) > 0
                     THEN (SUM(clicks)::FLOAT / SUM(impressions)) * 100
                     ELSE 0
                END as ctr
            FROM fact_keyword_entry_daily
            WHERE dt >= CURRENT_DATE - 7
            GROUP BY keyword
            HAVING SUM(impressions) > 1000
               AND (SUM(clicks)::FLOAT / NULLIF(SUM(impressions), 0)) < 0.002
            ORDER BY impressions DESC
            LIMIT 10
        """).df()

        if len(df_low_ctr) > 0:
            st.warning(f"Found {len(df_low_ctr)} keywords with CTR < 0.2%")
            st.dataframe(df_low_ctr, hide_index=True)
            st.markdown("**Recommended Action:** Review ad copy or keyword relevance.")
        else:
            st.success("CTR metrics look healthy!")

    with tab3:
        st.subheader("📊 Data Quality Alerts")

        # Run data quality checks
        report = generate_quality_report(con)

        # Overall status
        status = report.get('overall_status', 'UNKNOWN')
        if status == 'PASS':
            st.success(f"Data Quality: {status}")
        elif status == 'WARNING':
            st.warning(f"Data Quality: {status}")
        else:
            st.error(f"Data Quality: {status}")

        # Summary
        summary = report.get('summary', {})
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("Total Checks", summary.get('total_checks', 0))
        with col2:
            st.metric("Passed", summary.get('passed', 0))
        with col3:
            st.metric("Warnings", summary.get('warnings', 0))
        with col4:
            st.metric("Errors", summary.get('errors', 0))

        # Details
        for section, data in report.get('sections', {}).items():
            if data.get('warnings') or data.get('errors'):
                with st.expander(f"{section.title()} Issues"):
                    for w in data.get('warnings', []):
                        st.warning(w)
                    for e in data.get('errors', []):
                        st.error(e)

    with tab4:
        st.subheader("💰 Budget Monitoring")

        # Daily spend trend
        df_budget = con.execute("""
            SELECT
                dt as date,
                SUM(spend) as daily_spend
            FROM fact_keyword_entry_daily
            WHERE dt >= CURRENT_DATE - 14
            GROUP BY dt
            ORDER BY dt
        """).df()

        if len(df_budget) > 0:
            avg_spend = df_budget['daily_spend'].mean()
            max_spend = df_budget['daily_spend'].max()
            latest_spend = df_budget['daily_spend'].iloc[-1] if len(df_budget) > 0 else 0

            col1, col2, col3 = st.columns(3)
            with col1:
                st.metric("Avg Daily Spend", f"${avg_spend:.2f}")
            with col2:
                st.metric("Max Daily Spend", f"${max_spend:.2f}")
            with col3:
                delta = ((latest_spend - avg_spend) / avg_spend * 100) if avg_spend > 0 else 0
                st.metric("Latest Spend", f"${latest_spend:.2f}",
                         f"{delta:+.1f}% vs avg")

            # Budget alert thresholds
            daily_limit = st.number_input("Daily Budget Limit ($)", value=200.0, step=10.0)
            if latest_spend > daily_limit:
                st.error(f"⚠️ Latest spend (${latest_spend:.2f}) exceeds daily limit (${daily_limit:.2f})")
            else:
                st.success(f"✅ Spend within budget (${latest_spend:.2f} / ${daily_limit:.2f})")

        else:
            st.info("No spend data available.")

    con.close()

except Exception as e:
    st.error(f"Error loading alerts: {e}")
