#
# Truyen24h.vn — push Sprint 1 lên GitHub
# Anh mở PowerShell ở folder dự án (Shift+Right Click → "Open PowerShell here"),
# rồi chạy:    .\push-to-github.ps1
#
# Lưu ý: lần đầu PowerShell có thể chặn script. Nếu thấy lỗi "execution policy",
# chạy 1 lần lệnh sau (1 lần duy nhất cho user này):
#     Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
#

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "==> Đang dọn lock file (nếu có)..." -ForegroundColor Cyan
if (Test-Path ".git\index.lock") {
    Remove-Item ".git\index.lock" -Force
    Write-Host "    Đã xoá .git\index.lock"
}

Write-Host ""
Write-Host "==> Kiểm tra remote..." -ForegroundColor Cyan
$remotes = git remote
if (-not ($remotes -contains "origin")) {
    Write-Host "    Chưa có remote 'origin'. Thêm Horizon-PVT/truyen24h.vn..."
    git remote add origin https://github.com/Horizon-PVT/truyen24h.vn.git
} else {
    Write-Host "    Đã có remote 'origin':"
    git remote -v
}

Write-Host ""
Write-Host "==> Đổi branch sang main (chuẩn GitHub mới)..." -ForegroundColor Cyan
git branch -M main

Write-Host ""
Write-Host "==> Stage toàn bộ thay đổi..." -ForegroundColor Cyan
git add .

Write-Host ""
Write-Host "==> Tóm tắt thay đổi sắp commit:" -ForegroundColor Cyan
git status --short

Write-Host ""
Write-Host "==> Commit..." -ForegroundColor Cyan
$msg = @"
Sprint 1: AI pipeline + admin panel + SEO + monetization

- Add /api/ai/* (generate-novel, generate-chapter) and /api/admin/* (publish-novel, publish-chapter, daily-run, daily-run-cron)
- Add AI Studio admin page (/admin/ai-studio) + Revenue dashboard (/admin/revenue) + Novels manager (/admin/novels)
- Add AI cover service (Pollinations.ai) so every AI novel ships with a unique cover
- Add Schema.org JSON-LD (Organization, WebSite, Book, Chapter, BreadcrumbList)
- Add GA4 + Microsoft Clarity + AdSense env-driven Analytics component
- Add Affiliate Shopee widget + AdSense slot scaffolding
- Add About page (/gioi-thieu) + AI content disclosure in footer
- Add VIP monthly bundle (99k → 1800 xu) and starter pack (5k → 70 xu)
- Fix hardcode localhost:3005, truyen24h.com -> truyen24h.vn helper
- Add vercel.json (cron daily) + GitHub Actions backup workflow
- Add SETUP_GUIDE.md, DEPLOY.md
"@
git commit -m $msg

Write-Host ""
Write-Host "==> Push lên GitHub (sẽ hỏi đăng nhập nếu cache trống)..." -ForegroundColor Cyan
git push -u origin main

Write-Host ""
Write-Host "==> ✅ XONG. Bây giờ:" -ForegroundColor Green
Write-Host "    1. Mở https://vercel.com → Add New Project → Import Horizon-PVT/truyen24h.vn"
Write-Host "    2. Khi đến bước Environment Variables, mở file .env.local rồi dùng nút Import .env của Vercel"
Write-Host "    3. Deploy"
Write-Host ""
