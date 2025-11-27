# ============================================
# Edge Functions 관리 스크립트
# Supabase Edge Functions를 배포, 테스트, 관리합니다
# ============================================

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("deploy", "test", "list", "logs", "help")]
    [string]$Action = "help",
    
    [Parameter(Mandatory=$false)]
    [string]$FunctionName = "",
    
    [Parameter(Mandatory=$false)]
    [switch]$All
)

$ErrorActionPreference = "Stop"

# Supabase 프로젝트 정보
$SUPABASE_URL = "https://hteazdwvhjaexjxwiwwl.supabase.co"
$SERVICE_ROLE_KEY = "sb_secret_VmXybwYRcz3g_2J71eGQDw_t82PMoOZ"

# 사용 가능한 함수 목록
$AVAILABLE_FUNCTIONS = @(
    "hourly-vph-updater",
    "daily-statistics-updater"
)

# ============================================
# 함수: 도움말 표시
# ============================================
function Show-Help {
    Write-Host "🚀 Supabase Edge Functions 관리 스크립트" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "사용법:" -ForegroundColor Yellow
    Write-Host "  .\manage-edge-functions.ps1 -Action <action> [-FunctionName <name>] [-All]" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Actions:" -ForegroundColor Yellow
    Write-Host "  deploy  - Edge Function 배포" -ForegroundColor Gray
    Write-Host "  test    - Edge Function 테스트" -ForegroundColor Gray
    Write-Host "  list    - 사용 가능한 함수 목록" -ForegroundColor Gray
    Write-Host "  logs    - 함수 로그 확인 (Dashboard 링크)" -ForegroundColor Gray
    Write-Host "  help    - 이 도움말 표시" -ForegroundColor Gray
    Write-Host ""
    Write-Host "예제:" -ForegroundColor Yellow
    Write-Host "  .\manage-edge-functions.ps1 -Action deploy -FunctionName hourly-vph-updater" -ForegroundColor Gray
    Write-Host "  .\manage-edge-functions.ps1 -Action deploy -All" -ForegroundColor Gray
    Write-Host "  .\manage-edge-functions.ps1 -Action test -FunctionName daily-statistics-updater" -ForegroundColor Gray
    Write-Host "  .\manage-edge-functions.ps1 -Action list" -ForegroundColor Gray
    Write-Host ""
}

# ============================================
# 함수: 함수 목록 표시
# ============================================
function Show-FunctionList {
    Write-Host "📋 사용 가능한 Edge Functions:" -ForegroundColor Cyan
    Write-Host ""
    for ($i = 0; $i -lt $AVAILABLE_FUNCTIONS.Length; $i++) {
        $func = $AVAILABLE_FUNCTIONS[$i]
        $path = "supabase\functions\$func\index.ts"
        $exists = Test-Path $path
        if ($exists) {
            $status = "✅"
            $color = "Green"
        } else {
            $status = "❌"
            $color = "Red"
        }
        Write-Host "  $($i + 1). $status $func" -ForegroundColor $color
    }
    Write-Host ""
}

