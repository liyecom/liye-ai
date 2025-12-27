#!/usr/bin/env bash
# LiYe OS Home Migration Script
# Migrate scattered files to 4 boundary directories: ~/github, ~/data, ~/vaults, ~/tools

set -euo pipefail

# Repo root
REPO_ROOT="$HOME/github/liye_os"
MIGRATION_LOG="$REPO_ROOT/_meta/logs/migration_$(date +%Y%m%d_%H%M%S).log"
LOCK_FILE="$REPO_ROOT/_meta/logs/migration.lock"

# Global flags
DRY_RUN=false

# Parse arguments (支持任意位置)
COMMAND=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    phase0|phase1|phase2|phase3|verify|rollback|help)
      COMMAND="$1"
      shift
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

# Validate command
if [ -z "$COMMAND" ]; then
  echo "Usage: $0 <command> [--dry-run]"
  echo "Commands: phase0, phase1, phase2, phase3, verify, rollback, help"
  exit 1
fi

# Setup logging (chmod 600 for security)
mkdir -p "$REPO_ROOT/_meta/logs"
touch "$MIGRATION_LOG"
chmod 600 "$MIGRATION_LOG"

# Lock file mechanism
if [ -f "$LOCK_FILE" ]; then
  echo "❌ Migration already in progress (PID: $(cat "$LOCK_FILE" 2>/dev/null || echo 'unknown'))"
  echo "   If stale, remove: $LOCK_FILE"
  exit 1
fi

# Create lock
echo $$ > "$LOCK_FILE"

# Cleanup on exit
cleanup() {
  rm -f "$LOCK_FILE"
}
trap cleanup EXIT

# Logging functions
log() {
  local msg="[$(date +'%H:%M:%S')] $1"
  echo "$msg" | tee -a "$MIGRATION_LOG"
}

warn() {
  local msg="⚠️  [$(date +'%H:%M:%S')] $1"
  echo "$msg" | tee -a "$MIGRATION_LOG"
}

error() {
  local msg="❌ [$(date +'%H:%M:%S')] $1"
  echo "$msg" | tee -a "$MIGRATION_LOG"
}

info() {
  local msg="ℹ️  [$(date +'%H:%M:%S')] $1"
  echo "$msg" | tee -a "$MIGRATION_LOG"
}

# Execute wrapper (统一控制 dry-run vs 真执行)
# 使用 "$@" 而非 eval 以确保安全
execute() {
  if [ "$DRY_RUN" = true ]; then
    echo "[DRY RUN] $*"
  else
    log "Executing: $*"
    "$@"
  fi
}

# Repos to migrate (only confirmed 3 + loudmirrror)
REPOS_TO_MOVE=(
  "~/websites/learninggithub.com:~/github/sites/learninggithub.com"
  "~/websites/nuanyan.com:~/github/sites/nuanyan.com"
  "~/websites/ceshibao.com:~/github/sites/ceshibao.com"
  "~/Documents/GitHub/loudmirrror:~/github/loudmirrror"
)

