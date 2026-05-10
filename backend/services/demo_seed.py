from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from models.models import Alert, AnomalyLog, Device, MetricHistory, Scan, ScanResult, Settings, TrafficMetric

DEMO_SEED_VERSION_KEY = "demo_seed_version"
DEMO_SEED_VERSION = "lan_4pc_switch_v1"

OLD_DEMO_IPS = {
    "192.168.1.1",
    "192.168.1.10",
    "192.168.1.25",
    "192.168.1.35",
    "192.168.1.41",
    "192.168.1.52",
}
NEW_DEMO_IPS = {
    "192.168.1.2",
    "192.168.1.10",
    "192.168.1.11",
    "192.168.1.12",
    "192.168.1.13",
}
OLD_DEMO_HOSTNAMES = {
    "GW-BUREAU",
    "SRV-DATA-01",
    "POSTE-RH-03",
    "SW-ETAGE-01",
    "PRN-ACCUEIL",
    "NOUVEAU-52",
}
NEW_DEMO_HOSTNAMES = {
    "SW-LAN-01",
    "PC-TEST-01",
    "PC-DEV-02",
    "PC-ADMIN-03",
    "PC-LAB-04",
}

DEFAULT_SETTINGS = {
    "latency_max_ms": "200",
    "cpu_alert_pct": "85",
    "ram_alert_pct": "90",
    "anomaly_score_threshold": "0.5",
    "monitoring_interval_sec": "30",
    "network_outage_min_devices": "3",
}


def _set_setting(db: Session, key: str, value: str) -> None:
    existing = db.query(Settings).filter(Settings.cle == key).first()
    if existing is None:
        db.add(Settings(cle=key, valeur=value))
    else:
        existing.valeur = value


def _set_default_settings(db: Session) -> None:
    for key, value in DEFAULT_SETTINGS.items():
        existing = db.query(Settings).filter(Settings.cle == key).first()
        if existing is None:
            db.add(Settings(cle=key, valeur=value))


def _is_known_demo_dataset(db: Session) -> bool:
    devices = db.query(Device).all()
    if not devices:
        return False

    known_ips = OLD_DEMO_IPS | NEW_DEMO_IPS
    known_hostnames = OLD_DEMO_HOSTNAMES | NEW_DEMO_HOSTNAMES
    ips = {device.ip for device in devices if device.ip}
    hostnames = {device.hostname for device in devices if device.hostname}

    return bool(ips) and ips.issubset(known_ips) and (not hostnames or hostnames.issubset(known_hostnames))


def _clear_demo_data(db: Session) -> None:
    for model in (AnomalyLog, Alert, MetricHistory, ScanResult, Scan, TrafficMetric, Device):
        db.query(model).delete(synchronize_session=False)


