#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Neuro — release script
# Push to GitHub and publish all packages to npm
#
# Usage:
#   GITHUB_TOKEN=ghp_xxx NPM_TOKEN=npm_xxx ./scripts/release.sh
#
# Or set the vars in .env.release (never commit that file):
#   cp .env.release.example .env.release && fill in values
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# ── Load .env.release if present ─────────────────────────────────────────────
if [[ -f ".env.release" ]]; then
  echo "📦 Loading .env.release"
  set -o allexport
  source .env.release
  set +o allexport
fi

# ── Validate required vars ────────────────────────────────────────────────────
: "${GITHUB_TOKEN:?Set GITHUB_TOKEN=ghp_... or add it to .env.release}"
: "${NPM_TOKEN:?Set NPM_TOKEN=npm_... or add it to .env.release}"
: "${GITHUB_REPO:?Set GITHUB_REPO=username/repo-name or add it to .env.release}"

# ─────────────────────────────────────────────────────────────────────────────
# 1. PUSH TO GITHUB
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "🚀 Pushing to GitHub → https://github.com/$GITHUB_REPO"

REMOTE_URL="https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git"

# Set remote (create or update)
if git remote get-url origin &>/dev/null; then
  git remote set-url origin "$REMOTE_URL"
else
  git remote add origin "$REMOTE_URL"
fi

git push origin HEAD --follow-tags

echo "✓ GitHub push complete"

# ─────────────────────────────────────────────────────────────────────────────
# 2. BUILD ALL PACKAGES
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "🔨 Building packages..."

build_package() {
  local dir=$1
  local name=$2
  echo "  → building $name"
  (cd "$dir" && npm install --silent && npm run build 2>&1 | tail -3)
}

# Build consolidated package only
build_package "packages/ts/praesidia" "@praesidia/neurogent"

echo "✓ All packages built"

# ─────────────────────────────────────────────────────────────────────────────
# 3. PUBLISH TO NPM
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "📦 Publishing to npm..."

# Write token to .npmrc (scoped to this run, cleaned up on exit)
NPM_RC="$HOME/.npmrc"
NPMRC_BACKUP="$HOME/.npmrc.release-backup"

cleanup() {
  if [[ -f "$NPMRC_BACKUP" ]]; then
    mv "$NPMRC_BACKUP" "$NPM_RC"
  elif [[ -f "$NPM_RC" ]]; then
    # Only remove if we created it
    grep -q "//registry.npmjs.org/:_authToken=" "$NPM_RC" && rm -f "$NPM_RC" || true
  fi
}
trap cleanup EXIT

[[ -f "$NPM_RC" ]] && cp "$NPM_RC" "$NPMRC_BACKUP"
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" >> "$NPM_RC"

publish_package() {
  local dir=$1
  local name=$2
  echo ""
  echo "  📤 $name"
  if (cd "$dir" && npm publish --access public 2>&1); then
    echo "  ✓ $name published"
  else
    echo "  ⚠ $name — already at this version or publish failed (skipping)"
  fi
}

publish_package "packages/ts/praesidia" "@praesidia/neurogent"

echo ""
echo "✅ Release complete!"
echo "   GitHub → https://github.com/$GITHUB_REPO"
echo "   npm    → https://www.npmjs.com/~$(npm whoami 2>/dev/null || echo 'check npm profile')"
