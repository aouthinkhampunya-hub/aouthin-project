param(
    [int]$Port = 5173
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$exe = Join-Path $scriptDir "cloudflared.exe"

if (-not (Test-Path $exe)) {
    Write-Host "[INFO] Downloading cloudflared.exe..." -ForegroundColor Yellow
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    (New-Object Net.WebClient).DownloadFile(
        "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe",
        $exe
    )
}

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "       AOUTHIN - CONNECTING PORT $Port TO CLOUDFLARE...        " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "Starting tunnel for http://localhost:$Port ..."

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $exe
$psi.Arguments = "tunnel --url http://localhost:$Port"
$psi.RedirectStandardError = $true
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true

$proc = [System.Diagnostics.Process]::Start($psi)

$urlFound = $false

# Cleanup handler
Register-ObjectEvent -InputObject ([System.AppDomain]::CurrentDomain) -EventName ProcessExit -Action {
    try { if (-not $proc.HasExited) { $proc.Kill() } } catch {}
} | Out-Null

while (-not $proc.HasExited) {
    $line = $proc.StandardError.ReadLine()
    if ($null -ne $line) {
        Write-Host $line

        if (-not $urlFound -and $line -match '(https://[a-z0-9\-]+\.trycloudflare\.com)') {
            $urlFound = $true
            $url = $matches[1]

            try { Set-Clipboard -Value $url } catch {}

            Write-Host ""
            Write-Host "================================================================" -ForegroundColor Green
            Write-Host "                   TUNNEL IS NOW ONLINE!                        " -ForegroundColor Green
            Write-Host "================================================================" -ForegroundColor Green
            Write-Host "  Public URL:        $url" -ForegroundColor Yellow
            Write-Host "  [Auto-Copied to Clipboard!]" -ForegroundColor Green
            if ($Port -eq 5173) {
                Write-Host "  Customer Menu:     $url/menu" -ForegroundColor Cyan
                Write-Host "  Admin Dashboard:   $url/admin" -ForegroundColor Cyan
                Write-Host "  Kitchen Display:   $url/kitchen" -ForegroundColor Cyan
            }
            Write-Host "================================================================" -ForegroundColor Green
            Write-Host "Keep this window open. Press Ctrl+C anytime to stop.`n" -ForegroundColor Gray
        }
    }
}
