"""IP del servidor en la red local, para el QR de conexión (BE-30,
docs/control-center-and-devices.md §5).

Sin internet y sin dependencias: se recorren las interfaces de red (Linux: ioctl
SIOCGIFADDR) y, como respaldo, lo que resuelve el hostname y la IP de salida por
defecto. Se descartan loopback (127.x, ::1), link-local (169.254.x) y los puentes
virtuales (docker, virbr…): un móvil no puede abrir esas URL. Primero la IP de la ruta
por defecto y las privadas (192.168.x, 10.x, 172.16-31.x).

`RUOK_LAN_HOST` fuerza la IP (o nombre) si la detección no acierta en la demo.
`RUOK_PUBLIC_PORT` fija el puerto del QR (por defecto, el de la petición o 8000).
`RUOK_HOSTNAME` fija el nombre que se muestra (los mocks del front lo usan).
"""

from __future__ import annotations

import contextlib
import ipaddress
import logging
import os
import socket
import struct
from collections.abc import Iterable

log = logging.getLogger(__name__)

DEFAULT_PORT = 8000
_SIOCGIFADDR = 0x8915  # Linux
# Puentes y redes virtuales del propio portátil: un móvil no llega a ellas.
_VIRTUAL_PREFIXES = ("lo", "docker", "br-", "virbr", "veth", "vmnet", "vboxnet", "tun", "tap")


def _interface_ips() -> list[str]:
    """IPv4 de cada interfaz (Linux). Lista vacía en otros sistemas."""
    try:
        import fcntl
    except ImportError:  # Windows
        return []
    ips = []
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        for _, name in socket.if_nameindex():
            if name.startswith(_VIRTUAL_PREFIXES):
                continue
            packed = struct.pack("256s", name[:15].encode())
            with contextlib.suppress(OSError):  # interfaz sin IPv4
                ips.append(socket.inet_ntoa(fcntl.ioctl(s.fileno(), _SIOCGIFADDR, packed)[20:24]))
    return ips


def _hostname_ips(hostname: str) -> list[str]:
    with contextlib.suppress(OSError):
        return [info[4][0] for info in socket.getaddrinfo(hostname, None, socket.AF_INET)]
    return []


def _outbound_ip() -> list[str]:
    """IP de la ruta por defecto. UDP no envía nada al hacer connect."""
    with contextlib.suppress(OSError), socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.connect(("10.255.255.255", 1))
        return [s.getsockname()[0]]
    return []


def lan_ips(candidates: Iterable[str]) -> list[str]:
    """Filtra y deduplica sin loopback ni link-local. Conserva el orden de llegada,
    con las privadas primero."""
    seen: dict[str, ipaddress.IPv4Address | ipaddress.IPv6Address] = {}
    for raw in candidates:
        try:
            ip = ipaddress.ip_address(raw)
        except ValueError:
            continue
        if ip.is_loopback or ip.is_link_local or ip.is_unspecified or ip.is_multicast:
            continue
        seen.setdefault(str(ip), ip)
    return sorted(seen, key=lambda k: not seen[k].is_private)  # sort estable


def detect_ips(hostname: str | None = None) -> list[str]:
    hostname = hostname or socket.gethostname()
    # Primero la IP de la ruta por defecto: suele ser la del wifi de la demo.
    return lan_ips([*_outbound_ip(), *_interface_ips(), *_hostname_ips(hostname)])


def hostname() -> str:
    return os.environ.get("RUOK_HOSTNAME") or socket.gethostname()


def public_port(request_port: int | None) -> int:
    configured = os.environ.get("RUOK_PUBLIC_PORT")
    if configured:
        return int(configured)
    return request_port or DEFAULT_PORT


def lan_urls(port: int, ips: list[str] | None = None) -> list[str]:
    forced = os.environ.get("RUOK_LAN_HOST", "").strip()
    if not forced and os.path.exists("/.dockerenv"):
        log.warning("En Docker sin RUOK_LAN_HOST: network-info dará la IP del contenedor")
    hosts = [forced] if forced else (detect_ips() if ips is None else ips)
    return [f"http://{h}:{port}" if ":" not in h else f"http://[{h}]:{port}" for h in hosts]
