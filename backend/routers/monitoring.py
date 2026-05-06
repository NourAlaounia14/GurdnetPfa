from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.models import Device, MetricHistory, TrafficMetric, Alert
from dependencies.auth import get_current_user
from services.monitoring_service import get_snmp_matrice
from sqlalchemy import func
import random
router =APIRouter(prefix="/monitoring",tags=["Monitoring"])

@router.get("/network")
def get_network_map(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Retourne la carte réseau avec devices positionnés en SVG"""
    devices = db.query(Device).all()
    
    # Calculer positions en cercle pour la visualisation SVG
    network_nodes = []
    num_devices = len(devices)
    center_x, center_y = 400, 300
    radius = 200
    
    for idx, device in enumerate(devices):
        angle = (2 * 3.14159 * idx) / max(num_devices, 1)
        x = center_x + radius * (2 * idx / max(num_devices, 1) - 1)
        y = center_y + radius * (2 * idx / max(num_devices, 1) - 1)
        
        # Déterminer l'icône basée sur device_type
        icon_map = {
            "router": "📡",
            "switch": "🔄",
            "server": "🖥️",
            "pc": "💻",
            "printer": "🖨️",
            "firewall": "🔥",
            "unknown": "❓"
        }
        icon = icon_map.get(device.device_type, "❓")
        
        # Compter les alertes liées à ce device
        alert_count = db.query(Alert).filter(
            Alert.device_id == device.id,
            Alert.resolved == False
        ).count()
        
        network_nodes.append({
            "id": device.id,
            "ip": device.ip,
            "hostname": device.hostname or "Unknown",
            "device_type": device.device_type,
            "status": device.status,
            "icon": icon,
            "x": x,
            "y": y,
            "alert_count": alert_count,
            "first_seen": device.first_seen,
            "last_seen": device.last_seen,
        })
    
    return {"nodes": network_nodes, "total_devices": num_devices}

@router.get("/device/{device_id}/history")
def get_device_history(device_id:int,db:Session=Depends(get_db),current_user = Depends(get_current_user)):
    device=db.query(Device).filter(Device.id==device_id).first()
    if not  device:
        raise HTTPException(status_code=404, detail="Appareil introuvable")
    history=db.query(MetricHistory).filter(MetricHistory.device_id==device_id).all()
    return history
@router.get("/summary")
def get_summary(db: Session = Depends(get_db),
                current_user = Depends(get_current_user)
                ):
    devices = db.query(Device).all()
    online = sum(1 for d in devices if d.status == "online")
    offline = sum(1 for d in devices if d.status == "offline")
    return {
        "total": len(devices),
        "online": online,
        "offline": offline
    }
@router.get("/traffic/history")
def get_traffic_history(db: Session = Depends(get_db),
                        current_user = Depends(get_current_user)):
    traffic=db.query(TrafficMetric).all()
    return traffic

@router.get("/device/{device_id}/diagnose")
def diagnostiquer(
        device_id: int,
        db: Session = Depends(get_db),
        current_user = Depends(get_current_user)
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Appareil introuvable")
    informationMachine = get_snmp_matrice(device.ip)
    if not informationMachine:
        raise HTTPException(status_code=503, detail="SNMP non disponible sur cet appareil")
    return informationMachine