#!/bin/bash
# ==============================================
# Amazon Growth OS - 一键启动脚本
# 用法: ./docker-start.sh
# ==============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_step() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# 切换到脚本所在目录
cd "$(dirname "$0")"

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║     🚀 Amazon Growth OS 启动器             ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# 检查 Docker 是否安装
print_step "检查 Docker..."
if ! command -v docker &> /dev/null; then
    print_error "Docker 未安装！"
    echo ""
    echo "请先安装 Docker Desktop："
    echo "  Mac/Windows: https://www.docker.com/products/docker-desktop/"
    echo ""
    exit 1
fi
print_success "Docker 已安装"

# 检查 Docker 是否运行
print_step "检查 Docker 状态..."
if ! docker info &> /dev/null; then
    print_error "Docker 未运行！"
    echo ""
    echo "请启动 Docker Desktop 应用程序，等待鲸鱼图标出现后再试。"
    echo ""
    exit 1
fi
print_success "Docker 正在运行"

# 检查 .env 文件
print_step "检查配置文件..."
if [ ! -f ".env" ]; then
    print_warning ".env 文件不存在"

    if [ -f ".env.example" ]; then
        echo ""
        echo "是否要从模板创建 .env 文件？(y/n)"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            cp .env.example .env
            print_success "已创建 .env 文件"
            echo ""
            print_warning "请编辑 .env 文件，填入你的 API 密钥："
            echo "  nano .env"
            echo "  或用任何文本编辑器打开"
            echo ""
            echo "至少需要填写 ANTHROPIC_API_KEY"
            exit 0
        fi
    fi

    print_error "缺少 .env 配置文件"
    exit 1
fi
print_success "配置文件存在"

# 检查 API 密钥
print_step "检查 API 密钥..."
source .env 2>/dev/null || true
if [ -z "$ANTHROPIC_API_KEY" ] || [ "$ANTHROPIC_API_KEY" = "sk-ant-xxx" ]; then
    print_error "ANTHROPIC_API_KEY 未设置或无效"
    echo ""
    echo "请编辑 .env 文件，填入有效的 Anthropic API 密钥"
    exit 1
fi
print_success "API 密钥已配置"

# 启动服务
echo ""
print_step "启动 Docker 容器..."
echo ""

docker-compose up -d

echo ""
print_success "服务启动成功！"
echo ""

# 等待服务就绪
print_step "等待服务就绪..."
sleep 3

# 检查服务状态
echo ""
echo "服务状态："
docker-compose ps

# 打印访问信息
echo ""
echo "╔════════════════════════════════════════════╗"
echo "║     🎉 启动完成！                          ║"
echo "╠════════════════════════════════════════════╣"
echo "║                                            ║"
echo "║  📊 Dashboard: http://localhost:8501       ║"
echo "║  🗄️  Qdrant:    http://localhost:6333       ║"
echo "║                                            ║"
echo "╠════════════════════════════════════════════╣"
echo "║  常用命令：                                ║"
echo "║  - 查看日志: docker-compose logs -f        ║"
echo "║  - 停止服务: docker-compose down           ║"
echo "║  - 重启服务: docker-compose restart        ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# 询问是否打开浏览器
echo "是否打开浏览器访问 Dashboard？(y/n)"
read -r response
if [[ "$response" =~ ^[Yy]$ ]]; then
    if command -v open &> /dev/null; then
        open http://localhost:8501
    elif command -v xdg-open &> /dev/null; then
        xdg-open http://localhost:8501
    else
        echo "请手动打开浏览器访问: http://localhost:8501"
    fi
fi
