import math

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.models import Alert, Device, MetricHistory, TrafficMetric
from services.monitoring_service import diagnose_machine

router = APIRouter(prefix="/monitoring", tags=["Monitoring"])


def _is_online(status: str | None) -> bool:
    return (status or "").lower() in {"online", "up"}


def _latest_metric(db: Session, device_id: int) -> MetricHistory | None:
    return (
        db.query(MetricHistory)
        .filter(MetricHistory.device_id == device_id)
        .order_by(MetricHistory.timestamp.desc())
        .first()
    )


def _device_payload(device: Device, db: Session) -> dict:
    metric = _latest_metric(db, device.id)
    return {
        "id": device.id,
        "ip": device.ip,
        "hostname": device.hostname,
        "os_name": device.os_name,
        "device_type": device.device_type or "unknown",
        "status": device.status or "unknown",
        "first_seen": device.first_seen.isoformat() if device.first_seen else None,
        "last_seen": device.last_seen.isoformat() if device.last_seen else None,
        "latency_ms": metric.latency_ms if metric else None,
        "cpu_percent": metric.cpu_percent if metric else None,
        "ram_percent": metric.ram_percent if metric else None,
        "is_up": metric.is_up if metric else _is_online(device.status),
        "last_metric_at": metric.timestamp.isoformat() if metric and metric.timestamp else None,
    }


@router.get("/network")
def get_network_map(db: Session = Depends(get_db)):
    devices = db.query(Device).all()
    total_devices = len(devices)
    center_x, center_y = 400, 300
    radius = 210

    icon_map = {
        "router": "RT",
        "switch": "SW",
        "server": "SRV",
        "workstation": "WS",
        "pc": "PC",
        "printer": "PRN",
        "firewall": "FW",
        "unknown": "UNK",
    }

    def build_node(device: Device, x: float, y: float) -> dict:
        payload = _device_payload(device, db)
        alert_count = (
            db.query(Alert)
            .filter(Alert.device_id == device.id, Alert.resolved == False)
            .count()
        )
        device_type = payload["device_type"].lower()

        return {
            **payload,
            "hostname": payload["hostname"] or payload["ip"] or "Unknown",
            "icon": icon_map.get(device_type, icon_map["unknown"]),
            "x": x,
            "y": y,
            "alert_count": alert_count,
        }

    hub_device = next((device for device in devices if (device.device_type or "").lower() == "switch"), None)
    nodes = []

    if hub_device:
        nodes.append(build_node(hub_device, center_x, center_y))
        leaf_devices = [device for device in devices if device.id != hub_device.id]
        for index, device in enumerate(leaf_devices):
            angle = (2 * math.pi * index) / max(len(leaf_devices), 1) - math.pi / 2
            nodes.append(
                build_node(
                    device,
                    center_x + radius * math.cos(angle),
                    center_y + radius * math.sin(angle),
                )
            )
    else:
        for index, device in enumerate(devices):
            angle = (2 * math.pi * index) / max(total_devices, 1)
            nodes.append(
                build_node(
                    device,
                    center_x + radius * math.cos(angle),
                    center_y + radius * math.sin(angle),
                )
            )

    return {"nodes": nodes, "total_devices": total_devices}


@router.get("/summary")
def get_monitoring_summary(db: Session = Depends(get_db)):
    devices = db.query(Device).all()
    metrics = db.query(MetricHistory).order_by(MetricHistory.timestamp.desc()).limit(50).all()

    def average(field: str) -> float:
        values = [getattr(metric, field) for metric in metrics if getattr(metric, field) is not None]
        return round(sum(values) / len(values), 2) if values else 0

    online = sum(1 for device in devices if _is_online(device.status))
    latest_metric = db.query(MetricHistory).order_by(MetricHistory.timestamp.desc()).first()
    return {
        "total": len(devices),
        "online": online,
        "offline": len(devices) - online,
        "avg_cpu_percent": average("cpu_percent"),
        "avg_ram_percent": average("ram_percent"),
        "avg_latency_ms": average("latency_ms"),
        "monitoring_interval_sec": 30,
        "last_monitoring_at": latest_metric.timestamp.isoformat() if latest_metric else None,
    }


@router.get("/devices")
def get_monitoring_devices(db: Session = Depends(get_db)):
    devices = db.query(Device).all()
    return [_device_payload(device, db) for device in devices]


@router.get("/device/{device_id}/history")
def get_device_history(device_id: int, db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Appareil introuvable")
    return (
        db.query(MetricHistory)
        .filter(MetricHistory.device_id == device_id)
        .order_by(MetricHistory.timestamp.desc())
        .limit(100)
        .all()
    )


@router.get("/device/{device_id}/diagnose")
def diagnose_device(device_id: int, db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Appareil introuvable")
    return diagnose_machine(db, device)


@router.get("/traffic/history")
def get_traffic_history(limit: int = 30, db: Session = Depends(get_db)):
    metrics = (
        db.query(TrafficMetric)
        .order_by(TrafficMetric.timestamp.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "timestamp": m.timestamp.isoformat(),
            "total_packets": m.total_packets,
            "tcp_pct": m.tcp_pct,
            "udp_pct": m.udp_pct,
            "bytes_total": m.bytes_total,
            "top_ips": m.top_ips,
            "top_ports": m.top_ports,
        }
        for m in reversed(metrics)
    ]


@router.get("/report")
def get_monitoring_report(db: Session = Depends(get_db)):
    return {
        "summary": get_monitoring_summary(db),
        "devices": get_monitoring_devices(db),
        "traffic_history": get_traffic_history(10, db),
        "active_alerts": db.query(Alert).filter(Alert.resolved == False).count(),
    }
