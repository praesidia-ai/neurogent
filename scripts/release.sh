#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Neuro — publish @praesidia/neurogent to npm
#
# Scoped name @praesidia/* requires an npm org named "praesidia" and a user with
# publish rights (or change the "name" in packages/ts/praesidia/package.json).
# Create org: https://www.npmjs.com/org/create
#
# Required:
#   NPM_TOKEN=npm_xxx ./scripts/release.sh
#
# Optional (push + tags to GitHub before publish):
#   GITHUB_TOKEN=ghp_xxx GITHUB_REPO=username/repo ./scripts/release.sh
#
# Or set vars in .env.release (never commit that file):
#   cp .env.release.example .env.release && fill in values
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PACKAGE_DIR="packages/ts/praesidia"
PACKAGE_NAME="@praesidia/neurogent"

# ── Load .env.release if present ─────────────────────────────────────────────
if [[ -f ".env.release" ]]; then
  echo "Loading .env.release"
  set -o allexport
  source .env.release
  set +o allexport
fi

# ── Validate npm ────────────────────────────────────────────────────────────
: "${NPM_TOKEN:?Set NPM_TOKEN=npm_... or add it to .env.release}"

# ─────────────────────────────────────────────────────────────────────────────
# 1. OPTIONAL: PUSH TO GITHUB
# ─────────────────────────────────────────────────────────────────────────────
if [[ -n "${GITHUB_TOKEN:-}" ]] && [[ -n "${GITHUB_REPO:-}" ]]; then
  echo ""
  echo "Pushing to GitHub → https://github.com/$GITHUB_REPO"
  REMOTE_URL="https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git"
  if git remote get-url origin &>/dev/null; then
    git remote set-url origin "$REMOTE_URL"
  else
    git remote add origin "$REMOTE_URL"
  fi
  git push origin HEAD --follow-tags
  echo "GitHub push complete"
else
  echo ""
  echo "Skipping GitHub (set GITHUB_TOKEN and GITHUB_REPO to push before publish)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 2. BUILD
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "Building $PACKAGE_NAME..."
(
  cd "$PACKAGE_DIR"
  npm install --silent
  npm run build
)
echo "Build complete"

# ─────────────────────────────────────────────────────────────────────────────
# 3. PUBLISH TO NPM
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "Publishing to npm..."

NPM_RC="$HOME/.npmrc"
NPMRC_BACKUP="$HOME/.npmrc.release-backup"

cleanup() {
  if [[ -f "$NPMRC_BACKUP" ]]; then
    mv "$NPMRC_BACKUP" "$NPM_RC"
  elif [[ -f "$NPM_RC" ]]; then
    grep -q "//registry.npmjs.org/:_authToken=" "$NPM_RC" && rm -f "$NPM_RC" || true
  fi
}
trap cleanup EXIT

[[ -f "$NPM_RC" ]] && cp "$NPM_RC" "$NPMRC_BACKUP"
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" >> "$NPM_RC"

VERSION="$(node -p "require('${REPO_ROOT}/${PACKAGE_DIR}/package.json').version")"
echo "  Version: $VERSION"
echo "  Package: $PACKAGE_NAME"

if (cd "$PACKAGE_DIR" && npm publish --access public); then
  echo "  Published $PACKAGE_NAME@$VERSION"
  echo ""
  echo "Release complete."
  echo "  npm → https://www.npmjs.com/package/${PACKAGE_NAME}"
else
  code=$?
  echo ""
  echo "Publish failed (exit $code). Common causes:"
  echo "  - E404 'Scope not found': create the @praesidia org on npm or rename the package."
  echo "  - Version already published: bump version in $PACKAGE_DIR/package.json"
  exit "$code"
fi
