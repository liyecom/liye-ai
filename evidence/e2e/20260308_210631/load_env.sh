#!/usr/bin/env bash
# E2E 凭证加载脚本 — source 使用，不要 sh 执行
# 用法: source evidence/e2e/20260308_210631/load_env.sh
#
# 安全: 不写入磁盘、不打印原文、仅当前 shell 会话有效

set -euo pipefail

E2E_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export E2E_DIR
echo "📁 E2E_DIR=$E2E_DIR"

# ──────────────────────────────────────────────
# 1) Amazon Ads 凭证 (从 AGE .env.local 映射)
# ──────────────────────────────────────────────
AGE_ENV="${AGE_DIR:-$HOME/github/age-engine}/.env.local"
if [ ! -f "$AGE_ENV" ]; then
  echo "❌ 找不到 $AGE_ENV"; return 1
fi

# 读取 ADS_* 并映射为 AMAZON_ADS_*
while IFS='=' read -r key value; do
  case "$key" in
    ADS_CLIENT_ID)     export AMAZON_ADS_CLIENT_ID="$value" ;;
    ADS_CLIENT_SECRET) export AMAZON_ADS_CLIENT_SECRET="$value" ;;
    ADS_REFRESH_TOKEN) export AMAZON_ADS_REFRESH_TOKEN="$value" ;;
    ADS_PROFILE_ID)    export AMAZON_ADS_PROFILE_ID="$value" ;;
  esac
done < <(grep -E '^ADS_' "$AGE_ENV")

export AMAZON_ADS_REGION="${AMAZON_ADS_REGION:-NA}"

echo "✅ Amazon Ads 凭证已加载 (ADS_* → AMAZON_ADS_*)"
env | grep '^AMAZON_ADS_' | sed 's/=.*/=██████/' | sort

# ──────────────────────────────────────────────
# 2) LIYE_HMAC_SECRET (自动生成 32 字符)
# ──────────────────────────────────────────────
if [ -z "${LIYE_HMAC_SECRET:-}" ]; then
  export LIYE_HMAC_SECRET="$(openssl rand -hex 16)"
  echo "✅ LIYE_HMAC_SECRET 已自动生成 (32 chars)"
else
  echo "✅ LIYE_HMAC_SECRET 已存在 (保留)"
fi
echo "   LIYE_HMAC_SECRET=██████"

# ──────────────────────────────────────────────
# 3) Slack 凭证 (需要手动提供)
# ──────────────────────────────────────────────
if [ -z "${SLACK_BOT_TOKEN:-}" ]; then
  echo ""
  echo "⚠️  Slack 凭证未配置。需要手动设置："
  echo "   export SLACK_BOT_TOKEN=\"xoxb-...\""
  echo "   export SLACK_APP_TOKEN=\"xapp-...\""
  echo ""
  echo "   获取位置: https://api.slack.com/apps → 你的 App → OAuth & Permissions / Basic Info"
fi

if [ -n "${SLACK_BOT_TOKEN:-}" ] && [ -n "${SLACK_APP_TOKEN:-}" ]; then
  echo "✅ Slack 凭证已配置"
  echo "   SLACK_BOT_TOKEN=██████"
  echo "   SLACK_APP_TOKEN=██████"
fi

# ──────────────────────────────────────────────
# 4) 总结
# ──────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "凭证加载完成。缺失项:"
MISSING=0
[ -z "${AMAZON_ADS_CLIENT_ID:-}" ]  && echo "  ❌ AMAZON_ADS_CLIENT_ID" && MISSING=1
[ -z "${AMAZON_ADS_CLIENT_SECRET:-}" ] && echo "  ❌ AMAZON_ADS_CLIENT_SECRET" && MISSING=1
[ -z "${AMAZON_ADS_REFRESH_TOKEN:-}" ] && echo "  ❌ AMAZON_ADS_REFRESH_TOKEN" && MISSING=1
[ -z "${AMAZON_ADS_PROFILE_ID:-}" ] && echo "  ❌ AMAZON_ADS_PROFILE_ID" && MISSING=1
[ -z "${LIYE_HMAC_SECRET:-}" ]      && echo "  ❌ LIYE_HMAC_SECRET" && MISSING=1
[ -z "${SLACK_BOT_TOKEN:-}" ]       && echo "  ❌ SLACK_BOT_TOKEN" && MISSING=1
[ -z "${SLACK_APP_TOKEN:-}" ]       && echo "  ❌ SLACK_APP_TOKEN" && MISSING=1

if [ "$MISSING" -eq 0 ]; then
  echo "  ✅ 全部就绪！可以启动 E2E 验收"
else
  echo ""
  echo "  补齐后重新 source 此脚本即可"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