# ============================================
# 함수: Edge Function 배포
# ============================================
function Deploy-Function {
    param([string]$FunctionName)
    
    Write-Host "📦 배포 중: $FunctionName" -ForegroundColor Green
    
    $functionPath = "supabase\functions\$FunctionName"
    
    if (-not (Test-Path $functionPath)) {
        Write-Host "  ❌ 함수 폴더를 찾을 수 없습니다: $functionPath" -ForegroundColor Red
        return $false
    }
    
    # Supabase CLI 확인
    $supabaseInstalled = Get-Command supabase -ErrorAction SilentlyContinue
    
    if (-not $supabaseInstalled) {
        Write-Host "  ❌ Supabase CLI가 설치되어 있지 않습니다" -ForegroundColor Red
        Write-Host "  먼저 .\setup-supabase-cli.ps1을 실행하세요" -ForegroundColor Yellow
        return $false
    }
    
    # Supabase 로그인 확인
    try {
        $null = supabase projects list 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ⚠️ Supabase에 로그인되지 않았습니다" -ForegroundColor Yellow
            Write-Host "  supabase login을 실행하세요" -ForegroundColor Gray
            return $false
        }
    } catch {
        Write-Host "  ⚠️ Supabase 연결 확인 실패" -ForegroundColor Yellow
        Write-Host "  supabase login을 실행하세요" -ForegroundColor Gray
        return $false
    }
    
    # 프로젝트 연결 확인
    $projectRef = "hteazdwvhjaexjxwiwwl"
    if (-not (Test-Path ".supabase")) {
        Write-Host "  프로젝트 연결 중..." -ForegroundColor Gray
        supabase link --project-ref $projectRef
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ❌ 프로젝트 연결 실패" -ForegroundColor Red
            return $false
        }
    }
    
    try {
        # Supabase CLI로 배포
        Write-Host "  배포 실행 중..." -ForegroundColor Gray
        supabase functions deploy $FunctionName --project-ref $projectRef
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ 배포 완료: $FunctionName" -ForegroundColor Green
            return $true
        } else {
            Write-Host "  ❌ 배포 실패: $FunctionName" -ForegroundColor Red
            Write-Host ""
            Write-Host "  💡 Supabase Dashboard에서 수동으로 배포하세요:" -ForegroundColor Yellow
            Write-Host "     1. Dashboard 열기: https://supabase.com/dashboard/project/hteazdwvhjaexjxwiwwl/functions" -ForegroundColor Gray
            Write-Host "     2. '$FunctionName' 함수 선택" -ForegroundColor Gray
            Write-Host "     3. Code 탭 클릭" -ForegroundColor Gray
            Write-Host "     4. $functionPath\index.ts 파일 내용 복사하여 붙여넣기" -ForegroundColor Gray
            Write-Host "     5. Deploy 버튼 클릭" -ForegroundColor Gray
            return $false
        }
    } catch {
        Write-Host "  ❌ 배포 실패: $FunctionName" -ForegroundColor Red
        Write-Host "  에러: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        Write-Host "  💡 Supabase Dashboard에서 수동으로 배포하세요:" -ForegroundColor Yellow
        Write-Host "     1. Dashboard 열기: https://supabase.com/dashboard/project/hteazdwvhjaexjxwiwwl/functions" -ForegroundColor Gray
        Write-Host "     2. '$FunctionName' 함수 선택" -ForegroundColor Gray
        Write-Host "     3. Code 탭 클릭" -ForegroundColor Gray
        Write-Host "     4. $functionPath\index.ts 파일 내용 복사하여 붙여넣기" -ForegroundColor Gray
        Write-Host "     5. Deploy 버튼 클릭" -ForegroundColor Gray
        return $false
    }
}

