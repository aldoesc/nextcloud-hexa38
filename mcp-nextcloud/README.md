# MCP Nextcloud NUC — Gestión asistida del servidor Hexa38

Servidor **MCP (Model Context Protocol)** que permite a Claude diagnosticar y operar
el NUC de Nextcloud (`hexa38-nuc`) directamente desde una conversación, vía SSH sobre
Tailscale.

## Arquitectura

```
Claude Desktop ──stdio──► server.py (FastMCP) ──paramiko──► Tailscale ──► NUC (Ubuntu+Docker)
```

- **Transporte:** stdio (local)
- **SSH:** `paramiko` in-process (NO `ssh.exe` — ver "Decisión técnica" abajo)
- **Auth:** Tailscale SSH `auth_none` (identidad de red, sin clave ni password)

## Requisitos

- Python 3.11+
- Tailscale corriendo en Windows y en el NUC (misma tailnet)
- El NUC con Tailscale SSH habilitado para el usuario

## Instalación

```powershell
# 1. Instalar dependencias
python -m pip install -r requirements.txt

# 2. Configurar .env (ver plantilla)
#    NUC_HOST = IP de Tailscale del NUC (tailscale status)

# 3. Registrar en %APPDATA%\Claude\claude_desktop_config.json:
#    "nextcloud-nuc": { "command": "<python.exe>", "args": ["<ruta>\\server.py"] }

# 4. Reiniciar Claude Desktop
```

## Configuración (`.env`)

| Variable | Descripción | Default |
|----------|-------------|---------|
| `NUC_HOST` | IP Tailscale del NUC | `100.91.119.52` |
| `NUC_USER` | Usuario SSH | `aldo` |
| `NUC_SSH_PORT` | Puerto SSH | `22` |
| `NUC_SSH_KEY` | Ruta a clave privada (opcional) | — |
| `NUC_PASSWORD` | Password SSH (opcional) | — |
| `NUC_COMPOSE_DIR` | Dir. del docker-compose en el NUC | `/home/aldo/nextcloud` |
| `NUC_BACKUP_DIR` | Dir. de backups en el NUC | `/mnt/nextcloud/backups` |

> Con Tailscale SSH no se necesita clave ni password: la auth es por identidad de red.

## Herramientas

| Herramienta | Función |
|-------------|---------|
| `nuc_check_health` | Diagnóstico completo del sistema |
| `nuc_get_containers` | Estado de contenedores Docker |
| `nuc_get_logs` | Logs de un contenedor |
| `nuc_restart_service` | Reinicia un contenedor |
| `nuc_run_occ` | Comandos `occ` de Nextcloud |
| `nuc_check_backup` | Estado de backups local + Drive |
| `nuc_check_disk` | Uso de disco + SMART |
| `nuc_check_tunnel` | Diagnóstico del túnel Cloudflare |
| `nuc_maintenance_mode` | Activa/desactiva mantenimiento |
| `nuc_run_command` | Comando shell arbitrario |
| `nuc_debug_connection` | Verifica conectividad MCP → NUC |

## Decisión técnica: paramiko en vez de `ssh.exe`

Claude Desktop ejecuta el MCP en un **sandbox de Electron** que bloquea `ssh.exe`
como proceso hijo (falla con `exit 255` y stderr vacío, incluso con `-vvv`).
La solución es usar **paramiko**, que hace SSH dentro del propio proceso Python
sin lanzar binarios externos. El proceso Python sí tiene acceso de red, así que
paramiko conecta sin problema.

Tailscale SSH autentica con `transport.auth_none(user)`.

## Seguridad

- Lista blanca de contenedores (no acepta nombres arbitrarios).
- Validación de entradas con Pydantic.
- `sudo` requiere contraseña → el MCP **no** ejecuta comandos privilegiados de forma
  autónoma. Los cambios root los aplica el operador manualmente.
- Sin secretos en `.env` (Tailscale autentica por identidad).

## Prueba rápida

En Claude, tras reiniciar: *"revisa el túnel"* o *"haz un health check del NUC"*.
