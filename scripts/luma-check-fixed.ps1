[CmdletBinding()]
param(
    [switch]$RunApp,
    [switch]$SkipInstall,
    [switch]$SkipTests,
    [switch]$SkipBuild,
    [switch]$StopOnFailure
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $ProjectRoot

$ReportDir = Join-Path $ProjectRoot 'reports'
$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$ReportFile = Join-Path $ReportDir "luma-check-$Timestamp.log"
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

$Results = [System.Collections.Generic.List[object]]::new()

function Section([string]$Title) {
    Write-Host ''
    Write-Host ('=' * 72) -ForegroundColor Cyan
    Write-Host " $Title" -ForegroundColor Cyan
    Write-Host ('=' * 72) -ForegroundColor Cyan
}

function Pass([string]$Message) { Write-Host "[PASS] $Message" -ForegroundColor Green }
function Warn([string]$Message) { Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Fail([string]$Message) { Write-Host "[FAIL] $Message" -ForegroundColor Red }
function Info([string]$Message) { Write-Host "[INFO] $Message" -ForegroundColor Gray }

function Check {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][scriptblock]$Action,
        [switch]$Optional
    )

    Write-Host "`n>>> $Name" -ForegroundColor White
    $start = Get-Date
    $code = 0
    $exception = $null

    try {
        $global:LASTEXITCODE = 0
        Push-Location $ProjectRoot
        & $Action
        if ($null -ne $LASTEXITCODE) { $code = [int]$LASTEXITCODE }
    }
    catch {
        $code = 1
        $exception = $_.Exception.Message
    }
    finally {
        try { Pop-Location } catch {}
        Set-Location $ProjectRoot
    }

    $duration = [math]::Round(((Get-Date) - $start).TotalSeconds, 2)

    if ($code -eq 0) {
        Pass "$Name ($duration s)"
        $Results.Add([pscustomobject]@{
            Name = $Name; Status = 'PASS'; ExitCode = 0; Duration = $duration
        })
        return $true
    }

    if ($exception) { Info "Detail: $exception" }

    if ($Optional) { Warn "$Name failed ($duration s)" }
    else { Fail "$Name failed with exit code $code ($duration s)" }

    $Results.Add([pscustomobject]@{
        Name = $Name
        Status = $(if ($Optional) { 'WARN' } else { 'FAIL' })
        ExitCode = $code
        Duration = $duration
    })

    if ($StopOnFailure -and -not $Optional) {
        throw "Stopping after required failure: $Name"
    }

    return $false
}

function CommandExists([string]$Name) {
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($null -eq $cmd) {
        Fail "$Name not found"
        return $false
    }
    Pass "$Name -> $($cmd.Source)"
    return $true
}

$transcript = $false

