# ==========================================
# Nextcloud Backup Script - Hexa38
# ==========================================
# Ejecuta backup de: DB + Datos de usuarios + Config
# Retiene los ultimos 7 backups
# ==========================================

$ErrorActionPreference = "Stop"
$DATE = Get-Date -Format "yyyy-MM-dd_HH-mm"
$BACKUP_DIR = "D:\nextcloud\backups\$DATE"
$LOG_FILE = "D:\nextcloud\backups\backup.log"
$RETENTION_DAYS = 7

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $entry = "[$timestamp] $Message"
    Write-Host $entry
    Add-Content -Path $LOG_FILE -Value $entry
}

try {
    Write-Log "========== INICIO BACKUP =========="

    # Crear directorio de backup
    New-Item -ItemType Directory -Path $BACKUP_DIR -Force | Out-Null
    New-Item -ItemType Directory -Path "$BACKUP_DIR\config" -Force | Out-Null
    Write-Log "Directorio creado: $BACKUP_DIR"

    # 1. Activar modo mantenimiento
    Write-Log "Activando modo mantenimiento..."
    docker exec -u 0 nextcloud-app bash -c "php occ maintenance:mode --on"

    # 2. Backup de la base de datos
    Write-Log "Exportando base de datos..."
    docker exec nextcloud-db bash -c 'mariadb-dump -u nextcloud -p"$MYSQL_PASSWORD" nextcloud --single-transaction' | Out-File -FilePath "$BACKUP_DIR\database.sql" -Encoding UTF8
    $dbSize = (Get-Item "$BACKUP_DIR\database.sql").Length / 1MB
    Write-Log "Base de datos exportada: $([math]::Round($dbSize, 2)) MB"

    # 3. Backup de datos de usuarios
    Write-Log "Copiando datos de usuarios..."
    docker cp nextcloud-app:/var/www/html/data "$BACKUP_DIR\userdata"
    Write-Log "Datos de usuarios copiados"

    # 4. Backup de configuracion
    Write-Log "Copiando configuracion..."
    docker cp nextcloud-app:/var/www/html/config "$BACKUP_DIR\config"
    Write-Log "Configuracion copiada"

    # 5. Backup del docker-compose y .env
    Copy-Item "C:\nextcloud\docker-compose.yml" "$BACKUP_DIR\"
    Copy-Item "C:\nextcloud\.env" "$BACKUP_DIR\"
    Copy-Item "C:\nextcloud\hsts.conf" "$BACKUP_DIR\"
    Write-Log "Archivos de configuracion Docker copiados"

    # 6. Desactivar modo mantenimiento
    Write-Log "Desactivando modo mantenimiento..."
    docker exec -u 0 nextcloud-app bash -c "php occ maintenance:mode --off"

    # 7. Calcular tamano total
    $totalSize = (Get-ChildItem -Path $BACKUP_DIR -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Log "Tamano total del backup: $([math]::Round($totalSize, 2)) MB"

    # 8. Limpiar backups antiguos (retener ultimos 7)
    Write-Log "Limpiando backups antiguos (retencion: $RETENTION_DAYS dias)..."
    $backups = Get-ChildItem -Path "D:\nextcloud\backups" -Directory |
               Where-Object { $_.Name -match '^\d{4}-\d{2}-\d{2}' } |
               Sort-Object Name -Descending |
               Select-Object -Skip $RETENTION_DAYS

    foreach ($old in $backups) {
        Remove-Item -Path $old.FullName -Recurse -Force
        Write-Log "Eliminado backup antiguo: $($old.Name)"
    }

    Write-Log "========== BACKUP COMPLETADO =========="

} catch {
    Write-Log "ERROR: $($_.Exception.Message)"

    # Asegurar que el modo mantenimiento se desactive
    try {
        docker exec -u 0 nextcloud-app bash -c "php occ maintenance:mode --off" 2>$null
    } catch {}

    Write-Log "========== BACKUP FALLIDO =========="
    exit 1
}
