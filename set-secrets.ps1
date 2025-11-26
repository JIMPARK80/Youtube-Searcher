# Supabase Edge Function Secrets 설정 스크립트
# 사용법: .\set-secrets.ps1

Write-Host "🔐 Supabase Edge Function Secrets 설정" -ForegroundColor Cyan
Write-Host ""

# YouTube API 키 입력 요청
$youtubeApiKey = Read-Host "YouTube API 키를 입력하세요 (config 테이블에 저장된 키)"

if ([string]::IsNullOrWhiteSpace($youtubeApiKey)) {
    Write-Host "❌ YouTube API 키가 입력되지 않았습니다." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📝 Secrets 설정 중..." -ForegroundColor Yellow

# YOUTUBE_DATA_API_KEY 설정
npx supabase secrets set "YOUTUBE_DATA_API_KEY=$youtubeApiKey"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Secrets 설정 완료!" -ForegroundColor Green
    Write-Host ""
    Write-Host "설정된 Secrets:" -ForegroundColor Cyan
    npx supabase secrets list
} else {
    Write-Host ""
    Write-Host "❌ Secrets 설정 실패" -ForegroundColor Red
    exit 1
}

