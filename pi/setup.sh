#!/usr/bin/env bash
# Turns a fresh Raspberry Pi OS Desktop (64-bit, bookworm or trixie; X11 or Wayland)
# into a Chromium kiosk showing the wall map. Run once as your normal user:
#   curl -fsSL https://raw.githubusercontent.com/benjaminwalker-se/wall-map/main/pi/setup.sh | bash -s -- https://benjaminwalker-se.github.io/wall-map/
set -euo pipefail

main() {
  local URL="${1:-https://benjaminwalker-se.github.io/wall-map/}"

  # apt reads stdin, which would eat the rest of this script under `curl | bash`.
  sudo apt-get update </dev/null
  sudo apt-get install -y --no-install-recommends chromium </dev/null \
    || sudo apt-get install -y --no-install-recommends chromium-browser </dev/null

  local CHROMIUM
  CHROMIUM=$(command -v chromium || command -v chromium-browser)

  cat > "$HOME/kiosk.sh" <<EOF
#!/usr/bin/env bash
pgrep -f -- "--kiosk.*wall-map" >/dev/null && exit 0
until ping -c1 -W1 github.com >/dev/null 2>&1; do sleep 2; done
exec $CHROMIUM --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble \\
  --check-for-update-interval=31536000 --start-fullscreen "$URL"
EOF
  chmod +x "$HOME/kiosk.sh"

  # XDG autostart (X11 / LXDE-pi-x) ...
  mkdir -p "$HOME/.config/autostart"
  cat > "$HOME/.config/autostart/wallmap.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Wall Map
Exec=$HOME/kiosk.sh
X-GNOME-Autostart-enabled=true
EOF
  # ... and labwc autostart (Wayland, default on recent Pi OS).
  mkdir -p "$HOME/.config/labwc"
  touch "$HOME/.config/labwc/autostart"
  grep -q kiosk.sh "$HOME/.config/labwc/autostart" || echo "$HOME/kiosk.sh &" >> "$HOME/.config/labwc/autostart"

  # Nightly reboot at 05:00 keeps the Pi 3 fresh and picks up app updates.
  ( crontab -l 2>/dev/null | grep -v wallmap; echo "0 5 * * * sudo reboot # wallmap" ) | crontab -
  echo "$USER ALL=(root) NOPASSWD: /usr/sbin/reboot" | sudo tee /etc/sudoers.d/wallmap-reboot >/dev/null

  # Never blank the screen; boot to desktop with auto-login.
  sudo raspi-config nonint do_blanking 1 || true
  sudo raspi-config nonint do_boot_behaviour B4 || true

  echo "Done. Rebooting into kiosk mode showing: $URL"
  sudo reboot
}

main "$@"
