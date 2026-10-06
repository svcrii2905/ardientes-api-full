$env:PORT=8005
$proc = Start-Process -FilePath "C:\Users\Equipo\Music\ardientes appi\bcrypt_test.exe" -WorkingDirectory "C:\Users\Equipo\Music\ardientes appi" -PassThru -NoNewWindow
Start-Sleep -Seconds 3

Write-Host "--- HEALTH ---"
curl.exe -s -i http://127.0.0.1:8005/health

Write-Host "--- LOGIN ---"
$body = '{"username":"admin","password":"password"}'
try {
    $response = Invoke-WebRequest -Method Post -Uri "http://127.0.0.1:8005/api/v1/auth/login" -Body $body -ContentType "application/json" -UseBasicParsing
    Write-Host "SUCCESS:"
    Write-Host $response.Content
} catch {
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $content = $reader.ReadToEnd()
        Write-Host "STATUS: $($_.Exception.Response.StatusCode.value__)"
        Write-Host "CONTENT: $content"
    } else {
        Write-Host "CRASH: No response received. $($_.Exception.Message)"
    }
}

Write-Host "--- PROCESS STATUS ---"
if (!$proc.HasExited) {
    Write-Host "PROCESS IS STILL ALIVE"
    Stop-Process -Id $proc.Id -Force
} else {
    Write-Host "PROCESS EXITED WITH CODE: $($proc.ExitCode)"
}
