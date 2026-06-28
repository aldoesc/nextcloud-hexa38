# 🔬 Guía Maestra de Diagnóstico — Linux + Docker + Nextcloud

> **Versión 1.0** — Creada el 2026-04-26
> Esta guía te enseña a diagnosticar tu sistema, interpretar resultados y reaccionar.
> Está pensada para **estudiar** y **referenciar** cuando hay problemas.

---

## 📋 Tabla de contenidos

1. [Filosofía del diagnóstico](#1-filosofía-del-diagnóstico)
2. [Sistema operativo](#2-sistema-operativo)
3. [Memoria RAM](#3-memoria-ram)
4. [CPU y procesos](#4-cpu-y-procesos)
5. [Almacenamiento](#5-almacenamiento)
6. [SMART (salud de discos)](#6-smart)
7. [Red](#7-red)
8. [Servicios systemd](#8-servicios-systemd)
9. [Logs y journalctl](#9-logs-y-journalctl)
10. [Boots y reboots](#10-boots-y-reboots)
11. [Docker](#11-docker)
12. [Nextcloud (occ)](#12-nextcloud-occ)
13. [Hardware específico](#13-hardware-específico)
14. [Análisis forense paso a paso](#14-análisis-forense)
15. [Script todo-en-uno](#15-script-todo-en-uno)
16. [Cuándo hacer cada cosa](#16-cuándo-hacer-cada-cosa)

---

## 1. Filosofía del diagnóstico <a name="1-filosofía-del-diagnóstico"></a>

### Las 5 reglas
1. **Observar antes de actuar**: nunca hagas cambios sin entender qué pasa
2. **De lo general a lo específico**: primero ver el sistema, luego el componente
3. **Logs en orden cronológico**: ¿qué pasó ANTES del error?
4. **Una variable a la vez**: si cambias todo, no sabrás qué arregló qué
5. **Documentar todo**: guardar comandos y salidas para volver después

### Ciclo de diagnóstico
```
[Observar síntoma] → [Hipótesis] → [Verificar con comandos]
       ↑                                      ↓
       └──────────[Refinar]──────────────────┘
```

### Tu kit básico
```bash
# 1. ¿Está vivo?
uptime; docker ps; df -h; free -h

# 2. ¿Hay servicios caídos?
systemctl --failed

# 3. ¿Hubo errores recientes?
sudo journalctl --since "1 hour ago" -p err --no-pager | head -30

# 4. ¿Cómo están los recursos?
top -b -n1 | head -20
```

---

## 2. Sistema operativo <a name="2-sistema-operativo"></a>

### `uname -a`
**Qué hace:** muestra kernel, hostname, arquitectura.

**Ejemplo:**
```
Linux hexa38-nuc 6.17.0-22-generic #22 SMP x86_64 GNU/Linux
```

**Cómo interpretar:**
- `6.17.0-22-generic`: versión del kernel
- `x86_64`: arquitectura de 64 bits
- Si hay errores raros, verifica si tu kernel es muy nuevo o muy viejo

---

### `lsb_release -a`
**Qué hace:** muestra distribución y versión de Linux.

**Ejemplo:**
```
Distributor ID: Ubuntu
Description:    Ubuntu 24.04.4 LTS
Release:        24.04
Codename:       noble
```

**Cómo interpretar:** confirma que estás en la distribución correcta.

---

### `uptime`
**Qué hace:** tiempo encendido + carga del sistema.

**Ejemplo:**
```
03:08:47 up 5 days, 2:12, 1 user, load average: 0.29, 0.28, 0.32
```

**Cómo interpretar:**
- `up 5 days`: el sistema lleva 5 días encendido
- `load average: 0.29, 0.28, 0.32`: carga en 1, 5, 15 minutos
- **Regla**: la carga ideal es **menor que el número de cores**. Tienes 4 cores, así que <4 es OK
- Si load > cores: sistema sobrecargado
- Si load < cores: sistema relajado

---

### `who` y `last`
**Qué hace:** quién está logueado y quién lo estuvo.

```bash
who          # Usuarios actualmente conectados
last -F      # Historial de logins
last reboot  # Solo reboots
```

**Cómo interpretar:** detecta logins no autorizados o reboots inesperados.

---

## 3. Memoria RAM <a name="3-memoria-ram"></a>

### `free -h`
**Qué hace:** muestra uso de RAM y swap.

**Ejemplo sano:**
```
              total        used        free      shared  buff/cache   available
Mem:          3.6Gi       1.3Gi       400Mi        50Mi       2.0Gi       2.4Gi
Swap:         7.7Gi       0Bi         7.7Gi
```

**Cómo interpretar:**
- `total`: RAM física
- `used`: RAM ocupada por procesos
- `available`: cuánta RAM puede dar el sistema a un nuevo proceso (lo más importante)
- `buff/cache`: RAM usada como caché de disco (se libera si hace falta)
- **Swap usado**: si > 50% sostenido, te falta RAM

**🚨 Banderas rojas:**
- `available` < 200 MB → te quedaste sin RAM
- Swap usado > 1 GB → muy mal rendimiento
- Si swap aumenta sin parar → fuga de memoria

---

### `vmstat 1 5`
**Qué hace:** muestra estadísticas de memoria, swap, CPU cada segundo.

**Cómo interpretar:**
- `si` (swap in): leyendo del swap → sistema lento
- `so` (swap out): escribiendo al swap → te falta RAM
- Si ambos son > 0 sostenido → ampliar RAM

---

### Detectar OOM kills
**Qué hace:** ver si el kernel mató procesos por falta de memoria.

```bash
sudo dmesg | grep -i "killed process"
sudo journalctl --since "30 days ago" | grep -i "out of memory" | head
```

**Cómo interpretar:**
- Si aparece algo: el kernel mató procesos por OOM → **necesitas más RAM**
- Vacío: bien

---

## 4. CPU y procesos <a name="4-cpu-y-procesos"></a>

### `top` y `htop` y `btop`
**Qué hace:** monitor en tiempo real de procesos.

**Atajos en `top`:**
- `M`: ordenar por uso de memoria
- `P`: ordenar por uso de CPU
- `q`: salir

**Cómo interpretar la línea de cabecera:**
```
%Cpu(s): 18.0 us, 5.0 sy, 0.0 ni, 75.0 id, 2.0 wa, 0.0 hi, 0.0 si, 0.0 st
```
- `us` (user): % CPU usado por procesos del usuario
- `sy` (system): % CPU usado por kernel
- `id` (idle): % libre
- `wa` (iowait): % esperando disco — **si > 20%, tu disco es el cuello de botella**
- `st` (steal): % robado por hipervisor (solo en VMs)

---

### Procesos que más consumen
```bash
# Top 5 por CPU
ps aux --sort=-%cpu | head -6

# Top 5 por memoria
ps aux --sort=-%mem | head -6
```

---

### `lscpu`
**Qué hace:** info detallada de la CPU.

**Ejemplo:**
```
CPU(s):              4
Model name:          Intel(R) Celeron(R) CPU N3150 @ 1.60GHz
CPU max MHz:         2080.0000
CPU min MHz:         480.0000
```

**Cómo interpretar:** confirma cuántos cores y velocidad máxima tienes.

---

## 5. Almacenamiento <a name="5-almacenamiento"></a>

### `df -h`
**Qué hace:** uso de espacio por filesystem montado.

**Ejemplo:**
```
Filesystem                         Size  Used Avail Use% Mounted on
/dev/mapper/ubuntu--vg-ubuntu--lv   98G   19G   75G  20% /
/dev/sdb1                          1.8T  46G  1.7T   3% /mnt/nextcloud
```

**Cómo interpretar:**
- `Use%`: porcentaje usado
- **Banderas rojas**:
  - `Use% > 90%` en `/` → sistema puede empezar a fallar
  - `Use% = 100%` → todo se rompe
- Si crece muy rápido sin que subas archivos → algo está escribiendo logs/cache

---

### `du -sh`
**Qué hace:** cuánto espacio ocupa un directorio.

```bash
# Ver qué directorios ocupan más
sudo du -sh /var/log /var/lib /home /tmp /mnt/nextcloud 2>/dev/null

# Top 10 directorios más grandes en /
sudo du -h --max-depth=1 / 2>/dev/null | sort -hr | head -10
```

**Cómo interpretar:** detecta logs descontrolados, caches, archivos olvidados.

---

### `lsblk`
**Qué hace:** muestra todos los discos y particiones.

**Ejemplo:**
```
NAME                      MAJ:MIN RM   SIZE RO TYPE MOUNTPOINTS
sda                         8:0    0 298.1G  0 disk
├─sda1                      8:1    0     1G  0 part /boot/efi
├─sda2                      8:2    0     2G  0 part /boot
└─sda3                      8:3    0   295G  0 part
  └─ubuntu--vg-ubuntu--lv 252:0    0   100G  0 lvm  /
sdb                         8:16   0   1.8T  0 disk
└─sdb1                      8:17   0   1.8T  0 part /mnt/nextcloud
```

**Cómo interpretar:**
- Identifica discos físicos (`sda`, `sdb`) y sus particiones
- `MOUNTPOINTS`: dónde está montado cada uno
- Detecta discos no montados (problema potencial)

---

### `mount` y `/etc/fstab`
```bash
mount | column -t       # Qué está montado AHORA
cat /etc/fstab          # Qué se monta al boot
```

**Cómo interpretar:**
- Si algo está en `fstab` pero no en `mount` → falló al montar
- `nofail` en fstab: el sistema sigue arrancando aunque el disco no monte
- `noatime`: optimización para SSD (reduce escrituras)

---

### `lsof +D /ruta`
**Qué hace:** ver qué procesos usan archivos en una ruta.

```bash
sudo lsof +D /mnt/nextcloud
```

**Cuándo usarlo:** antes de hacer `umount` para saber qué está bloqueando.

---

### Velocidad de lectura
```bash
# Leer 1 GB del disco (no destruye datos)
sudo dd if=/dev/sda of=/dev/null bs=1M count=1000 status=progress
```

**Cómo interpretar:**
- HDD nuevo: 80-150 MB/s
- HDD viejo: 40-80 MB/s
- SSD SATA: 400-550 MB/s
- SSD NVMe: 1000+ MB/s
- Si es muy lento, el disco puede tener bad sectors

---

## 6. SMART — Salud de discos <a name="6-smart"></a>

SMART es el sistema de auto-monitoreo de los discos. Te dice si tu disco está sano o agonizando.

### Instalación
```bash
sudo apt install -y smartmontools
```

### Comprobación rápida de salud
```bash
sudo smartctl -H /dev/sda
sudo smartctl -H /dev/sdb
```

**Salidas posibles:**
- `PASSED`: el disco está sano (según el fabricante)
- `FAILED!`: ¡reemplazar YA!

### Atributos detallados
```bash
sudo smartctl -A /dev/sda
```

### 🎯 Atributos CRÍTICOS y cómo interpretarlos

| Atributo | Qué significa | ✅ Bueno | ⚠️ Atención | 🚨 Malo |
|----------|---------------|---------|-------------|---------|
| **Reallocated_Sector_Ct** | Sectores defectuosos remapeados | 0 | 1-50 | >50 o creciendo |
| **Current_Pending_Sector** | Sectores pendientes de reasignar | 0 | 1-5 | >5 |
| **Offline_Uncorrectable** | Errores no corregibles offline | 0 | 1-5 | >5 |
| **Reported_Uncorrect** | Errores no corregidos a SO | 0 | <100 | >1000 |
| **Power_On_Hours** | Horas encendido | <40,000 | 40-60K | >60K |
| **Temperature_Celsius** | Temperatura | <45 | 45-55 | >55 |
| **UDMA_CRC_Error_Count** | Errores de cable SATA | 0 | 1-10 | >10 (cambiar cable) |
| **Power_Cycle_Count** | Encendidos/apagados | <1000 | 1-5K | >10K |
| **Wear_Leveling_Count** (SSD) | Desgaste del SSD | <50% | 50-90% | >90% |
| **Available_Reserved_Space** (SSD) | Reserva del SSD | >50 | 10-50 | <10 |

### Test de superficie (largo, ~30 min - 8h)
```bash
# Test corto (2-5 minutos)
sudo smartctl -t short /dev/sda
# Esperar 5 min, luego ver resultado:
sudo smartctl -l selftest /dev/sda

# Test largo (varias horas, hace barrido completo)
sudo smartctl -t long /dev/sda
```

### Cuándo cambiar el disco
**Cambia el disco si:**
- `Reallocated_Sector_Ct` está creciendo mes a mes
- `Current_Pending_Sector` > 0
- Falla el test corto o largo
- `SMART overall-health: FAILED`
- Aparecen errores de I/O en `dmesg`

---

## 7. Red <a name="7-red"></a>

### `ip a`
**Qué hace:** muestra interfaces de red e IPs.

**Ejemplo:**
```
2: wlp2s0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500
    inet 192.168.1.69/24 brd 192.168.1.255 scope global dynamic
```

**Cómo interpretar:**
- `UP,LOWER_UP`: la interfaz está activa
- `inet`: la IP que tienes
- Si no ves IP: problema de DHCP o cable

---

### `ss -tlnp`
**Qué hace:** muestra puertos TCP escuchando.

```bash
sudo ss -tlnp
```

**Ejemplo:**
```
LISTEN 0 4096 0.0.0.0:9000 0.0.0.0:* users:(("docker-proxy",pid=2317))
LISTEN 0 511 *:80 *:* users:(("apache2",pid=2315))
```

**Cómo interpretar:**
- `0.0.0.0:9000`: escuchando en TODAS las IPs en puerto 9000
- `127.0.0.1:5432`: solo escucha localhost (más seguro)
- Detecta servicios sospechosos escuchando

---

### `ping` y `dig`
```bash
ping -c 3 8.8.8.8         # ¿Tienes internet?
ping -c 3 google.com      # ¿Funciona DNS?
dig google.com            # Resolución detallada
nslookup cloud.hexa38.com # Verificar tu dominio
```

---

### `traceroute`
```bash
traceroute google.com
```
Muestra la ruta que toma un paquete. Detecta dónde está el cuello de botella.

---

### Velocidad de red
```bash
# Instalar speedtest
sudo apt install -y speedtest-cli
speedtest-cli
```

---

## 8. Servicios systemd <a name="8-servicios-systemd"></a>

### Ver estado de un servicio
```bash
systemctl status docker
systemctl status nextcloud-app   # No existe (Docker no es servicio systemd)
```

**Estados:**
- `active (running)`: corriendo OK
- `inactive (dead)`: parado
- `failed`: falló al iniciar
- `activating`: arrancando

---

### Listar servicios
```bash
# Todos los activos
systemctl list-units --state=active

# Solo los fallidos
systemctl --failed

# Habilitados al boot
systemctl list-unit-files --state=enabled
```

---

### Habilitar / deshabilitar servicios
```bash
sudo systemctl enable docker     # Iniciar al boot
sudo systemctl disable docker    # NO iniciar al boot
sudo systemctl start docker      # Iniciar ahora
sudo systemctl stop docker       # Parar ahora
sudo systemctl restart docker    # Reiniciar
sudo systemctl reload docker     # Recargar config sin parar
```

---

### Timers (cron moderno de systemd)
```bash
systemctl list-timers --all
```

---

## 9. Logs y journalctl <a name="9-logs-y-journalctl"></a>

`journalctl` es la herramienta más poderosa para investigar problemas.

### Comandos básicos
```bash
# Logs en vivo (como tail -f)
sudo journalctl -f

# Logs desde el último boot
sudo journalctl -b 0

# Logs del boot anterior
sudo journalctl -b -1

# Logs de un servicio específico
sudo journalctl -u docker

# Solo errores y peor
sudo journalctl -p err

# Por rango de tiempo
sudo journalctl --since "2 hours ago"
sudo journalctl --since "2026-04-25 10:00" --until "2026-04-25 12:00"

# Solo kernel
sudo journalctl -k
```

---

### Niveles de prioridad (`-p`)
| Nivel | Nombre | Uso |
|-------|--------|-----|
| 0 | emerg | Sistema inutilizable |
| 1 | alert | Acción inmediata |
| 2 | crit | Crítico |
| 3 | err | Error |
| 4 | warning | Advertencia |
| 5 | notice | Notable pero normal |
| 6 | info | Informativo |
| 7 | debug | Depuración |

```bash
# Solo críticos del último boot
sudo journalctl -b 0 -p crit

# Errores de las últimas 24h
sudo journalctl --since "1 day ago" -p err
```

---

### Buscar texto específico
```bash
# Buscar "error" en todos los logs del último boot
sudo journalctl -b 0 | grep -i error

# Buscar disco sdb con errores
sudo journalctl | grep -iE "sdb.*error|i/o error"

# Errores de OOM
sudo journalctl | grep -iE "oom|out of memory|killed process"
```

---

### Tamaño y rotación
```bash
# Cuánto espacio usan los logs
journalctl --disk-usage

# Limitar tamaño (en /etc/systemd/journald.conf):
SystemMaxUse=500M

# Limpiar logs antiguos
sudo journalctl --vacuum-time=30d  # Borrar más de 30 días
sudo journalctl --vacuum-size=500M # Mantener solo 500 MB
```

---

## 10. Boots y reboots <a name="10-boots-y-reboots"></a>

### Listar todos los boots
```bash
sudo journalctl --list-boots
```

**Ejemplo:**
```
IDX BOOT ID                          FIRST ENTRY                 LAST ENTRY
 -2 f74774639ac04d61852452d6df31f78e Fri 2026-04-24 22:15:28 UTC Sat 2026-04-25 00:04:42 UTC
 -1 0f5b3c36b28c461bb277460a53a283cc Sat 2026-04-25 00:05:13 UTC Sat 2026-04-25 02:56:10 UTC
  0 c3edab38b9084c2dbcfe1aa9a2ce99af Sat 2026-04-25 03:08:20 UTC Sun 2026-04-26 12:35:17 UTC
```

**IDX:**
- `0`: el boot ACTUAL
- `-1`: el anterior
- `-2`: dos boots atrás
- ...

---

### ¿Cómo terminó cada boot? (clean vs crash)
```bash
# Ver últimas líneas de un boot anterior
sudo journalctl -b -1 --no-pager | tail -50
```

**Si terminó CLEAN (planificado):**
```
systemd-poweroff.service: Deactivated successfully.
Finished systemd-poweroff.service - System Power Off.
Reached target poweroff.target - System Power Off.
```

**Si terminó CON CRASH:**
- Ningún mensaje de shutdown
- Termina abruptamente con kernel panic, OOM, o último mensaje normal
- Falta el mensaje `Reached target shutdown.target`

---

### Buscar kernel panics
```bash
sudo journalctl --since "30 days ago" -k | grep -iE "panic|oops|kernel BUG"
```

---

### Detectar reboots inesperados
```bash
last -F | head -20
last reboot
```

**Cómo interpretar la duración:**
- `(00:01)`: 1 minuto → muy raro, suele ser intervención manual o crash
- `(00:22)`: 22 minutos → posible mantenimiento
- Si hay muchos reboots cortos → algo está apagando el sistema

---

## 11. Docker <a name="11-docker"></a>

### Estado general
```bash
# Información del daemon
docker info

# Espacio usado por Docker
docker system df

# Limpiar lo no usado (cuidado)
docker system prune -f         # Limpia contenedores parados, imágenes huérfanas
docker system prune -af --volumes  # Limpia TAMBIÉN volúmenes (¡revisa antes!)
```

---

### Contenedores
```bash
docker ps                    # Solo activos
docker ps -a                 # Todos (incluye parados)
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
```

**Estados importantes:**
- `Up X minutes`: corriendo
- `Restarting`: ⚠️ algo falla, mira logs
- `Exited (0)`: salió OK
- `Exited (137)`: matado por OOM o SIGKILL
- `Exited (1)`: error genérico

---

### Logs de un contenedor
```bash
docker logs nextcloud-app                  # Todos los logs
docker logs nextcloud-app --tail 50        # Últimas 50 líneas
docker logs nextcloud-app -f               # En vivo
docker logs nextcloud-app --since 1h       # Última hora
docker logs nextcloud-app 2>&1 | grep -i error
```

---

### Ejecutar comandos dentro
```bash
# Shell interactiva
docker exec -it nextcloud-app bash

# Como un usuario específico
docker exec -u www-data -it nextcloud-app bash

# Comando único
docker exec nextcloud-app php --version
```

---

### Inspeccionar
```bash
# Toda la info del contenedor
docker inspect nextcloud-app

# Solo los mounts
docker inspect nextcloud-app --format '{{range .Mounts}}{{.Type}} {{.Source}} -> {{.Destination}}{{println}}{{end}}'

# IP del contenedor
docker inspect nextcloud-app --format '{{.NetworkSettings.Networks.backend.IPAddress}}'

# Variables de entorno
docker inspect nextcloud-app --format '{{range .Config.Env}}{{println .}}{{end}}'
```

---

### Volúmenes
```bash
docker volume ls                              # Listar
docker volume inspect NOMBRE                  # Info detallada
docker volume rm NOMBRE                       # Borrar (¡cuidado!)
sudo du -sh /var/lib/docker/volumes/*         # Tamaño de cada uno
```

---

### Recursos en vivo
```bash
docker stats                # Como `top` pero para contenedores
docker stats --no-stream    # Snapshot único
```

**Columnas:**
- `CPU %`: % CPU usado por el contenedor
- `MEM USAGE / LIMIT`: memoria usada / límite
- `NET I/O`: tráfico de red
- `BLOCK I/O`: lectura/escritura disco

---

### Docker Compose
```bash
cd /home/aldo/nextcloud

docker compose ps              # Estado
docker compose logs            # Todos los logs
docker compose logs -f app     # Logs en vivo de "app"
docker compose down            # Parar y borrar contenedores (NO volúmenes)
docker compose down -v         # Parar Y borrar volúmenes ⚠️
docker compose up -d           # Levantar en background
docker compose restart app     # Reiniciar solo "app"
docker compose pull            # Actualizar imágenes
```

---

## 12. Nextcloud (occ) <a name="12-nextcloud-occ"></a>

`occ` es la herramienta de línea de comando de Nextcloud. Se ejecuta dentro del contenedor.

### Sintaxis básica
```bash
docker exec -u www-data nextcloud-app php occ COMANDO
```

### Estado y diagnóstico
```bash
docker exec -u www-data nextcloud-app php occ status
docker exec -u www-data nextcloud-app php occ check
docker exec -u www-data nextcloud-app php occ integrity:check-core
```

---

### Modo mantenimiento
```bash
docker exec -u www-data nextcloud-app php occ maintenance:mode --on
docker exec -u www-data nextcloud-app php occ maintenance:mode --off
docker exec -u www-data nextcloud-app php occ maintenance:repair
```

---

### Usuarios
```bash
docker exec -u www-data nextcloud-app php occ user:list
docker exec -u www-data nextcloud-app php occ user:list --info
docker exec -it -u www-data nextcloud-app php occ user:resetpassword USUARIO
docker exec -it -u www-data nextcloud-app php occ user:add --group admin USUARIO
docker exec -u www-data nextcloud-app php occ user:disable USUARIO
docker exec -u www-data nextcloud-app php occ user:lastseen USUARIO
docker exec -u www-data nextcloud-app php occ user:report   # Estadísticas
```

---

### Apps
```bash
docker exec -u www-data nextcloud-app php occ app:list
docker exec -u www-data nextcloud-app php occ app:enable APP
docker exec -u www-data nextcloud-app php occ app:disable APP
docker exec -u www-data nextcloud-app php occ app:install APP
docker exec -u www-data nextcloud-app php occ app:update --all
```

---

### Archivos
```bash
# Reescaneo completo (lento si hay muchos archivos)
docker exec -u www-data nextcloud-app php occ files:scan --all

# Reescanear solo un usuario
docker exec -u www-data nextcloud-app php occ files:scan USUARIO

# Limpiar archivos huérfanos
docker exec -u www-data nextcloud-app php occ files:cleanup

# Ver storage de un usuario
docker exec -u www-data nextcloud-app php occ user:setting USUARIO files quota
```

---

### Configuración
```bash
# Listar toda la config
docker exec -u www-data nextcloud-app php occ config:list

# Solo del sistema
docker exec -u www-data nextcloud-app php occ config:list system

# Obtener un valor
docker exec -u www-data nextcloud-app php occ config:system:get trusted_domains

# Establecer un valor
docker exec -u www-data nextcloud-app php occ config:system:set trusted_domains 2 --value="otro.dominio.com"

# Borrar un valor
docker exec -u www-data nextcloud-app php occ config:system:delete trusted_domains 2
```

---

### Base de datos
```bash
# Reparaciones recomendadas
docker exec -u www-data nextcloud-app php occ db:add-missing-indices
docker exec -u www-data nextcloud-app php occ db:add-missing-columns
docker exec -u www-data nextcloud-app php occ db:add-missing-primary-keys
docker exec -u www-data nextcloud-app php occ db:convert-filecache-bigint
```

---

### Logs
```bash
# Ver últimos eventos
docker exec -u www-data nextcloud-app php occ log:tail

# Cambiar nivel de log (0=Debug, 1=Info, 2=Warn, 3=Error, 4=Fatal)
docker exec -u www-data nextcloud-app php occ log:manage --level=warning

# Ver el log raw
docker exec nextcloud-app tail -100 /var/www/html/data/nextcloud.log

# Limpiar el log
docker exec nextcloud-app truncate -s 0 /var/www/html/data/nextcloud.log
```

---

## 13. Hardware específico <a name="13-hardware-específico"></a>

### Temperatura
```bash
sudo apt install -y lm-sensors
sudo sensors-detect --auto
sudo sensors
```

**Ejemplo:**
```
coretemp-isa-0000
Adapter: ISA adapter
Core 0:       +56.0°C  (high = +90.0°C, crit = +90.0°C)
Core 1:       +56.0°C  (high = +90.0°C, crit = +90.0°C)
```

**Banderas rojas:**
- Core > 80°C: refrigeración insuficiente
- Core > 90°C (crit): ¡throttling, posible apagado!

---

### Memoria física (RAM)
```bash
sudo dmidecode --type memory | grep -E "Size|Speed|Type:"
```

**Ejemplo:**
```
Size: 4 GB
Type: DDR3
Speed: 1600 MT/s
```

---

### CPU info
```bash
lscpu | grep -E "Model name|CPU\(s\)|MHz"
cat /proc/cpuinfo | grep "model name" | head -1
```

---

### USB y dispositivos
```bash
lsusb            # USB conectados
lspci            # PCI (gráfica, red, etc.)
lshw -short      # Resumen de TODO el hardware
```

---

### Energía y batería (si aplica)
```bash
upower -d        # Estado de batería/UPS
```

---

## 14. Análisis forense paso a paso <a name="14-análisis-forense"></a>

Cuando algo se rompió, sigue este flujo:

### Paso 1: ¿Cuándo empezó?
```bash
# Ver logs del momento aproximado
sudo journalctl --since "2026-04-24 03:00:00" --until "2026-04-24 04:00:00"
```

### Paso 2: ¿Qué se ve en los logs?
```bash
# Errores en ese rango
sudo journalctl --since "2026-04-24 03:00:00" --until "2026-04-24 04:00:00" -p err
```

### Paso 3: ¿Qué procesos hubo?
```bash
# Bash history del usuario
cat /home/aldo/.bash_history | tail -50
sudo cat /root/.bash_history | tail -50

# Comandos sudo recientes
sudo journalctl _COMM=sudo --since "2 days ago"
```

### Paso 4: ¿Hubo apagados/reboots?
```bash
last -F | head -20
sudo journalctl --list-boots
```

### Paso 5: ¿El hardware está bien?
```bash
sudo smartctl -H /dev/sda
sudo smartctl -H /dev/sdb
free -h
sudo dmesg | tail -50
```

### Paso 6: ¿Algún cron ejecutado en ese momento?
```bash
sudo grep CRON /var/log/syslog | grep "abr 24 03:"  # Ajustar fecha
```

### Paso 7: Reconstruye el timeline
Crea un documento con:
- **Hora**: qué pasó
- **Comando o proceso**: qué se ejecutó
- **Resultado**: qué cambió

---

## 15. Script todo-en-uno <a name="15-script-todo-en-uno"></a>

Guarda esto como `/home/aldo/diagnostico.sh`:

```bash
#!/bin/bash
# Diagnostico completo del sistema
# Uso: sudo bash diagnostico.sh > diagnostico_$(date +%Y%m%d).txt

echo "===================="
echo "DIAGNOSTICO SISTEMA $(date)"
echo "===================="

echo ""
echo "=== UPTIME ==="
uptime

echo ""
echo "=== SISTEMA OPERATIVO ==="
lsb_release -a 2>/dev/null
uname -r

echo ""
echo "=== CPU ==="
lscpu | grep -E "Model name|CPU\(s\):|MHz"

echo ""
echo "=== MEMORIA ==="
free -h
echo "OOM kills:"
sudo dmesg | grep -i "killed process" | tail -5

echo ""
echo "=== DISCOS ==="
df -h
echo ""
lsblk -f
echo ""
mount | grep -v "tmpfs\|cgroup\|proc\|sysfs" | column -t

echo ""
echo "=== SMART ==="
for disk in /dev/sda /dev/sdb; do
    if [ -e "$disk" ]; then
        echo "--- $disk ---"
        sudo smartctl -H $disk 2>&1 | grep -E "PASSED|FAILED|test result"
        sudo smartctl -A $disk 2>&1 | grep -E "Reallocated_Sector_Ct|Current_Pending_Sector|Offline_Uncorrectable|UDMA_CRC|Temperature"
    fi
done

echo ""
echo "=== TEMPERATURA ==="
sudo sensors 2>/dev/null | grep -E "Core|temp"

echo ""
echo "=== RED ==="
ip -br a
echo ""
sudo ss -tlnp | head -20

echo ""
echo "=== SERVICIOS FALLIDOS ==="
systemctl --failed --no-legend
echo "Total fallidos: $(systemctl --failed --no-legend | wc -l)"

echo ""
echo "=== DOCKER ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
echo ""
docker system df

echo ""
echo "=== NEXTCLOUD ==="
docker exec -u www-data nextcloud-app php occ status 2>/dev/null
echo ""
docker exec -u www-data nextcloud-app php occ user:list 2>/dev/null

echo ""
echo "=== BACKUPS ==="
ls -lt /mnt/nextcloud/backups/ 2>/dev/null | head -10
echo ""
echo "Último backup en log:"
grep "BACKUP COMPLETADO" /mnt/nextcloud/backups/backup.log 2>/dev/null | tail -3

echo ""
echo "=== ERRORES ÚLTIMAS 24H ==="
sudo journalctl --since "1 day ago" -p err --no-pager | head -30

echo ""
echo "=== BOOTS RECIENTES ==="
sudo journalctl --list-boots | tail -10

echo ""
echo "===================="
echo "FIN DIAGNOSTICO"
echo "===================="
```

Hazlo ejecutable y úsalo así:
```bash
chmod +x /home/aldo/diagnostico.sh
sudo bash /home/aldo/diagnostico.sh > ~/diagnostico_$(date +%Y%m%d_%H%M).txt
```

Súbelo a Drive si quieres tener historial:
```bash
rclone copy ~/diagnostico_*.txt gdrive:diagnosticos/
```

---

## 16. Cuándo hacer cada cosa <a name="16-cuándo-hacer-cada-cosa"></a>

### 📅 Diario (automático con cron)
- Backup completo (3 AM)

### 📅 Semanal (manualmente, 5 minutos)
```bash
# 1. Estado general
docker ps && df -h && free -h

# 2. Errores recientes
sudo journalctl --since "7 days ago" -p err --no-pager | head -30
docker exec nextcloud-app tail -50 /var/www/html/data/nextcloud.log

# 3. Backups recientes
ls -lt /mnt/nextcloud/backups/ | head -5
```

### 📅 Mensual (15 minutos)
```bash
# 1. Diagnóstico completo
sudo bash /home/aldo/diagnostico.sh > ~/diagnostico_$(date +%Y%m%d).txt

# 2. SMART de discos
sudo smartctl -A /dev/sda | grep -E "Reallocated|Pending|Uncorrectable"
sudo smartctl -A /dev/sdb | grep -E "Reallocated|Pending|Uncorrectable"

# 3. Mantenimiento Nextcloud
docker exec -u www-data nextcloud-app php occ maintenance:repair
docker exec -u www-data nextcloud-app php occ db:add-missing-indices

# 4. Limpieza Docker
docker system prune -f
docker image prune -f

# 5. Updates Ubuntu
sudo apt update && sudo apt upgrade -y
```

### 📅 Trimestral (1 hora)
```bash
# 1. Test SMART completo (deja correr unas horas)
sudo smartctl -t long /dev/sda
sudo smartctl -t long /dev/sdb

# 2. Test de restauración
# Restaura un backup en una VM o segundo NUC para verificar el procedimiento

# 3. Actualizar Nextcloud (con backup previo)
sudo bash /home/aldo/nextcloud/backup.sh
cd /home/aldo/nextcloud && docker compose pull && docker compose up -d
docker exec -u www-data nextcloud-app php occ upgrade
```

### 🚨 Cuando algo se rompa
1. `docker ps && df -h && free -h` (estado general)
2. `systemctl --failed` (servicios caídos)
3. `sudo journalctl --since "1 hour ago" -p err` (errores recientes)
4. `docker logs CONTENEDOR --tail 50` (logs del servicio que falla)
5. Identifica el problema → consulta sección específica de esta guía
6. Aplica solución
7. **Documenta** lo que pasó y la solución para futuras referencias

---

## 📖 Recursos adicionales para estudiar

### Comandos esenciales que vale la pena dominar
- `grep`, `awk`, `sed` (procesamiento de texto)
- `find` y `xargs` (búsqueda de archivos)
- `tar`, `rsync` (backups y sincronización)
- `cron` y `systemd-timer` (tareas programadas)
- `iptables` y `nftables` (firewall)

### Lecturas recomendadas
- **The Linux Command Line** (William Shotts) - PDF gratuito
- **Docker Deep Dive** (Nigel Poulton)
- Documentación oficial de Nextcloud: https://docs.nextcloud.com/
- Arch Linux Wiki (aplicable a casi cualquier distro): https://wiki.archlinux.org/

### Práctica
- Configura una VM de pruebas y rómpela a propósito
- Restaura tus backups en la VM (test de DR)
- Lee logs aleatorios de tu sistema 5 minutos al día
- Usa `man` para todo: `man journalctl`, `man systemctl`, etc.

---

## 🎯 Resumen ejecutivo

Para diagnosticar cualquier problema, recuerda esta secuencia:

```
1. ESTADO  → docker ps, df -h, free -h, systemctl --failed
2. LOGS    → journalctl, docker logs, nextcloud.log
3. CAUSA   → bash_history, last reboot, journalctl filtrado
4. ACCIÓN  → solución específica para el problema identificado
5. DOC     → escribir lo aprendido aquí mismo
```

---

**Creado:** 2026-04-26
**Autor:** Aldo Escobar (con asistencia de Claude)
**Próxima revisión:** cada 6 meses
