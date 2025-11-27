# System Status Check Script
# 자동으로 시스템 상태를 확인하는 스크립트

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   System Status Check" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# 1. Edge Functions 확인
Write-Host "1. Edge Functions Status:" -ForegroundColor Yellow
try {
    $functions = supabase functions list 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] Edge Functions are deployed" -ForegroundColor Green
        $functions | Select-String -Pattern "hourly-vph-updater|daily-statistics-updater|search-keyword-updater" | ForEach-Object {
            Write-Host "   - $_" -ForegroundColor Gray
        }
    } else {
        Write-Host "   [WARNING] Could not check Edge Functions" -ForegroundColor Yellow
        Write-Host "   Please check manually in Supabase Dashboard" -ForegroundColor Gray
    }
} catch {
    Write-Host "   [ERROR] Failed to check Edge Functions" -ForegroundColor Red
    Write-Host "   Error: $_" -ForegroundColor Gray
}

Write-Host "`n2. Manual Checks Required (Supabase Dashboard):" -ForegroundColor Yellow
Write-Host "   Run these SQL queries in Supabase SQL Editor:`n" -ForegroundColor Gray

Write-Host "   A. Cron Jobs Check:" -ForegroundColor Cyan
Write-Host "   SELECT jobname, schedule, active" -ForegroundColor White
Write-Host "   FROM cron.job" -ForegroundColor White
Write-Host "   WHERE jobname IN ('hourly-vph-updater', 'daily-statistics-updater', 'search-keyword-updater');`n" -ForegroundColor White

Write-Host "   B. Search Keywords Check:" -ForegroundColor Cyan
Write-Host "   SELECT key, jsonb_array_length(value) as keyword_count" -ForegroundColor White
Write-Host "   FROM config" -ForegroundColor White
Write-Host "   WHERE key = 'searchKeywords';`n" -ForegroundColor White

Write-Host "   C. All-in-One Check:" -ForegroundColor Cyan
Write-Host "   See FINAL_SETUP_GUIDE.md for the complete SQL query`n" -ForegroundColor White

Write-Host "3. Secrets Check:" -ForegroundColor Yellow
Write-Host "   Please check in Supabase Dashboard:" -ForegroundColor Gray
Write-Host "   - Edge Functions -> Secrets tab" -ForegroundColor Gray
Write-Host "   Required: YOUTUBE_DATA_API_KEY, SR_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY), SUPABASE_URL`n" -ForegroundColor Gray

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Check Complete!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "For detailed setup instructions, see:" -ForegroundColor Yellow
Write-Host "  - FINAL_SETUP_GUIDE.md" -ForegroundColor White
Write-Host "  - README-EDGE-FUNCTIONS.md`n" -ForegroundColor White

