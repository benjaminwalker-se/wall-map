#!/usr/bin/env bash
# Turns a fresh Raspberry Pi OS (Desktop, 64-bit) install into a Chromium kiosk
# showing the wall map. Run once as the default `pi` user:
#   curl -fsSL https://raw.githubusercontent.com/benjaminwalker-se/wall-map/main/pi/setup.sh | bash -s -- https://benjaminwalker-se.github.io/wall-map/
set -euo pipefail

URL="${1:-https://benjaminwalker-se.github.io/wall-map/}"

sudo apt-get update
sudo apt-get install -y --no-install-recommends chromium-browser unclutter xdotool

# Kiosk launcher: waits for network, then opens Chromium fullscreen.
mkdir -p "$HOME/.config/autostart"
cat > "$HOME/kiosk.sh" <<EOF
#!/usr/bin/env bash
until ping -c1 -W1 github.com >/dev/null 2>&1; do sleep 2; done
xset s off; xset -dpms; xset s noblank
unclutter -idle 1 -root &
exec chromium-browser --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble \\
  --check-for-update-interval=31536000 --autoplay-policy=no-user-gesture-required "$URL"
EOF
chmod +x "$HOME/kiosk.sh"

cat > "$HOME/.config/autostart/wallmap.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Wall Map
Exec=$HOME/kiosk.sh
X-GNOME-Autostart-enabled=true
EOF

# Reload the page nightly (picks up app updates) and reboot weekly.
( crontab -l 2>/dev/null | grep -v wallmap; \
  echo "0 4 * * * DISPLAY=:0 xdotool key F5 # wallmap"; \
  echo "0 5 * * 1 sudo reboot # wallmap" ) | crontab -

# Never blank the screen.
sudo raspi-config nonint do_blanking 1 || true

echo "Done. Rebooting into kiosk mode showing: $URL"
sudo reboot
