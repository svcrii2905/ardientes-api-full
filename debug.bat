
setlocal EnableDelayedExpansion

:: Configuración
set DB_USER=root
set DB_NAME=ardientes_pos
set BACKUP_DIR=C:\ArdientesBackups
set LOG_FILE=%BACKUP_DIR%\backup_log.txt
set MYSQLDUMP_PATH=C:\xampp\mysql\bin\mysqldump.exe

:: Obtener timestamp independiente de configuracion regional
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set mydate=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%
set mytime=%datetime:~8,2%%datetime:~10,2%%datetime:~12,2%
set FILENAME=backup_%DB_NAME%_%mydate%_%mytime%.sql
set FILEPATH=%BACKUP_DIR%\%FILENAME%

echo [%date% %time%] Iniciando backup de %DB_NAME%... >> "%LOG_FILE%"

:: Ejecutar mysqldump
"%MYSQLDUMP_PATH%" -u %DB_USER% %DB_NAME% > "%FILEPATH%" 2>> "%LOG_FILE%"
set DUMP_ERROR=%ERRORLEVEL%

if %DUMP_ERROR% neq 0 (
    echo [%date% %time%] [ERROR] mysqldump fallo con codigo %DUMP_ERROR%. >> "%LOG_FILE%"
    echo [ERROR] Backup fallido. Revisa %LOG_FILE%.
    exit /b %DUMP_ERROR%
)

:: Verificar que el archivo existe
if not exist "%FILEPATH%" (
    echo [%date% %time%] [ERROR] El archivo de backup no se genero. >> "%LOG_FILE%"
    echo [ERROR] Archivo no generado.
    exit /b 1
)

:: Verificar tamaño > 0
for %%A in ("%FILEPATH%") do set FILESIZE=%%~zA
if %FILESIZE% equ 0 (
    echo [%date% %time%] [ERROR] El archivo de backup generado esta vacio (0 bytes). >> "%LOG_FILE%"
    del "%FILEPATH%"
    echo [ERROR] Archivo generado vacio.
    exit /b 1
)

echo [%date% %time%] [EXITO] Backup creado correctamente: %FILENAME% (Tamano: %FILESIZE% bytes) >> "%LOG_FILE%"
echo [EXITO] Backup creado correctamente: %FILENAME%

:: Rotación de 14 días
echo [%date% %time%] [INFO] Ejecutando rotacion de backups antiguos (14 dias)... >> "%LOG_FILE%"
forfiles /p "%BACKUP_DIR%" /m *.sql /d -14 /c "cmd /c del @path" 2> NUL

exit /b 0
