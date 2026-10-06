$env:PORT=8006
$proc = Start-Process -FilePath "C:\Users\Equipo\Music\ardientes appi\bcrypt_test_final.exe" -WorkingDirectory "C:\Users\Equipo\Music\ardientes appi" -PassThru -NoNewWindow
Start-Sleep -Seconds 3

deno run -A test_endpoints.ts

Stop-Process -Id $proc.Id -Force
