#!/bin/bash

# --- 配置区 ---
WORK_DIR="/Users/liye"
LOG_FILE="$WORK_DIR/.doc_converter.log"
PYTHON_EXEC="$WORK_DIR/.venv/bin/python"
SCRIPT_PATH="$WORK_DIR/converter.py"
TARGET_DIR="$WORK_DIR/Documents/"

# --- 执行逻辑 ---
{
    echo "========================================"
    echo "[INFO] 任务启动时间: $(date)"
    
    # 检查 Python 环境是否存在
    if [ ! -f "$PYTHON_EXEC" ]; then
        echo "[ERROR] 找不到 Python 环境: $PYTHON_EXEC"
        exit 1
    fi

    # 执行转换脚本
    echo "[INFO] 开始扫描目录: $TARGET_DIR"
    "$PYTHON_EXEC" "$SCRIPT_PATH" "$TARGET_DIR"
    
    echo "[INFO] 任务结束时间: $(date)"
    echo "========================================"
    echo "" 
} >> "$LOG_FILE" 2>&1
