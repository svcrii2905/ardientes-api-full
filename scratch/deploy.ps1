$svcName = "ArdientesPOS"
$appDir = "C:\Users\Equipo\Music\ardientes appi"
$newExe = Join-Path $appDir "ardientes-pos-NEW.exe"
$targetExe = Join-Path $appDir "ardientes-pos.exe"

Write-Host "Stopping service $svcName..."
Stop-Service -Name $svcName -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

Write-Host "Replacing $targetExe with $newExe..."
Copy-Item -Path $newExe -Destination $targetExe -Force

Write-Host "Starting service $svcName..."
Start-Service -Name $svcName
Start-Sleep -Seconds 3

$svc = Get-Service -Name $svcName
Write-Host "Service State: $($svc.Status)"