###############################################################################
# Phase 0: Backup
###############################################################################
phase0_backup() {
  local timestamp=$(date +%Y%m%d_%H%M%S)
  local backup_dir="$HOME/Backups/home_migration_$timestamp"
  local manifest="$backup_dir/MANIFEST.txt"

  if [ "$DRY_RUN" = true ]; then
    echo ""
    echo "=== [DRY RUN] Phase 0: Backup ==="
    echo ""
    echo "Will backup to: $backup_dir"
    echo ""
    echo "Directories to backup:"
    echo "  1. ~/Documents (size: $(du -sh ~/Documents 2>/dev/null | awk '{print $1}' || echo 'unknown'))"
    echo "  2. ~/websites (size: $(du -sh ~/websites 2>/dev/null | awk '{print $1}' || echo 'unknown'))"
    echo "  3. ~/tools (size: $(du -sh ~/tools 2>/dev/null | awk '{print $1}' || echo 'unknown'))"
    echo "  4. ~/converter.py, ~/run_converter.sh (if exist)"
    echo ""
    echo "Backup strategy:"
    echo "  - Symlinks: preserved as symlinks (--links)"
    echo "  - Permissions: chmod 700 (owner only)"
    echo "  - Manifest: will write to $manifest"
    echo "    - du -sh for each directory"
    echo "    - rsync exit code for each operation"
    echo "    - Directory listing"
    echo ""
    echo "Backup location will be saved to:"
    echo "  $REPO_ROOT/_meta/logs/last_backup.txt"
    echo "  (absolute path, verified to exist)"
    echo ""
    echo "[DRY RUN] No changes will be made"
    return 0
  fi

  log "Starting Phase 0: Backup"

  # Create backup directory
  execute mkdir -p "$backup_dir"
  execute chmod 700 "$backup_dir"

  # Initialize manifest
  cat > "$manifest" <<EOF
# LiYe OS Home Migration Backup
# Created: $(date +'%Y-%m-%d %H:%M:%S')
# Backup Directory: $backup_dir

=== Backup Sources ===
EOF

  # Backup Documents
  if [ -d ~/Documents ]; then
    log "Backing up ~/Documents..."
    du -sh ~/Documents >> "$manifest"

    # rsync with --links (preserve symlinks as symlinks)
    # --ignore-errors: continue on errors (for problematic filenames)
    # --exclude: exclude directories that will be migrated in phase3
    # exit code 23 = partial transfer (some files couldn't be transferred)
    rsync -av --links --ignore-errors \
      --exclude='生财有术' \
      ~/Documents/ "$backup_dir/Documents/" >> "$MIGRATION_LOG" 2>&1
    rc=$?
    if [ $rc -eq 0 ]; then
      echo "✅ Documents: rsync exit code 0 (complete success)" >> "$manifest"
      echo "   Note: Excluded directories for phase3 migration: 生财有术" >> "$manifest"
    elif [ $rc -eq 23 ]; then
      echo "⚠️  Documents: rsync exit code 23 (partial transfer - some files skipped)" >> "$manifest"
      warn "Documents backup partially succeeded (exit code 23)"
      warn "Some files with special characters may have been skipped"
    else
      echo "❌ Documents: rsync exit code $rc (failed)" >> "$manifest"
      error "Documents backup failed with exit code $rc"
      return 1
    fi
  fi

  # Backup websites
  if [ -d ~/websites ]; then
    log "Backing up ~/websites..."
    du -sh ~/websites >> "$manifest"

    rsync -av --links --ignore-errors ~/websites/ "$backup_dir/websites/" >> "$MIGRATION_LOG" 2>&1
    rc=$?
    if [ $rc -eq 0 ]; then
      echo "✅ websites: rsync exit code 0 (complete success)" >> "$manifest"
    elif [ $rc -eq 23 ]; then
      echo "⚠️  websites: rsync exit code 23 (partial transfer - some files skipped)" >> "$manifest"
      warn "websites backup partially succeeded (exit code 23)"
    else
      echo "❌ websites: rsync exit code $rc (failed)" >> "$manifest"
      error "websites backup failed with exit code $rc"
      return 1
    fi
  fi

  # Backup tools
  if [ -d ~/tools ]; then
    log "Backing up ~/tools..."
    du -sh ~/tools >> "$manifest"

    rsync -av --links --ignore-errors ~/tools/ "$backup_dir/tools/" >> "$MIGRATION_LOG" 2>&1
    rc=$?
    if [ $rc -eq 0 ]; then
      echo "✅ tools: rsync exit code 0 (complete success)" >> "$manifest"
    elif [ $rc -eq 23 ]; then
      echo "⚠️  tools: rsync exit code 23 (partial transfer - some files skipped)" >> "$manifest"
      warn "tools backup partially succeeded (exit code 23)"
    else
      echo "❌ tools: rsync exit code $rc (failed)" >> "$manifest"
      error "tools backup failed with exit code $rc"
      return 1
    fi
  fi

  # Backup home scripts
  if [ -f ~/converter.py ]; then
    log "Backing up ~/converter.py..."
    execute cp ~/converter.py "$backup_dir/" || warn "converter.py copy failed"
  fi

  if [ -f ~/run_converter.sh ]; then
    log "Backing up ~/run_converter.sh..."
    execute cp ~/run_converter.sh "$backup_dir/" || warn "run_converter.sh copy failed"
  fi

  # Finalize manifest
  cat >> "$manifest" <<EOF

=== Backup Verification ===
Backup completed: $(date +'%Y-%m-%d %H:%M:%S')
Total backup size: $(du -sh "$backup_dir" | awk '{print $1}')

=== Symlink Strategy ===
--links: Symlinks are preserved as symlinks (not dereferenced)

=== Directory Listing ===
EOF

  ls -lah "$backup_dir" >> "$manifest"

  # Save backup location (absolute path)
  local last_backup_file="$REPO_ROOT/_meta/logs/last_backup.txt"
  echo "$backup_dir" > "$last_backup_file"

  # Verify backup location file exists and contains valid path
  if [ ! -f "$last_backup_file" ]; then
    error "Failed to create last_backup.txt"
    return 1
  fi

  local saved_backup=$(cat "$last_backup_file")
  if [ ! -d "$saved_backup" ]; then
    error "Backup location verification failed: $saved_backup does not exist"
    return 1
  fi

  log "✅ Phase 0 complete. Backup location: $backup_dir"
  log "   Manifest: $manifest"
  log "   Last backup reference: $last_backup_file"

  return 0
}

