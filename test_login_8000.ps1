$body = '{"username":"admin","password":"password"}'
try {
    $response = Invoke-WebRequest -Method Post -Uri "http://127.0.0.1:8000/api/v1/auth/login" -Body $body -ContentType "application/json" -UseBasicParsing
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
