# Скрипт для проверки размеров иконки
# Запустите: powershell -ExecutionPolicy Bypass -File check-icon.ps1

$iconPath = "build\icon.ico"

if (-not (Test-Path $iconPath)) {
    Write-Host "Файл $iconPath не найден!" -ForegroundColor Red
    exit 1
}

Write-Host "Проверка иконки: $iconPath" -ForegroundColor Green
Write-Host ""

# Используем .NET для чтения иконки
Add-Type -AssemblyName System.Drawing

try {
    $icon = [System.Drawing.Icon]::FromHandle((New-Object System.Drawing.Icon($iconPath)).Handle)
    $iconSize = $icon.Size
    
    Write-Host "Размер иконки: $($iconSize.Width)x$($iconSize.Height)" -ForegroundColor Yellow
    
    # Пробуем загрузить иконку и проверить доступные размеры
    $iconFile = New-Object System.Drawing.Icon($iconPath)
    
    Write-Host ""
    Write-Host "Проверка доступных размеров:" -ForegroundColor Cyan
    
    # Проверяем стандартные размеры
    $requiredSizes = @(16, 32, 48, 256)
    $foundSizes = @()
    
    foreach ($size in $requiredSizes) {
        try {
            # Пробуем создать иконку нужного размера
            $testIcon = New-Object System.Drawing.Icon($iconPath, $size, $size)
            if ($testIcon -ne $null) {
                $foundSizes += $size
                Write-Host "  ✓ $size x $size - найден" -ForegroundColor Green
            }
        } catch {
            Write-Host "  ✗ $size x $size - не найден" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    if ($foundSizes.Count -eq $requiredSizes.Count) {
        Write-Host "✓ Все необходимые размеры присутствуют!" -ForegroundColor Green
    } else {
        Write-Host "✗ Отсутствуют некоторые размеры!" -ForegroundColor Red
        Write-Host "  Найдено: $($foundSizes -join ', ')" -ForegroundColor Yellow
        Write-Host "  Требуется: $($requiredSizes -join ', ')" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "Ошибка при чтении иконки: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Попробуйте использовать другой способ проверки:" -ForegroundColor Yellow
    Write-Host "1. Откройте файл в проводнике Windows" -ForegroundColor White
    Write-Host "2. Используйте онлайн-инструмент: https://www.icoconverter.com/" -ForegroundColor White
    Write-Host "3. Используйте программу IcoFX: https://icofx.ro/" -ForegroundColor White
}

