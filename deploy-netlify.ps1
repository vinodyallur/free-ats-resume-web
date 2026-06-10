# Deploy this site to Netlify with no CLI install (uses the Netlify API).
# Usage: open a terminal in this folder and run:  .\deploy-netlify.ps1
#
# You'll need a free Netlify Personal Access Token:
#   https://app.netlify.com/user/applications#personal-access-tokens

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

# 1) Zip the site (small, ~0.4 MB)
$zip = Join-Path $env:TEMP "free-ats-resume-web-deploy.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path .\index.html, .\styles.css, .\app.js, .\src, .\lib, .\icons, .\netlify.toml `
  -DestinationPath $zip -Force
Write-Host ("Zipped {0} KB" -f [math]::Round((Get-Item $zip).Length / 1KB))

# 2) Ask for the token (hidden input)
$sec = Read-Host "Paste your Netlify token and press Enter" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
$token = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
if ([string]::IsNullOrWhiteSpace($token)) { Write-Host "No token entered. Aborting." -ForegroundColor Red; exit 1 }

# 3) Create the site + deploy in one API call
Write-Host "Deploying to Netlify..."
try {
  $resp = Invoke-RestMethod -Uri "https://api.netlify.com/api/v1/sites" -Method Post `
    -Headers @{ Authorization = "Bearer $token" } -ContentType "application/zip" -InFile $zip
  Write-Host "`n=== DEPLOYED ===" -ForegroundColor Green
  Write-Host ("Live URL : " + $resp.ssl_url)
  Write-Host ("Admin    : " + $resp.admin_url)
  Write-Host ("Site name: " + $resp.name)
  Write-Host "`n(First load may take a few seconds while Netlify provisions HTTPS.)"
}
catch {
  Write-Host ("Deploy failed: " + $_.Exception.Message) -ForegroundColor Red
  if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
  exit 1
}
