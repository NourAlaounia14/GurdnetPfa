import asyncio
import io
from datetime import datetime

import pandas as pd
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database import SessionLocal, get_db
from models.models import Device, Scan, ScanResult
from schemas.scan import ScanRequest
from services.alerts_service import check_port_scan, create_alert
from services.scanner import NetworkScanner

router = APIRouter(prefix="/scan", tags=["Scan"])
scanner = NetworkScanner()


def _scanner_profile(scan_type: str) -> str:
    return "full" if scan_type == "complet" else "quick"


async def run_scan(ip_range: str, scan_type: str, scan_id: int) -> None:
    loop = asyncio.get_event_loop()
    raw_result = await loop.run_in_executor(None, scanner.scan, ip_range, _scanner_profile(scan_type))
    results = raw_result.get("hosts", []) if isinstance(raw_result, dict) else []

    db = SessionLocal()
    try:
        existing_ips = {device.ip for device in db.query(Device).all()}

        for result in results:
            result["is_new"] = result["ip"] not in existing_ips
            device = db.query(Device).filter(Device.ip == result["ip"]).first()
            previous_scan = (
                db.query(ScanResult)
                .filter(ScanResult.device_ip == result["ip"])
                .order_by(ScanResult.id.desc())
                .first()
            )

            status = "online" if result.get("state") == "up" else "offline"
            if not device:
                device = Device(
                    ip=result["ip"],
                    hostname=result.get("hostname"),
                    os_name=result.get("os_name"),
                    device_type=result.get("device_type") or "unknown",
                    status=status,
                    last_seen=datetime.utcnow() if status == "online" else None,
                )
                db.add(device)
                db.flush()
                alert_type = "NEW_UNKNOWN_DEVICE" if device.device_type == "unknown" else "NEW_DEVICE"
                create_alert(
                    db,
                    alert_type,
                    device_id=device.id,
                    metadata={"ip": result["ip"], "device_type": device.device_type},
                )
            else:
                current_ports = {port["port"] for port in result.get("ports", [])}
                previous_ports = {port["port"] for port in (previous_scan.ports or [])} if previous_scan else set()
                added_ports = sorted(current_ports - previous_ports)
                removed_ports = sorted(previous_ports - current_ports)

                if added_ports or removed_ports:
                    create_alert(
                        db,
                        "PORT_CHANGE",
                        device_id=device.id,
                        metadata={"ip": result["ip"], "added": added_ports, "removed": removed_ports},
                    )

                if status == "offline" and device.status != "offline":
                    create_alert(db, "DEVICE_DOWN", device_id=device.id, metadata={"ip": result["ip"]})

                device.hostname = result.get("hostname")
                device.os_name = result.get("os_name")
                device.device_type = result.get("device_type") or "unknown"
                device.status = status
                if status == "online":
                    device.last_seen = datetime.utcnow()

            scan_result = ScanResult(
                scan_id=scan_id,
                device_ip=result["ip"],
                hostname=result.get("hostname"),
                os_name=result.get("os_name"),
                device_type=result.get("device_type") or "unknown",
                ports=result.get("ports", []),
                is_new=result["is_new"],
            )
            db.add(scan_result)
            db.flush()
            check_port_scan(result["ip"], db)

        scan_obj = db.query(Scan).filter(Scan.id == scan_id).first()
        if scan_obj:
            scan_obj.finished_at = datetime.utcnow()
            scan_obj.devices_found = len(results)
        db.commit()
        print(f"[SCAN {scan_id}] Termine : {len(results)} devices")
    finally:
        db.close()


@router.post("/start")
async def start_scan(request: ScanRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    scan = Scan(ip_range=request.ip_range, scan_type="complet")
    db.add(scan)
    db.commit()
    db.refresh(scan)
    background_tasks.add_task(run_scan, request.ip_range, "complet", scan.id)
    return {"scan_id": scan.id, "status": "en cours", "ip_range": request.ip_range, "scan_type": "complet"}


@router.get("/history")
def get_scan_history(skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    scans = db.query(Scan).order_by(Scan.started_at.desc()).offset(skip).limit(limit).all()
    return [
        {
            "id": scan.id,
            "ip_range": scan.ip_range,
            "scan_type": scan.scan_type,
            "started_at": scan.started_at,
            "finished_at": scan.finished_at,
            "devices_found": scan.devices_found or 0,
        }
        for scan in scans
    ]


@router.get("/{scan_id}")
def get_scan_detail(scan_id: int, db: Session = Depends(get_db)):
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan introuvable")
    results = db.query(ScanResult).filter(ScanResult.scan_id == scan_id).all()
    return {
        "scan": {
            "id": scan.id,
            "ip_range": scan.ip_range,
            "scan_type": scan.scan_type,
            "started_at": scan.started_at,
            "finished_at": scan.finished_at,
            "devices_found": scan.devices_found or 0,
        },
        "devices": [
            {
                "id": result.id,
                "scan_id": result.scan_id,
                "device_ip": result.device_ip,
                "ip": result.device_ip,
                "hostname": result.hostname,
                "os_name": result.os_name,
                "device_type": result.device_type or "unknown",
                "ports": result.ports or [],
                "is_new": result.is_new,
            }
            for result in results
        ],
    }


@router.get("/{scan_id}/export")
def export_scan_csv(scan_id: int, db: Session = Depends(get_db)):
    results = db.query(ScanResult).filter(ScanResult.scan_id == scan_id).all()
    if not results:
        raise HTTPException(status_code=404, detail="Scan introuvable ou vide")

    rows = []
    for result in results:
        ports_str = ", ".join([f"{port.get('port')}/{port.get('service')}" for port in (result.ports or [])])
        rows.append(
            {
                "IP": result.device_ip,
                "Hostname": result.hostname,
                "OS": result.os_name,
                "Device Type": result.device_type or "unknown",
                "Ports": ports_str,
                "Nouveau": "Oui" if result.is_new else "Non",
            }
        )

    stream = io.StringIO()
    pd.DataFrame(rows).to_csv(stream, index=False)
    stream.seek(0)
    return StreamingResponse(
        iter([stream.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=scan_{scan_id}.csv"},
    )