try {
    Start-Transcript -Path $ReportFile -Append | Out-Null
    $transcript = $true

    Section 'LUMA MASTER HEALTH CHECK'
    Info "Project: $ProjectRoot"
    Info "Report: $ReportFile"

    Section '1. REPOSITORY'
    if (Test-Path '.git') {
        Pass 'Git repository detected'
        Info 'Branch:'
        git branch --show-current
        Info 'Status:'
        git status --short
        Info 'Recent commits:'
        git log -5 --oneline
    }
    else {
        Fail 'Git repository not detected'
    }

    Section '2. PROJECT STRUCTURE'
    $paths = @(
        'Cargo.toml',
        'package.json',
        'pnpm-workspace.yaml',
        'apps/desktop',
        'apps/desktop/src-tauri',
        'crates/luma-core',
        'crates/luma-anchor',
        'crates/luma-reader',
        'crates/luma-storage',
        'crates/luma-search',
        'crates/luma-sync',
        'crates/luma-ai',
        'crates/luma-security',
        'packages',
        'docs'
    )
    foreach ($p in $paths) {
        if (Test-Path $p) { Pass "Exists: $p" }
        else { Fail "Missing: $p" }
    }

    Section '3. TOOLCHAIN'
    $null = Check 'rustup' { rustup --version }
    $null = Check 'rustc' { rustc --version }
    $null = Check 'cargo' { cargo --version }
    $null = Check 'node' { node --version }
    $null = Check 'pnpm' { pnpm --version }

    $rustInfo = rustc -vV 2>$null
    $rustInfo

    if ($rustInfo -match 'host:\s+x86_64-pc-windows-msvc') {
        Pass 'Rust MSVC host'
    }
    else {
        Warn 'Rust host is not x86_64-pc-windows-msvc'
    }

    Section '4. WINDOWS NATIVE TOOLCHAIN'
    $hasLink = CommandExists 'link.exe'
    $hasCl = CommandExists 'cl.exe'
    $hasRc = CommandExists 'rc.exe'

    if (-not ($hasLink -and $hasCl -and $hasRc)) {
        Warn 'MSVC native environment is incomplete in this shell.'
    }

    Section '5. WASM'
    $targets = rustup target list --installed 2>$null
    $targets
    if ($targets -contains 'wasm32-unknown-unknown') {
        Pass 'WASM target installed'
        if ($SkipTests) {
            Warn 'WASM compile skipped'
        }
        else {
            $null = Check 'WASM luma-core + luma-anchor' {
                cargo check -p luma-core -p luma-anchor --target wasm32-unknown-unknown
            }
        }
    }
    else {
        Warn 'wasm32-unknown-unknown is not installed'
    }

    Section '6. INSTALL'
    if ($SkipInstall) {
        Warn 'pnpm install skipped'
    }
    else {
        $null = Check 'pnpm install' { pnpm install }
    }

    Section '7. RUST FORMAT'
    $null = Check 'cargo fmt --check' { cargo fmt --all -- --check }

    Section '8. RUST CHECK'
    $null = Check 'cargo check --workspace' { cargo check --workspace }

    Section '9. RUST TESTS'
    if ($SkipTests) {
        Warn 'Rust tests skipped'
    }
    else {
        $null = Check 'cargo test --workspace' { cargo test --workspace }
    }

    Section '10. CLIPPY'
    $null = Check 'cargo clippy --workspace --all-targets -- -D warnings' {
        cargo clippy --workspace --all-targets -- -D warnings
    }

    Section '11. TYPESCRIPT'
    $null = Check 'pnpm typecheck' { pnpm typecheck }

    Section '12. ESLINT'
    $null = Check 'pnpm lint' { pnpm lint }

    Section '13. FRONTEND TESTS'
    if ($SkipTests) {
        Warn 'Frontend tests skipped'
    }
    else {
        $null = Check 'pnpm test' { pnpm test }
    }

    Section '14. FRONTEND BUILD'
    if ($SkipBuild) {
        Warn 'Frontend build skipped'
    }
    else {
        $null = Check 'pnpm build' { pnpm build }
    }

    Section '15. TAURI'
    $null = Check 'Tauri CLI' { pnpm exec tauri --version }
    $null = Check 'Tauri info' { pnpm exec tauri info } -Optional

    if ($SkipBuild) {
        Warn 'Tauri debug build skipped'
    }
    else {
        $null = Check 'Tauri debug build' { pnpm exec tauri build --debug } -Optional
    }

    if ($RunApp) {
        Section '16. LUMA APPLICATION'
        Info 'Launching Tauri dev mode. Press Ctrl+C to stop.'
        pnpm exec tauri dev
    }
    else {
        Info 'Application launch skipped. Use -RunApp to launch Luma.'
    }

    Section '17. FINAL GIT STATE'
    git status --short

    Section '18. SUMMARY'
    $Results | Format-Table Name, Status, ExitCode, Duration -AutoSize

    $passed = @($Results | Where-Object { $_.Status -eq 'PASS' }).Count
    $failed = @($Results | Where-Object { $_.Status -eq 'FAIL' }).Count
    $warnings = @($Results | Where-Object { $_.Status -eq 'WARN' }).Count

    Write-Host ''
    Write-Host "PASS    : $passed" -ForegroundColor Green
    Write-Host "FAIL    : $failed" -ForegroundColor Red
    Write-Host "WARN    : $warnings" -ForegroundColor Yellow
    Write-Host "REPORT  : $ReportFile"

    if ($failed -eq 0) {
        Write-Host ''
        Pass 'LUMA VALIDATION STATUS: GREEN'
        exit 0
    }
    else {
        Write-Host ''
        Fail 'LUMA VALIDATION STATUS: RED'
        exit 1
    }
}
catch {
    Write-Host ''
    Fail $_.Exception.Message
    exit 1
}
finally {
    if ($transcript) {
        try { Stop-Transcript | Out-Null } catch {}
    }
}
