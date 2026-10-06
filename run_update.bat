@echo off
sc stop ArdientesPOS
timeout /t 3 /nobreak
taskkill /f /im ardientes-pos.exe
timeout /t 2 /nobreak
copy /y "C:\Users\Equipo\Music\ardientes appi\ardientes-pos-NEW.exe" "C:\Users\Equipo\Music\ardientes appi\ardientes-pos.exe"
sc start ArdientesPOS
