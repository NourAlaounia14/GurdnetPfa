from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.models import Device, MetricHistory, TrafficMetric
from dependencies.auth import get_current_user
from services.monitoring_service import get_snmp_matrice
router =APIRouter(prefix="/monitoring",tags=["Monitoring"])
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