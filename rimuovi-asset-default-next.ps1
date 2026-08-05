$ErrorActionPreference = "Stop"

$files = @(
  "public\next.svg",
  "public\vercel.svg",
  "public\globe.svg",
  "public\window.svg",
  "public\file.svg"
)

foreach ($file in $files) {
  if (Test-Path $file) {
    Remove-Item $file -Force
    Write-Host "Rimosso: $file"
  }
}

Write-Host "Pulizia degli asset predefiniti Next.js completata."
