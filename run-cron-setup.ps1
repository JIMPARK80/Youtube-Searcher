# Supabase Cron 작업 설정 스크립트
# 이 스크립트는 Supabase Dashboard SQL Editor를 열어줍니다

Write-Host "🔧 Supabase Cron 작업 설정" -ForegroundColor Cyan
Write-Host ""

# SQL 파일 읽기
$sqlFile = "supabase\cron.sql"
if (-not (Test-Path $sqlFile)) {
    Write-Host "❌ $sqlFile 파일을 찾을 수 없습니다." -ForegroundColor Red
    exit 1
}

$sqlContent = Get-Content $sqlFile -Raw

Write-Host "📋 SQL 내용:" -ForegroundColor Yellow
Write-Host $sqlContent
Write-Host ""

Write-Host "다음 단계:" -ForegroundColor Green
Write-Host "1. 위 SQL 내용을 복사하세요" -ForegroundColor White
Write-Host "2. Supabase Dashboard → SQL Editor 접속" -ForegroundColor White
Write-Host "   https://supabase.com/dashboard/project/hteazdwvhjaexjxwiwwl/sql/new" -ForegroundColor Cyan
Write-Host "3. SQL Editor에 붙여넣기" -ForegroundColor White
Write-Host "4. Run 버튼 클릭" -ForegroundColor White
Write-Host ""

# 클립보드에 복사 시도
try {
    $sqlContent | Set-Clipboard
    Write-Host "✅ SQL 내용이 클립보드에 복사되었습니다!" -ForegroundColor Green
    Write-Host "   이제 Supabase Dashboard SQL Editor에 붙여넣기만 하면 됩니다." -ForegroundColor White
} catch {
    Write-Host "⚠️ 클립보드 복사 실패. 수동으로 복사하세요." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "브라우저를 열까요? (Y/N)" -ForegroundColor Yellow
$response = Read-Host

if ($response -eq 'Y' -or $response -eq 'y') {
    Start-Process "https://supabase.com/dashboard/project/hteazdwvhjaexjxwiwwl/sql/new"
    Write-Host "Browser opened. Paste SQL and click Run button." -ForegroundColor Green
}

