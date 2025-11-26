# ============================================
# Supabase CLI 설치 스크립트
# ============================================

$ErrorActionPreference = "Stop"

Write-Host "🔧 Supabase CLI 설치 스크립트" -ForegroundColor Cyan
Write-Host ""

# Supabase CLI 설치 확인
$supabaseInstalled = Get-Command supabase -ErrorAction SilentlyContinue

if ($supabaseInstalled) {
    Write-Host "✅ Supabase CLI가 이미 설치되어 있습니다" -ForegroundColor Green
    $version = supabase --version
    Write-Host "  버전: $version" -ForegroundColor Gray
    exit 0
}

Write-Host "📦 Supabase CLI 설치 중..." -ForegroundColor Yellow

# npm이 설치되어 있는지 확인
$npmInstalled = Get-Command npm -ErrorAction SilentlyContinue

if ($npmInstalled) {
    Write-Host "  npm을 사용하여 설치합니다..." -ForegroundColor Gray
    npm install -g supabase
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Supabase CLI 설치 완료" -ForegroundColor Green
        $version = supabase --version
        Write-Host "  버전: $version" -ForegroundColor Gray
    } else {
        Write-Host "❌ npm 설치 실패" -ForegroundColor Red
        Write-Host "  Scoop을 사용하여 설치를 시도합니다..." -ForegroundColor Yellow
        
        # Scoop 설치 확인
        $scoopInstalled = Get-Command scoop -ErrorAction SilentlyContinue
        if (-not $scoopInstalled) {
            Write-Host "  Scoop 설치 중..." -ForegroundColor Gray
            Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
            Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
        }
        
        # Supabase bucket 추가
        scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
        scoop install supabase
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Supabase CLI 설치 완료 (Scoop)" -ForegroundColor Green
        } else {
            Write-Host "❌ 설치 실패" -ForegroundColor Red
            Write-Host "  수동 설치: https://supabase.com/docs/guides/cli" -ForegroundColor Yellow
            exit 1
        }
    }
} else {
    Write-Host "⚠️ npm이 설치되어 있지 않습니다" -ForegroundColor Yellow
    Write-Host "  Scoop을 사용하여 설치를 시도합니다..." -ForegroundColor Yellow
    
    # Scoop 설치 확인
    $scoopInstalled = Get-Command scoop -ErrorAction SilentlyContinue
    if (-not $scoopInstalled) {
        Write-Host "  Scoop 설치 중..." -ForegroundColor Gray
        Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
        Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
    }
    
    # Supabase bucket 추가
    scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
    scoop install supabase
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Supabase CLI 설치 완료" -ForegroundColor Green
    } else {
        Write-Host "❌ 설치 실패" -ForegroundColor Red
        Write-Host "  수동 설치: https://supabase.com/docs/guides/cli" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host ""
Write-Host "✨ 설치 완료!" -ForegroundColor Green
Write-Host ""
Write-Host "다음 단계:" -ForegroundColor Cyan
Write-Host "  1. supabase login" -ForegroundColor Gray
Write-Host "  2. supabase link --project-ref hteazdwvhjaexjxwiwwl" -ForegroundColor Gray
Write-Host "  3. .\manage-edge-functions.ps1 -Action deploy -All" -ForegroundColor Gray

