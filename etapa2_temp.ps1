$ErrorActionPreference = "Stop"
$backupCnfPath = "C:\ArdientesBackups\.test_backup.cnf"
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

$secrets = Get-Content "C:\Users\Equipo\Music\ardientes appi\temp_secrets.json" | ConvertFrom-Json

@"
[client]
user="ardientes_backup"
password="$($secrets.ardientes_backup)"
host="127.0.0.1"
"@ | Set-Content $backupCnfPath -Encoding ASCII

# Temporary permission for the test
icacls $backupCnfPath /inheritance:r /grant:r "${currentUser}:(R)" /c /q > $null

$mysqlExe = "C:\xampp\mysql\bin\mysql.exe"
$outBackup = & $mysqlExe --defaults-extra-file=$backupCnfPath -e "SELECT User, Host FROM mysql.user WHERE User='ardientes_backup';" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "Prueba de autenticacion ardientes_backup EXITOSA."
    Write-Host $outBackup
} else {
    Write-Host "Fallo autenticacion ardientes_backup:" $outBackup
}

Remove-Item $backupCnfPath -Force -ErrorAction SilentlyContinue
Remove-Item $PSCommandPath -Force -ErrorAction SilentlyContinue
