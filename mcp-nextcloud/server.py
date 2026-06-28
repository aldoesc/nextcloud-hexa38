#!/usr/bin/env python3
"""
MCP Server — Gestión del NUC Nextcloud Hexa38
Conecta vía Tailscale SSH al servidor Ubuntu usando paramiko (SSH in-process).

Nota de arquitectura: NO se usa ssh.exe como subproceso porque Claude Desktop
ejecuta el MCP en un sandbox (Electron) que bloquea ese binario. paramiko corre
dentro del proceso Python, que sí tiene acceso de red. Tailscale SSH autentica
por identidad de red ("none" auth), sin clave ni password.
"""

import os
import logging
import asyncio
import socket
import threading
from typing import Optional

import paramiko
from dotenv import load_dotenv
from pydantic import BaseModel, Field, ConfigDict
from mcp.server.fastmcp import FastMCP

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# Silenciar logging de paramiko (evita ruido en stderr del MCP)
logging.getLogger("paramiko").setLevel(logging.WARNING)

# ---------------------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------------------
NUC_HOST = os.getenv("NUC_HOST", "100.91.119.52")
NUC_USER = os.getenv("NUC_USER", "aldo")
NUC_SSH_PORT = int(os.getenv("NUC_SSH_PORT", "22"))
NUC_PASSWORD = os.getenv("NUC_PASSWORD", "")
NUC_SSH_KEY = os.getenv("NUC_SSH_KEY", "")
NUC_COMPOSE_DIR = os.getenv("NUC_COMPOSE_DIR", "/home/aldo/nextcloud")
NUC_BACKUP_DIR = os.getenv("NUC_BACKUP_DIR", "/mnt/nextcloud/backups")

ALLOWED_CONTAINERS = [
    "nextcloud-app",
    "nextcloud-db",
    "nextcloud-redis",
    "nextcloud-cron",
    "nextcloud-tunnel",
    "nextcloud-push",
]

USERPROFILE = os.environ.get("USERPROFILE", os.path.expanduser("~"))
_auth_lock = threading.Lock()

# ---------------------------------------------------------------------------
# SSH helper — paramiko in-process (compatible con sandbox de Claude Desktop)
# ---------------------------------------------------------------------------
def _tcp_ok(host: str, port: int, timeout: int = 5) -> str:
    """Verifica conectividad TCP básica al NUC."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return f"TCP {host}:{port} → OK"
    except Exception as e:
        return f"TCP {host}:{port} → FALLO: {e}"


def _ssh_once(command: str, timeout: int) -> tuple[str, str, int]:
    """Un intento de ejecución vía paramiko. Lanza excepción si la conexión falla."""
    transport: Optional[paramiko.Transport] = None
    try:
        sock = socket.create_connection((NUC_HOST, NUC_SSH_PORT), timeout=15)
        transport = paramiko.Transport(sock)
        transport.start_client(timeout=15)

        # Autenticación: clave > password > none (Tailscale SSH por identidad de red)
        authenticated = False
        if NUC_SSH_KEY and os.path.exists(os.path.expanduser(NUC_SSH_KEY)):
            try:
                pkey = paramiko.RSAKey.from_private_key_file(os.path.expanduser(NUC_SSH_KEY))
                transport.auth_publickey(NUC_USER, pkey)
                authenticated = True
            except Exception:
                pass
        if not authenticated and NUC_PASSWORD:
            try:
                transport.auth_password(NUC_USER, NUC_PASSWORD)
                authenticated = True
            except Exception:
                pass
        if not authenticated:
            with _auth_lock:
                transport.auth_none(NUC_USER)

        chan = transport.open_session(timeout=timeout)
        chan.settimeout(timeout)
        chan.exec_command(command)

        out = bytearray()
        err = bytearray()
        while True:
            while chan.recv_ready():
                out += chan.recv(8192)
            while chan.recv_stderr_ready():
                err += chan.recv_stderr(8192)
            if chan.exit_status_ready() and not chan.recv_ready() and not chan.recv_stderr_ready():
                break
        exit_code = chan.recv_exit_status()
        while chan.recv_ready():
            out += chan.recv(8192)
        while chan.recv_stderr_ready():
            err += chan.recv_stderr(8192)

        return (
            out.decode("utf-8", errors="replace"),
            err.decode("utf-8", errors="replace"),
            exit_code,
        )
    finally:
        if transport is not None:
            try:
                transport.close()
            except Exception:
                pass


def _ssh_sync(command: str, timeout: int = 60) -> tuple[str, str, int]:
    """Ejecuta un comando vía paramiko con un reintento ante fallos transitorios.

    El WiFi del NUC es intermitente, por lo que la conexión/auth puede fallar
    esporádicamente; un reintento la hace robusta.
    """
    last_err = ""
    for attempt in (1, 2):
        try:
            return _ssh_once(command, timeout)
        except socket.timeout:
            return "", f"Timeout ({timeout}s): el comando tardó demasiado o el NUC no responde.", 124
        except paramiko.BadAuthenticationType as e:
            return "", f"Auth rechazada. Métodos permitidos por el servidor: {e.allowed_types}", 255
        except Exception as e:
            last_err = f"{type(e).__name__}: {e}"
            if attempt == 1:
                import time
                time.sleep(1.5)   # backoff breve antes del reintento
                continue
    return "", f"Error de conexión tras 2 intentos: {last_err}", 255


async def _ssh(command: str, timeout: int = 60) -> tuple[str, str, int]:
    """Wrapper async de _ssh_sync (corre en executor para no bloquear el loop)."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _ssh_sync, command, timeout)


