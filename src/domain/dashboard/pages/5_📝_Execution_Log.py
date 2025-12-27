"""
Execution Log Page - ETL Status and Agent Actions
"""

import streamlit as st
import pandas as pd
import json
import os
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from src.data_lake.db_manager import get_db_connection, get_database_size, get_table_stats

st.set_page_config(page_title="Execution Log", page_icon="📝", layout="wide")

st.title("📝 Execution Log")
st.markdown("**ETL Status, Agent Actions, and System Health**")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Tabs for different log types
tab1, tab2, tab3 = st.tabs(["📊 ETL Status", "🤖 Agent Log", "⚙️ System Health"])

with tab1:
    st.subheader("📊 ETL Pipeline Status")

    # Load ETL state
    state_file = os.path.join(BASE_DIR, "data", ".etl_state.json")
    if os.path.exists(state_file):
        with open(state_file, 'r') as f:
            etl_state = json.load(f)

        last_run = etl_state.get('last_run', 'Never')
        processed_files = etl_state.get('processed_files', {})

        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("Last ETL Run", last_run[:19] if last_run else "Never")
        with col2:
            st.metric("Files Tracked", len(processed_files))
        with col3:
            success_count = sum(1 for f in processed_files.values()
                               if f.get('status') == 'SUCCESS')
            st.metric("Success Rate", f"{success_count}/{len(processed_files)}")

        # File processing history
        st.subheader("📁 Processed Files")
        if processed_files:
            df_files = pd.DataFrame([
                {
                    'Filename': fname,
                    'Status': fdata.get('status', 'UNKNOWN'),
                    'Rows': fdata.get('rows_loaded', 0),
                    'Processed At': fdata.get('processed_at', '')[:19]
                }
                for fname, fdata in processed_files.items()
            ])
            df_files = df_files.sort_values('Processed At', ascending=False)

            st.dataframe(
                df_files,
                column_config={
                    "Filename": st.column_config.TextColumn("File"),
                    "Status": st.column_config.TextColumn("Status"),
                    "Rows": st.column_config.NumberColumn("Rows Loaded", format="%d"),
                    "Processed At": st.column_config.TextColumn("Processed")
                },
                hide_index=True,
                use_container_width=True
            )
        else:
            st.info("No files processed yet.")

        # ETL logs
        st.subheader("📋 Recent ETL Logs")
        log_dir = os.path.join(BASE_DIR, "logs")
        if os.path.exists(log_dir):
            log_files = sorted(
                [f for f in os.listdir(log_dir) if f.endswith('.log')],
                reverse=True
            )[:5]

            if log_files:
                selected_log = st.selectbox("Select Log File", log_files)
                log_path = os.path.join(log_dir, selected_log)

                with open(log_path, 'r') as f:
                    log_content = f.read()

                # Show last 50 lines
                lines = log_content.split('\n')[-50:]
                st.code('\n'.join(lines), language='log')
            else:
                st.info("No log files found.")
        else:
            st.info("Log directory not found.")

    else:
        st.info("ETL state file not found. Run the ETL pipeline first.")

with tab2:
    st.subheader("🤖 Agent Execution Log")

    # Agent experiences directory
    agent_exp_dir = os.path.join(
        os.path.dirname(BASE_DIR),
        "..",
        "..",
        "..",
        "..",
        "出海跨境",
        ".liye_evolution",
        "agent_experiences"
    )
    agent_exp_dir = os.path.normpath(agent_exp_dir)

    # Also check local evolution directory
    local_exp_dir = os.path.join(BASE_DIR, "evolution", "experiences")

    if os.path.exists(agent_exp_dir):
        agents = [d for d in os.listdir(agent_exp_dir)
                 if os.path.isdir(os.path.join(agent_exp_dir, d))]

        if agents:
            selected_agent = st.selectbox("Select Agent", sorted(agents))
            agent_dir = os.path.join(agent_exp_dir, selected_agent)

            exp_files = sorted([f for f in os.listdir(agent_dir)
                               if f.endswith('.json')], reverse=True)[:10]

            if exp_files:
                st.markdown(f"**Recent experiences for {selected_agent}:**")
                for exp_file in exp_files:
                    with st.expander(exp_file):
                        exp_path = os.path.join(agent_dir, exp_file)
                        with open(exp_path, 'r') as f:
                            exp_data = json.load(f)
                        st.json(exp_data)
            else:
                st.info(f"No experience logs for {selected_agent} yet.")
        else:
            st.info("No agents have logged experiences yet.")
    else:
        st.info("Agent experience directory not found.")

        # Show placeholder for future implementation
        st.markdown("""
        **Agent Experience Logging (Planned)**

        After each task execution, agents will log:
        - Task type and inputs
        - Decision reasoning
        - Knowledge sources used
        - Output and results
        - User feedback (1-5 rating)
        - 7-day outcome metrics
        """)

with tab3:
    st.subheader("⚙️ System Health")

    # Database info
    db_info = get_database_size()
    col1, col2, col3 = st.columns(3)

    with col1:
        st.metric("Database Size", f"{db_info.get('size_mb', 0)} MB")
    with col2:
        st.metric("Database Status", "Online" if db_info.get('exists') else "Offline")
    with col3:
        st.metric("Path", db_info.get('path', 'N/A')[-30:])

    # Table stats
    st.subheader("📊 Table Statistics")
    table_stats = get_table_stats()

    if table_stats:
        df_tables = pd.DataFrame([
            {
                'Table': table,
                'Rows': stats.get('row_count', 0) if isinstance(stats, dict) else 0,
                'Date Range': (
                    f"{stats.get('date_range', {}).get('min', 'N/A')[:10]} - "
                    f"{stats.get('date_range', {}).get('max', 'N/A')[:10]}"
                    if isinstance(stats, dict) and stats.get('date_range') else 'N/A'
                )
            }
            for table, stats in table_stats.items()
        ])
        df_tables = df_tables.sort_values('Rows', ascending=False)

        st.dataframe(
            df_tables,
            column_config={
                "Table": st.column_config.TextColumn("Table Name"),
                "Rows": st.column_config.NumberColumn("Row Count", format="%d"),
                "Date Range": st.column_config.TextColumn("Date Range")
            },
            hide_index=True,
            use_container_width=True
        )

    # System commands
    st.subheader("🛠️ Maintenance Commands")

    col1, col2, col3 = st.columns(3)

    with col1:
        if st.button("🔄 Run ETL"):
            st.info("Run: `python src/data_lake/etl_loader.py`")

    with col2:
        if st.button("🧹 Apply Retention"):
            st.info("Run: `python src/data_lake/db_manager.py retention`")

    with col3:
        if st.button("📊 Data Quality Check"):
            st.info("Run: `python tools/data_quality_check.py`")
