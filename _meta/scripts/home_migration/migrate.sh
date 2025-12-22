#!/usr/bin/env bash
# LiYe Home Directory Migration - Master Script
# 主控迁移脚本：按 Phase 执行本机文件系统重组

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
MIGRATION_LOG="$REPO_ROOT/_meta/logs/migration_$(date +%Y%m%d_%H%M%S).log"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
  echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1" | tee -a "$MIGRATION_LOG"
}

warn() {
  echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$MIGRATION_LOG"
}

error() {
  echo -e "${RED}[ERROR]${NC} $1" | tee -a "$MIGRATION_LOG"
}

info() {
  echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$MIGRATION_LOG"
}

# 显示使用说明
show_usage() {
  cat <<EOF
LiYe Home Migration Tool

Usage:
  ./migrate.sh [phase|all|verify|rollback]

Phases:
  phase0    - Preparation & Backup
  phase1    - Migrate Git Repositories
  phase2    - Migrate Tool Scripts
  phase3    - Migrate Large Files to ~/data
  phase4    - Migrate Obsidian Vaults
  phase5    - Cleanup Documents
  phase6    - Verification & Report
  all       - Execute all phases sequentially

Commands:
  verify    - Run verification checks only
  rollback  - Rollback to backup (CAUTION!)
  help      - Show this message

Examples:
  ./migrate.sh phase0        # Just backup
  ./migrate.sh phase1        # Migrate repos only
  ./migrate.sh all           # Full migration (Phase 0-6)
  ./migrate.sh verify        # Check current state

EOF
}

# Phase 0: 准备和备份
phase0_prepare() {
  log "=== Phase 0: Preparation & Backup ==="

  # 创建备份目录
  BACKUP_DIR=~/Backups/home_migration_$(date +%Y%m%d_%H%M%S)
  mkdir -p "$BACKUP_DIR"
  log "Creating backup at: $BACKUP_DIR"

  # 备份关键目录
  info "Backing up ~/Documents..."
  rsync -av ~/Documents/ "$BACKUP_DIR/Documents/" --exclude=".Trash" --exclude="Library" >/dev/null 2>&1 || true

  info "Backing up ~/websites..."
  rsync -av ~/websites/ "$BACKUP_DIR/websites/" >/dev/null 2>&1 || true

  info "Backing up ~/tools..."
  rsync -av ~/tools/ "$BACKUP_DIR/tools/" >/dev/null 2>&1 || true

  info "Backing up home scripts..."
  cp ~/converter.py ~/run_converter.sh "$BACKUP_DIR/" 2>/dev/null || true

  # 创建日志目录
  mkdir -p "$REPO_ROOT/_meta/logs"

  # 检查磁盘空间
  AVAILABLE_KB=$(df ~ | tail -1 | awk '{print $4}')
  AVAILABLE_GB=$((AVAILABLE_KB / 1024 / 1024))
  info "Available disk space: ${AVAILABLE_GB}GB"

  if [ "$AVAILABLE_KB" -lt 10485760 ]; then
    warn "Less than 10GB free space! Consider cleanup first."
  fi

  # 保存备份路径
  echo "$BACKUP_DIR" > "$REPO_ROOT/_meta/logs/last_backup.txt"

  log "✅ Phase 0 complete. Backup: $BACKUP_DIR"
}

