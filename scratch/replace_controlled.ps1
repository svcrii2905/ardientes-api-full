$dir = "c:\Users\Equipo\Music\ardientes appi"

Write-Host "1. Deteniendo servicio ArdientesPOS..."
& sc.exe stop ArdientesPOS
Start-Sleep -Seconds 4

$proc = Get-Process -Name "ardientes-pos" -ErrorAction SilentlyContinue
if ($proc) {
    Write-Host "Deteniendo proceso ardientes-pos (PID $($proc.Id))..."
    Stop-Process -Id $proc.Id -Force
    Start-Sleep -Seconds 2
}

Write-Host "2. Reemplazando ardientes-pos.exe con ardientes-pos-NEW.exe..."
Copy-Item "$dir\ardientes-pos-NEW.exe" "$dir\ardientes-pos.exe" -Force

Write-Host "3. Iniciando servicio ArdientesPOS..."
& sc.exe start ArdientesPOS
Start-Sleep -Seconds 5

Write-Host "4. Verificaciones:"
Get-Service -Name "ArdientesPOS"
Get-Process -Name "ardientes-pos" -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, StartTime
Get-Item "$dir\ardientes-pos.exe" | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize
