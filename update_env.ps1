$ErrorActionPreference = "Stop"

$secrets = Get-Content "C:\Users\Equipo\Music\ardientes appi\temp_secrets.json" | ConvertFrom-Json
$envPath = "C:\Users\Equipo\Music\ardientes appi\.env"
$envLines = Get-Content $envPath

$newEnv = @()
foreach ($line in $envLines) {
    if ($line -match "^DB_USERNAME=") {
        $newEnv += "DB_USERNAME=ardientes_app"
    } elseif ($line -match "^DB_PASSWORD=") {
        $newEnv += "DB_PASSWORD=`"$($secrets.ardientes_app)`""
    } elseif ($line -match "^DB_HOSTNAME=") {
        $newEnv += "DB_HOSTNAME=127.0.0.1"
    } else {
        $newEnv += $line
    }
}

$newEnv | Set-Content $envPath
Write-Host ".env actualizado exitosamente con ardientes_app."
