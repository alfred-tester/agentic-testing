#!/usr/bin/env sh
set -e

GITHUB_USER="alfred-tester"
GITHUB_REPO="agentic-testing"
BRANCH="main"
REPO_RAW_URL="https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${BRANCH}"
TARGET_DIR="."

if [ "$1" = "--global" ]; then
  TARGET_DIR="$HOME"
  echo "🌍 Installing Agentic QA subagents and skill globally in ~/.claude/..."
else
  echo "📦 Installing Agentic QA architecture in the current project..."
fi

mkdir -p "$TARGET_DIR/.claude/agents" "$TARGET_DIR/.claude/skills/agentic-testing"

curl -fsSL "$REPO_RAW_URL/.claude/agents/test-architect.md" -o "$TARGET_DIR/.claude/agents/test-architect.md"
curl -fsSL "$REPO_RAW_URL/.claude/agents/test-engineer.md" -o "$TARGET_DIR/.claude/agents/test-engineer.md"
curl -fsSL "$REPO_RAW_URL/.claude/agents/test-quality-reviewer.md" -o "$TARGET_DIR/.claude/agents/test-quality-reviewer.md"
curl -fsSL "$REPO_RAW_URL/.claude/skills/agentic-testing/SKILL.md" -o "$TARGET_DIR/.claude/skills/agentic-testing/SKILL.md"

if [ "$1" != "--global" ]; then
  [ ! -f "AGENTS.md" ] && curl -fsSL "$REPO_RAW_URL/AGENTS.md" -o "AGENTS.md" || true
  [ ! -f "CLAUDE.md" ] && curl -fsSL "$REPO_RAW_URL/CLAUDE.md" -o "CLAUDE.md" || true
fi

echo "✅ Installation complete! Open Claude Code and run: /agentic-testing <target-path-or-feature>"
