#!/bin/bash
# Turso DB backup script — run via cron or manually
# Usage: ./scripts/backup.sh

DATE=$(date +%Y-%m-%d)
BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"

echo "Backing up Turso DB to $BACKUP_DIR/backup-$DATE.sql..."

# Export via Turso HTTP API (reads all tables)
curl -s "https://integrated-allergy-mputiyon1985.aws-us-east-1.turso.io/v2/pipeline" \
  -H "Authorization: Bearer ${DATABASE_AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"requests":[{"type":"execute","stmt":{"sql":".dump"}},{"type":"close"}]}' \
  -o "$BACKUP_DIR/backup-$DATE.json"

echo "Backup complete: $BACKUP_DIR/backup-$DATE.json"
