# À ajouter dans votre fichier de routes (ex: routers/monitoring.py ou main.py)

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models.models import TrafficMetric

router = APIRouter(prefix="/metrics", tags=["Metrics"])


@router.get("/traffic")
def get_traffic_metrics(limit: int = 20, db: Session = Depends(get_db)):
    """
    Retourne les N dernières captures de trafic réseau.
    Query param : ?limit=20 (défaut)
    """
    metrics = (
        db.query(TrafficMetric)
        .order_by(TrafficMetric.timestamp.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": m.id,
            "timestamp": m.timestamp,
            "total_packets": m.total_packets,
            "tcp_pct": m.tcp_pct,
            "udp_pct": m.udp_pct,
            "bytes_total": m.bytes_total,
            "top_ips": m.top_ips,
            "top_ports": m.top_ports,
        }
        for m in metrics
    ]