$env:PORT=8006
$proc = Start-Process -FilePath "deno" -ArgumentList "run -A src/main.ts" -WorkingDirectory "C:\Users\Equipo\Music\ardientes appi" -PassThru -NoNewWindow
Start-Sleep -Seconds 3
Write-Host "CURL HEALTH"
curl.exe -s -i http://127.0.0.1:8006/health
Write-Host "CURL LOGIN"
curl.exe -s -i -X POST http://127.0.0.1:8006/api/v1/auth/login -H "Content-Type: application/json" -d "{`"username`":`"admin`",`"password`":`"password`"}"
Stop-Process -Id $proc.Id -Force