# Phase 1: 迁移 Git Repos
phase1_repos() {
  log "=== Phase 1: Migrate Git Repositories ==="

  # 确保目标目录存在
  mkdir -p ~/github/sites

  # 1. loudmirrror
  if [ -d ~/Documents/GitHub/loudmirrror/.git ]; then
    info "Moving loudmirrror..."
    mv ~/Documents/GitHub/loudmirrror ~/github/loudmirrror
    ln -s ~/github/loudmirrror ~/Documents/GitHub/loudmirrror
    log "  ✅ loudmirrror moved + linked"
  else
    info "  ⏭️  loudmirrror not found or already moved"
  fi

  # 2. learninggithub.com
  if [ -d ~/websites/learninggithub.com/.git ]; then
    info "Moving learninggithub.com..."
    mv ~/websites/learninggithub.com ~/github/sites/learninggithub.com
    ln -s ~/github/sites/learninggithub.com ~/websites/learninggithub.com
    log "  ✅ learninggithub.com moved + linked"
  else
    info "  ⏭️  learninggithub.com not found or already moved"
  fi

  # 3. nuanyan.com
  if [ -d ~/websites/nuanyan.com/.git ]; then
    info "Moving nuanyan.com..."
    mv ~/websites/nuanyan.com ~/github/sites/nuanyan.com
    ln -s ~/github/sites/nuanyan.com ~/websites/nuanyan.com
    log "  ✅ nuanyan.com moved + linked"
  else
    info "  ⏭️  nuanyan.com not found or already moved"
  fi

  # 4. ceshibao.com (初始化 git)
  if [ -d ~/websites/ceshibao.com ] && [ -f ~/websites/ceshibao.com/package.json ]; then
    if [ ! -d ~/websites/ceshibao.com/.git ]; then
      info "Initializing git for ceshibao.com..."
      (cd ~/websites/ceshibao.com && git init && git add . && git commit -m "Initial commit" 2>/dev/null || true)
    fi

    info "Moving ceshibao.com..."
    mv ~/websites/ceshibao.com ~/github/sites/ceshibao.com
    ln -s ~/github/sites/ceshibao.com ~/websites/ceshibao.com
    log "  ✅ ceshibao.com moved + linked"
  else
    info "  ⏭️  ceshibao.com not found or already moved"
  fi

  log "✅ Phase 1 complete"
}

# Phase 2: 迁移工具脚本
phase2_tools() {
  log "=== Phase 2: Migrate Tool Scripts ==="

  # 创建工具目录
  mkdir -p ~/github/tools/converters
  mkdir -p ~/github/tools/notion_utils

  # 1. converter.py
  if [ -f ~/converter.py ]; then
    info "Moving converter.py..."
    mv ~/converter.py ~/github/tools/converters/converter.py
    ln -s ~/github/tools/converters/converter.py ~/converter.py
    log "  ✅ converter.py moved + linked"
  else
    info "  ⏭️  converter.py not found or already moved"
  fi

  # 2. run_converter.sh
  if [ -f ~/run_converter.sh ]; then
    info "Moving run_converter.sh..."
    mv ~/run_converter.sh ~/github/tools/converters/run_converter.sh
    chmod +x ~/github/tools/converters/run_converter.sh
    ln -s ~/github/tools/converters/run_converter.sh ~/run_converter.sh
    log "  ✅ run_converter.sh moved + linked"
  else
    info "  ⏭️  run_converter.sh not found or already moved"
  fi

  # 3. generate-para-indexes.js
  if [ -f ~/Documents/generate-para-indexes.js ]; then
    info "Moving generate-para-indexes.js..."
    mv ~/Documents/generate-para-indexes.js ~/github/tools/notion_utils/generate-para-indexes.js
    ln -s ~/github/tools/notion_utils/generate-para-indexes.js ~/Documents/generate-para-indexes.js
    log "  ✅ generate-para-indexes.js moved + linked"
  else
    info "  ⏭️  generate-para-indexes.js not found or already moved"
  fi

  # 4. 初始化 git（如果需要）
  for dir in ~/github/tools/converters ~/github/tools/notion_utils; do
    if [ -d "$dir" ] && [ ! -d "$dir/.git" ]; then
      info "Initializing git for $(basename $dir)..."
      (cd "$dir" && git init && git add . && git commit -m "feat: migrate tools" 2>/dev/null || true)
    fi
  done

  # 5. 软链接 notion-sync
  if [ -d ~/tools/notion-sync ] && [ ! -L ~/tools/notion-sync ]; then
    info "Linking notion-sync to repo..."
    rm -rf ~/tools/notion-sync.bak 2>/dev/null || true
    mv ~/tools/notion-sync ~/tools/notion-sync.bak
    ln -s ~/github/liye_os/tools/notion-sync ~/tools/notion-sync
    log "  ✅ notion-sync linked to repo (backup: ~/tools/notion-sync.bak)"
  fi

  log "✅ Phase 2 complete"
}

