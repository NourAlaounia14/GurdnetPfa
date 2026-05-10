from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import SessionLocal, engine
from models import models
from routers import alerts, anomaly, auth, monitoring, scan, settings, users
from services.demo_seed import seed_demo_data
from services.monitoring_service import monitor_devices

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="GuardNet API", version="1.0")
scheduler = BackgroundScheduler()


def _with_db(task) -> None:
    db = SessionLocal()
    try:
        task(db)
    finally:
        db.close()


def _run_scheduled_monitoring() -> None:
    try:
        _with_db(monitor_devices)
    except Exception as exc:
        print(f"[SCHEDULER] Echec du monitoring automatique : {exc}")


def _run_scheduled_anomaly() -> None:
    try:
        _with_db(lambda db: anomaly.detect_anomaly_internal(db=db, automatic=True))
    except Exception as exc:
        print(f"[SCHEDULER] Echec de la detection IA automatique : {exc}")


@app.on_event("startup")
def start_scheduler() -> None:
    _with_db(seed_demo_data)
    scheduler.add_job(
        _run_scheduled_monitoring,
        trigger="interval",
        seconds=30,
        id="monitoring_ping",
        replace_existing=True,
    )
    scheduler.add_job(
        _run_scheduled_anomaly,
        trigger="interval",
        minutes=5,
        id="anomaly_detection",
        replace_existing=True,
    )
    scheduler.start()


@app.on_event("shutdown")
def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://127.0.0.1:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scan.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(settings.router)
app.include_router(anomaly.router)
app.include_router(alerts.router)
app.include_router(monitoring.router)


@app.get("/")
def root():
    return {"message": "GuardNet API operationnelle"}
