import platform
import random
import socket
import subprocess
import time
from collections import Counter
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from models.models import Alert, Device, MetricHistory, Settings, TrafficMetric

try:
    import psutil
except ImportError:  # pragma: no cover - fallback useful on demo machines
    psutil = None

try:
    from pysnmp.hlapi import (
        CommunityData,
        ContextData,
        ObjectIdentity,
        ObjectType,
        SnmpEngine,
        UdpTransportTarget,
        getCmd,
    )
except ImportError:  # pragma: no cover
    getCmd = None
    SnmpEngine = None
    CommunityData = None
    UdpTransportTarget = None
    ContextData = None
    ObjectType = None
    ObjectIdentity = None


def get_threshold(key: str, default: float, db: Session) -> float:
    setting = db.query(Settings).filter(Settings.cle == key).first()
    if setting is None or setting.valeur is None:
        return default

    try:
        return float(setting.valeur)
    except ValueError:
        return default


def get_latency_max_ms(db: Session) -> float:
    return get_threshold("latency_max_ms", 200, db)


def get_uptime_min_pct(db: Session) -> float:
    return get_threshold("uptime_min_pct", 80, db)


def get_server_cpu_ram() -> dict[str, float]:
    if psutil is None:
        return {"cpu_percent": 25.0, "ram_percent": 40.0}

    return {
        "cpu_percent": round(float(psutil.cpu_percent(interval=0.1)), 2),
        "ram_percent": round(float(psutil.virtual_memory().percent), 2),
    }


