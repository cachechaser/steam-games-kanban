<#
.SYNOPSIS
    Extract Collection data from local Steam userdata files

.DESCRIPTION
    Searches for local Steam collection data in cloud-storage-namespace-1.json
    and outputs clean JSON

.PARAMETER SearchTerm
    Optional filter — only output collections whose name matches this term (case-insensitive).

.EXAMPLE
    .\extract_collections.ps1
    .\extract_collections.ps1 -SearchTerm "Playing"
    .\extract_collections.ps1 | Out-File -Encoding utf8 collections.json

.NOTES
    Then paste/upload the output in/to the web app
#>

param(
    [string]$SearchTerm = ""
)

$ErrorActionPreference = "Stop"

# --- Steam userdata search paths ---
$SteamBases = @(
    "${env:ProgramFiles(x86)}\Steam\userdata",
    "$env:ProgramFiles\Steam\userdata"
)

$JsonFiles = @()

foreach ($base in $SteamBases) {
    if (-not (Test-Path $base)) { continue }
    $found = Get-ChildItem -Path $base -Recurse -Filter "cloud-storage-namespace-1.json" -File -ErrorAction SilentlyContinue
    foreach ($f in $found) {
        $JsonFiles += $f.FullName
    }
}

if ($JsonFiles.Count -eq 0) {
    Write-Host "[ERROR] Could not find any cloud-storage-namespace-1.json files." -ForegroundColor Red
    Write-Host "[INFO]  Make sure Steam is installed and you have logged in at least once." -ForegroundColor Yellow
    Write-Host "[INFO]  Searched paths:" -ForegroundColor Yellow
    foreach ($p in $SteamBases) {
        Write-Host "         - $p" -ForegroundColor Yellow
    }
    exit 1
}

Write-Host "[INFO] Found $($JsonFiles.Count) userdata file(s):" -ForegroundColor Cyan
foreach ($f in $JsonFiles) {
    Write-Host "  -> $f" -ForegroundColor Cyan
}

# --- Extract collections ---
$Collections = @{}  # deduplicate by name (last wins)

foreach ($jsonFile in $JsonFiles) {
    Write-Host "[INFO] Parsing: $jsonFile" -ForegroundColor Cyan

    try {
        $raw = Get-Content -Path $jsonFile -Raw -Encoding UTF8
    } catch {
        Write-Host "[WARN] Could not read $jsonFile : $_" -ForegroundColor Yellow
        continue
    }

    $pattern = '"value":"\{[^}]*\\"name\\":[^}]*\}"'
    $matches = [regex]::Matches($raw, $pattern)

    foreach ($m in $matches) {
        $entry = $m.Value

        if ($entry -match '\\"name\\":\\"([^\\]+)\\"') {
            $name = $Matches[1]
        } else {
            continue
        }

        if ([string]::IsNullOrWhiteSpace($name)) { continue }

        # filter by SEARCH_TERM if provided (case-insensitive substring match on collection name)
        if ($SearchTerm -and $name -notlike "*$SearchTerm*") { continue }

        # game IDs from "added" array - btw TODO find out whether "removed" is useful for anything
        $gameIds = @()
        if ($entry -match '\\"added\\":\[([^\]]*)\]') {
            $idsStr = $Matches[1]
            if ($idsStr -and $idsStr -ne "null") {
                $gameIds = $idsStr -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ -match '^\d+$' } | ForEach-Object { [int]$_ }
            }
        }

        $Collections[$name] = $gameIds
    }
}

Write-Host "[INFO] Found $($Collections.Count) collection(s)." -ForegroundColor Cyan

$collArray = @()
foreach ($key in $Collections.Keys) {
    $idsJson = "[$( ($Collections[$key] | ForEach-Object { $_.ToString() }) -join ',' )]"
    $collArray += "  {`"name`":`"$key`",`"game_ids`":$idsJson}"
}

$json = "{`"collections`":[`n$($collArray -join ",`n")`n]}"
Write-Output $json

# --- clipboard ---
try {
    Set-Clipboard -Value $json
    Write-Host "" -ForegroundColor Green
    Write-Host "[DONE] JSON copied to clipboard. Paste it in the web app under" -ForegroundColor Green
    Write-Host "       Profile Edit -> Import Steam Collections." -ForegroundColor Green
} catch {
    Write-Host "" -ForegroundColor Green
    Write-Host "[DONE] Copy the JSON output above and paste it into the web app" -ForegroundColor Green
    Write-Host "       under Profile Edit -> Import Steam Collections." -ForegroundColor Green
}

