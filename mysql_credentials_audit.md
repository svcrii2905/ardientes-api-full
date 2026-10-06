# Auditoría de Credenciales MySQL - Ardientes POS

## 1. CONFIGURACIÓN DE ARDIENTES
- **Archivo principal de entorno:** `.env`
  - `DB_HOSTNAME=127.0.0.1`
  - `DB_PORT=3306`
  - `DB_USERNAME=root`
  - `DB_PASSWORD=""` (Vacío)
  - `DB_DATABASE=ardientes_pos`
- **Carga de configuración:** `src/config/env.ts` carga estas variables e inicializa un poolSize por defecto de `10`. Si el entorno es "producción" exigiría password, pero localmente corre sin esa validación.
- **Conector de BD:** `src/shared/infrastructure/database.ts` construye el pool usando `Client` y `TransactionManager` apuntando a las credenciales extraídas.

## 2. CONFIGURACIÓN DE XAMPP/MYSQL
- **Instancia Detectada:** `10.4.32-MariaDB` (XAMPP predeterminado).
- **Servicio y Conexión:** Servicio de Windows `mysql`. Conexión activa en host `127.0.0.1`, puerto `3306`.
- **Estado de Autenticación:** El motor se encuentra sin protección de contraseñas, permitiendo conexiones TCP/IP locales de forma irrestricta al usuario por defecto.

## 3. USUARIOS MYSQL
Lista de usuarios del sistema (sin secretos):
- `root` @ `localhost` (Plugin: vacío / default, Password length: 0)
- `root` @ `127.0.0.1` (Plugin: vacío / default, Password length: 0)
- `root` @ `::1` (Plugin: vacío / default, Password length: 0)
- `pma` @ `localhost` (Plugin: mysql_native_password, Password length: 0)

*Conclusión:* **El usuario `root` NO tiene contraseña configurada.** Tampoco existen usuarios de aplicación dedicados (ej. `ardientes_app`).

## 4. PERMISOS
- **root@localhost:** Posee `GRANT ALL PRIVILEGES ON *.* WITH GRANT OPTION`.
- **Necesidad real de Ardientes:** La aplicación únicamente requiere privilegios `SELECT, INSERT, UPDATE, DELETE` (y eventualmente `EXECUTE` si se usaran procedures) EXCLUSIVAMENTE sobre la base de datos `ardientes_pos`. Actualmente opera con superusuario omnipotente.

## 5. SCRIPTS DE BACKUP Y RESTORE
- **backup_db.bat:** Autentica como `root` sin password. Variable: `set DB_USER=root`. Se ejecuta a través de CLI (`mysqldump -u %DB_USER% %DB_NAME%`).
- **restore_db.bat:** Autentica como `root` sin password (`mysql -u %DB_USER% %DB_NAME% < ...`).
*Conclusión:* Ambos scripts dependen inherentemente del usuario global y asumen la falta de contraseña.

## 6. RIESGOS

| Riesgo | Descripción | Nivel |
| :--- | :--- | :--- |
| **Escalamiento de Privilegios** | ArdientesPOS corre como `root`. Si se vulnerara la aplicación mediante SQL Injection, el atacante tendría control total sobre el motor (borrar otras BD, leer archivos locales con `LOAD DATA`, alterar usuarios). | 🔴 CRÍTICO |
| **Autenticación Nula** | Cualquier malware o usuario en el PC puede conectarse localmente a `127.0.0.1:3306` con `mysql -u root` y destruir o robar la base de datos de caja. | 🔴 CRÍTICO |
| **Scripts Vulnerables** | Dejar un `root` sin clave fomenta que futuros scripts sigan la misma mala práctica. | 🟠 ALTO |

## 7. PLAN DE MIGRACIÓN FUTURO

Para asegurar la transición sin romper Ardientes, se debe seguir estrictamente este flujo seguro (manteniendo el servidor XAMPP actual):

**A. Crear usuario dedicado:**
Mediante consola MySQL crear el usuario de aplicación (ej. `ardientes_user`):
`CREATE USER 'ardientes_user'@'localhost' IDENTIFIED BY 'CLAVE_SEGURA_GENERADA';`

**B. Conceder privilegios mínimos:**
`GRANT SELECT, INSERT, UPDATE, DELETE ON ardientes_pos.* TO 'ardientes_user'@'localhost';`
`FLUSH PRIVILEGES;`

**C. Configurar ArdientesPOS:**
Actualizar `.env`:
- `DB_USERNAME=ardientes_user`
- `DB_PASSWORD="CLAVE_SEGURA_GENERADA"`

**D y E. Adaptar scripts de Backup/Restore:**
Para no exponer credenciales en línea de comandos (ni en los `.bat`), se utilizará **`mysql_config_editor`** de MySQL para crear un perfil de conexión encriptado local (`.mylogin.cnf` en el usuario de Windows):
`mysql_config_editor set --login-path=ardientes_backup --host=127.0.0.1 --user=ardientes_user --password`
Los scripts se cambiarán a:
`mysqldump --login-path=ardientes_backup ardientes_pos > ...`
`mysql --login-path=ardientes_backup ardientes_pos < ...`

**F. Probar Conexión:**
Se reiniciará el POS y se probará login y flujo de órdenes. Se forzará el script de backup para confirmar que todo funciona con el nuevo usuario.

**G y H. Proteger root (Último paso):**
Solo cuando se garantice que `ardientes_user` sostiene la aplicación completa, se asignará un password fuerte a `root` de MySQL para bloquearlo y se actualizará `phpMyAdmin` si es necesario.

## 8. COMPATIBILIDAD
El enfoque iterativo asegura que el negocio no se detenga. El POS utiliza un Pool de conexiones que simplemente inicializará con credenciales distintas, pero a nivel interno (TypeORM/Consultas), el comportamiento DML es transparente. Funciones de login (JWT), inventario, mesas y pagos no se percatarán del cambio de usuario a nivel infraestructura.

## 9. VALIDACIÓN PRE-CAMBIO
Antes de iniciar cualquier acción:
1. Realizar un dump manual total del estado actual de `ardientes_pos` y la tabla `mysql.user`.
2. Verificar que Deno compile (`deno check`) y los tests pasen con éxito.
3. Asegurar acceso total físico a Windows en caso de requerir un reinicio del servicio de MySQL.
