#!/bin/bash
set -e

# Sets up bread.crumb hostname and port 80 → 9999 forwarding
# Requires sudo/admin privileges (one-time setup)

HOSTNAME="bread.crumb"
TARGET_PORT=9999

echo "Setting up $HOSTNAME → localhost:$TARGET_PORT"
echo "This requires administrator privileges."
echo ""

# --- 1. Hosts file entry ---

setup_hosts() {
  if grep -q "$HOSTNAME" /etc/hosts 2>/dev/null; then
    echo "[OK] $HOSTNAME already in /etc/hosts"
  else
    echo "Adding $HOSTNAME to /etc/hosts..."
    echo "127.0.0.1 $HOSTNAME" | sudo tee -a /etc/hosts > /dev/null
    echo "[OK] Added $HOSTNAME to /etc/hosts"
  fi
}

# --- 2. Port forwarding (platform-specific) ---

setup_macos() {
  setup_hosts

  # Create pf anchor file for breadcrumb
  local ANCHOR_FILE="/etc/pf.anchors/breadcrumb"
  local PF_CONF="/etc/pf.conf"

  echo "Setting up macOS port forwarding (port 80 → $TARGET_PORT)..."

  # Write the redirect rule
  echo "rdr pass on lo0 inet proto tcp from any to 127.0.0.1 port 80 -> 127.0.0.1 port $TARGET_PORT" | sudo tee "$ANCHOR_FILE" > /dev/null

  # Add anchor to pf.conf if not already present
  if ! grep -q "breadcrumb" "$PF_CONF" 2>/dev/null; then
    # Insert anchor load after the last 'rdr-anchor' line, or at the top of rules
    sudo cp "$PF_CONF" "${PF_CONF}.breadcrumb-backup"

    # Add the anchor reference and load
    echo "" | sudo tee -a "$PF_CONF" > /dev/null
    echo "# Breadcrumb local development" | sudo tee -a "$PF_CONF" > /dev/null
    echo "rdr-anchor \"breadcrumb\"" | sudo tee -a "$PF_CONF" > /dev/null
    echo "load anchor \"breadcrumb\" from \"$ANCHOR_FILE\"" | sudo tee -a "$PF_CONF" > /dev/null
  fi

  # Enable and reload pf
  sudo pfctl -f "$PF_CONF" 2>/dev/null || true
  sudo pfctl -e 2>/dev/null || true

  echo "[OK] macOS port forwarding configured"
}

setup_linux() {
  setup_hosts

  echo "Setting up Linux port forwarding (port 80 → $TARGET_PORT)..."

  # iptables redirect
  sudo iptables -t nat -C OUTPUT -p tcp -d 127.0.0.1 --dport 80 -j REDIRECT --to-port "$TARGET_PORT" 2>/dev/null || \
    sudo iptables -t nat -A OUTPUT -p tcp -d 127.0.0.1 --dport 80 -j REDIRECT --to-port "$TARGET_PORT"

  # Persist across reboots (if iptables-persistent is available)
  if command -v iptables-save &>/dev/null; then
    sudo iptables-save | sudo tee /etc/iptables/rules.v4 > /dev/null 2>&1 || true
  fi

  echo "[OK] Linux port forwarding configured"
}

# --- Detect platform and run ---

case "$(uname -s)" in
  Darwin)
    setup_macos
    ;;
  Linux)
    if grep -qEi "(microsoft|wsl)" /proc/version 2>/dev/null; then
      echo "[INFO] WSL detected. Setting up hosts file only."
      echo "       Windows port forwarding must be configured on the Windows side."
      echo "       Run in an admin PowerShell:"
      echo "       netsh interface portproxy add v4tov4 listenport=80 listenaddress=127.0.0.1 connectport=$TARGET_PORT connectaddress=127.0.0.1"
      setup_hosts
    else
      setup_linux
    fi
    ;;
  *)
    echo "Unsupported platform: $(uname -s)"
    echo "Manual setup required:"
    echo "  1. Add '127.0.0.1 $HOSTNAME' to your hosts file"
    echo "  2. Forward port 80 to port $TARGET_PORT on localhost"
    exit 1
    ;;
esac

echo ""
echo "Setup complete! After starting the Breadcrumb daemon, browse to:"
echo "  http://$HOSTNAME"
