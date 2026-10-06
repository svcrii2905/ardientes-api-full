$dir = "C:\Users\Equipo\Music\ardientes appi"
$log = "$dir\replace_exe_result.txt"

try {
    Set-Content $log "=== INICIO ELEVADO: $(Get-Date) ===`n"

    # 1. Backup de seguridad obligatorio
    $backupName = "$dir\ardientes-pos.exe.pre-payment-fix-20260917-0916.bak"
    if (-not (Test-Path $backupName)) {
        Copy-Item "$dir\ardientes-pos.exe" $backupName -Force
        Add-Content $log "Backup creado: $backupName"
    } else {
        Add-Content $log "Backup ya existe: $backupName"
    }

    # 2. Detener servicio ArdientesPOS
    Add-Content $log "Deteniendo servicio ArdientesPOS..."
    $result = & sc.exe stop ArdientesPOS
    Add-Content $log "sc stop resultado: $result"
    Start-Sleep -Seconds 5

    $svc = Get-Service -Name "ArdientesPOS" -ErrorAction SilentlyContinue
    Add-Content $log "Estado post-stop: $($svc.Status)"

    if ($svc.Status -ne "Stopped") {
        $pidProc = Get-Process -Name "ardientes-pos" -ErrorAction SilentlyContinue
        if ($pidProc) {
            Add-Content $log "Forzando cierre de PID: $($pidProc.Id)"
            Stop-Process -Id $pidProc.Id -Force
            Start-Sleep -Seconds 3
        }
    }

    # 3. Reemplazar ardientes-pos.exe por ardientes-pos-NEW.exe
    Add-Content $log "Reemplazando ardientes-pos.exe con ardientes-pos-NEW.exe..."
    Copy-Item "$dir\ardientes-pos-NEW.exe" "$dir\ardientes-pos.exe" -Force
    Add-Content $log "Reemplazo OK"

    # 4. Verificar ejecutable resultante
    $newExe = Get-Item "$dir\ardientes-pos.exe"
    Add-Content $log "NUEVO EXE: $($newExe.LastWriteTime) | Length: $($newExe.Length) bytes"

    # 5. Iniciar servicio ArdientesPOS
    Add-Content $log "Iniciando servicio ArdientesPOS..."
    $result2 = & sc.exe start ArdientesPOS
    Add-Content $log "sc start resultado: $result2"
    Start-Sleep -Seconds 5

    $svcAfter = Get-Service -Name "ArdientesPOS" -ErrorAction SilentlyContinue
    Add-Content $log "Estado post-start: $($svcAfter.Status)"

    Add-Content $log "=== FIN ELEVADO OK: $(Get-Date) ==="
} catch {
    Add-Content $log "ERROR: $_"
    Add-Content $log "=== FIN CON ERROR: $(Get-Date) ==="
}