def _fmt(stdout: str, stderr: str, exit_code: int, title: str = "") -> str:
    """Formatea el resultado SSH en Markdown limpio."""
    parts: list[str] = []
    if title:
        parts.append(f"## {title}")
    if stdout.strip():
        parts.append(stdout.strip())
    # Mostrar stderr siempre (para diagnóstico), indicar si está vacío
    stderr_clean = stderr.strip()
    parts.append(f"**stderr:** {stderr_clean if stderr_clean else '(vacío)'}")
    if exit_code != 0:
        parts.append(f"*(exit code: {exit_code})*")
    return "\n\n".join(parts) or "(sin salida)"


# ---------------------------------------------------------------------------
# FastMCP
# ---------------------------------------------------------------------------
mcp = FastMCP("nextcloud_nuc_mcp")


# ---------------------------------------------------------------------------
# Modelos de entrada
# ---------------------------------------------------------------------------
class ContainerInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    container: str = Field(
        ...,
        description=f"Nombre del contenedor. Uno de: {', '.join(ALLOWED_CONTAINERS)}",
    )


class LogsInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    container: str = Field(
        ...,
        description=f"Nombre del contenedor. Uno de: {', '.join(ALLOWED_CONTAINERS)}",
    )
    lines: int = Field(
        default=50,
        description="Número de líneas recientes a mostrar (5-500)",
        ge=5,
        le=500,
    )
    since: Optional[str] = Field(
        default=None,
        description="Filtro temporal, ej: '1h', '30m', '2026-05-31'. Si se indica, reemplaza a 'lines'.",
    )


class OccInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    command: str = Field(
        ...,
        description="Subcomando occ, ej: 'status', 'user:list', 'notify_push:metrics', 'db:add-missing-indices'",
        min_length=1,
    )


class MaintenanceModeInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enable: bool = Field(
        ...,
        description="True para activar mantenimiento, False para desactivarlo",
    )


class RunCommandInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    command: str = Field(
        ...,
        description="Comando shell a ejecutar en el NUC. Usar con cuidado.",
        min_length=1,
        max_length=1000,
    )
    timeout: int = Field(
        default=30,
        description="Timeout en segundos (5-300)",
        ge=5,
        le=300,
    )


# ---------------------------------------------------------------------------
# Herramientas
# ---------------------------------------------------------------------------

