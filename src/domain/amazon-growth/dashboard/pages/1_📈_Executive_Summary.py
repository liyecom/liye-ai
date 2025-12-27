"""
Executive Summary Page - ACOS Trends, Sales, Budget Usage
"""

import streamlit as st
import plotly.express as px
import plotly.graph_objects as go
import pandas as pd
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from src.data_lake.db_manager import get_db_connection

st.set_page_config(page_title="Executive Summary", page_icon="📈", layout="wide")

st.title("📈 Executive Summary")
st.markdown("**Performance Overview** | Last 30 Days")

try:
    con = get_db_connection()

    # Date range selector
    col1, col2 = st.columns([3, 1])
    with col2:
        date_range = st.selectbox(
            "Date Range",
            ["Last 7 Days", "Last 14 Days", "Last 30 Days"],
            index=2
        )
        days = {"Last 7 Days": 7, "Last 14 Days": 14, "Last 30 Days": 30}[date_range]

    # Daily performance trend
    st.subheader("📊 Daily Performance Trend")

    df_daily = con.execute(f"""
        SELECT
            dt as date,
            SUM(impressions) as impressions,
            SUM(clicks) as clicks,
            SUM(spend) as spend,
            SUM(sales) as sales,
            SUM(orders) as orders,
            CASE WHEN SUM(sales) > 0
                 THEN (SUM(spend) / SUM(sales)) * 100
                 ELSE 0
            END as acos
        FROM fact_keyword_entry_daily
        WHERE dt >= CURRENT_DATE - {days}
        GROUP BY dt
        ORDER BY dt
    """).df()

    if len(df_daily) > 0:
        # ACOS trend chart
        fig_acos = go.Figure()
        fig_acos.add_trace(go.Scatter(
            x=df_daily['date'],
            y=df_daily['acos'],
            mode='lines+markers',
            name='ACOS %',
            line=dict(color='#FF9900', width=3),
            marker=dict(size=8)
        ))
        fig_acos.add_hline(y=30, line_dash="dash", line_color="red",
                          annotation_text="Target: 30%")
        fig_acos.add_hline(y=23, line_dash="dash", line_color="green",
                          annotation_text="Goal: 23%")
        fig_acos.update_layout(
            title="ACOS Trend",
            xaxis_title="Date",
            yaxis_title="ACOS %",
            height=300
        )
        st.plotly_chart(fig_acos, use_container_width=True)

        # Sales vs Spend
        col1, col2 = st.columns(2)

        with col1:
            fig_sales = go.Figure()
            fig_sales.add_trace(go.Bar(
                x=df_daily['date'],
                y=df_daily['sales'],
                name='Sales',
                marker_color='#28a745'
            ))
            fig_sales.add_trace(go.Bar(
                x=df_daily['date'],
                y=df_daily['spend'],
                name='Spend',
                marker_color='#dc3545'
            ))
            fig_sales.update_layout(
                title="Sales vs Spend",
                barmode='group',
                height=300
            )
            st.plotly_chart(fig_sales, use_container_width=True)

        with col2:
            fig_efficiency = go.Figure()
            fig_efficiency.add_trace(go.Scatter(
                x=df_daily['date'],
                y=df_daily['clicks'] / df_daily['impressions'].replace(0, 1) * 100,
                mode='lines+markers',
                name='CTR %',
                line=dict(color='#007bff')
            ))
            fig_efficiency.update_layout(
                title="Click-Through Rate Trend",
                xaxis_title="Date",
                yaxis_title="CTR %",
                height=300
            )
            st.plotly_chart(fig_efficiency, use_container_width=True)

    else:
        st.info("No performance data available for the selected period.")

    # Summary metrics
    st.subheader("📋 Period Summary")

    summary = con.execute(f"""
        SELECT
            SUM(impressions) as total_impressions,
            SUM(clicks) as total_clicks,
            SUM(spend) as total_spend,
            SUM(sales) as total_sales,
            SUM(orders) as total_orders,
            CASE WHEN SUM(sales) > 0
                 THEN (SUM(spend) / SUM(sales)) * 100
                 ELSE 0
            END as avg_acos,
            CASE WHEN SUM(impressions) > 0
                 THEN (SUM(clicks)::FLOAT / SUM(impressions)) * 100
                 ELSE 0
            END as avg_ctr
        FROM fact_keyword_entry_daily
        WHERE dt >= CURRENT_DATE - {days}
    """).fetchone()

    if summary:
        col1, col2, col3, col4, col5 = st.columns(5)
        with col1:
            st.metric("Total Impressions", f"{int(summary[0] or 0):,}")
        with col2:
            st.metric("Total Clicks", f"{int(summary[1] or 0):,}")
        with col3:
            st.metric("Total Spend", f"${float(summary[2] or 0):,.2f}")
        with col4:
            st.metric("Total Sales", f"${float(summary[3] or 0):,.2f}")
        with col5:
            st.metric("Avg ACOS", f"{float(summary[5] or 0):.1f}%")

    con.close()

except Exception as e:
    st.error(f"Error loading data: {e}")
    st.info("Make sure the database has data loaded via ETL.")
