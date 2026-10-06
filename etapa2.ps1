$ErrorActionPreference = "Stop"

$secretsPath = "C:\Users\Equipo\Music\ardientes appi\temp_secrets.json"
if (-not (Test-Path $secretsPath)) {
    Write-Error "El archivo de secretos no existe."
    exit 1
}

$secrets = Get-Content $secretsPath | ConvertFrom-Json
$backupPass = $secrets.ardientes_backup
$restorePass = $secrets.ardientes_restore

$backupCnfPath = "C:\ArdientesBackups\.my_backup.cnf"
$restoreCnfPath = "C:\ArdientesBackups\.my_restore.cnf"

# Crear archivos
@"
[client]
user="ardientes_backup"
password="$backupPass"
"@ | Set-Content $backupCnfPath -Encoding ASCII

@"
[client]
user="ardientes_restore"
password="$restorePass"
"@ | Set-Content $restoreCnfPath -Encoding ASCII

Write-Host "Archivos .cnf creados."

# Aplicar ACLs
foreach ($file in @($backupCnfPath, $restoreCnfPath)) {
    # Quitar herencia y copiar permisos existentes
    icacls $file /inheritance:r /grant:r "Administrators:(R)" "SYSTEM:(R)" /c /q > $null
    # Opcionalmente en Windows en español, el grupo puede llamarse "Administradores"
    # Para ser agnósticos del idioma usamos el SID de Administrators y SYSTEM
    # SID Administrators: *S-1-5-32-544
    # SID SYSTEM: *S-1-5-18
    icacls $file /inheritance:r /grant:r "*S-1-5-32-544:(R)" "*S-1-5-18:(R)" /c /q > $null
    
    # Validar permisos
    $acl = Get-Acl $file
    Write-Host "Permisos aplicados a $file :"
    $acl.Access | ForEach-Object { Write-Host " - $($_.IdentityReference): $($_.FileSystemRights)" }
}

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

Write-Host "ETAPA 2 Completada."