def seed_demo_data(db: Session) -> None:
    _set_default_settings(db)
    current_version = db.query(Settings).filter(Settings.cle == DEMO_SEED_VERSION_KEY).first()

    if db.query(Device).count() > 0:
        if current_version and current_version.valeur == DEMO_SEED_VERSION:
            db.commit()
            return
        if _is_known_demo_dataset(db):
            _clear_demo_data(db)
            db.flush()
        else:
            db.commit()
            return

    now = datetime.utcnow()
    devices = [
        Device(ip="192.168.1.2", hostname="SW-LAN-01", os_name="Switch manageable", device_type="switch", status="online", last_seen=now - timedelta(seconds=14)),
        Device(ip="192.168.1.10", hostname="PC-TEST-01", os_name="Windows 11 Pro", device_type="workstation", status="online", last_seen=now - timedelta(seconds=18)),
        Device(ip="192.168.1.11", hostname="PC-DEV-02", os_name="Windows 11 Pro", device_type="workstation", status="online", last_seen=now - timedelta(seconds=31)),
        Device(ip="192.168.1.12", hostname="PC-ADMIN-03", os_name="Ubuntu Desktop 24.04", device_type="workstation", status="online", last_seen=now - timedelta(seconds=38)),
        Device(ip="192.168.1.13", hostname="PC-LAB-04", os_name="Windows 10 Pro", device_type="workstation", status="online", last_seen=now - timedelta(minutes=2)),
    ]
    db.add_all(devices)
    db.flush()

    metric_profiles = {
        "192.168.1.2": (2, None, None),
        "192.168.1.10": (4, 18, 42),
        "192.168.1.11": (6, 31, 55),
        "192.168.1.12": (5, 27, 48),
        "192.168.1.13": (7, 23, 49),
    }
    for device in devices:
        base_latency, cpu, ram = metric_profiles[device.ip]
        for index in range(8):
            db.add(
                MetricHistory(
                    device_id=device.id,
                    timestamp=now - timedelta(seconds=30 * (8 - index)),
                    latency_ms=base_latency + (index % 3),
                    is_up=True,
                    cpu_percent=None if cpu is None else min(cpu + (index % 2) * 2, 96),
                    ram_percent=None if ram is None else min(ram + (index % 3), 96),
                )
            )

    scan = Scan(
        ip_range="192.168.1.0/24",
        scan_type="complet",
        started_at=now - timedelta(minutes=12, seconds=42),
        finished_at=now - timedelta(minutes=11, seconds=58),
        devices_found=len(devices),
    )
    db.add(scan)
    db.flush()

    ports_by_ip = {
        "192.168.1.2": [{"port": 80, "protocol": "tcp", "service": "http"}, {"port": 161, "protocol": "udp", "service": "snmp"}],
        "192.168.1.10": [{"port": 135, "protocol": "tcp", "service": "msrpc"}, {"port": 445, "protocol": "tcp", "service": "smb"}, {"port": 3389, "protocol": "tcp", "service": "rdp", "is_new_port": True}],
        "192.168.1.11": [{"port": 135, "protocol": "tcp", "service": "msrpc"}, {"port": 445, "protocol": "tcp", "service": "smb"}],
        "192.168.1.12": [{"port": 22, "protocol": "tcp", "service": "ssh"}],
        "192.168.1.13": [{"port": 445, "protocol": "tcp", "service": "smb"}],
    }
    for device in devices:
        db.add(
            ScanResult(
                scan_id=scan.id,
                device_ip=device.ip,
                hostname=device.hostname,
                os_name=device.os_name,
                device_type=device.device_type,
                ports=ports_by_ip[device.ip],
                is_new=False,
            )
        )

    traffic_points = [
        (25, 2140, 64, 30, 1843000, [{"ip": "192.168.1.10", "count": 42}, {"ip": "192.168.1.11", "count": 31}], [{"port": 443, "count": 38}, {"port": 53, "count": 25}]),
        (20, 2380, 66, 28, 2291000, [{"ip": "192.168.1.10", "count": 49}, {"ip": "192.168.1.12", "count": 28}], [{"port": 443, "count": 44}, {"port": 445, "count": 18}]),
        (15, 2610, 68, 25, 2410000, [{"ip": "192.168.1.11", "count": 53}, {"ip": "192.168.1.13", "count": 26}], [{"port": 443, "count": 46}, {"port": 3389, "count": 12}]),
        (10, 2475, 62, 31, 2164000, [{"ip": "192.168.1.12", "count": 39}, {"ip": "192.168.1.10", "count": 35}], [{"port": 53, "count": 34}, {"port": 443, "count": 30}]),
        (5, 2890, 70, 23, 2768000, [{"ip": "192.168.1.10", "count": 58}, {"ip": "192.168.1.11", "count": 47}], [{"port": 443, "count": 51}, {"port": 3389, "count": 15}]),
    ]
    for minutes, packets, tcp_pct, udp_pct, bytes_total, top_ips, top_ports in traffic_points:
        db.add(
            TrafficMetric(
                timestamp=now - timedelta(minutes=minutes),
                total_packets=packets,
                tcp_pct=tcp_pct,
                udp_pct=udp_pct,
                bytes_total=bytes_total,
                top_ips=top_ips,
                top_ports=top_ports,
            )
        )

    alerts = [
        Alert(type="PORT_CHANGE", severity="warning", message="Port RDP detecte sur PC-TEST-01 : 3389/tcp.", device_id=devices[1].id, resolved=False, created_at=now - timedelta(minutes=12)),
    ]
    db.add_all(alerts)
    db.flush()

    anomaly_points = [
        (40, 0.12, 5, 7, 0, 0, 22, 45, 9),
        (30, 0.18, 6, 7, 0, 0, 24, 48, 10),
        (20, 0.29, 7, 8, 0, 1, 31, 55, 11),
        (8, 0.21, 5, 8, 0, 1, 25, 49, 12),
    ]
    for minutes, score, latency, ports, new_devices, alert_count, cpu, ram, hour in anomaly_points:
        db.add(
            AnomalyLog(
                timestamp=now - timedelta(minutes=minutes),
                features={
                    "latency_ms": latency,
                    "nb_open_ports": ports,
                    "nb_new_devices": new_devices,
                    "nb_alerts_1h": alert_count,
                    "cpu_percent": cpu,
                    "ram_percent": ram,
                    "hour_of_day": hour,
                },
                score=score,
                is_anomaly=False,
                alert_id=None,
            )
        )

    _set_setting(db, DEMO_SEED_VERSION_KEY, DEMO_SEED_VERSION)
    db.commit()
