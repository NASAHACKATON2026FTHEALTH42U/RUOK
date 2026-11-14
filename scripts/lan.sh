#!/usr/bin/env bash
# FS-08: comprobar y preparar la red local para que los móviles abran R U OK? sin internet.
#
#   scripts/lan.sh            → diagnóstico: IPs del equipo, puertos, firewall y /health por cada IP
#   scripts/lan.sh open       → abre los puertos en el firewall (ufw o firewalld; pide sudo)
#   scripts/lan.sh close      → los vuelve a cerrar
#   scripts/lan.sh hotspot    → crea el hotspot Wi-Fi con nmcli (SSID=RUOK; clave: HOTSPOT_PASS)
#
# Puertos: 8000 (API + front con `make demo`/docker) y 5173 (Vite con `make dev`).
# Variables: PORTS="8000 5173"  SSID=RUOK  HOTSPOT_PASS=<mín. 8 caracteres>
set -uo pipefail

PORTS="${PORTS:-8000 5173}"
SSID="${SSID:-RUOK}"

ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

firewall_kind() {
  if have ufw && sudo -n true 2>/dev/null && sudo -n ufw status 2>/dev/null | grep -q "Status: active"; then echo ufw
  elif have ufw && ufw status 2>/dev/null | grep -q "Status: active"; then echo ufw
  elif have firewall-cmd && firewall-cmd --state >/dev/null 2>&1; then echo firewalld
  else echo none; fi
}

lan_ips() {  # IPv4 no loopback ni de contenedores
  ip -4 -o addr show scope global 2>/dev/null \
    | awk '{split($4,a,"/"); print $2" "a[1]}' \
    | grep -Ev '^(docker|br-|veth|virbr|lo)' || true
}

cmd_open() {
  case "$(firewall_kind)" in
    ufw)       for p in $PORTS; do sudo ufw allow "$p"/tcp; done ;;
    firewalld) for p in $PORTS; do sudo firewall-cmd --add-port="$p"/tcp; done
               echo "(solo en esta sesión; con --permanent sobrevive al reinicio)" ;;
    none)      ok "No hay firewall activo: no hace falta abrir nada" ;;
  esac
}

cmd_close() {
  case "$(firewall_kind)" in
    ufw)       for p in $PORTS; do sudo ufw delete allow "$p"/tcp; done ;;
    firewalld) for p in $PORTS; do sudo firewall-cmd --remove-port="$p"/tcp; done ;;
    none)      ok "No hay firewall activo" ;;
  esac
}

cmd_hotspot() {
  have nmcli || { bad "Falta nmcli (NetworkManager)"; exit 1; }
  [ -n "${HOTSPOT_PASS:-}" ] || { bad "Define HOTSPOT_PASS (mín. 8 caracteres)"; exit 1; }
  iface="$(nmcli -t -f DEVICE,TYPE dev | awk -F: '$2=="wifi"{print $1; exit}')"
  [ -n "$iface" ] || { bad "No hay interfaz Wi-Fi"; exit 1; }
  nmcli dev wifi hotspot ifname "$iface" ssid "$SSID" password "$HOTSPOT_PASS" \
    && ok "Hotspot '$SSID' activo en $iface (el servidor suele quedar en 10.42.0.1)"
  warn "Algunas tarjetas no admiten hotspot y Wi-Fi a la vez; y algunos móviles se desconectan de una red sin internet."
}

cmd_status() {
  echo "R U OK? · diagnóstico de red local"
  echo
  echo "IPs del equipo (las que verán los móviles):"
  ips="$(lan_ips)"
  if [ -z "$ips" ]; then bad "Sin IP de red local: conecta el equipo al router o activa el hotspot"; else
    while read -r ifc ip; do ok "$ip  ($ifc)"; done <<<"$ips"
  fi

  echo; echo "Servidor escuchando:"
  listening=""
  for p in $PORTS; do
    line="$(ss -ltnH "sport = :$p" 2>/dev/null | head -1)"
    if [ -z "$line" ]; then warn "puerto $p: nada escuchando (arranca con 'make demo' o 'make dev')"
    elif echo "$line" | grep -Eq '(0\.0\.0\.0|\*|\[::\]):'"$p"; then ok "puerto $p: escucha en todas las interfaces"; listening="$listening $p"
    else bad "puerto $p: solo escucha en local (${line##* }); arranca con --host 0.0.0.0"; fi
  done

  echo; echo "Firewall:"
  case "$(firewall_kind)" in
    ufw)       ok "ufw activo"; for p in $PORTS; do ufw status 2>/dev/null | grep -q "^$p/tcp.*ALLOW" && ok "  $p/tcp permitido" || warn "  $p/tcp sin regla (scripts/lan.sh open)"; done ;;
    firewalld) ok "firewalld activo"; for p in $PORTS; do firewall-cmd --query-port="$p"/tcp >/dev/null 2>&1 && ok "  $p/tcp permitido" || warn "  $p/tcp cerrado (scripts/lan.sh open)"; done ;;
    none)      ok "sin firewall activo" ;;
  esac

  echo; echo "Comprobación desde cada IP (OJO: desde el propio equipo no pasa por el firewall; la prueba real es abrir la URL en un móvil):"
  [ -n "$ips" ] && for p in $listening; do
    while read -r _ ip; do
      if have curl && curl -fsS -m 3 "http://$ip:$p/api/v1/health" >/dev/null 2>&1; then ok "http://$ip:$p/api/v1/health responde"
      else bad "http://$ip:$p/api/v1/health no responde"; fi
    done <<<"$ips"
  done
  [ -z "$listening" ] && warn "Nada que comprobar: no hay servidor escuchando"

  echo; echo "Internet (la demo no debe depender de ella):"
  if have curl && curl -fsS -m 3 -o /dev/null https://example.com 2>/dev/null; then warn "hay internet: para la prueba real, desconecta la WAN del router"
  else ok "sin internet"; fi

  echo; echo "Abre en el móvil: http://<IP>:8000  (la pantalla /control muestra el QR de conexión)"
}

case "${1:-status}" in
  status|"") cmd_status ;;
  open) cmd_open ;;
  close) cmd_close ;;
  hotspot) cmd_hotspot ;;
  *) sed -n '2,11p' "$0"; exit 1 ;;
esac
