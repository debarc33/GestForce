# ============================================================
#  GestForce — Optimización del entorno de desarrollo (Windows)
#  EJECUTAR COMO ADMINISTRADOR (clic derecho > Ejecutar con PowerShell)
#
#  Causa del "se queda procesando": Windows Defender escanea cada
#  archivo que Turbopack escribe en .next, haciendo que cada
#  recompilación tarde 12-23 segundos en este disco.
#
#  Este script añade exclusiones de Defender para el proyecto,
#  Node y el caché de Next.js. Es seguro y reversible.
# ============================================================

$ErrorActionPreference = 'Stop'

# Verificar privilegios de administrador
$isAdmin = ([Security.Principal.WindowsPrincipal] `
  [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
  Write-Host "ERROR: Debes ejecutar este script como ADMINISTRADOR." -ForegroundColor Red
  Write-Host "Clic derecho sobre el archivo > 'Ejecutar con PowerShell' (como admin)." -ForegroundColor Yellow
  exit 1
}

$proj = "C:\Users\usuario\GestForce1"

Write-Host "Añadiendo exclusiones de Windows Defender..." -ForegroundColor Cyan

# Carpeta del proyecto y caché de build
Add-MpPreference -ExclusionPath $proj
Add-MpPreference -ExclusionPath "$proj\.next"
Add-MpPreference -ExclusionPath "$proj\node_modules"

# Procesos de Node (evita escaneo en cada escritura)
Add-MpPreference -ExclusionProcess "node.exe"

Write-Host ""
Write-Host "Listo. Exclusiones activas:" -ForegroundColor Green
(Get-MpPreference).ExclusionPath | ForEach-Object { Write-Host "  $_" }
(Get-MpPreference).ExclusionProcess | ForEach-Object { Write-Host "  [proc] $_" }

Write-Host ""
Write-Host "Ahora:" -ForegroundColor Cyan
Write-Host "  1) Cierra el servidor de desarrollo si está corriendo."
Write-Host "  2) Borra el caché viejo:  Remove-Item -Recurse -Force '$proj\.next'"
Write-Host "  3) Arranca de nuevo:      npm run dev"
Write-Host ""
Write-Host "La primera compilación seguirá tardando, pero las siguientes" -ForegroundColor Yellow
Write-Host "navegaciones deberían ser mucho más rápidas." -ForegroundColor Yellow
