# PLAN B1 — DISEÑO DEL SISTEMA DE BACKUPS (ARDIENTES POS)

## 1. OBJETIVOS
Diseñar una estrategia segura y automatizada para respaldar la base de datos de Ardientes POS, con retención de 14 días, directorio exclusivo (`C:\ArdientesBackups`), scripts defensivos y un sistema de restauración manual protegido. Todo operando sobre el stack actual (XAMPP MySQL).

## 2. MEJORA DEL SCRIPT DE BACKUP (`backup_db.bat`)

El script actual será reescrito completamente para ser robusto. La nueva versión implementará:

- **Rutas absolutas:** Uso explícito de `C:\xampp\mysql\bin\mysqldump.exe` para no depender del `%PATH%` de Windows.
- **Credenciales seguras:** Se empleará un archivo de opciones temporal o la configuración nativa de MySQL (`my.ini` extra config o `mysql_config_editor`) si eventualmente se agrega password, evitando pasarlo por argumento `-p`. Por ahora, se mantendrá `root` sin password, conectándose localmente.
- **Verificación de éxito:** Tras correr `mysqldump`, se verificará tanto el `%ERRORLEVEL%` como que el tamaño del archivo `.sql` generado sea mayor a 0 bytes.
- **Logging:** Todo el proceso (éxito, fallos, tamaño del archivo) se registrará en `C:\ArdientesBackups\backup_log.txt`.
- **Rotación (14 días):** Se usará el comando `forfiles` de Windows nativo para buscar y eliminar archivos `.sql` en `C:\ArdientesBackups` con fecha de modificación superior a 14 días (`/d -14`).

## 3. SCRIPT DE RESTAURACIÓN (`restore_db.bat`)

Se creará desde cero para proveer una forma segura de recuperar el sistema ante desastres.

- **Listado interactivo:** El script buscará los últimos archivos `.sql` en `C:\ArdientesBackups` y los mostrará en pantalla numerados.
- **Confirmación estricta:** Solicitará al usuario seleccionar un archivo y requerirá escribir la palabra exacta `RESTAURAR` (en mayúsculas) para continuar.
- **Ejecución segura:** Usará `C:\xampp\mysql\bin\mysql.exe` para importar. Advertirá en texto rojo/destacado que la base actual se sobrescribirá y los datos nuevos se perderán.
- **Logs:** También registrará la fecha, hora y archivo restaurado en el log general.

## 4. AUTOMATIZACIÓN (TASK SCHEDULER)

Se configurará una tarea programada nativa en Windows:

- **Nombre:** `ArdientesPOS_Backup_Diario`
- **Frecuencia:** Diaria.
- **Hora:** 03:00 AM (horario de nula concurrencia).
- **Usuario/Contexto:** Ejecutar como `SYSTEM` o el usuario actual, marcando "Ejecutar tanto si el usuario ha iniciado sesión como si no" y "Ejecutar con los privilegios más altos".
- **PC Apagado:** Marcar la opción "Ejecutar la tarea lo antes posible si no se programó un inicio". Así, si el PC estaba apagado a las 3:00 AM, el backup se hará apenas encienda al día siguiente.
- **Manejo de MySQL caído:** El script de backup intentará ejecutar `mysqldump`. Si el servicio `mysql` está detenido, el dump fallará y el script atrapará el error, registrando en `backup_log.txt` que el motor no estaba accesible.

## 5. ALMACENAMIENTO EXTERNO (NUBE)

Dado el requerimiento de una única solución, se analiza:

- **Google Drive (App de Escritorio):**
  - *Ventajas:* Amplia cuota gratuita (15GB), excelente sincronización silenciosa, permite elegir carpetas específicas del PC (usando Mirroring).
  - *Riesgos:* Puede ser estricto con los baneos de cuentas si detecta actividad anómala, pero para archivos `.sql` pequeños no es problema.
- **OneDrive (App Nativa):**
  - *Ventajas:* Ya viene instalado en Windows, integración profunda con el sistema.
  - *Riesgos:* Cuota gratuita menor (5GB). A veces mueve archivos locales a la nube exclusivamente ("Files On-Demand"), lo que podría confundir scripts si no se configura para "Mantener siempre en este dispositivo".

**Recomendación:** **Google Drive**. Es menos intrusivo con el sistema de archivos local de Windows, ofrece más espacio y es sumamente sencillo apuntar la sincronización hacia la carpeta arbitraria `C:\ArdientesBackups` sin tocar el perfil de usuario general.

## 6. SEGURIDAD ADICIONAL

- **Carpeta de Backups:** `C:\ArdientesBackups` estará aislada del código de la aplicación. Se configurarán permisos de ACL de Windows para que solo el Administrador y el usuario SYSTEM tengan acceso total.
- **Exposición SQL:** Al sacar los backups del directorio público/proyecto (que actualmente está en `Documents` o `Music`), se evita que la carpeta sea expuesta por el servidor web o el control de versiones.
- **Ransomware:** Al tener Google Drive configurado, si el PC es atacado, Drive sincronizará los archivos encriptados. Sin embargo, Google Drive mantiene historial de versiones en la nube durante 30 días, lo que permite restaurar los `.sql` sanos desde el navegador web.
- **Password MySQL:** Es imperativo establecer una contraseña al root de MySQL en el futuro. Por ahora se respeta el entorno.
