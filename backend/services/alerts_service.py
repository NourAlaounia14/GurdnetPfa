from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from models.models import Alert, Device, Settings

ALERT_SEVERITY = {
    "DEVICE_DOWN": "critical",
    "NEW_DEVICE": "warning",
    "NEW_UNKNOWN_DEVICE": "critical",
    "PORT_CHANGE": "warning",
    "PORT_SCAN_DETECTED": "critical",
    "ANOMALY_DETECTED": "critical",
    "PERSISTENT_ANOMALY": "critical",
    "NETWORK_OUTAGE": "critical",
    "LATENCY_HIGH": "warning",
}

ALERT_MESSAGES = {
    "DEVICE_DOWN": "Device {ip} est indisponible.",
    "NEW_DEVICE": "Nouveau device detecte : {ip} ({device_type}).",
    "NEW_UNKNOWN_DEVICE": "Nouveau device inconnu detecte : {ip}.",
    "PORT_CHANGE": "Changement de ports detecte pour {ip}. Ports ajoutes : {added}. Ports supprimes : {removed}.",
    "PORT_SCAN_DETECTED": "Scan de ports detecte sur {ip}.",
    "ANOMALY_DETECTED": "Anomalie detectee. Score: {score}, confiance: {confidence}.",
    "PERSISTENT_ANOMALY": "Anomalie persistante : 3 analyses IA consecutives sont anormales. Score: {score}, confiance: {confidence}.",
    "NETWORK_OUTAGE": "Panne reseau detectee.",
    "LATENCY_HIGH": "Latence elevee detectee : {latency_ms} ms (seuil {threshold} ms).",
}


def _parse_setting_value(value: str, default: Any) -> Any:
    if default is None:
        return value
    if isinstance(default, bool):
        return value.lower() in ("1", "true", "yes", "on")
    if isinstance(default, int):
        try:
            return int(value)
        except ValueError:
            return default
    if isinstance(default, float):
        try:
            return float(value)
        except ValueError:
            return default
    return value


def get_setting_value(db: Session, key: str, default: Any = None) -> Any:
    setting = db.query(Settings).filter(Settings.cle == key).first()
    if setting is None or setting.valeur is None:
        return default
    return _parse_setting_value(setting.valeur, default)


def _build_message(alert_type: str, metadata: Optional[Dict[str, Any]] = None) -> str:
    metadata = metadata or {}
    template = ALERT_MESSAGES.get(alert_type, "Alerte {type} generee.")
    data = defaultdict(str, metadata)
    data["type"] = alert_type
    return template.format_map(data)


def create_alert(
    db: Session,
    alert_type: str,
    message: Optional[str] = None,
    severity: Optional[str] = None,
    device_id: Optional[int] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Alert:
    severity = severity or ALERT_SEVERITY.get(alert_type, "info")
    if message is None:
        message = _build_message(alert_type, metadata)

    alert = Alert(
        type=alert_type,
        severity=severity,
        message=message,
        device_id=device_id,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


def check_port_scan(device_ip: str, db: Session) -> Optional[Alert]:
    device = db.query(Device).filter(Device.ip == device_ip).first()
    if not device:
        return None

    existing_alert = (
        db.query(Alert)
        .filter(
            Alert.type == "PORT_SCAN_DETECTED",
            Alert.device_id == device.id,
            Alert.resolved.is_(False),
        )
        .first()
    )
    if existing_alert:
        return None

    inspector = inspect(db.bind)
    columns = {column["name"] for column in inspector.get_columns("metric_history")}
    if "port" not in columns:
        return None

    since = datetime.utcnow() - timedelta(seconds=60)
    params = {"since": since}
    if "device_ip" in columns:
        where_clause = "device_ip = :device_ip AND timestamp >= :since"
        params["device_ip"] = device_ip
    elif "device_id" in columns:
        where_clause = "device_id = :device_id AND timestamp >= :since"
        params["device_id"] = device.id
    else:
        return None

    distinct_ports = db.execute(
        text(f"SELECT COUNT(DISTINCT port) FROM metric_history WHERE {where_clause}"),
        params,
    ).scalar() or 0

    if distinct_ports <= 15:
        return None

    return create_alert(
        db,
        "PORT_SCAN_DETECTED",
        severity="critical",
        message=f"Possible port scan detected from {device_ip}: more than 15 ports probed in 60 seconds",
        device_id=device.id,
    )
