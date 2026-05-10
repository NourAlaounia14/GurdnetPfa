from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from ia.predict import FEATURES, predict_anomaly
from models.models import Alert, AnomalyLog, MetricHistory, Scan, ScanResult
from services.alerts_service import create_alert, get_setting_value
from services.monitoring_service import get_server_cpu_ram, get_threshold

router = APIRouter(prefix="/anomaly", tags=["Anomalie"])


def _latest_scan_features(db: Session) -> dict:
    last_scan = (
        db.query(Scan)
        .filter(Scan.finished_at.isnot(None))
        .order_by(Scan.finished_at.desc())
        .first()
    )
    if not last_scan:
        return {"nb_open_ports": 3, "nb_new_devices": 0}

    results = db.query(ScanResult).filter(ScanResult.scan_id == last_scan.id).all()
    open_ports = sum(len(result.ports or []) for result in results)
    new_devices = sum(1 for result in results if result.is_new)
    return {"nb_open_ports": open_ports, "nb_new_devices": new_devices}


def _metric_features(db: Session) -> dict:
    recent_metrics = (
        db.query(MetricHistory)
        .order_by(MetricHistory.timestamp.desc())
        .limit(30)
        .all()
    )
    if not recent_metrics:
        return {"latency_ms": 50}

    values = [metric.latency_ms for metric in recent_metrics if metric.latency_ms is not None]
    latency = round(sum(values) / len(values), 2) if values else 50
    return {"latency_ms": latency}


def collect_ai_features(db: Session) -> dict:
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
    server_metrics = get_server_cpu_ram()
    features = {
        **_metric_features(db),
        **_latest_scan_features(db),
        "nb_alerts_1h": db.query(Alert)
        .filter(Alert.resolved.is_(False), Alert.created_at >= one_hour_ago)
        .count(),
        "cpu_percent": server_metrics["cpu_percent"],
        "ram_percent": server_metrics["ram_percent"],
        "hour_of_day": datetime.now().hour,
    }
    return {feature: features.get(feature, 0) for feature in FEATURES}


def _should_escalate_consecutive_anomalies(db: Session, is_anomaly: bool) -> bool:
    if not is_anomaly:
        return False

    last_two = (
        db.query(AnomalyLog)
        .order_by(AnomalyLog.timestamp.desc())
        .limit(2)
        .all()
    )
    return len(last_two) == 2 and all(item.is_anomaly for item in last_two)


def detect_anomaly_internal(db: Session, automatic: bool = False) -> dict:
    features = collect_ai_features(db)
    result = predict_anomaly(features)

    latency_threshold = get_threshold("latency_max_ms", 200, db)
    if features["latency_ms"] > latency_threshold:
        create_alert(
            db,
            "LATENCY_HIGH",
            metadata={"latency_ms": features["latency_ms"], "threshold": latency_threshold},
        )

    alert_id = None
    if result["is_anomaly"]:
        anomaly_threshold = get_setting_value(db, "anomaly_score_threshold", 0.5)
        severity = "critical" if result["score"] >= anomaly_threshold else "warning"
        alert = create_alert(
            db,
            "ANOMALY_DETECTED",
            severity=severity,
            metadata={
                "score": result["score"],
                "confidence": result["confidence"],
                "nb_open_ports": features["nb_open_ports"],
                "nb_new_devices": features["nb_new_devices"],
                "source": "scheduler" if automatic else "manual",
            },
        )
        alert_id = alert.id

    escalation_alert_id = None
    if _should_escalate_consecutive_anomalies(db, result["is_anomaly"]):
        escalation = create_alert(
            db,
            "PERSISTENT_ANOMALY",
            severity="critical",
            metadata={"score": result["score"], "confidence": result["confidence"]},
        )
        escalation_alert_id = escalation.id

    log = AnomalyLog(
        features=features,
        score=result["score"],
        is_anomaly=result["is_anomaly"],
        alert_id=alert_id,
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    return {
        "is_anomaly": result["is_anomaly"],
        "score": result["score"],
        "confidence": result["confidence"],
        "confidence_score": result["confidence_score"],
        "features_used": features,
        "feature_order": FEATURES,
        "alert_created": alert_id is not None,
        "alert_id": alert_id,
        "escalation_alert_id": escalation_alert_id,
        "automatic": automatic,
        "logged_at": log.timestamp.isoformat() if log.timestamp else None,
    }


@router.post("/detect")
def detect_anomaly(db: Session = Depends(get_db)):
    return detect_anomaly_internal(db=db, automatic=False)


@router.get("/features")
def get_current_features(db: Session = Depends(get_db)):
    return collect_ai_features(db)


@router.get("/history")
def get_anomaly_history(skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    logs = (
        db.query(AnomalyLog)
        .order_by(AnomalyLog.timestamp.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return logs
