import subprocess
from sqlalchemy.orm import Session
import time
from models.models import Device, MetricHistory, Alert, TrafficMetric
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from database import SessionLocal
from pysnmp.hlapi import *
from .traffic_sniffer import TrafficSniffer


# ─────────────────────────────────────────────
#  Ping / Latence
# ─────────────────────────────────────────────

def ping_device(ip: str) -> bool:
    result = subprocess.run(
        ["ping", "-n", "1", "-w", "1000", ip],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return result.returncode == 0


def calculerLantence(ip: str) -> float:
    start = time.time()
    result = subprocess.run(
        ["ping", "-n", "1", "-w", "1000", ip],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    end = time.time()
    if result.returncode == 0:
        return round((end - start) * 1000, 2)
    return None


# ─────────────────────────────────────────────
#  Monitoring des devices (tâche 30 s)
# ─────────────────────────────────────────────

def monitor_devices(db: Session):
    devices = db.query(Device).all()
    for i in devices:
        is_up = ping_device(i.ip)
        duree = calculerLantence(i.ip)
        i.status = "online" if is_up else "offline"
        i.last_seen = datetime.utcnow()

        metric = MetricHistory(
            device_id=i.id,
            timestamp=datetime.utcnow(),
            latency_ms=duree,
            is_up=is_up,
        )
        db.add(metric)

    offline_count = sum(1 for d in devices if d.status == "offline")
    if offline_count >= 3:
        alert = Alert(
            type="NETWORK_OUTAGE",
            severity="critical",
            message=f"{offline_count} appareils sont hors ligne",
        )
        db.add(alert)

    db.commit()


def scheduled_monitor():
    db = SessionLocal()
    try:
        monitor_devices(db)
    finally:
        db.close()


# ─────────────────────────────────────────────
#  Capture trafic Scapy → TrafficMetric (tâche 5 min)
# ─────────────────────────────────────────────

_sniffer = TrafficSniffer()


def capture_traffic():
    """
    Appelée toutes les 5 minutes par APScheduler.
    Lance une capture Scapy de 30 secondes, puis persiste
    les résultats dans la table traffic_metrics.
    """
    db = SessionLocal()
    try:
        data = _sniffer.capture(duration=30)

        metric = TrafficMetric(
            timestamp=datetime.utcnow(),
            total_packets=data["total_packets"],
            tcp_pct=data["tcp_pct"],
            udp_pct=data["udp_pct"],
            bytes_total=data["bytes_total"],
            top_ips=data["top_ips"],
            top_ports=data["top_ports"],
        )
        db.add(metric)
        db.commit()
        print(f"[TrafficMetric] {datetime.utcnow()} — {data['total_packets']} paquets capturés")
    except Exception as e:
        print(f"[TrafficMetric] Erreur capture : {e}")
    finally:
        db.close()


# ─────────────────────────────────────────────
#  APScheduler — deux tâches
# ─────────────────────────────────────────────

scheduler = BackgroundScheduler()

# Tâche existante : ping/latence toutes les 30 s
scheduler.add_job(scheduled_monitor, "interval", seconds=30, id="device_monitor")

# Nouvelle tâche : capture trafic toutes les 5 min
scheduler.add_job(capture_traffic, "interval", minutes=5, id="traffic_capture")

scheduler.start()


# ─────────────────────────────────────────────
#  SNMP
# ─────────────────────────────────────────────

def get_snmp_matrice(ip: str) -> dict:
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

        errorIndication, errorStatus, errorIndex, varBinds = next(iterator)
        if not errorStatus and not errorIndication:
            cpu = int(varBinds[0][1])
            ramTotal = int(varBinds[1][1])
            ramFree = int(varBinds[2][1])
            ram_percent = round((ramTotal - ramFree) / ramTotal * 100, 2)
            return {"cpu": cpu, "ram_percent": ram_percent}
    except Exception:
        return None