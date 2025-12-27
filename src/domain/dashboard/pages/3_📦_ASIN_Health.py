"""
ASIN Health Page - Product Performance Matrix
"""

import streamlit as st
import plotly.express as px
import plotly.graph_objects as go
import pandas as pd
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from src.data_lake.db_manager import get_db_connection

st.set_page_config(page_title="ASIN Health", page_icon="📦", layout="wide")

st.title("📦 ASIN Health Matrix")
st.markdown("**Product Performance Overview**")

try:
    con = get_db_connection()

    # ASIN performance summary
    st.subheader("📊 ASIN Performance (Last 7 Days)")

    df_asin = con.execute("""
        SELECT
            asin,
            SUM(sessions) as total_sessions,
            SUM(page_views) as total_page_views,
            SUM(units_ordered) as total_units,
            SUM(sales) as total_sales,
            AVG(buy_box_percentage) as avg_buy_box,
            AVG(unit_session_percentage) as avg_cvr
        FROM fact_asin_daily
        WHERE dt >= CURRENT_DATE - 7
        GROUP BY asin
        ORDER BY total_sales DESC NULLS LAST
    """).df()

    if len(df_asin) > 0:
        # Health score calculation
        df_asin['health_score'] = (
            (df_asin['avg_cvr'].fillna(0) / 20 * 30) +  # CVR component (max 30)
            (df_asin['avg_buy_box'].fillna(0) / 100 * 30) +  # Buy Box component (max 30)
            (df_asin['total_units'].fillna(0) / df_asin['total_units'].max() * 40 if df_asin['total_units'].max() > 0 else 0)  # Sales velocity (max 40)
        ).round(1)

        # Heatmap
        col1, col2 = st.columns([2, 1])

        with col1:
            fig_heatmap = go.Figure(data=go.Heatmap(
                z=[df_asin['health_score']],
                x=df_asin['asin'],
                y=['Health Score'],
                colorscale='RdYlGn',
                text=[[f"{s:.0f}" for s in df_asin['health_score']]],
                texttemplate="%{text}",
                textfont={"size": 12}
            ))
            fig_heatmap.update_layout(
                title="ASIN Health Score (0-100)",
                height=150,
                margin=dict(l=20, r=20, t=40, b=20)
            )
            st.plotly_chart(fig_heatmap, use_container_width=True)

        with col2:
            avg_health = df_asin['health_score'].mean()
            health_status = "Healthy" if avg_health >= 60 else "Needs Attention" if avg_health >= 40 else "Critical"
            color = "green" if avg_health >= 60 else "orange" if avg_health >= 40 else "red"
            st.metric(
                "Average Health Score",
                f"{avg_health:.1f}/100",
                health_status
            )

        # ASIN table
        st.subheader("📋 ASIN Details")

        st.dataframe(
            df_asin,
            column_config={
                "asin": "ASIN",
                "total_sessions": st.column_config.NumberColumn("Sessions", format="%d"),
                "total_page_views": st.column_config.NumberColumn("Page Views", format="%d"),
                "total_units": st.column_config.NumberColumn("Units Sold", format="%d"),
                "total_sales": st.column_config.NumberColumn("Sales", format="$%.2f"),
                "avg_buy_box": st.column_config.NumberColumn("Buy Box %", format="%.1f%%"),
                "avg_cvr": st.column_config.NumberColumn("CVR %", format="%.2f%%"),
                "health_score": st.column_config.ProgressColumn(
                    "Health Score",
                    min_value=0,
                    max_value=100,
                    format="%.0f"
                )
            },
            hide_index=True,
            use_container_width=True
        )

        # Scatter plot: Sessions vs CVR
        st.subheader("📈 Sessions vs Conversion Rate")
        fig_scatter = px.scatter(
            df_asin,
            x='total_sessions',
            y='avg_cvr',
            size='total_sales',
            color='health_score',
            hover_name='asin',
            color_continuous_scale='RdYlGn',
            title="ASIN Performance Quadrant"
        )
        fig_scatter.update_layout(height=400)
        st.plotly_chart(fig_scatter, use_container_width=True)

    else:
        st.info("No ASIN data available. Load Business Reports via ETL.")

    con.close()

except Exception as e:
    st.error(f"Error loading data: {e}")
