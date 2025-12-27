#!/bin/bash
# Daily Incremental Index Script for Amazon Knowledge Base
# 每天自动执行增量索引

# 设置环境变量
export NO_PROXY=localhost,127.0.0.1
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

# 项目目录
PROJECT_DIR="/Users/liye/Documents/liye_workspace/LiYe_OS/Skills/02_Operation_Intelligence/amazon-operations-crew"
cd "$PROJECT_DIR" || exit 1

# 日志文件
LOG_DIR="$PROJECT_DIR/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/daily_index_$(date +%Y%m%d).log"

# 记录开始时间
echo "================================================" >> "$LOG_FILE"
echo "Incremental Index Started: $(date)" >> "$LOG_FILE"
echo "================================================" >> "$LOG_FILE"

# 激活虚拟环境并运行增量索引
source venv/bin/activate
python scripts/incremental_index.py >> "$LOG_FILE" 2>&1
EXIT_CODE=$?

# 记录结束时间和状态
echo "================================================" >> "$LOG_FILE"
echo "Incremental Index Finished: $(date)" >> "$LOG_FILE"
echo "Exit Code: $EXIT_CODE" >> "$LOG_FILE"
echo "================================================" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

# 清理30天前的日志
find "$LOG_DIR" -name "daily_index_*.log" -mtime +30 -delete

exit $EXIT_CODE
