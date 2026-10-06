$env:PORT=8005
$proc = Start-Process -FilePath "C:\Users\Equipo\Music\ardientes appi\bcrypt_test.exe" -WorkingDirectory "C:\Users\Equipo\Music\ardientes appi" -PassThru -NoNewWindow
Start-Sleep -Seconds 3
Write-Host "CURL HEALTH 8005"
curl.exe -s -i http://127.0.0.1:8005/health
Write-Host "CURL LOGIN 8005"
curl.exe -s -i -X POST http://127.0.0.1:8005/api/v1/auth/login -H "Content-Type: application/json" -d "{`"username`":`"admin`",`"password`":`"password`"}"
Stop-Process -Id $proc.Id -Force
