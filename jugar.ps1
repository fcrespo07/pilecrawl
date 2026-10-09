# Arranca Block Rogue en local, abre el navegador y para el servidor al salir (Ctrl+C o cerrar la ventana).
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 5173
$url = "http://localhost:$port"
$server = $null

# Si quedó un servidor de una ejecución anterior cerrada a la fuerza, lo paramos.
Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { & taskkill.exe /PID $_.OwningProcess /T /F | Out-Null }

try {
    $server = Start-Process -FilePath 'cmd.exe' `
        -ArgumentList '/c', "npm run dev -- --port $port --strictPort" `
        -WorkingDirectory $root -NoNewWindow -PassThru

    $ready = $false
    for ($i = 0; $i -lt 80 -and -not $ready; $i++) {
        Start-Sleep -Milliseconds 250
        if ($server.HasExited) { throw 'El servidor de Vite se ha cerrado al arrancar.' }
        try {
            Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 1 | Out-Null
            $ready = $true
        } catch { }
    }
    if (-not $ready) { throw "No he podido conectar con $url" }

    Write-Host "Block Rogue en $url - Ctrl+C para parar" -ForegroundColor Cyan
    Start-Process $url
    Wait-Process -Id $server.Id
}
finally {
    if ($server -and -not $server.HasExited) {
        # /T mata también el proceso node que lanza npm
        & taskkill.exe /PID $server.Id /T /F | Out-Null
    }
    Write-Host 'Servidor parado.' -ForegroundColor DarkGray
}
