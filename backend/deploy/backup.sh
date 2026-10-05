#!/bin/sh
# Daily encrypted Postgres backup to Cloudflare R2. Restore steps are in the backend README.
set -eu
# Without pipefail a failed pg_dump still lets gzip and openssl succeed, and an empty dump gets uploaded.
set -o pipefail

apk add --no-cache aws-cli openssl >/dev/null

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION=auto
endpoint="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

# Each step is checked explicitly: `set -e` is switched off inside the `if` that calls this.
backup() {
  stamp=$(date -u +%Y-%m-%dT%H-%M-%SZ)
  file="/tmp/resumebuilder-${stamp}.sql.gz.enc"

  # Encrypted before it leaves the server, so a leaked bucket doesn't expose user data.
  pg_dump -h shortlist-postgres -U postgres -d resumebuilder --no-owner \
    | gzip \
    | openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_ENCRYPTION_KEY -out "$file" \
    || return 1

  aws s3 cp "$file" "s3://${R2_BUCKET}/backups/postgres/$(basename "$file")" --endpoint-url "$endpoint" --only-show-errors \
    || return 1
  echo "Backup uploaded: ${stamp}"
}

while true; do
  if ! backup; then
    echo "Backup FAILED at $(date -u +%Y-%m-%dT%H-%M-%SZ); nothing was uploaded" >&2
  fi
  rm -f /tmp/resumebuilder-*.sql.gz.enc

  sleep "${BACKUP_INTERVAL_SECONDS:-86400}"
done
