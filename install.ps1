# Agentic QA installer for Windows PowerShell 5.1+ and PowerShell 7+.
#
# Project install (run in the root of your repository):
#   irm https://raw.githubusercontent.com/alfred-tester/agentic-testing/main/install.ps1 | iex
#
# Global install (into $HOME\.claude):
#   & ([scriptblock]::Create((irm https://raw.githubusercontent.com/alfred-tester/agentic-testing/main/install.ps1))) -Global

param(
  [switch]$Global
)

# Run in a child scope so that `irm | iex` does not leak variables, functions or
# $ErrorActionPreference into the caller's session.
& {
  $ErrorActionPreference = 'Stop'

  $GitHubUser = 'alfred-tester'
  $GitHubRepo = 'agentic-testing'
  $Branch = 'main'
  $RepoRawUrl = "https://raw.githubusercontent.com/$GitHubUser/$GitHubRepo/$Branch"

  # Windows PowerShell 5.1 does not enable TLS 1.2 by default.
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

  $Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

  function Get-RemoteFile([string]$RelativePath, [string]$Destination) {
    Invoke-WebRequest -UseBasicParsing -Uri "$RepoRawUrl/$RelativePath" -OutFile $Destination
  }

  function Get-RemoteText([string]$RelativePath) {
    $tmp = [System.IO.Path]::GetTempFileName()
    try {
      Get-RemoteFile $RelativePath $tmp
      return [System.IO.File]::ReadAllText($tmp, $Utf8NoBom)
    } finally {
      Remove-Item -Force $tmp -ErrorAction SilentlyContinue
    }
  }

  if ($Global) {
    $TargetDir = $HOME
    Write-Host "Installing Agentic QA subagents and skill globally in $(Join-Path $HOME '.claude') ..."
  } else {
    $TargetDir = (Get-Location).Path
    Write-Host 'Installing Agentic QA architecture in the current project...'
  }

  $AgentsDir = Join-Path $TargetDir '.claude/agents'
  $SkillDir = Join-Path $TargetDir '.claude/skills/agentic-testing'
  New-Item -ItemType Directory -Force -Path $AgentsDir, $SkillDir | Out-Null

  foreach ($agent in 'test-architect', 'test-engineer', 'test-quality-reviewer') {
    Get-RemoteFile ".claude/agents/$agent.md" (Join-Path $AgentsDir "$agent.md")
  }
  Get-RemoteFile '.claude/skills/agentic-testing/SKILL.md' (Join-Path $SkillDir 'SKILL.md')

  if (-not $Global) {
    $StartMarker = '<!-- agentic-testing:start -->'
    $EndMarker = '<!-- agentic-testing:end -->'
    $AgentsFile = Join-Path $TargetDir 'AGENTS.md'
    $ClaudeFile = Join-Path $TargetDir 'CLAUDE.md'
    $QaBlock = Get-RemoteText 'AGENTS.md'

    if (-not (Test-Path $AgentsFile)) {
      [System.IO.File]::WriteAllText($AgentsFile, $QaBlock, $Utf8NoBom)
    } else {
      $existing = [System.IO.File]::ReadAllText($AgentsFile, $Utf8NoBom)
      $start = $existing.IndexOf($StartMarker)
      $end = $existing.IndexOf($EndMarker)
      if ($start -ge 0 -and $end -gt $start) {
        # Replace the previously installed QA block, keeping the rest of the file intact.
        $afterEnd = $existing.IndexOf("`n", $end)
        $tail = if ($afterEnd -ge 0) { $existing.Substring($afterEnd + 1) } else { '' }
        $merged = $existing.Substring(0, $start) + $QaBlock + $tail
        [System.IO.File]::WriteAllText($AgentsFile, $merged, $Utf8NoBom)
        Write-Host 'Updated the Agentic QA section in your existing AGENTS.md.'
      } else {
        $separator = if ($existing.EndsWith("`n")) { "`n" } else { "`n`n" }
        [System.IO.File]::AppendAllText($AgentsFile, $separator + $QaBlock, $Utf8NoBom)
        Write-Host 'Appended the Agentic QA section to your existing AGENTS.md.'
      }
    }

    if (-not (Test-Path $ClaudeFile)) {
      Get-RemoteFile 'CLAUDE.md' $ClaudeFile
    } elseif (-not ([System.IO.File]::ReadAllText($ClaudeFile, $Utf8NoBom).Contains('@AGENTS.md'))) {
      # Claude Code does not read AGENTS.md natively; import it from the existing CLAUDE.md.
      $import = "`n# Agentic QA`n`nFollow all quality engineering workflows, subagent delegation rules, and TypeScript/JavaScript testing standards defined in @AGENTS.md.`n"
      [System.IO.File]::AppendAllText($ClaudeFile, $import, $Utf8NoBom)
      Write-Host 'Appended an @AGENTS.md import to your existing CLAUDE.md.'
    }
  }

  Write-Host 'Installation complete! Open Claude Code and run: /agentic-testing <target-path-or-feature>'
}
