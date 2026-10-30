#!/bin/bash
# Instala el espejo Supabase → vault como tarea del Mac (launchd): corre cada
# hora mientras el Mac esté encendido y se pone al día al arrancar. Si el Mac
# está apagado, el vault se actualiza cuando vuelve; el panel no depende de él.
#
# Uso (una vez, en Terminal, desde la carpeta del proyecto):
#   bash scripts/charlas/espejo-launchd/instalar.sh
# Para quitarlo:
#   launchctl bootout gui/$(id -u)/com.alainzulaika.charlas-espejo
set -e

PROYECTO="$(cd "$(dirname "$0")/../../.." && pwd)"
NODE="$(command -v node || ls /opt/homebrew/bin/node /usr/local/bin/node 2>/dev/null | head -1)"
if [ -z "$NODE" ]; then echo "No encuentro node en este Mac."; exit 1; fi
if ! grep -q VAULT_CHARLAS_DIR "$PROYECTO/.env.local"; then echo "Falta VAULT_CHARLAS_DIR en .env.local"; exit 1; fi

ETIQUETA="com.alainzulaika.charlas-espejo"
PLIST="$HOME/Library/LaunchAgents/$ETIQUETA.plist"
LOG="$PROYECTO/scripts/charlas/espejo-launchd/espejo.log"
mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$ETIQUETA</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>$PROYECTO/scripts/charlas/espejo-vault.mjs</string>
  </array>
  <key>WorkingDirectory</key><string>$PROYECTO</string>
  <key>StartInterval</key><integer>3600</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)/$ETIQUETA" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Instalado. Primera ejecución en marcha; registro en: $LOG"
sleep 5
tail -n 5 "$LOG" 2>/dev/null || true
