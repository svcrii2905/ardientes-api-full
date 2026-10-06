$login = curl.exe -s -i -X POST http://127.0.0.1:8000/api/v1/auth/login -H "Content-Type: application/json" -d "{`"username`":`"fake`",`"password`":`"fake`"}"
Write-Host "LOGIN RESPONSE:"
Write-Host $login