# Phase 3: 迁移大文件到 ~/data
phase3_data() {
  log "=== Phase 3: Migrate Large Files to ~/data ==="

  # 创建 data 目录结构
  mkdir -p ~/data/archives/{shengcai,cancer,interviews,professional_growth,hangye_reports}
  mkdir -p ~/data/amazon_data/{reports,uploads,databases}
  mkdir -p ~/data/media/{pdfs,videos,images}
  mkdir -p ~/data/backups
  mkdir -p ~/data/temp

  # 1. 生财有术
  if [ -d ~/Documents/生财有术 ] && [ ! -L ~/Documents/生财有术 ]; then
    info "Moving 生财有术..."
    mv ~/Documents/生财有术 ~/data/archives/shengcai
    ln -s ~/data/archives/shengcai ~/Documents/生财有术
    SIZE=$(du -sh ~/data/archives/shengcai | awk '{print $1}')
    log "  ✅ 生财有术 moved + linked ($SIZE)"
  else
    info "  ⏭️  生财有术 not found or already moved"
  fi

  # 2. 癌症领域
  if [ -d ~/Documents/癌症领域 ] && [ ! -L ~/Documents/癌症领域 ]; then
    info "Moving 癌症领域..."
    mv ~/Documents/癌症领域 ~/data/archives/cancer
    ln -s ~/data/archives/cancer ~/Documents/癌症领域
    log "  ✅ 癌症领域 moved + linked"
  else
    info "  ⏭️  癌症领域 not found or already moved"
  fi

  # 3. 面试相关资料
  if [ -d ~/Documents/面试相关资料 ] && [ ! -L ~/Documents/面试相关资料 ]; then
    info "Moving 面试相关资料..."
    mv ~/Documents/面试相关资料 ~/data/archives/interviews
    ln -s ~/data/archives/interviews ~/Documents/面试相关资料
    log "  ✅ 面试相关资料 moved + linked"
  else
    info "  ⏭️  面试相关资料 not found or already moved"
  fi

  # 4. 职场成长服务相关行业研报
  if [ -d ~/Documents/职场成长服务相关行业研报 ] && [ ! -L ~/Documents/职场成长服务相关行业研报 ]; then
    info "Moving 职场成长服务相关行业研报..."
    mv ~/Documents/职场成长服务相关行业研报 ~/data/archives/professional_growth
    ln -s ~/data/archives/professional_growth ~/Documents/职场成长服务相关行业研报
    log "  ✅ 职场成长服务相关行业研报 moved + linked"
  else
    info "  ⏭️  职场成长服务相关行业研报 not found or already moved"
  fi

  # 5. hangye.com.cn行业研报
  if [ -d ~/Documents/hangye.com.cn行业研报 ] && [ ! -L ~/Documents/hangye.com.cn行业研报 ]; then
    info "Moving hangye.com.cn行业研报..."
    mv ~/Documents/hangye.com.cn行业研报 ~/data/archives/hangye_reports
    ln -s ~/data/archives/hangye_reports ~/Documents/hangye.com.cn行业研报
    log "  ✅ hangye.com.cn行业研报 moved + linked"
  else
    info "  ⏭️  hangye.com.cn行业研报 not found or already moved"
  fi

  # 设置权限
  chmod 700 ~/data
  chmod 700 ~/data/archives
  chmod 700 ~/data/amazon_data

  TOTAL_SIZE=$(du -sh ~/data | awk '{print $1}')
  log "✅ Phase 3 complete. ~/data size: $TOTAL_SIZE"
}

# Phase 4: 迁移 Obsidian Vault
phase4_vaults() {
  log "=== Phase 4: Migrate Obsidian Vaults ==="

  mkdir -p ~/vaults/obsidian_main
  mkdir -p ~/vaults/.sync

  if [ -d ~/Documents/Obsidian\ Vault ] && [ ! -L ~/Documents/Obsidian\ Vault ]; then
    # 检查 Obsidian 是否在运行
    if pgrep -x "Obsidian" > /dev/null; then
      error "Obsidian is running! Please close it first."
      return 1
    fi

    info "Moving Obsidian Vault..."
    mv ~/Documents/Obsidian\ Vault ~/vaults/obsidian_main
    ln -s ~/vaults/obsidian_main ~/Documents/Obsidian\ Vault
    log "  ✅ Obsidian Vault moved + linked"

    # 备份 Obsidian 配置
    OBSIDIAN_CONFIG=~/Library/Application\ Support/obsidian/obsidian.json
    if [ -f "$OBSIDIAN_CONFIG" ]; then
      info "Backing up Obsidian config..."
      cp "$OBSIDIAN_CONFIG" "$OBSIDIAN_CONFIG.backup_$(date +%Y%m%d)"
    fi
  else
    info "  ⏭️  Obsidian Vault not found or already moved"
  fi

  chmod 700 ~/vaults
  log "✅ Phase 4 complete"
}

