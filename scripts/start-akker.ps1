$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$nextCli = Join-Path $project 'node_modules\next\dist\bin\next'
$node = (Get-Command node.exe -ErrorAction Stop).Source
$logDir = Join-Path $project 'startup-logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$stdout = Join-Path $logDir 'server.log'
$stderr = Join-Path $logDir 'server-error.log'

while ($true) {
    $listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($listener) { exit 0 }
    try {
        $server = Start-Process -FilePath $node -ArgumentList @("`"$nextCli`"", 'start', '--port', '3000') -WorkingDirectory $project -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
        while (-not $server.HasExited) {
            Start-Sleep -Seconds 4
            $listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($listener) { exit 0 }
        }
        Add-Content -Path (Join-Path $logDir 'supervisor.log') -Value "$(Get-Date -Format o) Next.js process exited with code $($server.ExitCode); restarting in 10 seconds."
    } catch {
        Add-Content -Path (Join-Path $logDir 'supervisor.log') -Value "$(Get-Date -Format o) Startup error: $($_.Exception.Message)"
    }
    Start-Sleep -Seconds 10
}

