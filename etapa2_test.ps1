$ErrorActionPreference = "Stop"

$backupCnfPath = "C:\ArdientesBackups\.my_backup.cnf"
$restoreCnfPath = "C:\ArdientesBackups\.my_restore.cnf"
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

# Conceder acceso temporal al usuario actual para la validación
icacls $backupCnfPath /grant "${currentUser}:(R)" /c /q > $null
icacls $restoreCnfPath /grant "${currentUser}:(R)" /c /q > $null

# Prueba de conexión backup
$mysqlExe = "C:\xampp\mysql\bin\mysql.exe"
$outBackup = & $mysqlExe --defaults-extra-file=$backupCnfPath -e "SELECT User, Host FROM mysql.user WHERE User='ardientes_backup';" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "Prueba de autenticacion ardientes_backup EXITOSA."
} else {
    Write-Host "Fallo autenticacion ardientes_backup:" $outBackup
}

# Prueba de conexión restore
$outRestore = & $mysqlExe --defaults-extra-file=$restoreCnfPath -e "SELECT User, Host FROM mysql.user WHERE User='ardientes_restore';" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "Prueba de autenticacion ardientes_restore EXITOSA."
} else {
    Write-Host "Fallo autenticacion ardientes_restore:" $outRestore
}

# Revocar el acceso del usuario actual, dejando solo SYSTEM y Administrators
icacls $backupCnfPath /remove $currentUser /c /q > $null
icacls $restoreCnfPath /remove $currentUser /c /q > $null

Write-Host "ETAPA 2 Completada."