# Phase 5: 清理 Documents
phase5_cleanup() {
  log "=== Phase 5: Cleanup Documents ==="

  # 删除重复文件
  [ -f ~/Documents/CLAUDE.md ] && [ ! -L ~/Documents/CLAUDE.md ] && rm ~/Documents/CLAUDE.md && info "Removed CLAUDE.md"
  [ -f ~/Documents/测试语义搜索.html ] && rm ~/Documents/测试语义搜索.html && info "Removed test file"
  [ -f ~/Documents/cleanup_notion_files.sh ] && rm ~/Documents/cleanup_notion_files.sh && info "Removed old script"
  [ -f ~/Documents/MIGRATION_NOTES.md ] && rm ~/Documents/MIGRATION_NOTES.md && info "Removed old notes"

  # 清理空目录
  find ~/Documents -type d -empty -delete 2>/dev/null || true

  log "✅ Phase 5 complete"
}

# Phase 6: 验证
phase6_verify() {
  log "=== Phase 6: Verification ==="

  # 边界目录检查
  info "Boundary directories:"
  for dir in github data vaults; do
    if [ -d ~/$dir ]; then
      size=$(du -sh ~/$dir 2>/dev/null | awk '{print $1}')
      count=$(find ~/$dir -mindepth 1 -maxdepth 1 2>/dev/null | wc -l | xargs)
      log "  ✅ ~/$dir: $size, $count items"
    else
      warn "  ❌ ~/$dir: NOT FOUND"
    fi
  done

  # 检查软链接
  info "Checking symlinks..."
  BROKEN=0
  find ~ -maxdepth 3 -type l 2>/dev/null | while read link; do
    if [ ! -e "$link" ]; then
      warn "  ❌ Broken: $link"
      ((BROKEN++))
    fi
  done

  if [ "$BROKEN" -eq 0 ]; then
    log "  ✅ All symlinks valid"
  fi

  # Git repos 健康检查
  info "Git repositories:"
  for repo in $(find ~/github -name ".git" -type d -mindepth 2 -maxdepth 3 2>/dev/null | sed 's|/\.git$||'); do
    repo_name=$(basename "$repo")
    git_size=$(du -sh "$repo/.git" 2>/dev/null | awk '{print $1}')
    log "  $repo_name: .git=$git_size"
  done

  # 生成报告
  REPORT="$REPO_ROOT/_meta/logs/migration_report_$(date +%Y%m%d).md"
  cat > "$REPORT" <<EOF
# Home Migration Report

**Date:** $(date +%Y-%m-%d\ %H:%M:%S)

## Boundary Directories

- ~/github: $(du -sh ~/github 2>/dev/null | awk '{print $1}')
- ~/data: $(du -sh ~/data 2>/dev/null | awk '{print $1}')
- ~/vaults: $(du -sh ~/vaults 2>/dev/null | awk '{print $1}')

## Git Repositories

$(find ~/github -name ".git" -type d 2>/dev/null | sed 's|/\.git$||' | sed 's|/Users/liye/||' | sed 's|^|- |')

## Migration Log

See: $_meta/logs/migration_*.log

## Next Steps

- [ ] Test scripts with new paths
- [ ] Update Obsidian (if migrated)
- [ ] Monitor for 2 weeks
- [ ] Clean up old symlinks after 6 months
EOF

  log "✅ Phase 6 complete"
  log "📄 Report: $REPORT"
}

# 主函数
main() {
  case "${1:-help}" in
    phase0)
      phase0_prepare
      ;;
    phase1)
      phase1_repos
      ;;
    phase2)
      phase2_tools
      ;;
    phase3)
      phase3_data
      ;;
    phase4)
      phase4_vaults
      ;;
    phase5)
      phase5_cleanup
      ;;
    phase6)
      phase6_verify
      ;;
    all)
      log "🚀 Starting full migration (Phase 0-6)"
      phase0_prepare
      phase1_repos
      phase2_tools
      phase3_data
      phase4_vaults
      phase5_cleanup
      phase6_verify
      log "🎉 All phases complete!"
      ;;
    verify)
      phase6_verify
      ;;
    rollback)
      error "Rollback not yet implemented. Use backup at: $(cat $REPO_ROOT/_meta/logs/last_backup.txt 2>/dev/null || echo 'unknown')"
      ;;
    help|--help|-h)
      show_usage
      ;;
    *)
      error "Unknown command: $1"
      show_usage
      exit 1
      ;;
  esac
}

# 运行
main "$@"