def ping_device(ip: str) -> tuple[bool, float | None]:
    system = platform.system().lower()
    command = (
        ["ping", "-n", "1", "-w", "1000", ip]
        if "windows" in system
        else ["ping", "-c", "1", "-W", "1", ip]
    )
    started_at = time.perf_counter()
    try:
        result = subprocess.run(
            command,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=2,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return False, None

    latency = round((time.perf_counter() - started_at) * 1000, 2)
    return result.returncode == 0, latency if result.returncode == 0 else None


def get_snmp_metrics(ip: str) -> dict[str, float] | None:
    if getCmd is None:
        return None

    try:
        iterator = getCmd(
            SnmpEngine(),
            CommunityData("public", mpModel=0),
            UdpTransportTarget((ip, 161), timeout=2, retries=1),
            ContextData(),
            ObjectType(ObjectIdentity("1.3.6.1.4.1.2021.11.9.0")),
            ObjectType(ObjectIdentity("1.3.6.1.4.1.2021.4.5.0")),
            ObjectType(ObjectIdentity("1.3.6.1.4.1.2021.4.6.0")),
        )
        error_indication, error_status, _, var_binds = next(iterator)
        if error_indication or error_status:
            return None

        cpu_percent = float(var_binds[0][1])
        ram_total = float(var_binds[1][1])
        ram_free = float(var_binds[2][1])
        ram_percent = round(((ram_total - ram_free) / ram_total) * 100, 2) if ram_total else 0
        return {"cpu_percent": round(cpu_percent, 2), "ram_percent": ram_percent}
    except Exception:
        return None


def latest_metric(db: Session, device_id: int) -> MetricHistory | None:
    return (
        db.query(MetricHistory)
        .filter(MetricHistory.device_id == device_id)
        .order_by(MetricHistory.timestamp.desc())
        .first()
    )


def diagnose_machine(db: Session, device: Device) -> dict[str, Any]:
    is_up, latency_ms = ping_device(device.ip)
    snmp = get_snmp_metrics(device.ip)
    metric = latest_metric(db, device.id)
    server_metrics = get_server_cpu_ram()

    cpu_percent = (
        snmp.get("cpu_percent")
        if snmp
        else metric.cpu_percent
        if metric and metric.cpu_percent is not None
        else server_metrics["cpu_percent"]
    )
    ram_percent = (
        snmp.get("ram_percent")
        if snmp
        else metric.ram_percent
        if metric and metric.ram_percent is not None
        else server_metrics["ram_percent"]
    )

    metric_row = MetricHistory(
        device_id=device.id,
        timestamp=datetime.utcnow(),
        latency_ms=latency_ms,
        is_up=is_up,
        cpu_percent=cpu_percent,
        ram_percent=ram_percent,
    )
    db.add(metric_row)
    device.status = "online" if is_up else "offline"
    if is_up:
        device.last_seen = datetime.utcnow()
    db.commit()

    return {
        "device_id": device.id,
        "ip": device.ip,
        "hostname": device.hostname,
        "status": device.status,
        "latency_ms": latency_ms,
        "cpu_percent": round(float(cpu_percent), 2) if cpu_percent is not None else None,
        "ram_percent": round(float(ram_percent), 2) if ram_percent is not None else None,
        "source": "snmp" if snmp else "metric_history_or_server_fallback",
        "checked_at": datetime.utcnow().isoformat(),
    }


def collect_traffic_metric(db: Session) -> TrafficMetric:
    if psutil is None:
        packets = random.randint(900, 2800)
        bytes_total = packets * random.randint(650, 1200)
        tcp_pct = random.randint(65, 84)
        udp_pct = random.randint(8, 24)
        top_ips = [{"ip": "192.168.1.10", "count": random.randint(80, 180)}]
        top_ports = [{"port": 443, "count": random.randint(50, 140)}]
    else:
        counters = psutil.net_io_counters()
        packets = int(counters.packets_sent + counters.packets_recv)
        bytes_total = int(counters.bytes_sent + counters.bytes_recv)
        tcp_count = 0
        udp_count = 0
        ip_counter: Counter[str] = Counter()
        port_counter: Counter[int] = Counter()

        try:
            for connection in psutil.net_connections(kind="inet"):
                conn_type = getattr(connection, "type", None)
                if conn_type == socket.SOCK_STREAM:
                    tcp_count += 1
                elif conn_type == socket.SOCK_DGRAM:
                    udp_count += 1

                if connection.raddr:
                    ip_counter[str(connection.raddr.ip)] += 1
                    port_counter[int(connection.raddr.port)] += 1
                if connection.laddr:
                    port_counter[int(connection.laddr.port)] += 1
        except (OSError, psutil.AccessDenied):
            pass

        total_connections = max(tcp_count + udp_count, 1)
        tcp_pct = round((tcp_count / total_connections) * 100, 2)
        udp_pct = round((udp_count / total_connections) * 100, 2)
        if tcp_count == 0 and udp_count == 0:
            tcp_pct = 72.0
            udp_pct = 18.0

        top_ips = [{"ip": ip, "count": count} for ip, count in ip_counter.most_common(5)]
        top_ports = [{"port": port, "count": count} for port, count in port_counter.most_common(5)]

    metric = TrafficMetric(
        timestamp=datetime.utcnow(),
        total_packets=packets,
        tcp_pct=tcp_pct,
        udp_pct=udp_pct,
        bytes_total=bytes_total,
        top_ips=top_ips,
        top_ports=top_ports,
    )
    db.add(metric)
    return metric


def monitor_devices(db: Session) -> dict[str, int]:
    devices = db.query(Device).all()
    server_metrics = get_server_cpu_ram()
    offline_count = 0

    for device in devices:
        is_up, latency_ms = ping_device(device.ip)
        device.status = "online" if is_up else "offline"
        if is_up:
            device.last_seen = datetime.utcnow()
        offline_count += 0 if is_up else 1

        metric = MetricHistory(
            device_id=device.id,
            timestamp=datetime.utcnow(),
            latency_ms=latency_ms,
            is_up=is_up,
            cpu_percent=server_metrics["cpu_percent"] if device.device_type in {"server", "unknown"} else None,
            ram_percent=server_metrics["ram_percent"] if device.device_type in {"server", "unknown"} else None,
        )
        db.add(metric)

    collect_traffic_metric(db)

    min_offline = int(get_threshold("network_outage_min_devices", 3, db))
    recent_outage = (
        db.query(Alert)
        .filter(
            Alert.type == "NETWORK_OUTAGE",
            Alert.resolved.is_(False),
            Alert.created_at >= datetime.utcnow() - timedelta(minutes=5),
        )
        .first()
    )
    if offline_count >= min_offline and recent_outage is None:
        db.add(
            Alert(
                type="NETWORK_OUTAGE",
                severity="critical",
                message=f"{offline_count} appareils sont hors ligne pendant le cycle de monitoring.",
                resolved=False,
            )
        )

    db.commit()
    return {"total": len(devices), "online": len(devices) - offline_count, "offline": offline_count}
