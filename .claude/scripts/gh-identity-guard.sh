#!/bin/bash
# gh-identity-guard.sh
# ADR-0008: Auto-switch gh account based on current repo
#
# Usage: Source this in your shell rc file:
#   source ~/github/liye_os/.claude/scripts/gh-identity-guard.sh
#
# Then use `gh` normally - it will auto-switch when needed.

_gh_get_expected_account() {
    local remote_url
    remote_url=$(git config --get remote.origin.url 2>/dev/null || echo "")

    if [[ "$remote_url" == *"liyecom"* ]]; then
        echo "liyecom"
    elif [[ "$remote_url" == *"loudmirror"* ]]; then
        echo "loudmirror"
    else
        echo ""
    fi
}

_gh_get_current_account() {
    # Parse the active account from gh auth status
    # "Logged in to github.com account liyecom (keyring)" -> liyecom is $(NF-1)
    gh auth status 2>&1 | awk '
        /Logged in to github.com account/ { account = $(NF-1) }
        /Active account: true/ { print account; exit }
    ' || echo ""
}

gh() {
    local expected current
    expected=$(_gh_get_expected_account)
    current=$(_gh_get_current_account)

    # Only check for commands that create/modify PRs
    if [[ "$1" == "pr" && ("$2" == "create" || "$2" == "merge" || "$2" == "review") ]]; then
        if [[ -n "$expected" && "$expected" != "$current" ]]; then
            echo "[ADR-0008] Auto-switching gh account: $current → $expected"
            command gh auth switch --user "$expected" 2>/dev/null
        fi
    fi

    command gh "$@"
}

# Export for subshells
export -f gh _gh_get_expected_account _gh_get_current_account 2>/dev/null || true

echo "[gh-identity-guard] Loaded. PR commands will auto-switch account per ADR-0008."