@mcp.tool(
    name="nuc_check_health",
    annotations={
        "title": "Check NUC System Health",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def nuc_check_health() -> str:
    """Ejecuta un diagnóstico completo del servidor NUC Hexa38.

    Comprueba: uptime, memoria (free -h), uso de discos (df -h), estado de todos
    los contenedores Docker con su healthcheck, servicios systemd fallidos,
    errores recientes en journalctl, y último backup registrado.

    Returns:
        str: Informe de salud en Markdown con secciones por categoría.
    """
    cmd = (
        "echo '=== UPTIME ===' && uptime"
        " && echo '' && echo '=== MEMORIA ===' && free -h"
        " && echo '' && echo '=== DISCOS ===' && df -h | grep -v tmpfs"
        ' && echo "" && echo "=== CONTENEDORES ===" && docker ps -a --format "table {{.Names}}\\t{{.Status}}\\t{{.Image}}"'
        " && echo '' && echo '=== SERVICIOS FALLIDOS ===' && systemctl --failed --no-legend 2>&1 | head -10"
        " && echo '' && echo '=== ERRORES RECIENTES (1h) ===' && journalctl --since '1 hour ago' -p err --no-pager 2>&1 | tail -15"
        f" && echo '' && echo '=== ULTIMO BACKUP ===' && ls -lt {NUC_BACKUP_DIR}/ 2>/dev/null | head -5"
        f" && tail -5 {NUC_BACKUP_DIR}/backup.log 2>/dev/null"
    )
    stdout, stderr, code = await _ssh(cmd, timeout=45)
    return _fmt(stdout, stderr, code, "Health Check — NUC Hexa38")


@mcp.tool(
    name="nuc_get_containers",
    annotations={
        "title": "Get Docker Containers Status",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def nuc_get_containers() -> str:
    """Muestra el estado detallado de todos los contenedores Docker de Nextcloud.

    Incluye nombre, estado (running/exited/unhealthy/healthy), imagen y puertos.
    Equivale a `docker ps -a` con formato de tabla.

    Returns:
        str: Tabla con el estado de cada contenedor, incluyendo healthcheck.
    """
    stdout, stderr, code = await _ssh(
        'docker ps -a --format "table {{.Names}}\\t{{.Status}}\\t{{.Image}}\\t{{.Ports}}"'
    )
    return _fmt(stdout, stderr, code, "Estado de Contenedores Docker")


@mcp.tool(
    name="nuc_get_logs",
    annotations={
        "title": "Get Container Logs",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def nuc_get_logs(params: LogsInput) -> str:
    """Obtiene los logs recientes de un contenedor Docker específico.

    Útil para diagnosticar errores en nextcloud-tunnel (Cloudflare), nextcloud-app,
    nextcloud-db, nextcloud-redis, nextcloud-cron o nextcloud-push.

    Args:
        params (LogsInput):
            - container (str): Nombre del contenedor, ej: 'nextcloud-tunnel'
            - lines (int): Número de líneas recientes (default 50, máx 500)
            - since (Optional[str]): Filtro temporal ej: '1h', '30m' (sobreescribe lines)

    Returns:
        str: Salida de logs del contenedor.
    """
    if params.container not in ALLOWED_CONTAINERS:
        return f"Error: '{params.container}' no válido. Usa uno de: {', '.join(ALLOWED_CONTAINERS)}"
    if params.since:
        cmd = f"docker logs {params.container} --since {params.since} 2>&1 | tail -300"
    else:
        cmd = f"docker logs {params.container} --tail {params.lines} 2>&1"
    stdout, stderr, code = await _ssh(cmd, timeout=30)
    return _fmt(stdout, stderr, code, f"Logs: {params.container}")


@mcp.tool(
    name="nuc_restart_service",
    annotations={
        "title": "Restart Docker Container",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def nuc_restart_service(params: ContainerInput) -> str:
    """Reinicia un contenedor Docker específico de Nextcloud.

    Reinicio limpio (stop + start) sin pérdida de datos.
    Uso frecuente: reiniciar nextcloud-tunnel tras cambios de red o alertas de Cloudflare.

    Args:
        params (ContainerInput):
            - container (str): Contenedor a reiniciar, ej: 'nextcloud-tunnel'

    Returns:
        str: Confirmación del reinicio con nombre del contenedor.
    """
    if params.container not in ALLOWED_CONTAINERS:
        return f"Error: '{params.container}' no válido. Usa uno de: {', '.join(ALLOWED_CONTAINERS)}"
    stdout, stderr, code = await _ssh(f"docker restart {params.container}", timeout=60)
    return _fmt(stdout, stderr, code, f"Reinicio: {params.container}")


@mcp.tool(
    name="nuc_run_occ",
    annotations={
        "title": "Run Nextcloud OCC Command",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": False,
    },
)
async def nuc_run_occ(params: OccInput) -> str:
    """Ejecuta un comando occ (Operations Control Center) de Nextcloud.

    Corre como usuario www-data dentro de nextcloud-app.
    Comandos frecuentes: status, user:list, db:add-missing-indices,
    files:scan --all, notify_push:metrics, config:list system, log:tail.

    Args:
        params (OccInput):
            - command (str): Subcomando occ, ej: 'status', 'notify_push:metrics',
                             'user:report', 'config:system:get trusted_domains'

    Returns:
        str: Salida del comando occ.

    Examples:
        - 'status' → versión de Nextcloud y estado de la instalación
        - 'notify_push:metrics' → estadísticas de push notifications
        - 'user:report' → estadísticas de almacenamiento por usuario
        - 'log:tail' → últimos errores de la aplicación
        - 'check' → verifica integridad del sistema
    """
    cmd = f"docker exec -u www-data nextcloud-app php occ {params.command}"
    stdout, stderr, code = await _ssh(cmd, timeout=90)
    return _fmt(stdout, stderr, code, f"occ {params.command}")


@mcp.tool(
    name="nuc_check_backup",
    annotations={
        "title": "Check Backup Status",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def nuc_check_backup() -> str:
    """Verifica el estado de los backups locales y off-site de Nextcloud.

    Muestra: listado de backups locales con fechas y tamaños, resumen del log
    de backup, espacio total usado, y listado de backups en Google Drive (rclone).

    Returns:
        str: Informe de estado de backups en Markdown.
    """
    cmd = (
        f"echo '=== BACKUPS LOCALES ===' && ls -lht {NUC_BACKUP_DIR}/ 2>/dev/null | head -10"
        f" && echo '' && echo '=== LOG BACKUP (últimas 15 líneas) ===' && tail -15 {NUC_BACKUP_DIR}/backup.log 2>/dev/null"
        f" && echo '' && echo '=== ESPACIO USADO ===' && du -sh {NUC_BACKUP_DIR}/ 2>/dev/null"
        " && echo '' && echo '=== OFF-SITE Google Drive ==='"
        " && rclone lsf gdrive:nextcloud-backups/ 2>/dev/null | tail -15"
        " || echo '(rclone no disponible o gdrive no configurado)'"
    )
    stdout, stderr, code = await _ssh(cmd, timeout=60)
    return _fmt(stdout, stderr, code, "Estado de Backups")


@mcp.tool(
    name="nuc_check_disk",
    annotations={
        "title": "Check Disk Usage and SMART Health",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def nuc_check_disk() -> str:
    """Verifica el uso de disco y salud SMART de las unidades del NUC.

    Reporte incluye: uso de filesystems (df -h), layout de particiones (lsblk -f),
    resultado SMART de /dev/sda (HDD sistema, envejecido) y /dev/sdb (datos 2TB),
    atributos críticos SMART, y temperatura CPU.
    Nota: smartctl requiere sudo sin contraseña para el usuario aldo.

    Returns:
        str: Informe de salud de discos en Markdown.
    """
    cmd = (
        "echo '=== USO FILESYSTEMS ===' && df -h"
        " && echo '' && echo '=== PARTICIONES ===' && lsblk -f"
        " && echo '' && echo '=== SMART /dev/sda (sistema HDD) ==='"
        " && sudo smartctl -H /dev/sda 2>&1 | grep -E 'PASSED|FAILED|Error|No SMART'"
        " && sudo smartctl -A /dev/sda 2>&1 | grep -E 'Reallocated_Sector_Ct|Current_Pending_Sector|Offline_Uncorrectable|UDMA_CRC|Temperature'"
        " && echo '' && echo '=== SMART /dev/sdb (datos 2TB) ==='"
        " && sudo smartctl -H /dev/sdb 2>&1 | grep -E 'PASSED|FAILED|Error|No SMART'"
        " && sudo smartctl -A /dev/sdb 2>&1 | grep -E 'Reallocated_Sector_Ct|Current_Pending_Sector|Offline_Uncorrectable|UDMA_CRC|Temperature'"
        " && echo '' && echo '=== TEMPERATURA CPU ==='"
        " && sensors 2>/dev/null | grep -E 'Core|Package|temp' || echo '(instalar: sudo apt install lm-sensors)'"
    )
    stdout, stderr, code = await _ssh(cmd, timeout=30)
    return _fmt(stdout, stderr, code, "Salud de Discos")


@mcp.tool(
    name="nuc_check_tunnel",
    annotations={
        "title": "Check Cloudflare Tunnel Status",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def nuc_check_tunnel() -> str:
    """Verifica el estado del Cloudflare Tunnel (nextcloud-tunnel).

    Muestra el estado de salud del contenedor, logs recientes para detectar
    bucles de reconexión o conectores degradados, conteo de reconexiones,
    y verifica que Nextcloud responde internamente.
    Útil para diagnosticar alertas de 'degradado' de Cloudflare tras cambios de red.

    Returns:
        str: Informe de estado del tunnel en Markdown.
    """
    cmd = (
        "echo '=== ESTADO CONTENEDOR TUNNEL ==='; "
        "docker inspect nextcloud-tunnel --format "
        "'Status: {{.State.Status}} | Started: {{.State.StartedAt}} | Restarts: {{.RestartCount}}'; "
        "echo ''; echo '=== LOGS TUNNEL (80 líneas) ==='; "
        "docker logs nextcloud-tunnel --tail 80 2>&1; "
        "echo ''; echo '=== CONTEO EVENTOS DE CONEXIÓN ==='; "
        "docker logs nextcloud-tunnel 2>&1 | grep -ciE 'registered|connection|reconnect|connector|err' || true; "
        "echo ''; echo '=== CONECTIVIDAD NEXTCLOUD INTERNA ==='; "
        "docker exec nextcloud-app php -r "
        '\'echo @file_get_contents("http://localhost/status.php") ? "Nextcloud responde OK" : "ERROR: no responde";\' 2>&1'
    )
    stdout, stderr, code = await _ssh(cmd, timeout=35)
    return _fmt(stdout, stderr, code, "Estado Cloudflare Tunnel")


@mcp.tool(
    name="nuc_maintenance_mode",
    annotations={
        "title": "Toggle Nextcloud Maintenance Mode",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def nuc_maintenance_mode(params: MaintenanceModeInput) -> str:
    """Activa o desactiva el modo mantenimiento de Nextcloud.

    Mantenimiento ON: usuarios no pueden acceder (seguro para backups y updates).
    Mantenimiento OFF: operación normal.
    Siempre desactivar el modo mantenimiento al terminar la operación.

    Args:
        params (MaintenanceModeInput):
            - enable (bool): True para activar, False para desactivar

    Returns:
        str: Confirmación del estado de mantenimiento.
    """
    flag = "--on" if params.enable else "--off"
    label = "ACTIVANDO" if params.enable else "DESACTIVANDO"
    cmd = f"docker exec -u www-data nextcloud-app php occ maintenance:mode {flag}"
    stdout, stderr, code = await _ssh(cmd, timeout=30)
    return _fmt(stdout, stderr, code, f"Modo Mantenimiento — {label}")


@mcp.tool(
    name="nuc_run_command",
    annotations={
        "title": "Run Arbitrary Command on NUC",
        "readOnlyHint": False,
        "destructiveHint": True,
        "idempotentHint": False,
        "openWorldHint": False,
    },
)
async def nuc_run_command(params: RunCommandInput) -> str:
    """Ejecuta un comando shell arbitrario en el NUC vía SSH.

    Herramienta de diagnóstico avanzado para operaciones no cubiertas por las
    demás herramientas. Puede ejecutar CUALQUIER comando — usar con precaución.
    Preferir las herramientas específicas cuando estén disponibles.

    Args:
        params (RunCommandInput):
            - command (str): Comando a ejecutar, ej: 'tailscale status', 'docker network inspect backend'
            - timeout (int): Timeout en segundos (default 30, máx 300)

    Returns:
        str: Salida stdout + stderr del comando.

    Examples:
        - 'uptime && free -h' → resumen rápido del sistema
        - 'sudo journalctl --since "30 minutes ago" -p err' → errores recientes
        - 'docker network ls && docker network inspect backend' → redes Docker
        - 'tailscale status' → estado de la VPN Tailscale
        - 'sudo last reboot | head -10' → historial de reboots
        - 'cat /home/aldo/nextcloud/docker-compose.yml' → ver docker-compose actual
    """
    stdout, stderr, code = await _ssh(params.command, timeout=params.timeout)
    return _fmt(stdout, stderr, code, f"$ {params.command}")


# ---------------------------------------------------------------------------
# Diagnóstico de conexión
# ---------------------------------------------------------------------------
@mcp.tool(
    name="nuc_debug_connection",
    annotations={
        "title": "Debug SSH Connection",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def nuc_debug_connection() -> str:
    """Diagnostica la conectividad paramiko SSH desde el proceso MCP al NUC.

    Muestra: configuración de conexión, test TCP, y resultado de un comando
    de prueba vía paramiko (auth 'none' de Tailscale SSH).

    Returns:
        str: Informe de diagnóstico de conexión.
    """
    lines = ["## Diagnóstico de conexión MCP → NUC (paramiko)", ""]
    lines.append(f"- **NUC:** `{NUC_USER}@{NUC_HOST}:{NUC_SSH_PORT}`")
    lines.append(f"- **paramiko:** `{paramiko.__version__}`")
    lines.append(f"- **TCP:** {_tcp_ok(NUC_HOST, NUC_SSH_PORT)}")
    lines.append("")
    lines.append("### Comando de prueba (uptime)")
    stdout, stderr, code = await _ssh("uptime && echo conexion_paramiko_ok", timeout=15)
    lines.append(f"- exit code: `{code}`")
    lines.append(f"- stdout: `{stdout.strip() or '(vacío)'}`")
    if stderr.strip():
        lines.append(f"- stderr: `{stderr.strip()}`")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    mcp.run()
