# Luma health check entrypoint.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\scripts\luma-check.ps1

[CmdletBinding()]
param(
    [switch]$RunApp,
    [switch]$SkipInstall,
    [switch]$SkipTests,
    [switch]$SkipBuild,
    [switch]$StopOnFailure
)

$script = Join-Path $PSScriptRoot 'luma-check-fixed.ps1'

& $script `
    -RunApp:$RunApp `
    -SkipInstall:$SkipInstall `
    -SkipTests:$SkipTests `
    -SkipBuild:$SkipBuild `
    -StopOnFailure:$StopOnFailure

exit $LASTEXITCODE