###############################################################################
# Phase 1: Migrate Git Repos
###############################################################################
phase1_repos() {
  if [ "$DRY_RUN" = true ]; then
    echo ""
    echo "=== [DRY RUN] Phase 1: Migrate Git Repositories ==="
    echo ""

    for entry in "${REPOS_TO_MOVE[@]}"; do
      IFS=':' read -r src dest <<< "$entry"
      src=$(eval echo "$src")  # Expand ~
      dest=$(eval echo "$dest")

      echo "Checking $src..."

      # Check if source exists
      if [ ! -e "$src" ]; then
        echo "  ⚠️  Source does not exist, skip"
        continue
      fi

      # Check if source is already a symlink
      if [ -L "$src" ]; then
        echo "  ⚠️  Source is already a symlink, skip"
        continue
      fi

      # Check if source is a git repo
      if ! git -C "$src" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        echo "  ❌ Not a git repo, skip"
        continue
      fi

      # Check if destination exists
      if [ -e "$dest" ]; then
        echo "  ❌ Destination already exists: $dest"
        echo "     SAFETY: Will exit to prevent overwrite"
        continue
      fi

      echo "  ✅ Is a git repo, will migrate → $dest"
      echo "     └─ Create symlink: $src → $dest"
    done

    echo ""
    echo "[DRY RUN] No changes will be made"
    return 0
  fi

  log "Starting Phase 1: Migrate Git Repositories"

  # Migrate each repo (check dest per-entry)
  for entry in "${REPOS_TO_MOVE[@]}"; do
    IFS=':' read -r src dest <<< "$entry"
    src=$(eval echo "$src")
    dest=$(eval echo "$dest")

    # Skip if source doesn't exist
    if [ ! -e "$src" ]; then
      warn "Source does not exist, skip: $src"
      continue
    fi

    # Skip if source is already a symlink
    if [ -L "$src" ]; then
      warn "Source is already a symlink, skip: $src"
      continue
    fi

    # Skip if not a git repo
    if ! git -C "$src" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      warn "Not a git repo, skip: $src"
      continue
    fi

    # NOW check destination (only for valid repos)
    if [ -e "$dest" ]; then
      error "Destination already exists: $dest"
      error "SAFETY: Aborting to prevent data loss"
      return 1
    fi

    log "Migrating: $src → $dest"

    # Create destination parent directory
    local dest_parent=$(dirname "$dest")
    execute mkdir -p "$dest_parent"

    # Try mv first
    if execute mv "$src" "$dest"; then
      log "✅ Moved successfully with mv"
    else
      warn "mv failed, trying rsync + verify..."

      # Fallback to rsync
      if ! rsync -av "$src/" "$dest/" >> "$MIGRATION_LOG" 2>&1; then
        error "rsync failed for $src"
        return 1
      fi

      # Verify size match (allow <100 bytes difference for filesystem metadata)
      local src_size=$(du -s "$src" | awk '{print $1}')
      local dest_size=$(du -s "$dest" | awk '{print $1}')
      local diff=$((src_size - dest_size))
      local abs_diff=${diff#-}  # Absolute value

      if [ "$abs_diff" -ge 100 ]; then
        error "Size mismatch! src=$src_size, dest=$dest_size (diff=$diff KB)"
        error "Keeping original, removing incomplete copy"
        execute rm -rf "$dest"
        return 1
      elif [ "$abs_diff" -gt 0 ]; then
        warn "Small size difference: $abs_diff KB (acceptable, likely filesystem metadata)"
      fi

      # Remove source after verification
      execute rm -rf "$src"
      log "✅ Migrated and verified with rsync"
    fi

    # Create symlink back
    execute ln -s "$dest" "$src"
    log "✅ Created symlink: $src → $dest"
  done

  # Post-migration verify
  verify_phase1

  log "✅ Phase 1 complete"
  return 0
}

# Verify Phase 1 (based on REPOS_TO_MOVE list)
verify_phase1() {
  log "Running Phase 1 verification..."

  local failed=0

  for entry in "${REPOS_TO_MOVE[@]}"; do
    IFS=':' read -r src dest <<< "$entry"
    src=$(eval echo "$src")
    dest=$(eval echo "$dest")

    # Skip if destination doesn't exist (repo was skipped)
    if [ ! -e "$dest" ]; then
      continue
    fi

    # Check symlink validity
    if [ -L "$src" ]; then
      if [ ! -e "$src" ]; then
        error "Broken symlink: $src"
        ((failed++))
      else
        log "✅ Symlink valid: $src"
      fi
    else
      warn "Not a symlink (might be skipped): $src"
    fi

    # Check git repo health
    if [ -d "$dest/.git" ] || git -C "$dest" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      if (cd "$dest" && git status >/dev/null 2>&1); then
        log "✅ Git repo healthy: $dest"
      else
        error "Git repo corrupted: $dest"
        ((failed++))
      fi
    fi
  done

  if [ $failed -gt 0 ]; then
    error "Verification failed with $failed errors"
    warn "Consider running: ./migrate.sh rollback"
    return 1
  fi

  log "✅ Phase 1 verification passed"
  return 0
}

###############################################################################
# Phase 2: Migrate Tools
###############################################################################
phase2_tools() {
  if [ "$DRY_RUN" = true ]; then
    echo ""
    echo "=== [DRY RUN] Phase 2: Tools Migration ==="
    echo ""
    echo "1. converter.py + run_converter.sh"
    echo "   ~/converter.py → ~/github/liye_os/tools/converters/converter.py"
    echo "   ~/run_converter.sh → ~/github/liye_os/tools/converters/run_converter.sh"
    echo "   └─ Create symlinks back"
    echo ""
    echo "2. notion-sync (⚠️  CONFLICT DETECTION)"

    local local_ns="$HOME/tools/notion-sync"
    local repo_ns="$HOME/github/liye_os/tools/notion-sync"

    if [ ! -e "$local_ns" ]; then
      echo "   ℹ️  ~/tools/notion-sync does not exist, skip"
    elif [ -L "$local_ns" ]; then
      echo "   ℹ️  ~/tools/notion-sync is already a symlink, skip"
    elif [ ! -d "$repo_ns" ]; then
      echo "   ⚠️  Repo version does not exist: $repo_ns"
      echo "   Cannot compare, skip"
    else
      echo "   Will run: diff -qr $local_ns $repo_ns"
      echo "   Output: $REPO_ROOT/_meta/logs/notion-sync-diff.txt"
      echo ""
      echo "   ⚠️  NO automatic overwrite - user decision required"
    fi

    echo ""
    echo "[DRY RUN] No changes will be made"
    return 0
  fi

  log "Starting Phase 2: Tools Migration"

  # 1. Migrate converter scripts
  if [ -f ~/converter.py ]; then
    log "Migrating converter.py..."
    execute mkdir -p ~/github/liye_os/tools/converters
    execute mv ~/converter.py ~/github/liye_os/tools/converters/
    execute ln -s ~/github/liye_os/tools/converters/converter.py ~/converter.py
  fi

  if [ -f ~/run_converter.sh ]; then
    log "Migrating run_converter.sh..."
    execute mv ~/run_converter.sh ~/github/liye_os/tools/converters/
    execute ln -s ~/github/liye_os/tools/converters/run_converter.sh ~/run_converter.sh
  fi

  # 2. notion-sync diff (handle 3 cases)
  local local_ns="$HOME/tools/notion-sync"
  local repo_ns="$HOME/github/liye_os/tools/notion-sync"
  local diff_output="$REPO_ROOT/_meta/logs/notion-sync-diff.txt"

  if [ ! -e "$local_ns" ]; then
    log "ℹ️  ~/tools/notion-sync does not exist, skip diff"
  elif [ -L "$local_ns" ]; then
    log "ℹ️  ~/tools/notion-sync is already a symlink, skip diff"
  elif [ ! -d "$repo_ns" ]; then
    warn "⚠️  Repo version does not exist: $repo_ns"
    warn "Cannot compare, skip diff"
  else
    log "Running diff: $local_ns vs $repo_ns"

    if diff -qr "$local_ns" "$repo_ns" > "$diff_output" 2>&1; then
      log "✅ No differences found between local and repo versions"
      echo "No differences" > "$diff_output"
    else
      local diff_exit=$?
      if [ $diff_exit -eq 1 ]; then
        log "⚠️  Differences found, saved to: $diff_output"
        warn "Please review diff and decide manually"
      else
        warn "diff command failed with exit code $diff_exit"
      fi
    fi
  fi

  log "✅ Phase 2 complete"
  return 0
}

###############################################################################
# Phase 3: Migrate Large Files
###############################################################################

# rsync migrate with verification (with error logging)
rsync_migrate() {
  local src="$1"
  local dest="$2"
  local link="$3"

  log "Migrating $src → $dest"

  # 1. rsync copy with error logging
  if [ "$DRY_RUN" = true ]; then
    echo "[DRY RUN] rsync -av --progress --ignore-errors $src/ $dest/"
    echo "[DRY RUN] stderr will be logged to: $REPO_ROOT/_meta/logs/phase3-rsync-errors.log"
  else
    log "Executing: rsync -av --progress --ignore-errors $src/ $dest/"

    # Create error log
    local error_log="$REPO_ROOT/_meta/logs/phase3-rsync-errors.log"

    # Run rsync with error logging
    rsync -av --progress --ignore-errors \
      "$src/" "$dest/" \
      2> "$error_log"

    local rsync_rc=$?

    # Log rsync result
    if [ $rsync_rc -eq 0 ]; then
      log "✅ rsync completed successfully (exit code 0)"
    elif [ $rsync_rc -eq 23 ]; then
      warn "⚠️  rsync partial transfer (exit code 23 - some files skipped)"
      warn "Check error log: $error_log"
    else
      error "❌ rsync failed with exit code $rsync_rc"
      error "Check error log: $error_log"
      return 1
    fi
  fi

  # 2. Verify size (only in real mode, allow <100 bytes difference for filesystem metadata)
  if [ "$DRY_RUN" = false ]; then
    local src_size=$(du -s "$src" | awk '{print $1}')
    local dest_size=$(du -s "$dest" | awk '{print $1}')
    local diff=$((src_size - dest_size))
    local abs_diff=${diff#-}  # Absolute value

    if [ "$abs_diff" -ge 100 ]; then
      error "Size mismatch! src=$src_size, dest=$dest_size (diff=$diff KB)"
      execute rm -rf "$dest"
      return 1
    elif [ "$abs_diff" -gt 0 ]; then
      warn "Small size difference: $abs_diff KB (acceptable, likely filesystem metadata)"
    fi

    log "✅ Size verification passed"

    # 3. Remove source
    execute rm -rf "$src"

    # 4. Create symlink
    execute ln -s "$dest" "$link"

    log "✅ Migrated and verified: $src"
  fi

  return 0
}

phase3_data() {
  local targets_file="$REPO_ROOT/_meta/scripts/home_migration/targets_phase3.txt"

  if [ "$DRY_RUN" = true ]; then
    echo ""
    echo "=== [DRY RUN] Phase 3: Large Files Migration ==="
    echo ""

    if [ ! -f "$targets_file" ]; then
      echo "⚠️  Targets file not found: $targets_file"
      echo "Create this file with format:"
      echo "  SOURCE:DEST"
      echo "Example:"
      echo "  ~/Documents/生财有术:~/data/archives/shengcai"
      return 1
    fi

    local count=0
    local will_migrate=0

    while IFS=':' read -r src dest; do
      # Skip empty lines and comments
      [[ -z "$src" || "$src" =~ ^# ]] && continue

      src=$(eval echo "$src")  # Expand ~
      dest=$(eval echo "$dest")

      ((count++))
      echo "$count. $src"

      if [ ! -e "$src" ]; then
        echo "   ⚠️  Source does not exist, skip"
        continue
      fi

      ((will_migrate++))
      local size=$(du -sh "$src" 2>/dev/null | awk '{print $1}' || echo 'unknown')
      echo "   Size: $size"
      echo "   rsync -av --progress --ignore-errors → $dest"
      echo "   stderr → $REPO_ROOT/_meta/logs/phase3-rsync-errors.log"
      echo "   verify size match"
      echo "   rm -rf $src"
      echo "   ln -s $dest $src"
    done < "$targets_file"

    echo ""
    echo "Summary: Will migrate $will_migrate of $count directories"
    echo ""
    echo "[DRY RUN] No changes will be made"
    return 0
  fi

  log "Starting Phase 3: Large Files Migration"

  if [ ! -f "$targets_file" ]; then
    error "Targets file not found: $targets_file"
    return 1
  fi

  while IFS=':' read -r src dest; do
    # Skip empty lines and comments
    [[ -z "$src" || "$src" =~ ^# ]] && continue

    src=$(eval echo "$src")
    dest=$(eval echo "$dest")

    if [ ! -e "$src" ]; then
      warn "Source does not exist, skip: $src"
      continue
    fi

    # Skip if already a symlink (already migrated)
    if [ -L "$src" ]; then
      warn "Source is already a symlink (already migrated), skip: $src"
      continue
    fi

    # Create destination parent
    local dest_parent=$(dirname "$dest")
    execute mkdir -p "$dest_parent"

    # Use rsync_migrate function
    rsync_migrate "$src" "$dest" "$src"

  done < "$targets_file"

  log "✅ Phase 3 complete"
  return 0
}

###############################################################################
# Verify
###############################################################################
verify() {
  verify_phase1
  # Add verify_phase2, verify_phase3 as needed
}

###############################################################################
# Rollback
###############################################################################
rollback() {
  local last_backup_file="$REPO_ROOT/_meta/logs/last_backup.txt"

  if [ ! -f "$last_backup_file" ]; then
    error "No backup reference found: $last_backup_file"
    return 1
  fi

  local backup_dir=$(cat "$last_backup_file")

  if [ ! -d "$backup_dir" ]; then
    error "Backup directory does not exist: $backup_dir"
    return 1
  fi

  if [ "$DRY_RUN" = true ]; then
    echo ""
    echo "=== [DRY RUN] Rollback ==="
    echo ""
    echo "Will restore from: $backup_dir"
    echo ""
    echo "Actions:"
    echo "  1. rsync -av --delete --links --safe-links $backup_dir/Documents/ → ~/Documents/"
    echo "  2. rsync -av --delete --links --safe-links $backup_dir/websites/ → ~/websites/"
    echo "  3. rsync -av --delete --links --safe-links $backup_dir/tools/ → ~/tools/"
    echo "  4. Copy back ~/converter.py, ~/run_converter.sh (if exist)"
    echo ""
    echo "⚠️  This will OVERWRITE all changes made since backup"
    echo ""
    echo "[DRY RUN] No changes will be made"
    return 0
  fi

  warn "This will restore from: $backup_dir"
  warn "Current data will be OVERWRITTEN!"
  read -p "Continue? (yes/NO): " confirm

  if [ "$confirm" != "yes" ]; then
    log "Rollback cancelled"
    return 0
  fi

  log "Rolling back from $backup_dir..."

  # Restore Documents
  if [ -d "$backup_dir/Documents" ]; then
    execute rsync -av --delete --links --safe-links "$backup_dir/Documents/" "$HOME/Documents/"
  fi

  # Restore websites
  if [ -d "$backup_dir/websites" ]; then
    execute rsync -av --delete --links --safe-links "$backup_dir/websites/" "$HOME/websites/"
  fi

  # Restore tools
  if [ -d "$backup_dir/tools" ]; then
    execute rsync -av --delete --links --safe-links "$backup_dir/tools/" "$HOME/tools/"
  fi

  # Restore home scripts
  if [ -f "$backup_dir/converter.py" ]; then
    execute cp "$backup_dir/converter.py" "$HOME/"
  fi

  if [ -f "$backup_dir/run_converter.sh" ]; then
    execute cp "$backup_dir/run_converter.sh" "$HOME/"
  fi

  log "✅ Rollback complete"
  return 0
}

###############################################################################
# Main dispatch
###############################################################################
case "$COMMAND" in
  phase0)
    phase0_backup
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
  verify)
    verify
    ;;
  rollback)
    rollback
    ;;
  help)
    cat <<EOF
LiYe OS Home Migration Script

Usage: $0 <command> [--dry-run]

Commands:
  phase0          Backup (required first step)
  phase1          Migrate Git repos
  phase2          Migrate tools
  phase3          Migrate large files
  verify          Verify migration
  rollback        Restore from backup
  help            Show this help

Options:
  --dry-run       Preview actions without executing

Examples:
  $0 phase0 --dry-run
  $0 phase0
  $0 phase1 --dry-run
  $0 rollback --dry-run
EOF
    ;;
  *)
    error "Unknown command: $COMMAND"
    exit 1
    ;;
esac
