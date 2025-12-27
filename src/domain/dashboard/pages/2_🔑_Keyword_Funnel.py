"""
Keyword Funnel Page - Keyword Lifecycle Status
"""

import streamlit as st
import plotly.express as px
import plotly.graph_objects as go
import pandas as pd
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from src.data_lake.db_manager import get_db_connection

st.set_page_config(page_title="Keyword Funnel", page_icon="🔑", layout="wide")

st.title("🔑 Keyword Lifecycle Funnel")
st.markdown("**TEST → GROW → HARVEST → DEFEND → KILL**")

try:
    con = get_db_connection()

    # Keyword lifecycle classification based on organic rank
    st.subheader("📊 Keyword Lifecycle Distribution")

    df_lifecycle = con.execute("""
        WITH latest_snapshot AS (
            SELECT
                keyword,
                organic_rank,
                search_volume,
                ROW_NUMBER() OVER (PARTITION BY keyword ORDER BY snapshot_date DESC) as rn
            FROM fact_keyword_snapshot
            WHERE organic_rank IS NOT NULL
        )
        SELECT
            CASE
                WHEN organic_rank = 0 OR organic_rank IS NULL THEN 'KILL (Unranked)'
                WHEN organic_rank > 20 THEN 'TEST (Rank > 20)'
                WHEN organic_rank BETWEEN 8 AND 20 THEN 'GROW (Rank 8-20)'
                WHEN organic_rank BETWEEN 1 AND 7 THEN 'HARVEST (Rank 1-7)'
                ELSE 'DEFEND (Brand)'
            END as lifecycle_stage,
            COUNT(*) as keyword_count,
            AVG(search_volume) as avg_search_volume
        FROM latest_snapshot
        WHERE rn = 1
        GROUP BY
            CASE
                WHEN organic_rank = 0 OR organic_rank IS NULL THEN 'KILL (Unranked)'
                WHEN organic_rank > 20 THEN 'TEST (Rank > 20)'
                WHEN organic_rank BETWEEN 8 AND 20 THEN 'GROW (Rank 8-20)'
                WHEN organic_rank BETWEEN 1 AND 7 THEN 'HARVEST (Rank 1-7)'
                ELSE 'DEFEND (Brand)'
            END
        ORDER BY
            CASE lifecycle_stage
                WHEN 'TEST (Rank > 20)' THEN 1
                WHEN 'GROW (Rank 8-20)' THEN 2
                WHEN 'HARVEST (Rank 1-7)' THEN 3
                WHEN 'DEFEND (Brand)' THEN 4
                ELSE 5
            END
    """).df()

    if len(df_lifecycle) > 0:
        col1, col2 = st.columns(2)

        with col1:
            # Funnel chart
            fig_funnel = go.Figure(go.Funnel(
                y=df_lifecycle['lifecycle_stage'],
                x=df_lifecycle['keyword_count'],
                textinfo="value+percent initial",
                marker=dict(color=['#ffc107', '#17a2b8', '#28a745', '#007bff', '#dc3545'])
            ))
            fig_funnel.update_layout(title="Keyword Lifecycle Funnel", height=400)
            st.plotly_chart(fig_funnel, use_container_width=True)

        with col2:
            # Pie chart
            fig_pie = px.pie(
                df_lifecycle,
                values='keyword_count',
                names='lifecycle_stage',
                title="Lifecycle Distribution",
                color_discrete_sequence=px.colors.qualitative.Set2
            )
            fig_pie.update_layout(height=400)
            st.plotly_chart(fig_pie, use_container_width=True)

        # Metrics
        st.subheader("📈 Lifecycle Metrics")
        cols = st.columns(len(df_lifecycle))
        for i, row in df_lifecycle.iterrows():
            with cols[i]:
                st.metric(
                    row['lifecycle_stage'].split(' ')[0],
                    f"{int(row['keyword_count'])} keywords",
                    f"Avg SV: {int(row['avg_search_volume'] or 0):,}"
                )

    else:
        st.info("No keyword snapshot data available.")

    # Top keywords by stage
    st.subheader("🔝 Top Keywords by Stage")

    stage_filter = st.selectbox(
        "Select Lifecycle Stage",
        ["All", "TEST", "GROW", "HARVEST", "DEFEND", "KILL"]
    )

    rank_filter = {
        "All": "",
        "TEST": "AND organic_rank > 20",
        "GROW": "AND organic_rank BETWEEN 8 AND 20",
        "HARVEST": "AND organic_rank BETWEEN 1 AND 7",
        "DEFEND": "AND organic_rank <= 3",
        "KILL": "AND (organic_rank = 0 OR organic_rank IS NULL)"
    }

    df_keywords = con.execute(f"""
        SELECT
            keyword,
            organic_rank,
            search_volume,
            title_density,
            ppc_bid
        FROM fact_keyword_snapshot
        WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM fact_keyword_snapshot)
        {rank_filter.get(stage_filter, '')}
        ORDER BY search_volume DESC NULLS LAST
        LIMIT 20
    """).df()

    if len(df_keywords) > 0:
        st.dataframe(
            df_keywords,
            column_config={
                "keyword": "Keyword",
                "organic_rank": st.column_config.NumberColumn("Rank", format="%d"),
                "search_volume": st.column_config.NumberColumn("Search Volume", format="%d"),
                "title_density": st.column_config.NumberColumn("Title Density", format="%.1f"),
                "ppc_bid": st.column_config.NumberColumn("PPC Bid", format="$%.2f")
            },
            hide_index=True,
            use_container_width=True
        )
    else:
        st.info("No keywords found for the selected stage.")

    con.close()

except Exception as e:
    st.error(f"Error loading data: {e}")
