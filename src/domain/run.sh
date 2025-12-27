#!/bin/bash

# 获取当前脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 检查 .env 文件
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found!"
    echo "Please copy .env.example to .env and set your ANTHROPIC_API_KEY."
    exit 1
fi

# 检查虚拟环境
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3.13 -m venv venv || python3 -m venv venv
    
    echo "📥 Installing dependencies..."
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# 运行主程序，并传递所有命令行参数
echo "🚀 Launching Amazon Operations Crew..."
python main.py "$@"
