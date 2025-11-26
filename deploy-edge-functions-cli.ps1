# ============================================
# Edge Functions 배포 스크립트 (Supabase CLI 사용)
# ============================================

param(
    [string]$FunctionName = "",
    [switch]$All
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Supabase Edge Functions 배포 스크립트 (CLI)" -ForegroundColor Cyan
Write-Host ""

# Supabase CLI 확인
$supabaseInstalled = Get-Command supabase -ErrorAction SilentlyContinue

if (-not $supabaseInstalled) {
    Write-Host "❌ Supabase CLI가 설치되어 있지 않습니다" -ForegroundColor Red
    Write-Host "  먼저 .\setup-supabase-cli.ps1을 실행하세요" -ForegroundColor Yellow
    exit 1
}

# Supabase 로그인 확인
Write-Host "🔐 Supabase 연결 확인 중..." -ForegroundColor Yellow
try {
    $null = supabase projects list 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ⚠️ Supabase에 로그인되지 않았습니다" -ForegroundColor Yellow
        Write-Host "  supabase login을 실행하세요" -ForegroundColor Gray
        exit 1
    }
} catch {
    Write-Host "  ⚠️ Supabase 연결 확인 실패" -ForegroundColor Yellow
    Write-Host "  supabase login을 실행하세요" -ForegroundColor Gray
    exit 1
}

# 배포할 함수 목록
$functions = @(
    "hourly-vph-updater",
    "daily-statistics-updater"
)

if ($FunctionName) {
    if ($functions -contains $FunctionName) {
        $functions = @($FunctionName)
    } else {
        Write-Host "❌ 알 수 없는 함수: $FunctionName" -ForegroundColor Red
        Write-Host "  사용 가능한 함수: $($functions -join ', ')" -ForegroundColor Gray
        exit 1
    }
} elseif (-not $All) {
    Write-Host "사용법:" -ForegroundColor Yellow
    Write-Host "  .\deploy-edge-functions-cli.ps1 -FunctionName hourly-vph-updater" -ForegroundColor Gray
    Write-Host "  .\deploy-edge-functions-cli.ps1 -All" -ForegroundColor Gray
    Write-Host ""
    Write-Host "배포할 함수를 선택하세요:" -ForegroundColor Yellow
    for ($i = 0; $i -lt $functions.Length; $i++) {
        Write-Host "  $($i + 1). $($functions[$i])" -ForegroundColor Gray
    }
    exit
}

# 프로젝트 연결 확인
Write-Host "🔗 프로젝트 연결 확인 중..." -ForegroundColor Yellow
$projectRef = "hteazdwvhjaexjxwiwwl"

# .supabase 폴더 확인
if (-not (Test-Path ".supabase")) {
    Write-Host "  프로젝트 연결 중..." -ForegroundColor Gray
    supabase link --project-ref $projectRef
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ 프로젝트 연결 실패" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# 각 함수 배포
foreach ($func in $functions) {
    Write-Host "📦 배포 중: $func" -ForegroundColor Green
    
    $functionPath = "supabase\functions\$func"
    
    if (-not (Test-Path $functionPath)) {
        Write-Host "  ❌ 함수 폴더를 찾을 수 없습니다: $functionPath" -ForegroundColor Red
        continue
    }
    
    try {
        # Supabase CLI로 배포
        supabase functions deploy $func --project-ref $projectRef
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ 배포 완료: $func" -ForegroundColor Green
        } else {
            Write-Host "  ❌ 배포 실패: $func" -ForegroundColor Red
        }
    } catch {
        Write-Host "  ❌ 배포 실패: $func" -ForegroundColor Red
        Write-Host "  에러: $($_.Exception.Message)" -ForegroundColor Red
        
        # Supabase Dashboard에서 수동 배포 안내
        Write-Host "  💡 Supabase Dashboard에서 수동으로 배포하세요:" -ForegroundColor Yellow
        Write-Host "     1. Dashboard → Edge Functions → $func" -ForegroundColor Gray
        Write-Host "     2. Code 탭에서 파일 내용 복사" -ForegroundColor Gray
        Write-Host "     3. Deploy 클릭" -ForegroundColor Gray
    }
    
    Write-Host ""
}

Write-Host "✨ 배포 프로세스 완료" -ForegroundColor Cyan
Write-Host ""
Write-Host "다음 단계:" -ForegroundColor Cyan
Write-Host "  .\test-edge-functions.ps1 -FunctionName hourly-vph-updater" -ForegroundColor Gray

