# Plan de Migración de Credenciales MySQL - Ardientes POS

## 1. ANÁLISIS DE LA SITUACIÓN ACTUAL
La aplicación y los scripts de backup operan actualmente mediante el usuario global `root` de MariaDB 10.4.32, el cual no tiene contraseña configurada. Además, las utilidades nativas de MySQL Client (`mysql.exe` y `mysqldump.exe`) se ubican en `C:\xampp\mysql\bin\`, pero se comprobó que **NO existe `mysql_config_editor.exe`** en esta distribución de XAMPP.

## DECISIÓN FINAL SOBRE PRIVILEGIOS

Se abandona el concepto de un usuario monolítico o de "backup general" con permisos amplios. Se aplicará estrictamente el principio de menor privilegio mediante la creación de **TRES (3) usuarios dedicados**, todos restringidos exclusivamente a la base de datos `ardientes_pos`:

1. **`ardientes_app`**
   - **Propósito:** Conexión del backend Node/Deno (vía `.env`).
   - **Privilegios:** DML puro (`SELECT, INSERT, UPDATE, DELETE` sobre `ardientes_pos.*`).

2. **`ardientes_backup`**
   - **Propósito:** Exclusivo para generar los dumps automatizados a las 03:00 AM mediante el script `backup_db.bat`.
   - **Privilegios:** `SELECT, SHOW VIEW, TRIGGER, LOCK TABLES, EVENT` sobre `ardientes_pos.*`.
   - **Justificación:** Un script que corre desatendido (como `SYSTEM`) jamás debe tener permisos destructivos (`DROP` o `DELETE`). Si este usuario o script fuera vulnerado, los datos no pueden ser borrados o alterados a través de él.

3. **`ardientes_restore`**
   - **Propósito:** Exclusivo para la ejecución interactiva humana del asistente `restore_db.bat`.
   - **Privilegios:** `ALL PRIVILEGES ON ardientes_pos.*`.
   - **Justificación:** Los volcados de `mysqldump` sin flags especiales incluyen comandos DDL (`DROP TABLE IF EXISTS`, `CREATE TABLE`) y comandos DML (`INSERT`, `LOCK TABLES`). Por tanto, la reconstrucción estructural de la base requiere la suma total de permisos sobre ese esquema. Dado que la restauración es un evento manual altamente privilegiado, este usuario debe existir por separado.

## DECISIÓN FINAL SOBRE CREDENCIALES

Ante la ausencia de `mysql_config_editor` en MariaDB y la obligación de no exponer las contraseñas en variables de entorno capturables ni en la CLI (`-p...`), se adoptará el mecanismo nativo y seguro de MySQL: `--defaults-extra-file`.

**Archivos de configuración separados:**
Se crearán dos archivos ocultos en `C:\ArdientesBackups`:

1. **`.my_backup.cnf`**
   ```ini
   [client]
   user="ardientes_backup"
   password="[CLAVE_BACKUP]"
   ```
   - **Permisos de Archivo (ACL):** Solo accesible (Read) por `SYSTEM` y el grupo `Administradores`.
   - **Ejecución:** `backup_db.bat` utilizará explícitamente este archivo para leer credenciales desatendidas.

2. **`.my_restore.cnf`**
   ```ini
   [client]
   user="ardientes_restore"
   password="[CLAVE_RESTORE]"
   ```
   - **Permisos de Archivo (ACL):** Solo accesible (Read) por el grupo `Administradores`. `SYSTEM` no requiere acceso.
   - **Ejecución:** `restore_db.bat` utilizará este archivo al importar el volcado y al generar el backup de seguridad previo a la restauración.

*Esta separación garantiza que el Task Scheduler no pueda, bajo ninguna circunstancia o hackeo de privilegios locales, destruir la base usando el script diario.*

## PLAN DE EJECUCIÓN EXACTO

**Fase 1: Creación de Usuarios (Sin afectar a root)**
Ejecutar desde consola MySQL (como root actual):
1. `CREATE USER 'ardientes_app'@'127.0.0.1' IDENTIFIED BY '[CLAVE_APP]';`
2. `CREATE USER 'ardientes_backup'@'127.0.0.1' IDENTIFIED BY '[CLAVE_BACKUP]';`
3. `CREATE USER 'ardientes_restore'@'127.0.0.1' IDENTIFIED BY '[CLAVE_RESTORE]';`
4. `GRANT SELECT, INSERT, UPDATE, DELETE ON ardientes_pos.* TO 'ardientes_app'@'127.0.0.1';`
5. `GRANT SELECT, SHOW VIEW, TRIGGER, LOCK TABLES, EVENT ON ardientes_pos.* TO 'ardientes_backup'@'127.0.0.1';`
6. `GRANT ALL PRIVILEGES ON ardientes_pos.* TO 'ardientes_restore'@'127.0.0.1';`
7. `FLUSH PRIVILEGES;`

**Fase 2: Configuración de Seguridad en Windows**
1. Crear `C:\ArdientesBackups\.my_backup.cnf` y `.my_restore.cnf`.
2. Ejecutar comandos de `icacls` para remover herencias globales y dar acceso exclusivo de Lectura a `SYSTEM` (para backup) y a `Administrators` (para ambos).

**Fase 3: Migración de Scripts y Aplicación**
1. Modificar `backup_db.bat` para usar:
   `"%MYSQLDUMP_PATH%" --defaults-extra-file="C:\ArdientesBackups\.my_backup.cnf" %DB_NAME% > ...`
2. Modificar `restore_db.bat` para usar:
   `"%MYSQL_PATH%" --defaults-extra-file="C:\ArdientesBackups\.my_restore.cnf" %DB_NAME% < ...`
   Y para la sección de backup de seguridad interna de este script:
   `"%MYSQLDUMP_PATH%" --defaults-extra-file="C:\ArdientesBackups\.my_restore.cnf" %DB_NAME% > ...`
3. Actualizar `.env` de Ardientes POS con `DB_USERNAME=ardientes_app` y `DB_PASSWORD=[CLAVE_APP]`.

## PRUEBAS Y ROLLBACK

**Pruebas Antes de la Migración:**
- Verificar el estado actual de `backup_db.bat` corriendo manualmente.

**Pruebas Durante la Migración:**
- Probar la lectura de `--defaults-extra-file` invocando directamente `mysqldump` desde PowerShell (elevado).
- Reiniciar el POS tras cambiar el `.env` y asegurar operaciones normales de la app.

**Diseño de Rollback:**
- Si la app no arranca, revertir `.env` a `root` y password `""`.
- Si los scripts de `.bat` fallan (ej. error 1045 Access Denied o Cannot open file), remover el argumento `--defaults-extra-file` y volver a usar `-u root` en ambos scripts.
- Todo esto sin alterar la contraseña de `root`, garantizando la marcha atrás inmediata en cualquier punto de la migración.
