#!/bin/bash
# Auto Index Management Script
# 管理 Amazon 知识库自动索引任务

set -e

PROJECT_DIR="/Users/liye/Documents/liye_workspace/LiYe_OS/Skills/02_Operation_Intelligence/amazon-operations-crew"
PLIST_FILE="$PROJECT_DIR/scripts/com.liye.amazon-kb-indexer.plist"
LAUNCHD_DIR="$HOME/Library/LaunchAgents"
INSTALLED_PLIST="$LAUNCHD_DIR/com.liye.amazon-kb-indexer.plist"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 显示使用说明
show_usage() {
    echo "Amazon Knowledge Base Auto-Indexer Manager"
    echo ""
    echo "Usage: $0 {install|uninstall|status|run-now|logs}"
    echo ""
    echo "Commands:"
    echo "  install     - 安装定时任务（每天凌晨2点自动索引）"
    echo "  uninstall   - 卸载定时任务"
    echo "  status      - 查看任务状态"
    echo "  run-now     - 立即执行一次增量索引"
    echo "  logs        - 查看最近的索引日志"
    echo ""
}

# 安装定时任务
install_task() {
    echo -e "${YELLOW}Installing Amazon KB Auto-Indexer...${NC}"

    # 创建 LaunchAgents 目录（如果不存在）
    mkdir -p "$LAUNCHD_DIR"

    # 创建日志目录
    mkdir -p "$PROJECT_DIR/logs"

    # 复制 plist 文件
    cp "$PLIST_FILE" "$INSTALLED_PLIST"

    # 加载任务
    launchctl load "$INSTALLED_PLIST"

    echo -e "${GREEN}✓ Auto-indexer installed successfully!${NC}"
    echo ""
    echo "The indexer will run daily at 2:00 AM"
    echo "You can run it manually anytime with: $0 run-now"
    echo ""
}

# 卸载定时任务
uninstall_task() {
    echo -e "${YELLOW}Uninstalling Amazon KB Auto-Indexer...${NC}"

    # 卸载任务
    if [ -f "$INSTALLED_PLIST" ]; then
        launchctl unload "$INSTALLED_PLIST" 2>/dev/null || true
        rm "$INSTALLED_PLIST"
        echo -e "${GREEN}✓ Auto-indexer uninstalled successfully!${NC}"
    else
        echo -e "${RED}Auto-indexer is not installed${NC}"
    fi
}

# 查看状态
show_status() {
    echo -e "${YELLOW}Checking Amazon KB Auto-Indexer status...${NC}"
    echo ""

    if [ -f "$INSTALLED_PLIST" ]; then
        echo -e "${GREEN}✓ Auto-indexer is INSTALLED${NC}"
        echo ""
        echo "Schedule: Daily at 2:00 AM"
        echo "Plist file: $INSTALLED_PLIST"
        echo ""

        # 检查是否加载
        if launchctl list | grep -q "com.liye.amazon-kb-indexer"; then
            echo -e "${GREEN}✓ Task is LOADED and ACTIVE${NC}"
        else
            echo -e "${RED}✗ Task is installed but NOT loaded${NC}"
            echo "Try running: launchctl load $INSTALLED_PLIST"
        fi

        # 显示状态文件信息
        STATE_FILE="$PROJECT_DIR/.index_state.json"
        if [ -f "$STATE_FILE" ]; then
            TRACKED_FILES=$(jq 'length' "$STATE_FILE" 2>/dev/null || echo "unknown")
            LAST_UPDATE=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$STATE_FILE" 2>/dev/null || echo "unknown")
            echo ""
            echo "Index State:"
            echo "  Tracked files: $TRACKED_FILES"
            echo "  Last update: $LAST_UPDATE"
        fi

        # 显示最近日志
        LATEST_LOG=$(ls -t "$PROJECT_DIR/logs/daily_index_"*.log 2>/dev/null | head -1)
        if [ -n "$LATEST_LOG" ]; then
            echo ""
            echo "Latest log: $LATEST_LOG"
            echo "Last run: $(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$LATEST_LOG" 2>/dev/null)"
        fi
    else
        echo -e "${RED}✗ Auto-indexer is NOT installed${NC}"
        echo ""
        echo "Run '$0 install' to install"
    fi
}

# 立即运行索引
run_now() {
    echo -e "${YELLOW}Running incremental index now...${NC}"
    echo ""

    cd "$PROJECT_DIR"
    ./scripts/daily_index.sh

    echo ""
    echo -e "${GREEN}✓ Indexing completed${NC}"
}

# 查看日志
show_logs() {
    LATEST_LOG=$(ls -t "$PROJECT_DIR/logs/daily_index_"*.log 2>/dev/null | head -1)

    if [ -n "$LATEST_LOG" ]; then
        echo -e "${YELLOW}Showing latest log: $LATEST_LOG${NC}"
        echo ""
        tail -n 50 "$LATEST_LOG"
    else
        echo -e "${RED}No logs found${NC}"
        echo "Logs will be created after the first run"
    fi
}

# 主逻辑
case "${1:-}" in
    install)
        install_task
        ;;
    uninstall)
        uninstall_task
        ;;
    status)
        show_status
        ;;
    run-now)
        run_now
        ;;
    logs)
        show_logs
        ;;
    *)
        show_usage
        exit 1
        ;;
esac
