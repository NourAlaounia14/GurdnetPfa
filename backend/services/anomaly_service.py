from sqlalchemy.orm import Session
from models.models import MetricHistory, TrafficMetric, Alert, AnomalyLog
from ia.predict import predict_anomaly
from datetime import datetime

def get_current_features(db: Session) -> dict:
    # Dernière métrique
    metric = db.query(MetricHistory).order_by(MetricHistory.timestamp.desc()).first()
    # Dernier trafic
    traffic = db.query(TrafficMetric).order_by(TrafficMetric.timestamp.desc()).first()
    # Nombre d'alertes dans la dernière heure
    from datetime import timedelta
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
    nb_alerts = db.query(Alert).filter(Alert.created_at >= one_hour_ago).count()
    # Nombre de nouveaux appareils
    from models.models import Device
    nb_new_devices = db.query(Device).filter(Device.first_seen >= one_hour_ago).count()

    return {
        "latency_ms": float(metric.latency_ms) if metric and metric.latency_ms else 0.0,
        "nb_open_ports": 0,
        "nb_new_devices": nb_new_devices,
        "nb_alerts_1h": nb_alerts,
        "cpu_percent": float(metric.cpu_percent) if metric and metric.cpu_percent else 0.0,
        "ram_percent": float(metric.ram_percent) if metric and metric.ram_percent else 0.0,
        "hour_of_day": datetime.utcnow().hour
    }

def detect_anomaly(db: Session) -> dict:
    features = get_current_features(db)
    result = predict_anomaly(features)

    # Sauvegarde dans AnomalyLog
    log = AnomalyLog(
        timestamp=datetime.utcnow(),
        features=features,
        score=result["score"],
        is_anomaly=result["is_anomaly"]
    )

    # Si anomalie → crée une alerte
    if result["is_anomaly"]:
        alert = Alert(
            type="ANOMALY_DETECTED",
            severity="critical" if result["confidence"] == "high" else "warning",
            message=f"Anomalie détectée — score: {result['score']} — confiance: {result['confidence']}"
        )
        db.add(alert)
        db.flush()
        log.alert_id = alert.id

    db.add(log)
    db.commit()
    db.refresh(log)

    return {
        "is_anomaly": result["is_anomaly"],
        "score": result["score"],
        "confidence": result["confidence"],
        "features": features,
        "log_id": log.id
    }