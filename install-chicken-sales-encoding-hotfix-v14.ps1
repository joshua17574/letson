
$ErrorActionPreference = "Stop"

$root = Get-Location
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $root "_backup_chicken_sales_encoding_v14_$stamp"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

function Backup-File($relativePath) {
  $source = Join-Path $root $relativePath
  if (!(Test-Path $source)) {
    throw "File not found: $relativePath"
  }
  $target = Join-Path $backupDir $relativePath
  $targetDir = Split-Path $target -Parent
  New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
  Copy-Item $source $target -Force
}

function Read-FileUtf8($path) {
  $bytes = [System.IO.File]::ReadAllBytes($path)
  $utf8 = New-Object System.Text.UTF8Encoding($false, $false)
  return $utf8.GetString($bytes)
}

function Write-FileUtf8($path, $content) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
}

$sellFile = "components\sales\SellChickenPageClient.tsx"
Backup-File $sellFile
$sellPath = Join-Path $root $sellFile
$sell = Read-FileUtf8 $sellPath

# Fix mojibake caused by older PowerShell reading UTF-8 source as ANSI.
# Keep product labels ASCII-safe so the browser never shows text like: C10 Ã¢â‚¬â€ available
$replacements = @{
  "Ã¢â‚¬â€" = " - ";
  "Ã¢â‚¬â€" = " - ";
  "Ã¢â‚¬â€œ" = " - ";
  "â€”" = " - ";
  "â€“" = " - ";
  "Ã—" = "x";
  "Ã·" = "/";
  "Â₱" = "₱";
  "Â" = "";
  "â‚±" = "₱";
}

foreach ($key in $replacements.Keys) {
  $sell = $sell.Replace($key, $replacements[$key])
}

# Make common Sell Chicken labels explicit and ASCII-safe.
$sell = $sell -replace 'Packs / Qty', 'Packs to Sell'
$sell = $sell -replace '>Available<', '>Available Packs<'
$sell = $sell -replace '>Qty to Sell<', '>Packs to Sell<'
$sell = $sell -replace 'available \(', 'packs available ('
$sell = $sell -replace 'pcs/pack', 'pcs per pack'

# Fix dropdown option strings if they still contain a broken dash before "available".
$sell = $sell -replace '\s*[-–—]+\s*\{?\s*available\s*\}?', ' available'
$sell = $sell -replace 'Ã[^\r\n<>{}]*available', ' available'
$sell = $sell -replace 'â[^\r\n<>{}]*available', ' available'

# Ensure pack availability is derived from PCS stock divided by pack size.
$sell = $sell -replace 'availablePacks:\s*stockQty\s*,', 'availablePacks: Math.floor(stockQty / packSize),'

# If the product option helper fields exist, keep them consistent.
if ($sell -notmatch 'loosePcs:\s*stockQty\s*%\s*packSize') {
  $sell = $sell -replace '(availablePacks:\s*Math\.floor\(stockQty / packSize\),)', "$1`r`n          loosePcs: stockQty % packSize,"
}

if ($sell -notmatch 'pricePerPcs:\s*packSize') {
  $sell = $sell -replace '(pricePerPack,\s*\r?\n\s*packSize,)', "$1`r`n          pricePerPcs: packSize > 0 ? pricePerPack / packSize : pricePerPack,"
}

Write-FileUtf8 $sellPath $sell

Write-Host "Chicken sales encoding/dropdown hotfix v14 installed."
Write-Host "Backups saved to: $backupDir"
Write-Host "Restart dev server after install: npm run dev"
