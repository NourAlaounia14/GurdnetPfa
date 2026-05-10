import os

import joblib
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
model = joblib.load(os.path.join(BASE_DIR, "model.pkl"))
scaler = joblib.load(os.path.join(BASE_DIR, "scaler.pkl"))

FEATURES = [
    "latency_ms",
    "nb_open_ports",
    "nb_new_devices",
    "nb_alerts_1h",
    "cpu_percent",
    "ram_percent",
    "hour_of_day",
]


def predict_anomaly(features_dict: dict) -> dict:
    df = pd.DataFrame([features_dict])[FEATURES]
    df_scaled = scaler.transform(df)
    prediction = model.predict(df_scaled)[0]
    raw_score = -model.score_samples(df_scaled)[0]
    score = max(0.0, min(1.0, (float(raw_score) - 0.35) / 0.35))

    if score > 0.6:
        confidence = "high"
        confidence_score = 0.9
    elif score >= 0.4:
        confidence = "medium"
        confidence_score = 0.7
    else:
        confidence = "low"
        confidence_score = 0.55

    return {
        "is_anomaly": bool(prediction == -1),
        "score": round(float(score), 4),
        "confidence": confidence,
        "confidence_score": confidence_score,
        "raw_score": round(float(raw_score), 4),
        "prediction_raw": int(prediction),
    }
