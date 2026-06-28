# Nube Privada Nextcloud · Hexa38

Infraestructura de nube personal self-hosted corriendo 24/7 en hardware propio (Intel NUC), accesible desde cualquier lugar del mundo sin IP pública ni puertos abiertos.

🌐 **cloud.hexa38.com**

## Características

- **6 contenedores Docker** orquestados con healthchecks y auto-recuperación
- **Acceso global seguro** vía Cloudflare Tunnel (sin IP pública)
- **VPN mesh** Tailscale (WireGuard) para SSH remoto sin claves en disco
- **Backup 3-2-1** automático: local 7 días + Google Drive off-site 14 días (rclone)
- **Monitoreo en 3 capas**: Docker healthchecks → Healthchecks.io → Cloudflare alerts
- **Servidor MCP** con 11 herramientas para operar el servidor desde una conversación IA
- **Costo operativo**: ~$46 USD/año (hardware propio, dominio + Cloudflare gratuito)

## Stack

| Componente | Tecnología |
|-----------|-----------|
| App | Nextcloud (latest) |
| Base de datos | MariaDB 10.11 |
| Caché / locking | Redis Alpine |
| Sync en tiempo real | Nextcloud Notify Push (WebSocket) |
| Tunnel | Cloudflare Tunnel (cloudflared) |
| VPN remota | Tailscale (WireGuard) |
| Backup off-site | rclone → Google Drive |
| Servidor IA/MCP | Python + paramiko |
| SO servidor | Ubuntu Server 24.04 |

## Arquitectura

```
Usuario (móvil/PC)
      │  https://cloud.hexa38.com
      ▼
┌─────────────┐
│  Cloudflare │  CDN + SSL + WAF
└──────┬──────┘
       │  Cloudflare Tunnel (sin puertos abiertos)
       ▼
┌─────────────┐
│ cloudflared │  contenedor del túnel
└──────┬──────┘
       │
┌──────▼──────────────────────┐
│  Nextcloud (Apache + PHP)   │
└──┬──────────────────────┬───┘
   │                      │
┌──▼────┐  ┌──────┐  ┌───▼──────┐
│MariaDB│  │Redis │  │Disco 1.8T│
└───────┘  └──────┘  └──────────┘
```

## Inicio rápido

```bash
# Clonar y configurar variables de entorno
cp nextcloud/.env.example nextcloud/.env
# Editar nextcloud/.env con tus credenciales

# Levantar todos los servicios
cd nextcloud
docker compose up -d

# Verificar estado
docker ps
docker compose logs -f
```

## Servidor MCP (gestión asistida por IA)

Permite operar el servidor desde una conversación con Claude sin abrir SSH manualmente.

**Herramientas disponibles:**
`check_health` · `get_containers` · `get_logs` · `restart_service` · `run_occ` · `check_backup` · `check_disk` · `check_tunnel` · `maintenance_mode` · `run_command` · `debug_connection`

```bash
cd mcp-nextcloud
pip install -r requirements.txt
# Configurar en claude_desktop_config.json
```

**Decisión técnica destacada:** el sandbox de Claude Desktop bloquea `ssh.exe` como proceso hijo. Solución: SSH in-process con `paramiko` + autenticación por identidad Tailscale (`auth_none`) — canal seguro sin claves en disco.

## Seguridad

| Medida | Estado |
|--------|--------|
| HTTPS forzado + HSTS | ✅ |
| 2FA / TOTP | ✅ |
| Firewall UFW | ✅ |
| Sin puertos expuestos | ✅ |
| SSH solo por Tailscale | ✅ |

---

Desarrollado por [Aldo Escobar](https://hexa38.com) · Hexa38
