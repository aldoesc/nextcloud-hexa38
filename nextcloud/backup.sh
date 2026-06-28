#!/bin/bash
# ==========================================
# Nextcloud Backup Script - Hexa38 NUC
# ==========================================
# Ejecuta backup de: DB + Datos de usuarios + Config
# Retiene los ultimos 7 backups locales
# Sube backup comprimido a Google Drive (off-site)
# Retiene los ultimos 14 backups en Google Drive
# ==========================================

set -e  # Sale ante cualquier error

DATE=$(date +%Y-%m-%d_%H-%M)
BACKUP_DIR="/mnt/nextcloud/backups/$DATE"
LOG_FILE="/mnt/nextcloud/backups/backup.log"
RETENTION_LOCAL=7
RETENTION_REMOTE=14
RCLONE_REMOTE="gdrive:nextcloud-backups"

# Cargar variables de entorno
set -a
source /home/aldo/nextcloud/.env
set +a

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "========== INICIO BACKUP =========="

# Crear directorio
mkdir -p "$BACKUP_DIR"
log "Directorio creado: $BACKUP_DIR"

# 1. Modo mantenimiento ON
log "Activando modo mantenimiento..."
docker exec -u 0 nextcloud-app bash -c "php occ maintenance:mode --on"

# Funcion de cleanup en caso de error
cleanup_on_error() {
    log "ERROR detectado, desactivando modo mantenimiento..."
    docker exec -u 0 nextcloud-app bash -c "php occ maintenance:mode --off" || true
    exit 1
}
trap cleanup_on_error ERR

# 2. Backup base de datos
log "Exportando base de datos..."
docker exec nextcloud-db bash -c "mariadb-dump -u nextcloud -p\"$MYSQL_PASSWORD\" nextcloud --single-transaction" > "$BACKUP_DIR/database.sql"
DB_SIZE=$(du -h "$BACKUP_DIR/database.sql" | cut -f1)
log "Base de datos exportada: $DB_SIZE"

# 3. Backup datos de usuarios
log "Copiando datos de usuarios..."
docker cp nextcloud-app:/var/www/html/data "$BACKUP_DIR/userdata"
log "Datos de usuarios copiados"

# 4. Backup configuracion
log "Copiando configuracion..."
docker cp nextcloud-app:/var/www/html/config "$BACKUP_DIR/config"
log "Configuracion copiada"

# 5. Backup docker-compose y .env
cp /home/aldo/nextcloud/docker-compose.yml "$BACKUP_DIR/"
cp /home/aldo/nextcloud/.env "$BACKUP_DIR/"
cp /home/aldo/nextcloud/hsts.conf "$BACKUP_DIR/" 2>/dev/null || true
log "Archivos Docker copiados"

# 6. Modo mantenimiento OFF
log "Desactivando modo mantenimiento..."
docker exec -u 0 nextcloud-app bash -c "php occ maintenance:mode --off"
trap - ERR  # Quitar el trap, ya pasamos lo critico

# 7. Tamano total del backup local
TOTAL=$(du -sh "$BACKUP_DIR" | cut -f1)
log "Tamano total del backup local: $TOTAL"

# 8. Limpiar backups locales antiguos
log "Limpiando backups locales antiguos (retencion: $RETENTION_LOCAL)..."
ls -dt /mnt/nextcloud/backups/20*/ 2>/dev/null | tail -n +$((RETENTION_LOCAL + 1)) | while read OLD; do
    rm -rf "$OLD"
    log "Eliminado local: $OLD"
done

# 9. Comprimir y subir a Google Drive
if command -v rclone &> /dev/null && rclone listremotes | grep -q "^gdrive:"; then
    log "Comprimiendo backup para subida..."
    TARFILE="/tmp/nextcloud_backup_$DATE.tar.gz"
    tar czf "$TARFILE" -C /mnt/nextcloud/backups "$DATE"
    TAR_SIZE=$(du -h "$TARFILE" | cut -f1)
    log "Comprimido: $TAR_SIZE"

    log "Subiendo a Google Drive..."
    if rclone copy "$TARFILE" "$RCLONE_REMOTE/" --transfers=1 --retries=3; then
        log "Subido a Google Drive: $RCLONE_REMOTE/nextcloud_backup_$DATE.tar.gz"
        rm -f "$TARFILE"
    else
        log "ERROR subiendo a Google Drive (continuando)"
        rm -f "$TARFILE"
    fi

    # 10. Limpiar backups remotos antiguos
    log "Limpiando backups remotos antiguos (retencion: $RETENTION_REMOTE)..."
    rclone lsf "$RCLONE_REMOTE/" --files-only | sort | head -n -"$RETENTION_REMOTE" | while read OLD_REMOTE; do
        rclone deletefile "$RCLONE_REMOTE/$OLD_REMOTE" 2>/dev/null && log "Eliminado remoto: $OLD_REMOTE" || true
    done
else
    log "AVISO: rclone no disponible o gdrive no configurado, saltando subida off-site"
fi

log "========== BACKUP COMPLETADO =========="
log ""
