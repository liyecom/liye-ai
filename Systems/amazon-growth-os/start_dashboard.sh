#!/bin/bash
# Start Amazon Growth OS Dashboard

cd "$(dirname "$0")"

# Activate virtual environment
source venv/bin/activate

# Start Streamlit
echo "🚀 Starting Amazon Growth OS Dashboard..."
echo "   URL: http://localhost:8501"
echo ""

streamlit run dashboard/app.py --server.port 8501
