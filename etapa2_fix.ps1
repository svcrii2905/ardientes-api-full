$ErrorActionPreference = "Stop"
$backupCnfPath = "C:\ArdientesBackups\.my_backup.cnf"
$restoreCnfPath = "C:\ArdientesBackups\.my_restore.cnf"
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

# Read passwords securely
$secrets = Get-Content "C:\Users\Equipo\Music\ardientes appi\temp_secrets.json" | ConvertFrom-Json

# Recreate .cnf with host
@"
[client]
user="ardientes_backup"
password="$($secrets.ardientes_backup)"
host="127.0.0.1"
"@ | Set-Content $backupCnfPath -Encoding ASCII

@"
[client]
user="ardientes_restore"
password="$($secrets.ardientes_restore)"
host="127.0.0.1"
"@ | Set-Content $restoreCnfPath -Encoding ASCII

# Set ACLs
icacls $backupCnfPath /inheritance:r /grant:r "*S-1-5-32-544:(R)" "*S-1-5-18:(R)" /c /q > $null
icacls $restoreCnfPath /inheritance:r /grant:r "*S-1-5-32-544:(R)" "*S-1-5-18:(R)" /c /q > $null

# Grant temporary access for testing
icacls $backupCnfPath /grant "${currentUser}:(R)" /c /q > $null
icacls $restoreCnfPath /grant "${currentUser}:(R)" /c /q > $null

$mysqlExe = "C:\xampp\mysql\bin\mysql.exe"
$outBackup = & $mysqlExe --defaults-extra-file=$backupCnfPath -e "SELECT User, Host FROM mysql.user WHERE User='ardientes_backup';" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "Prueba de autenticacion ardientes_backup EXITOSA."
} else {
    Write-Host "Fallo autenticacion ardientes_backup:" $outBackup
}

$outRestore = & $mysqlExe --defaults-extra-file=$restoreCnfPath -e "SELECT User, Host FROM mysql.user WHERE User='ardientes_restore';" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "Prueba de autenticacion ardientes_restore EXITOSA."
} else {
    Write-Host "Fallo autenticacion ardientes_restore:" $outRestore
}

# Remove temporary access
icacls $backupCnfPath /remove $currentUser /c /q > $null
icacls $restoreCnfPath /remove $currentUser /c /q > $null

# Clean up script
Remove-Item $PSCommandPath -Force -ErrorAction SilentlyContinue
