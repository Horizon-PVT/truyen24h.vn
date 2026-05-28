# Auto-deploy Firestore rules. Run từ folder dự án:
#   .\deploy-rules.ps1
#
# Script đọc FIREBASE_SERVICE_ACCOUNT_JSON từ .env.local và push
# nội dung firestore.rules lên Firebase Console — không cần Firebase CLI.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
Write-Host ""
Write-Host "==> Deploying Firestore rules ..." -ForegroundColor Cyan
node scripts/deploy-firestore-rules.mjs
