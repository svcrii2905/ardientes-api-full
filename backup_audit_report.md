# Auditoría de Backups y Recuperación - Ardientes POS

## 1. BACKUP ACTUAL
- **Scripts existentes:** `backup_db.bat`
- **Ubicación exacta:** `C:\Users\Equipo\Music\ardientes appi\backup_db.bat`
- **¿Qué hace?:** Ejecuta `mysqldump` para generar un archivo `.sql` de la base de datos y lo guarda en la carpeta local `backups` agregando fecha y hora al nombre del archivo.
- **Credenciales:** Sí, utiliza credenciales hardcodeadas en el script (`DB_USER=root`, `DB_PASS=`, `DB_NAME=ardientes_pos`).
- **Variables de entorno:** NO utiliza `.env`.
- **Sobrescritura:** NO sobrescribe archivos, genera uno nuevo cada vez gracias a la marca de tiempo en el nombre.
- **Manejo de errores:** Básico. Comprueba `%ERRORLEVEL%` de `mysqldump` y muestra un mensaje (`echo`) de éxito o fallo en la consola.
- **Verificación:** NO comprueba que el archivo se haya creado exitosamente (podría crear un archivo vacío). NO comprueba tamaño ni integridad.
- **Registro (Logging):** NO registra errores en un archivo log, todo sale por consola (stdout/stderr).

## 2. CONFIGURACIÓN MYSQL
Configuración extraída de `.env`:
- **Host:** `127.0.0.1`
- **Puerto:** `3306`
- **Nombre de DB:** `ardientes_pos`
- **Usuario:** `root`
- **DB_PASSWORD:** no configurado

## 3. UBICACIÓN DE BACKUPS
- **Ubicación:** `C:\Users\Equipo\Music\ardientes appi\backups`
- **Disco:** Están en el mismo disco físico (Unidad `C:\`) que la base de datos de MySQL (XAMPP).
- **Copia externa:** NO existe ninguna copia fuera del PC.
- **Rotación y Retención:** NO existe. Los backups se acumularán indefinidamente hasta llenar el disco si se ejecutan de forma constante.
- **Riesgo:** Crítico. Ante un fallo catastrófico del disco o ransomware, se pierde tanto la base de datos viva como todos los backups.

## 4. PROGRAMACIÓN
- **Task Scheduler:** Al revisar las tareas programadas de Windows (`schtasks`), NO existe ninguna tarea automatizada para "Ardientes", "MySQL" o "backup_db.bat".
- **Automatización:** Nula. El backup actual depende de que alguien haga doble clic manualmente en el script `backup_db.bat`.

## 5. RESTAURACIÓN
- **Scripts:** NO existe `restore_db.bat` ni scripts similares.
- **Documentación:** Inexistente.
- **Procedimiento actual:** En caso de desastre, el administrador tendría que abrir una terminal, navegar a la ruta y ejecutar manualmente el comando de importación de MySQL (`mysql -u root ardientes_pos < backup...sql`), lo cual es propenso a errores humanos en situaciones de estrés.

## 6. SEGURIDAD
- **Credenciales en backups:** Los archivos `.sql` generados no contienen contraseñas del entorno, pero el script `backup_db.bat` tiene el usuario y nombre de la DB hardcodeados.
- **Permisos:** La carpeta `backups` hereda los permisos estándar del usuario de Windows. No está cifrada ni aislada.
- **Sensibilidad:** Los archivos `.sql` contienen toda la información sensible del negocio, clientes, e historiales financieros en texto plano.
- **Contraseñas en CLI:** Si se configurara una contraseña en `backup_db.bat`, el comando actual la pasaría por argumento de línea de comandos, lo cual es inseguro (aunque actualmente no hay password configurado).

## 7. RECUPERACIÓN ANTE FALLOS

| Escenario | Clasificación | Explicación |
| :--- | :--- | :--- |
| **A. Se daña MySQL (Servicio)** | 🟡 Recuperable actualmente | Se puede reinstalar XAMPP e importar manualmente el último backup generado. |
| **B. Borrado accidental de la DB** | 🟡 Recuperable actualmente | Se puede crear la DB vacía e importar el último backup generado. |
| **C. Muere el disco del PC** | 🔴 No recuperable | Los backups están en la misma unidad física. |
| **D. Se pierde Windows (OS roto)**| 🟠 Recuperable parcialmente | Si el disco está intacto, se puede extraer físicamente y copiar los archivos o rescatar los `.sql`. |
| **E. Se pierde el PC completo** | 🔴 No recuperable | Sin copias externas (Nube o USB), la información se pierde definitivamente. |
| **F. Se corrompe un backup** | 🟠 Recuperable parcialmente | Depende de si existen backups anteriores válidos realizados manualmente. |

## 8. RECOMENDACIÓN PARA PRODUCCIÓN

Considerando que el PC seguirá siendo un servidor local, la estrategia propuesta es **Backups Locales + Sincronización a la Nube**:

- **Frecuencia:** 1 vez al día de forma automatizada (ej. 3:00 AM) mediante Windows Task Scheduler.
- **Cantidad de copias y Retención:** Conservar los últimos 14 días localmente, borrando los más antiguos automáticamente (rotación) para no llenar el disco.
- **Ubicación local:** Mantener en una carpeta dedicada `C:\ArdientesBackups` (fuera del repositorio para evitar conflictos con Git o el IDE).
- **Ubicación externa/off-site:** Instalar la aplicación de escritorio de Google Drive o OneDrive y apuntarla exclusivamente a esa carpeta `C:\ArdientesBackups`.
- **Procedimiento de Restauración:** Crear un `restore_db.bat` seguro que liste los backups disponibles y requiera una confirmación manual escribiendo "RESTAURAR" antes de proceder, para evitar borrados por accidentes.
- **Prueba periódica:** Recomendar al cliente realizar una restauración de prueba en un entorno local diferente cada mes.

## 9. MATRIZ DE RIESGO

| Área | Estado actual | Riesgo | Severidad | Recomendación |
| :--- | :--- | :--- | :--- | :--- |
| **Automatización** | Copias manuales (depende del usuario). | 🔴 Crítico | ALTA | Implementar Task Scheduler diario. |
| **Ubicación** | Backups en el mismo disco (`C:`). | 🔴 Crítico | ALTA | Sincronizar carpeta con OneDrive/Google Drive. |
| **Rotación** | Archivos se acumulan sin límite. | 🟠 Alto | MEDIA | Incluir script para borrar copias mayores a 14 días. |
| **Restauración** | Ausencia de script o procedimiento. | 🟡 Medio | MEDIA | Desarrollar `restore_db.bat`. |
| **Validación** | No se verifica tamaño del backup. | 🟡 Medio | BAJA | Verificar integridad/tamaño > 0 antes de notificar. |
| **Seguridad DB** | DB local sin contraseña (root). | 🟠 Alto | MEDIA | Configurar password en MySQL local. |
