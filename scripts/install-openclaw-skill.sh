#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="$REPO_ROOT/skills/koinara-node"
TARGET_ROOT="${HOME}/.openclaw/skills"
TARGET_DIR="$TARGET_ROOT/koinara-node"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Missing skill source: $SOURCE_DIR" >&2
  exit 1
fi

mkdir -p "$TARGET_ROOT"
rm -rf "$TARGET_DIR"
cp -R "$SOURCE_DIR" "$TARGET_DIR"

echo "Installed OpenClaw skill:"
echo "  $TARGET_DIR"
echo
echo "Restart OpenClaw or reload skills to pick up the new Koinara skill."
