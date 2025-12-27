#!/bin/bash
# 激活 web-publisher 虚拟环境

source "$(dirname "$0")/.venv/bin/activate"

echo "✅ 虚拟环境已激活"
echo ""
echo "可用命令："
echo "  python enhance.py --test              # 测试 AI 增强（10 个 units）"
echo "  python enhance.py --input ... --output ...  # 全量处理"
echo ""

# 检查 API key
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "⚠️  警告：ANTHROPIC_API_KEY 未设置"
    echo "   请运行：export ANTHROPIC_API_KEY='your-api-key'"
fi
