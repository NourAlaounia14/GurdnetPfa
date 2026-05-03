from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models.models import Device, TrafficMetric

router = APIRouter(prefix="/monitoring", tags=["Monitoring"])

@router.get("/summary")
def get_monitoring_summary(db: Session = Depends(get_db)):
    total = db.query(Device).count()
    online = db.query(Device).filter(Device.status == "online").count()
    offline = db.query(Device).filter(Device.status == "offline").count()
    return {"total": total, "online": online, "offline": offline}

@router.get("/devices")
def get_monitoring_devices(db: Session = Depends(get_db)):
    devices = db.query(Device).all()
    return devices

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
