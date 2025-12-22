"""
Amazon Growth OS Dashboard
Version: 1.0 MVP

Multi-page Streamlit dashboard for Timo Store operations monitoring.

Usage:
    cd amazon-operations-crew
    streamlit run dashboard/app.py
"""

import streamlit as st
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.data_lake.db_manager import get_db_connection, get_database_size, get_table_stats

# Page config
st.set_page_config(
    page_title="Amazon Growth OS",
    page_icon="🚀",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS
st.markdown("""
<style>
    .main-header {
        font-size: 2.5rem;
        font-weight: bold;
        color: #FF9900;
        margin-bottom: 1rem;
    }
    .metric-card {
        background-color: #f0f2f6;
        padding: 1rem;
        border-radius: 0.5rem;
        margin-bottom: 0.5rem;
    }
    .status-pass { color: #28a745; font-weight: bold; }
    .status-warning { color: #ffc107; font-weight: bold; }
    .status-error { color: #dc3545; font-weight: bold; }
</style>
""", unsafe_allow_html=True)

# Sidebar
st.sidebar.title("🚀 Amazon Growth OS")
st.sidebar.markdown("---")
st.sidebar.markdown("**Timo Store Dashboard**")
st.sidebar.markdown("v1.0 MVP")

# Database connection status
db_info = get_database_size()
if db_info.get('exists'):
    st.sidebar.success(f"📊 DB: {db_info['size_mb']} MB")
else:
    st.sidebar.error("📊 DB: Not found")

st.sidebar.markdown("---")
st.sidebar.markdown("### Navigation")
st.sidebar.markdown("""
- 📈 Executive Summary
- 🔑 Keyword Funnel
- 📦 ASIN Health
- 🔔 Alerts
- 📝 Execution Log
""")

# Main content
st.markdown('<p class="main-header">Amazon Growth OS Dashboard</p>', unsafe_allow_html=True)
st.markdown("**Timo Store Operations Center** | 3-Day Sprint Rhythm")

# Quick stats row
col1, col2, col3, col4 = st.columns(4)

try:
    con = get_db_connection()

    # Get quick stats
    with col1:
        result = con.execute("""
            SELECT COUNT(DISTINCT keyword) FROM fact_keyword_entry_daily
        """).fetchone()
        st.metric("Active Keywords", f"{result[0]:,}" if result[0] else "0")

    with col2:
        result = con.execute("""
            SELECT COALESCE(SUM(spend), 0) FROM fact_keyword_entry_daily
            WHERE dt >= CURRENT_DATE - 7
        """).fetchone()
        st.metric("7-Day Spend", f"${result[0]:,.2f}" if result[0] else "$0.00")

    with col3:
        result = con.execute("""
            SELECT COALESCE(SUM(sales), 0) FROM fact_keyword_entry_daily
            WHERE dt >= CURRENT_DATE - 7
        """).fetchone()
        st.metric("7-Day Sales", f"${result[0]:,.2f}" if result[0] else "$0.00")

    with col4:
        result = con.execute("""
            SELECT
                CASE WHEN SUM(sales) > 0
                     THEN (SUM(spend) / SUM(sales)) * 100
                     ELSE 0
                END as acos
            FROM fact_keyword_entry_daily
            WHERE dt >= CURRENT_DATE - 7
        """).fetchone()
        acos_val = result[0] if result[0] else 0
        st.metric("7-Day ACOS", f"{acos_val:.1f}%",
                  delta="-2.3%" if acos_val < 30 else "+1.5%",
                  delta_color="inverse")

    con.close()

except Exception as e:
    st.error(f"Database connection error: {e}")

st.markdown("---")

# Table overview
st.subheader("📊 Data Lake Overview")

table_stats = get_table_stats()
if table_stats:
    cols = st.columns(3)
    idx = 0
    for table, stats in table_stats.items():
        if isinstance(stats, dict) and 'row_count' in stats:
            with cols[idx % 3]:
                date_range = stats.get('date_range') or {}
                min_date = date_range.get('min') if date_range else None
                date_str = f"{min_date[:10] if min_date else 'N/A'}"
                st.metric(
                    table.replace('fact_', '').replace('_', ' ').title(),
                    f"{stats['row_count']:,} rows",
                    date_str
                )
            idx += 1

st.markdown("---")

# Sprint status
st.subheader("🎯 Current Sprint Status")

col1, col2 = st.columns(2)

with col1:
    st.markdown("""
    **Sprint Goals (60-Day Plan)**

    | Phase | Days | Goal | Target |
    |-------|------|------|--------|
    | 1-3 | 1-9 | 止血 | ACOS 34%→30% |
    | 4-6 | 10-18 | 黄金词发力 | ROI > 3:1 |
    | 7-10 | 19-30 | 扩张 | +10 盈利词 |
    | 11-14 | 31-42 | 精细化 | ACOS → 25% |
    | 15-17 | 43-51 | 自然排名 | 3词 Top 20 |
    | 18-20 | 52-60 | 冲刺 | ACOS ≤ 23% |
    """)

with col2:
    st.markdown("""
    **3-Day Sprint Rhythm**

    - **Day 1 (启动)**: 复盘 + 规划 + 执行任务1-2
    - **Day 2 (执行)**: 异常检测 + 执行任务3 + 监控
    - **Day 3 (复盘)**: 效果评估 + Sprint回顾 + 进化例程
    """)

# Footer
st.markdown("---")
st.markdown(
    "<center>Amazon Growth OS v2.1 | 9-Agent Architecture | "
    "Powered by CrewAI + DuckDB + Qdrant</center>",
    unsafe_allow_html=True
)