# ============================================
# 함수: Edge Function 테스트
# ============================================
function Test-Function {
    param([string]$FunctionName)
    
    Write-Host "🧪 테스트 중: $FunctionName" -ForegroundColor Cyan
    Write-Host ""
    
    $functionUrl = "$SUPABASE_URL/functions/v1/$FunctionName"
    
    Write-Host "📡 요청 URL: $functionUrl" -ForegroundColor Gray
    Write-Host ""
    
    # Headers 설정
    $headers = @{
        "Authorization" = "Bearer $SERVICE_ROLE_KEY"
        "Content-Type" = "application/json"
    }
    
    # Request Body (빈 JSON)
    $body = @{} | ConvertTo-Json
    
    try {
        Write-Host "⏳ 함수 호출 중..." -ForegroundColor Yellow
        
        $response = Invoke-RestMethod -Uri $functionUrl -Method Post -Headers $headers -Body $body -ErrorAction Stop
        
        Write-Host "✅ 성공!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📋 응답:" -ForegroundColor Cyan
        $response | ConvertTo-Json -Depth 10 | Write-Host
        
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $statusDescription = $_.Exception.Response.StatusDescription
        
        Write-Host "❌ 실패!" -ForegroundColor Red
        Write-Host "  상태 코드: $statusCode" -ForegroundColor Red
        Write-Host "  설명: $statusDescription" -ForegroundColor Red
        
        # 에러 응답 본문 읽기
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "  응답 본문: $responseBody" -ForegroundColor Red
        } catch {
            Write-Host "  응답 본문을 읽을 수 없습니다" -ForegroundColor Yellow
        }
        
        Write-Host ""
        Write-Host "💡 해결 방법:" -ForegroundColor Yellow
        Write-Host "  1. Edge Function이 배포되었는지 확인" -ForegroundColor Gray
        Write-Host "  2. 환경 변수가 설정되었는지 확인 (Secrets)" -ForegroundColor Gray
        Write-Host "  3. Logs 탭에서 에러 로그 확인: https://supabase.com/dashboard/project/hteazdwvhjaexjxwiwwl/functions/$FunctionName/logs" -ForegroundColor Gray
    }
    
    Write-Host ""
}

# ============================================
# 함수: 로그 링크 표시
# ============================================
function Show-LogsLink {
    param([string]$FunctionName)
    
    if ($FunctionName) {
        $url = "https://supabase.com/dashboard/project/hteazdwvhjaexjxwiwwl/functions/$FunctionName/logs"
        Write-Host "📊 $FunctionName 로그:" -ForegroundColor Cyan
        Write-Host "  $url" -ForegroundColor Blue
    } else {
        Write-Host "📊 모든 함수 로그:" -ForegroundColor Cyan
        foreach ($func in $AVAILABLE_FUNCTIONS) {
            $url = "https://supabase.com/dashboard/project/hteazdwvhjaexjxwiwwl/functions/$func/logs"
            Write-Host "  $func : $url" -ForegroundColor Blue
        }
    }
    Write-Host ""
}

# ============================================
# 메인 로직
# ============================================

switch ($Action) {
    "help" {
        Show-Help
    }
    "list" {
        Show-FunctionList
    }
    "deploy" {
        if ($All) {
            Write-Host "🚀 모든 Edge Functions 배포" -ForegroundColor Cyan
            Write-Host ""
            foreach ($func in $AVAILABLE_FUNCTIONS) {
                Deploy-Function -FunctionName $func
                Write-Host ""
            }
        } elseif ($FunctionName) {
            if ($AVAILABLE_FUNCTIONS -contains $FunctionName) {
                Deploy-Function -FunctionName $FunctionName
            } else {
                Write-Host "❌ 알 수 없는 함수: $FunctionName" -ForegroundColor Red
                Show-FunctionList
            }
        } else {
            Write-Host "❌ 함수 이름을 지정하거나 -All 플래그를 사용하세요" -ForegroundColor Red
            Write-Host ""
            Show-FunctionList
        }
    }
    "test" {
        if ($All) {
            Write-Host "🧪 모든 Edge Functions 테스트" -ForegroundColor Cyan
            Write-Host ""
            foreach ($func in $AVAILABLE_FUNCTIONS) {
                Test-Function -FunctionName $func
                Write-Host ""
            }
        } elseif ($FunctionName) {
            if ($AVAILABLE_FUNCTIONS -contains $FunctionName) {
                Test-Function -FunctionName $FunctionName
            } else {
                Write-Host "❌ 알 수 없는 함수: $FunctionName" -ForegroundColor Red
                Show-FunctionList
            }
        } else {
            Write-Host "❌ 함수 이름을 지정하거나 -All 플래그를 사용하세요" -ForegroundColor Red
            Write-Host ""
            Show-FunctionList
        }
    }
    "logs" {
        Show-LogsLink -FunctionName $FunctionName
    }
    default {
        Show-Help
    }
}

