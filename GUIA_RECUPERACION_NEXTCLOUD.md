# 🆘 Guía Maestra de Nextcloud — Hexa38 NUC

> **Versión 2.0** — Creada el 2026-04-24 tras incidente resuelto exitosamente.
> Esta guía cubre diagnóstico, recuperación, mantenimiento y optimización.

---

## 📋 Tabla de contenidos

1. [Resumen del incidente original](#1-resumen-del-incidente-original)
2. [Arquitectura del sistema](#2-arquitectura-del-sistema)
3. [Diagnóstico — cómo identificar problemas](#3-diagnóstico)
4. [Procedimiento de restauración paso a paso](#4-restauración)
5. [Escenarios de recuperación](#5-escenarios-de-recuperación)
6. [Prevención y buenas prácticas](#6-prevención)
7. [Mantenimiento periódico](#7-mantenimiento)
8. [Actualizaciones](#8-actualizaciones)
9. [Optimización y rendimiento](#9-optimización)
10. [Seguridad](#10-seguridad)
11. [Troubleshooting de errores comunes](#11-troubleshooting)
12. [Backup mejorado y backup off-site](#12-backup-mejorado)
13. [Referencia rápida de comandos](#13-referencia)
14. [Glosario y rutas importantes](#14-glosario)
15. [Checklist de emergencia](#15-emergencia)

---

## 1. Resumen del incidente original <a name="1-resumen-del-incidente-original"></a>

### Síntomas
- Nextcloud accesible pero **aparece como instalación nueva**
- Solo el usuario admin (Aldz) visible — los otros 4 usuarios desaparecieron
- Errores en panel admin: modo mantenimiento, fallo de notify_push
- 20 errores en logs

### Causa raíz
Combinación de factores:
1. Modificaciones repetidas a `docker-compose.yml` para añadir `notify_push`
2. Recreación del contenedor `nextcloud-app` justo después del backup automático
3. **Apagado forzado** que dejó ext4 en estado "dirty"
4. Tras reboot, el disco montó con journal incompleto, ocultando archivos
5. Posible reinicialización de MariaDB durante recreación del contenedor

### Lo que salvó el día
- ✅ Script de backup automático corriendo en cron diario a las 3 AM
- ✅ Disco de 1.8 TB con espacio para 7 días de retención
- ✅ Backup completado a las 03:06 — apenas minutos antes del incidente

### Tiempo de recuperación
- Diagnóstico: ~30 minutos
- Restauración: ~10 minutos
- Verificación: ~10 minutos
- **Total: ~50 minutos** sin pérdida de datos

---

## 2. Arquitectura del sistema <a name="2-arquitectura-del-sistema"></a>

```
┌─────────────────────────────────────────────────────────────┐
│                    Usuario en Internet                       │
└────────────────────────┬────────────────────────────────────┘
                         │ https://cloud.hexa38.com
                         │
                ┌────────▼────────┐
                │ Cloudflare CDN  │
                └────────┬────────┘
                         │ Tunnel (sin IP pública)
                         │
              ┌──────────▼──────────┐
              │  NUC Hexa38         │
              │  Ubuntu 24.04       │
              │  IP local:          │
              │  192.168.1.69       │
              │  Tailscale:         │
              │  100.91.119.52      │
              └──────────┬──────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   ┌────▼────┐     ┌─────▼────┐    ┌─────▼─────┐
   │   sda   │     │   sdb1   │    │  Docker   │
   │ (300GB) │     │  1.8 TB  │    │           │
   │   OS    │     │          │    │           │
   └─────────┘     │/mnt/     │    │ 6 contai- │
                   │nextcloud │    │ ners      │
                   │          │    │           │
                   │ ├ html/  │◄───┤           │
                   │ ├ data/  │◄───┤           │
                   │ ├ db/    │◄───┤           │
                   │ └backups/│    │           │
                   └──────────┘    └───────────┘
```

### Contenedores Docker
| Contenedor | Imagen | Puerto | Función |
|------------|--------|--------|---------|
| `nextcloud-app` | nextcloud:latest | 9000:80 | Aplicación web |
| `nextcloud-db` | mariadb:10.11 | 3306 (interno) | Base de datos |
| `nextcloud-redis` | redis:alpine | 6379 (interno) | Cache y file locking |
| `nextcloud-cron` | nextcloud:latest | - | Tareas programadas |
| `nextcloud-tunnel` | cloudflare/cloudflared | - | Túnel Cloudflare |
| `nextcloud-push` | nextcloud:latest | - | Notify Push (sync rápido) |

---

## 3. Diagnóstico — cómo identificar problemas <a name="3-diagnóstico"></a>

### Paso 1: Estado general del sistema
```bash
# Estado del NUC
uptime
free -h
df -h

# Estado de Docker
docker ps
docker ps -a  # Incluye contenedores parados

# Estado de Nextcloud
docker exec -u www-data nextcloud-app php occ status
```

**Banderas rojas:**
- Carga (load) muy alta (>5 sostenida)
- RAM swap usado >50%
- Disco >90% lleno
- Algún contenedor en `Restarting` o `Exited`

### Paso 2: Verificar volúmenes y montajes
```bash
docker volume ls
docker inspect nextcloud-app --format '{{range .Mounts}}{{.Type}} {{.Source}} -> {{.Destination}}{{println}}{{end}}'
docker inspect nextcloud-db --format '{{range .Mounts}}{{.Type}} {{.Source}} -> {{.Destination}}{{println}}{{end}}'
```

**Esperado:**
- `bind /mnt/nextcloud/html -> /var/www/html`
- `bind /mnt/nextcloud/data -> /var/www/html/data`
- `bind /mnt/nextcloud/db -> /var/lib/mysql` (en el contenedor db)

### Paso 3: Verificar el disco de almacenamiento
```bash
mount | grep nextcloud
lsblk -f
df -h /mnt/nextcloud
sudo du -sh /mnt/nextcloud/*
```

**Esperado:**
- `/dev/sdb1` montado en `/mnt/nextcloud`
- Tamaños: `data` cientos MB-GB, `db` decenas MB, `html` ~1.5 GB, `backups` varios GB

### Paso 4: Si el filesystem se ve raro tras apagado forzado
```bash
# Detener contenedores
cd /home/aldo/nextcloud && docker compose stop

# Forzar journal replay
sudo umount /mnt/nextcloud
sudo mount /mnt/nextcloud

# Verificar contenido
ls -la /mnt/nextcloud/
sudo du -sh /mnt/nextcloud/*

# Si aún se ve raro, hacer fsck (REQUIERE el disco desmontado)
sudo umount /mnt/nextcloud
sudo fsck.ext4 -f -y /dev/sdb1
sudo mount /mnt/nextcloud

# Reiniciar contenedores
docker compose start
```

### Paso 5: Verificar backups
```bash
ls -la /mnt/nextcloud/backups/
tail -100 /mnt/nextcloud/backups/backup.log
sudo du -sh /mnt/nextcloud/backups/*/
```

**Verifica:**
- Hasta 7 carpetas con fecha `YYYY-MM-DD_HH-MM`
- El log termina con `BACKUP COMPLETADO` para el más reciente
- Tamaños razonables (1-10 GB por backup)

### Paso 6: Revisar logs en busca de errores
```bash
# Log de Nextcloud
docker exec nextcloud-app tail -100 /var/www/html/data/nextcloud.log | python3 -m json.tool

# Logs de cada contenedor
docker logs nextcloud-app --tail 50
docker logs nextcloud-db --tail 50
docker logs nextcloud-push --tail 50
docker logs nextcloud-cron --tail 50

# Logs del sistema
sudo journalctl --since "1 hour ago" | grep -iE "error|fail|nextcloud|sdb"
sudo dmesg | tail -50
```

### Paso 7: Verificar último backup antes de restaurar
```bash
BACKUP=/mnt/nextcloud/backups/2026-XX-XX_03-00  # Ajustar fecha

sudo ls -la $BACKUP/
sudo ls -la $BACKUP/userdata/
sudo ls -la $BACKUP/config/
sudo grep -E "instanceid|secret|passwordsalt" $BACKUP/config/config.php
sudo head -30 $BACKUP/database.sql
sudo grep -c "INSERT INTO" $BACKUP/database.sql
```

**Verifica:**
- `database.sql` con tamaño razonable (>10 MB)
- `userdata/` con todas las carpetas de usuarios
- `config/config.php` con `instanceid`, `secret`, `passwordsalt` definidos

---

## 4. Procedimiento de restauración paso a paso <a name="4-restauración"></a>

> ⚠️ **PRIMERO**: confirma que tienes un backup válido (Paso 7 del diagnóstico).
> ⚠️ Este procedimiento **borra los datos actuales** de Nextcloud.

### Paso 1: Variables y modo mantenimiento
```bash
# Establece la fecha del backup más reciente válido
export BACKUP=/mnt/nextcloud/backups/2026-XX-XX_03-00

# Cargar variables de entorno
set -a
source /home/aldo/nextcloud/.env
set +a

# Activar modo mantenimiento (si los contenedores están corriendo)
docker exec -u www-data nextcloud-app php occ maintenance:mode --on || true
```

### Paso 2: Detener contenedores que tocan los datos
```bash
cd /home/aldo/nextcloud
docker compose stop app cron tunnel notify_push
docker ps  # Solo nextcloud-db y nextcloud-redis deben quedar corriendo
```

### Paso 3: Restaurar la base de datos
```bash
# Borrar la DB corrupta y crear una vacía
docker exec -i nextcloud-db mariadb -u root -p"$MYSQL_ROOT_PASSWORD" -e \
  "DROP DATABASE IF EXISTS nextcloud; CREATE DATABASE nextcloud CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;"

# Importar el backup
docker exec -i nextcloud-db mariadb -u root -p"$MYSQL_ROOT_PASSWORD" nextcloud < $BACKUP/database.sql

# Verificar usuarios restaurados
docker exec nextcloud-db mariadb -u root -p"$MYSQL_ROOT_PASSWORD" nextcloud \
  -e "SELECT uid FROM oc_users;"
```

### Paso 4: Restaurar datos de usuarios
```bash
# Borrar contenido actual
sudo rm -rf /mnt/nextcloud/data/* /mnt/nextcloud/data/.[!.]*

# Copiar datos del backup
sudo cp -a $BACKUP/userdata/. /mnt/nextcloud/data/

# Permisos correctos
sudo chown -R www-data:www-data /mnt/nextcloud/data

# Verificar
sudo ls -la /mnt/nextcloud/data/
```

### Paso 5: Restaurar configuración
```bash
# Copiar config (sobrescribe el actual)
sudo cp -a $BACKUP/config/. /mnt/nextcloud/html/config/

# Permisos correctos
sudo chown -R www-data:www-data /mnt/nextcloud/html/config

# Verificar
sudo ls -la /mnt/nextcloud/html/config/
```

### Paso 6: Reiniciar y desactivar mantenimiento
```bash
cd /home/aldo/nextcloud
docker compose start
sleep 15

# Verificar que todos los contenedores estén Up
docker ps

# Desactivar mantenimiento
docker exec -u www-data nextcloud-app php occ maintenance:mode --off

# Listar usuarios para confirmar
docker exec -u www-data nextcloud-app php occ user:list
```

### Paso 7: Reescanear y reparar
```bash
docker exec -u www-data nextcloud-app php occ files:scan --all
docker exec -u www-data nextcloud-app php occ maintenance:repair
docker exec -u www-data nextcloud-app php occ status
```

### Paso 8: Verificación manual
1. Entra a `https://cloud.hexa38.com`
2. Login como admin (Aldz)
3. **Settings → Users**: verifica todos los usuarios
4. Login con cada usuario y verifica sus archivos
5. **Settings → Administration → Logging**: revisa errores

---

## 5. Escenarios de recuperación <a name="5-escenarios-de-recuperación"></a>

### Escenario A: Solo se perdieron archivos de usuario (sin tocar DB)
Si la DB está bien pero los archivos de un usuario se borraron:
```bash
USUARIO=Kevin
BACKUP=/mnt/nextcloud/backups/2026-XX-XX_03-00

docker exec -u www-data nextcloud-app php occ maintenance:mode --on

# Restaurar solo ese usuario
sudo rm -rf "/mnt/nextcloud/data/$USUARIO"
sudo cp -a "$BACKUP/userdata/$USUARIO" /mnt/nextcloud/data/
sudo chown -R www-data:www-data "/mnt/nextcloud/data/$USUARIO"

docker exec -u www-data nextcloud-app php occ maintenance:mode --off
docker exec -u www-data nextcloud-app php occ files:scan "$USUARIO"
```

### Escenario B: Solo se corrompió la DB
Si los archivos están bien pero la DB no responde:
```bash
BACKUP=/mnt/nextcloud/backups/2026-XX-XX_03-00
set -a; source /home/aldo/nextcloud/.env; set +a

docker exec -u www-data nextcloud-app php occ maintenance:mode --on

docker exec -i nextcloud-db mariadb -u root -p"$MYSQL_ROOT_PASSWORD" -e \
  "DROP DATABASE IF EXISTS nextcloud; CREATE DATABASE nextcloud CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;"
docker exec -i nextcloud-db mariadb -u root -p"$MYSQL_ROOT_PASSWORD" nextcloud < $BACKUP/database.sql

docker exec -u www-data nextcloud-app php occ maintenance:mode --off
docker exec -u www-data nextcloud-app php occ files:scan --all
```

### Escenario C: Disco sdb1 falla físicamente
1. **Verificar**: `sudo dmesg | grep -i "sdb\|i/o error"` y `sudo smartctl -a /dev/sdb` (instalar `smartmontools`)
2. **Si falla SMART**: el disco se debe reemplazar
3. **Recovery**: comprar disco nuevo, formatear como ext4 con label `nextcloud`, montar en `/mnt/nextcloud`, restaurar desde backup off-site (ver sección 12)

### Escenario D: Olvidaste contraseña admin
```bash
docker exec -it -u www-data nextcloud-app php occ user:resetpassword Aldz
# Te pedirá la nueva contraseña dos veces
```

### Escenario E: Quieres crear un nuevo admin de emergencia
```bash
docker exec -it -u www-data nextcloud-app php occ user:add --group admin emergencyadmin
```

### Escenario F: Cloudflare Tunnel no responde
```bash
# Ver logs
docker logs nextcloud-tunnel --tail 50

# Reiniciar
docker compose restart tunnel

# Si el token cambió, actualizar .env y recrear
nano /home/aldo/nextcloud/.env  # Editar CLOUDFLARE_TOKEN
docker compose up -d --force-recreate tunnel
```

### Escenario G: Tailscale no conecta
En el NUC:
```bash
sudo tailscale logout
sudo tailscale up
# Sigue el link que aparece en la terminal
```

### Escenario H: Quieres migrar todo a un nuevo servidor
1. En el NUC actual: hacer backup manual `sudo bash /home/aldo/nextcloud/backup.sh`
2. Copiar el backup al nuevo servidor: `rsync -avz /mnt/nextcloud/backups/2026-XX-XX_03-00/ user@nuevo:/ruta/`
3. En el nuevo servidor: instalar Docker + clonar el proyecto
4. Restaurar siguiendo la sección 4 desde Paso 1
5. Actualizar DNS / Cloudflare tunnel para apuntar al nuevo servidor

---

## 6. Prevención y buenas prácticas <a name="6-prevención"></a>

### ❌ Cosas que NUNCA debes hacer
| Acción | Por qué |
|--------|---------|
| Apagado forzado | Corrompe ext4, daña la DB |
| `docker compose down -v` | La `-v` BORRA volúmenes |
| `docker volume rm` sin backup | Pérdida de datos |
| Editar compose sin backup previo | Si algo sale mal, no hay vuelta atrás |
| `rm -rf /mnt/nextcloud/*` | Pérdida total |
| Tener Snap Nextcloud + Docker | Conflictos y errores apparmor |
| Saltar el modo mantenimiento al actualizar | Puede corromper la DB |

### ✅ Buenas prácticas

#### Antes de cualquier cambio en docker-compose
```bash
# 1. Backup manual primero
sudo bash /home/aldo/nextcloud/backup.sh

# 2. Backup adicional del docker-compose actual
cp /home/aldo/nextcloud/docker-compose.yml /home/aldo/nextcloud/docker-compose.yml.bak.$(date +%Y%m%d_%H%M)

# 3. Detener limpiamente (sin -v)
cd /home/aldo/nextcloud
docker compose down

# 4. Hacer cambios al docker-compose.yml
nano docker-compose.yml

# 5. Levantar de nuevo
docker compose up -d

# 6. Verificar
docker ps
docker exec -u www-data nextcloud-app php occ status
```

#### Apagado correcto del NUC
```bash
# Apagar todos los contenedores limpiamente
cd /home/aldo/nextcloud && docker compose stop

# Apagar el NUC
sudo shutdown -h now

# O si solo quieres reiniciar:
sudo reboot
```

#### Tras un apagado forzado o corte de luz
```bash
# 1. Verificar que el disco montó bien
mount | grep nextcloud
df -h /mnt/nextcloud

# 2. Si se ve raro, journal replay
cd /home/aldo/nextcloud && docker compose stop
sudo umount /mnt/nextcloud
sudo mount /mnt/nextcloud
docker compose start

# 3. Verificar que Nextcloud responde
docker exec -u www-data nextcloud-app php occ status

# 4. Programar fsck para próximo reinicio
sudo touch /forcefsck
# Reiniciar cuando sea conveniente:
sudo reboot
```

### 🗑️ Eliminar Nextcloud Snap (recomendado)
```bash
sudo snap remove --purge nextcloud
# Verifica que no hay procesos snap relacionados
ps aux | grep nextcloud
```

---

## 7. Mantenimiento periódico <a name="7-mantenimiento"></a>

### Diario (automatizado por cron)
- ✅ Backup automático a las 3 AM (ya configurado)

### Semanal (manual o automatizado)
```bash
# Verificar backups recientes
ls -lt /mnt/nextcloud/backups/ | head
tail -50 /mnt/nextcloud/backups/backup.log | grep -E "INICIO|COMPLETADO|ERROR"

# Verificar espacio en disco
df -h

# Revisar logs de errores
docker exec nextcloud-app tail -200 /var/www/html/data/nextcloud.log | grep -i error
```

### Mensual
```bash
# 1. Backup manual antes de mantenimiento
sudo bash /home/aldo/nextcloud/backup.sh

# 2. Reparación de la BD
docker exec -u www-data nextcloud-app php occ maintenance:repair
docker exec -u www-data nextcloud-app php occ db:add-missing-indices
docker exec -u www-data nextcloud-app php occ db:add-missing-columns
docker exec -u www-data nextcloud-app php occ db:add-missing-primary-keys
docker exec -u www-data nextcloud-app php occ db:convert-filecache-bigint

# 3. Limpiar archivos huérfanos
docker exec -u www-data nextcloud-app php occ files:cleanup

# 4. Limpiar imágenes Docker huérfanas
docker image prune -f
docker system df

# 5. Verificar integridad
docker exec -u www-data nextcloud-app php occ integrity:check-core

# 6. Verificar versión
docker exec -u www-data nextcloud-app php occ status | grep version
```

### Trimestral
```bash
# Test de restauración (¡importante!)
# Crear un Nextcloud de prueba en otro lado y restaurar el último backup
# para verificar que el procedimiento funciona

# Revisar y rotar logs
sudo journalctl --vacuum-time=90d

# Verificar SMART del disco
sudo apt install -y smartmontools  # Si no está instalado
sudo smartctl -a /dev/sdb | grep -E "Reallocated|Pending|Health"
```

---

## 8. Actualizaciones <a name="8-actualizaciones"></a>

### Actualizar Nextcloud (versión menor)
```bash
# 1. Backup OBLIGATORIO
sudo bash /home/aldo/nextcloud/backup.sh

# 2. Pull de la imagen latest
cd /home/aldo/nextcloud
docker compose pull

# 3. Recrear contenedores con la nueva imagen
docker compose up -d

# 4. Esperar a que inicien
sleep 30

# 5. Ejecutar el upgrade
docker exec -u www-data nextcloud-app php occ upgrade

# 6. Reparación post-upgrade
docker exec -u www-data nextcloud-app php occ maintenance:repair

# 7. Desactivar mantenimiento si quedó activado
docker exec -u www-data nextcloud-app php occ maintenance:mode --off

# 8. Verificar
docker exec -u www-data nextcloud-app php occ status
```

### Actualizar versión mayor (ej: 32.x → 33.x)
> ⚠️ Solo se puede saltar UNA versión mayor a la vez. Si estás muy desactualizado, hacer salto por salto.

```bash
# 1. Backup OBLIGATORIO
sudo bash /home/aldo/nextcloud/backup.sh

# 2. Cambiar la imagen en docker-compose.yml a la versión específica
nano docker-compose.yml
# Cambiar: nextcloud:latest → nextcloud:33-apache (por ejemplo)

# 3. Pull y recrear
docker compose pull
docker compose up -d

# 4. Upgrade
docker exec -u www-data nextcloud-app php occ upgrade

# 5. Si hay problemas con apps, deshabilitar las incompatibles temporalmente
docker exec -u www-data nextcloud-app php occ app:list
docker exec -u www-data nextcloud-app php occ app:disable APP_NOMBRE

# 6. Reparación
docker exec -u www-data nextcloud-app php occ maintenance:repair
docker exec -u www-data nextcloud-app php occ maintenance:mode --off
```

### Actualizar el sistema operativo (Ubuntu)
```bash
# 1. Backup OBLIGATORIO
sudo bash /home/aldo/nextcloud/backup.sh

# 2. Update normal
sudo apt update
sudo apt upgrade -y

# 3. Si hay actualizaciones de kernel, reiniciar (planificado)
sudo reboot

# 4. Verificar que Nextcloud volvió a levantar
docker ps
docker exec -u www-data nextcloud-app php occ status
```

---

## 9. Optimización y rendimiento <a name="9-optimización"></a>

### Ajustes recomendados en `config.php`
Editar `/mnt/nextcloud/html/config/config.php` y añadir si no existen:

```php
'memcache.local' => '\OC\Memcache\APCu',
'memcache.distributed' => '\OC\Memcache\Redis',
'memcache.locking' => '\OC\Memcache\Redis',
'redis' => array(
    'host' => 'redis',
    'port' => 6379,
    'password' => 'TU_PASSWORD_REDIS_AQUI',
),
'default_phone_region' => 'PE',  // País por defecto para teléfonos
'maintenance_window_start' => 1,  // Mantenimiento entre 1-5 AM UTC
'log_rotate_size' => 104857600,  // Rotar log a 100MB
'logfile' => '/var/www/html/data/nextcloud.log',
'loglevel' => 2,  // 0=Debug, 1=Info, 2=Warn, 3=Error, 4=Fatal
```

Tras editar:
```bash
docker compose restart app
```

### Ajustar límites de PHP
Ya están en `docker-compose.yml`:
```yaml
- PHP_MEMORY_LIMIT=1G
- PHP_UPLOAD_LIMIT=16G
```

Si necesitas archivos más grandes, ajustarlos.

### Optimización de la base de datos
```bash
# Añadir índices que mejoran rendimiento
docker exec -u www-data nextcloud-app php occ db:add-missing-indices

# Convertir filecache a bigint (recomendado para >100k archivos)
docker exec -u www-data nextcloud-app php occ db:convert-filecache-bigint
```

### Configurar HTTP/2 y HTTP/3 en Cloudflare
- En el dashboard de Cloudflare → SSL/TLS → Edge Certificates
- Activar: HTTP/2, HTTP/3 (QUIC), 0-RTT, Always Use HTTPS

### Habilitar caché de previsualizaciones
```bash
docker exec -u www-data nextcloud-app php occ config:app:set previewgenerator squareSizes --value="32 256"
docker exec -u www-data nextcloud-app php occ config:app:set previewgenerator widthSizes  --value="256 384"
docker exec -u www-data nextcloud-app php occ config:app:set previewgenerator heightSizes --value="256"
docker exec -u www-data nextcloud-app php occ preview:pre-generate
```

---

## 10. Seguridad <a name="10-seguridad"></a>

### Verificar el escaneo de seguridad
Visita: https://scan.nextcloud.com/ con tu dominio

### Headers de seguridad (HSTS)
Ya tienes `hsts.conf` montado. Verifica que esté activo:
```bash
curl -I https://cloud.hexa38.com | grep -i strict-transport
```

### 2FA (Autenticación de dos factores)
```bash
# Habilitar la app de TOTP
docker exec -u www-data nextcloud-app php occ app:enable twofactor_totp

# Para forzar 2FA en todos los usuarios:
docker exec -u www-data nextcloud-app php occ config:app:set twofactor_enforced enforced --value=1
```

### Política de contraseñas
```bash
docker exec -u www-data nextcloud-app php occ app:enable password_policy
```
Luego en Web → Settings → Security → ajustar requisitos.

### Limitar IPs de acceso (a través de Cloudflare)
- Cloudflare Dashboard → WAF → Custom Rules
- Crear regla: "Block requests from countries except: PE, US, ES" (ajusta a tu caso)

### Auditoría
```bash
docker exec -u www-data nextcloud-app php occ app:enable admin_audit
# Logs de auditoría aparecerán en /var/www/html/data/audit.log
```

### Banear IPs sospechosas con fail2ban
```bash
# En el NUC (host)
sudo apt install -y fail2ban

# Crear filtro Nextcloud
sudo tee /etc/fail2ban/filter.d/nextcloud.conf > /dev/null <<'EOF'
[Definition]
_groupsre = (?:(?:,?\s*"\w+":(?:"[^"]+"|\w+))*)
failregex = ^\{%(_groupsre)s,?\s*"remoteAddr":"<HOST>"%(_groupsre)s,?\s*"message":"Login failed:
            ^\{%(_groupsre)s,?\s*"remoteAddr":"<HOST>"%(_groupsre)s,?\s*"message":"Trusted domain error.
datepattern = ,?\s*"time"\s*:\s*"%%Y-%%m-%%d[T ]%%H:%%M:%%S(\.%%f)?(Z|\s*[+-]%%H:%%M)?"
EOF

# Crear jail
sudo tee /etc/fail2ban/jail.d/nextcloud.local > /dev/null <<'EOF'
[nextcloud]
backend = auto
enabled = true
port    = 80,443
protocol = tcp
filter   = nextcloud
maxretry = 5
bantime  = 3600
findtime = 36000
logpath  = /var/lib/docker/volumes/*/_data/nextcloud.log
         /mnt/nextcloud/data/nextcloud.log
EOF

sudo systemctl restart fail2ban
sudo fail2ban-client status nextcloud
```

---

## 11. Troubleshooting de errores comunes <a name="11-troubleshooting"></a>

### "Sistema en modo de mantenimiento"
```bash
docker exec -u www-data nextcloud-app php occ maintenance:mode --off
```

### "Cannot write into config directory"
```bash
sudo chown -R www-data:www-data /mnt/nextcloud/html/config
sudo chmod -R 770 /mnt/nextcloud/html/config
```

### "Internal Server Error" después de update
```bash
docker logs nextcloud-app --tail 100
docker exec nextcloud-app tail -50 /var/www/html/data/nextcloud.log
docker exec -u www-data nextcloud-app php occ upgrade
docker exec -u www-data nextcloud-app php occ maintenance:repair
```

### "Trusted domain error"
Edita `/mnt/nextcloud/html/config/config.php` y añade tu dominio:
```php
'trusted_domains' => 
  array (
    0 => 'localhost',
    1 => 'cloud.hexa38.com',
    2 => '192.168.1.69',
  ),
```

### "MySQL server has gone away"
```bash
# Aumentar timeout en MariaDB
docker exec -it nextcloud-db bash
echo "wait_timeout=28800" >> /etc/mysql/my.cnf
exit
docker compose restart db
```

### Sync del cliente desktop muy lento
Verificar que `notify_push` está funcionando:
```bash
docker logs nextcloud-push --tail 30
docker exec -u www-data nextcloud-app php occ notify_push:metrics
```

### "Strong rate limiting"
Es Redis bloqueando — algún script está spamming:
```bash
# Ver qué IP/usuario:
docker exec nextcloud-app tail -100 /var/www/html/data/nextcloud.log | grep -i "rate"

# Limpiar el lock manualmente:
docker exec -it nextcloud-redis redis-cli -a "$REDIS_PASSWORD" FLUSHDB
```

### Errores apparmor de snap.nextcloud
```bash
sudo snap remove --purge nextcloud
```

### Disco lleno
```bash
# Ver qué ocupa espacio
sudo du -sh /mnt/nextcloud/* | sort -h
sudo du -sh /var/lib/docker/* | sort -h

# Limpiar Docker
docker system prune -af --volumes  # ¡cuidado!: revisa qué borra primero con --dry-run

# Limpiar logs de Nextcloud
docker exec nextcloud-app truncate -s 0 /var/www/html/data/nextcloud.log

# Reducir retención de backups (ej: de 7 a 3 días)
nano /home/aldo/nextcloud/backup.sh
# Cambiar RETENTION=7 a RETENTION=3
```

### El cron de backup no ejecuta
```bash
# Verificar que el cron está
sudo crontab -l

# Verificar logs de cron
sudo grep CRON /var/log/syslog | tail -20

# Verificar permisos del script
ls -la /home/aldo/nextcloud/backup.sh
sudo chmod +x /home/aldo/nextcloud/backup.sh

# Ejecutar manualmente para ver errores
sudo bash -x /home/aldo/nextcloud/backup.sh
```

---

## 12. Backup mejorado y backup off-site <a name="12-backup-mejorado"></a>

### El backup actual (local)
- ✅ Diario a las 3 AM
- ✅ 7 días de retención
- ✅ Incluye DB + datos + config + docker-compose
- ⚠️ **Está en el mismo disco** que los datos — si el disco falla, se pierde TODO

### Recomendaciones de mejora

#### Opción 1: Backup adicional a otro disco/USB
```bash
# Conectar disco USB y montarlo (ej: /mnt/usb-backup)
# Editar backup.sh para hacer copia adicional al USB

# Añadir al final del script (antes de "BACKUP COMPLETADO"):
if mountpoint -q /mnt/usb-backup; then
    log "Copiando a USB..."
    rsync -a --delete /mnt/nextcloud/backups/ /mnt/usb-backup/nextcloud-backups/
    log "Copiado a USB completado"
fi
```

#### Opción 2: Backup off-site con rclone (a Google Drive, OneDrive, S3, etc.)
```bash
# Instalar rclone
sudo apt install -y rclone

# Configurar rclone (interactivo)
rclone config
# Crear remote ej: "gdrive" para Google Drive

# Test
rclone ls gdrive:

# Añadir al final de backup.sh:
log "Subiendo a Google Drive..."
rclone copy "$BACKUP_DIR" "gdrive:nextcloud-backups/$DATE/" --progress
log "Backup off-site completado"

# Limpiar backups antiguos en remote (mantener 30 días)
rclone delete gdrive:nextcloud-backups/ --min-age 30d
```

#### Opción 3: Cifrado del backup antes de subir
```bash
# Instalar GPG
sudo apt install -y gpg

# Crear key
gpg --full-generate-key  # Sigue las instrucciones

# Cifrar backup
tar czf - "$BACKUP_DIR" | gpg --encrypt --recipient TU_EMAIL > "$BACKUP_DIR.tar.gz.gpg"

# Para descifrar más tarde:
gpg --decrypt backup.tar.gz.gpg | tar xzf -
```

### Política de backup recomendada (3-2-1)
- **3** copias de los datos
- **2** medios diferentes (disco local + cloud)
- **1** copia off-site

Ejemplo:
1. Datos en producción (`/mnt/nextcloud/data`)
2. Backup local (`/mnt/nextcloud/backups`) — **medio 1**, on-site
3. Backup en Google Drive vía rclone — **medio 2**, off-site

### Test de restauración
**Cada 3 meses** restaura un backup en otro NUC/máquina virtual para verificar que el procedimiento funciona. **Un backup que no se ha probado, no es backup.**

---

## 13. Referencia rápida de comandos <a name="13-referencia"></a>

### Modo mantenimiento
```bash
docker exec -u www-data nextcloud-app php occ maintenance:mode --on
docker exec -u www-data nextcloud-app php occ maintenance:mode --off
```

### Gestión de usuarios
```bash
docker exec -u www-data nextcloud-app php occ user:list
docker exec -it -u www-data nextcloud-app php occ user:resetpassword USUARIO
docker exec -it -u www-data nextcloud-app php occ user:add --group admin USUARIO
docker exec -u www-data nextcloud-app php occ user:delete USUARIO
docker exec -u www-data nextcloud-app php occ user:disable USUARIO
docker exec -u www-data nextcloud-app php occ user:enable USUARIO
docker exec -u www-data nextcloud-app php occ user:lastseen USUARIO
```

### Gestión de apps
```bash
docker exec -u www-data nextcloud-app php occ app:list
docker exec -u www-data nextcloud-app php occ app:enable APP
docker exec -u www-data nextcloud-app php occ app:disable APP
docker exec -u www-data nextcloud-app php occ app:install APP
docker exec -u www-data nextcloud-app php occ app:remove APP
docker exec -u www-data nextcloud-app php occ app:update --all
```

### Logs y diagnóstico
```bash
docker exec nextcloud-app tail -100 /var/www/html/data/nextcloud.log
docker exec nextcloud-app truncate -s 0 /var/www/html/data/nextcloud.log
docker exec -u www-data nextcloud-app php occ log:tail
docker exec -u www-data nextcloud-app php occ status
docker logs nextcloud-app --tail 50
docker logs nextcloud-db --tail 50
```

### Reparación
```bash
docker exec -u www-data nextcloud-app php occ files:scan --all
docker exec -u www-data nextcloud-app php occ files:scan USUARIO
docker exec -u www-data nextcloud-app php occ files:cleanup
docker exec -u www-data nextcloud-app php occ maintenance:repair
docker exec -u www-data nextcloud-app php occ integrity:check-core
```

### Backup manual
```bash
sudo bash /home/aldo/nextcloud/backup.sh
ls -lt /mnt/nextcloud/backups/ | head
```

### Docker Compose
```bash
cd /home/aldo/nextcloud
docker compose ps
docker compose logs -f app
docker compose restart app
docker compose down       # Parar todo SIN borrar volúmenes
docker compose up -d      # Levantar todo
docker compose pull       # Actualizar imágenes
```

### Base de datos
```bash
docker exec -it nextcloud-db mariadb -u root -p"$MYSQL_ROOT_PASSWORD"

docker exec nextcloud-db mariadb -u root -p"$MYSQL_ROOT_PASSWORD" nextcloud \
  -e "SELECT uid, displayname FROM oc_users;"

docker exec nextcloud-db mariadb-dump -u root -p"$MYSQL_ROOT_PASSWORD" \
  nextcloud --single-transaction > /tmp/backup_manual.sql
```

### Configuración
```bash
docker exec -u www-data nextcloud-app php occ config:list
docker exec -u www-data nextcloud-app php occ config:system:get trusted_domains
docker exec -u www-data nextcloud-app php occ config:system:set trusted_domains 2 --value="otro.dominio.com"
docker exec -u www-data nextcloud-app php occ config:app:get APP CLAVE
```

### Sistema
```bash
# Estado general
htop  # o btop
df -h
free -h
uptime
docker stats --no-stream

# Disco
sudo smartctl -a /dev/sdb
sudo dmesg | tail
mount | grep nextcloud

# Red
ip a
ss -tlnp
docker network ls
```

---

## 14. Glosario y rutas importantes <a name="14-glosario"></a>

### Rutas en el host (NUC)
| Ruta | Descripción |
|------|-------------|
| `/home/aldo/nextcloud/` | Carpeta del proyecto |
| `/home/aldo/nextcloud/docker-compose.yml` | Configuración de contenedores |
| `/home/aldo/nextcloud/.env` | Variables de entorno |
| `/home/aldo/nextcloud/backup.sh` | Script de backup automático |
| `/home/aldo/nextcloud/hsts.conf` | Headers HSTS para Apache |
| `/mnt/nextcloud/` | **Disco SSD/HDD de 1.8 TB** (sdb1) |
| `/mnt/nextcloud/html/` | Archivos de Nextcloud (web app) |
| `/mnt/nextcloud/html/config/` | Configuración de Nextcloud |
| `/mnt/nextcloud/data/` | Datos de los usuarios |
| `/mnt/nextcloud/db/` | Base de datos MariaDB |
| `/mnt/nextcloud/backups/` | Backups automáticos |
| `/mnt/nextcloud/backups/backup.log` | Log de los backups |

### Rutas dentro del contenedor `nextcloud-app`
| Ruta | Equivalente en host |
|------|---------------------|
| `/var/www/html/` | `/mnt/nextcloud/html/` |
| `/var/www/html/data/` | `/mnt/nextcloud/data/` |
| `/var/www/html/config/` | `/mnt/nextcloud/html/config/` |
| `/var/www/html/data/nextcloud.log` | Log principal de Nextcloud |

### Variables de entorno (`.env`)
- `DOMAIN` — Dominio público
- `MYSQL_ROOT_PASSWORD` — Contraseña root MariaDB
- `MYSQL_PASSWORD` — Contraseña usuario `nextcloud` MariaDB
- `MYSQL_DATABASE` — Nombre de la BD (siempre `nextcloud`)
- `MYSQL_USER` — Usuario de MariaDB (siempre `nextcloud`)
- `REDIS_PASSWORD` — Contraseña de Redis
- `CLOUDFLARE_TOKEN` — Token del tunnel de Cloudflare

### Acceso remoto
- **Web pública**: https://cloud.hexa38.com (vía Cloudflare Tunnel)
- **Local LAN**: http://192.168.1.69:9000
- **Tailscale**: `ssh aldo@100.91.119.52`
- **Acceso interno** (al contenedor): `docker exec -it nextcloud-app bash`

### Disco
- Modelo: 1.8 TB ext4
- UUID: `e3fb6904-66b6-417e-b28b-dd340e23b5d8`
- Label: `nextcloud`
- Punto de montaje: `/mnt/nextcloud`
- Configurado en `/etc/fstab` con `nofail`

### Información del NUC
- Hardware: Intel NUC con CPU N3150
- RAM: 3.68 GiB
- Storage OS: 300 GB (sda)
- Storage datos: 1.8 TB (sdb)
- OS: Ubuntu 24.04.4 LTS
- Hostname: `hexa38-nuc`

---

## 15. Checklist de emergencia <a name="15-emergencia"></a>

### 🚨 Si algo se ve raro AHORA mismo

```
[ ] 1. NO entrar en pánico — hay 7 días de backups
[ ] 2. NO ejecutar nada destructivo (rm, format, docker volume rm, docker compose down -v)
[ ] 3. Ejecutar: docker ps && df -h && mount | grep nextcloud
[ ] 4. Buscar backups: ls /mnt/nextcloud/backups/
[ ] 5. Si hay backups → seguir sección 4 (restauración)
[ ] 6. Si no aparecen backups:
       a) docker compose stop
       b) sudo umount /mnt/nextcloud
       c) sudo mount /mnt/nextcloud
       d) ls /mnt/nextcloud/backups/  ← ¿ahora aparecen?
[ ] 7. Si nada funciona → consultar logs y NO tocar más
       sudo journalctl --since "2 hours ago" | tail -100
       sudo dmesg | tail -50
[ ] 8. Pedir ayuda con esta info en mano
```

### 🔥 Si el NUC no arranca

```
[ ] 1. Entrar a BIOS (F2 al encender)
[ ] 2. Verificar que el disco SSD/M.2 aparece en Devices/Storage
[ ] 3. Verificar que está en Boot Priority
[ ] 4. Si no aparece → posible falla física, abrir el NUC y reasentar
[ ] 5. Si aparece pero no arranca → boot from USB con Ubuntu Live
       y reparar GRUB:
       sudo mount /dev/sda3 /mnt
       sudo grub-install --root-directory=/mnt /dev/sda
       sudo update-grub
```

### 📞 Información de contacto y referencias

- **Documentación oficial**: https://docs.nextcloud.com/server/latest/admin_manual/
- **Foros**: https://help.nextcloud.com/
- **GitHub Issues**: https://github.com/nextcloud/server/issues
- **Cloudflare**: https://dash.cloudflare.com/
- **Tailscale Admin**: https://login.tailscale.com/admin/

---

## 📝 Historial de cambios

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0 | 2026-04-24 | Versión inicial post-incidente |
| 2.0 | 2026-04-24 | Ampliada con: arquitectura, escenarios, optimización, seguridad, troubleshooting, backup off-site |

---

## 🎯 Plan de acción recomendado tras leer esta guía

```
[ ] 1. Eliminar Snap Nextcloud
       sudo snap remove --purge nextcloud

[ ] 2. Programar fsck para próximo reinicio
       sudo touch /forcefsck
       sudo reboot  (cuando sea conveniente)

[ ] 3. Configurar backup off-site con rclone (Google Drive)
       Sección 12, Opción 2

[ ] 4. Test de restauración en máquina de prueba
       Restaurar último backup en una VM o segundo NUC

[ ] 5. Configurar fail2ban (sección 10)

[ ] 6. Habilitar 2FA en tu usuario admin

[ ] 7. Revisar y aplicar optimizaciones de la sección 9

[ ] 8. Imprimir el checklist de emergencia (sección 15) y tenerlo a mano
```

---

**Creado:** 2026-04-24 después de incidente exitosamente resuelto
**Autor**: Aldo Escobar (con asistencia de Claude)
**Próxima revisión sugerida:** 2026-10-24 (cada 6 meses)
