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
  START_MARKER="<!-- agentic-testing:start -->"
  END_MARKER="<!-- agentic-testing:end -->"
  QA_BLOCK="$(mktemp)"
  trap 'rm -f "$QA_BLOCK" "$QA_BLOCK.merged"' EXIT
  curl -fsSL "$REPO_RAW_URL/AGENTS.md" -o "$QA_BLOCK"

  if [ ! -f "AGENTS.md" ]; then
    cp "$QA_BLOCK" "AGENTS.md"
  elif grep -qF "$START_MARKER" "AGENTS.md" && grep -qF "$END_MARKER" "AGENTS.md"; then
    # Replace the previously installed QA block, keeping the rest of the file intact.
    awk -v block="$QA_BLOCK" -v start="$START_MARKER" -v end="$END_MARKER" '
      index($0, start) { while ((getline line < block) > 0) print line; skip = 1; next }
      index($0, end) { skip = 0; next }
      !skip { print }
    ' "AGENTS.md" > "$QA_BLOCK.merged"
    cat "$QA_BLOCK.merged" > "AGENTS.md"
    echo "ℹ️  Updated the Agentic QA section in your existing AGENTS.md."
  else
    printf '\n' >> "AGENTS.md"
    cat "$QA_BLOCK" >> "AGENTS.md"
    echo "ℹ️  Appended the Agentic QA section to your existing AGENTS.md."
  fi

  if [ ! -f "CLAUDE.md" ]; then
    curl -fsSL "$REPO_RAW_URL/CLAUDE.md" -o "CLAUDE.md"
  elif ! grep -qF "@AGENTS.md" "CLAUDE.md"; then
    # Claude Code does not read AGENTS.md natively; import it from the existing CLAUDE.md.
    printf '\n# Agentic QA\n\nFollow all quality engineering workflows, subagent delegation rules, and TypeScript/JavaScript testing standards defined in @AGENTS.md.\n' >> "CLAUDE.md"
    echo "ℹ️  Appended an @AGENTS.md import to your existing CLAUDE.md."
  fi
fi

echo "✅ Installation complete! Open Claude Code and run: /agentic-testing <target-path-or-feature>"
