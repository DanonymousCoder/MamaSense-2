#!/usr/bin/env python3
"""Serve the MamaSense UI and local research prediction API."""

from __future__ import annotations

import json
import math
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = Path(__file__).resolve().parent / "model" / "model.json"
LIMITS = {
    "gestational_age": (1, 42), "bmi": (10, 60), "haemoglobin": (3, 20),
    "systolic_bp": (60, 240), "diastolic_bp": (30, 160),
}
LABELS = {
    "gestational_age": "Gestational age", "bmi": "BMI", "haemoglobin": "Haemoglobin",
    "systolic_bp": "Systolic blood pressure", "diastolic_bp": "Diastolic blood pressure",
    "previous_caesarean": "Previous caesarean",
}


def sigmoid(value: float) -> float:
    return 1 / (1 + math.exp(-max(-35, min(35, value))))


def load_model() -> dict:
    if not MODEL_PATH.exists():
        raise FileNotFoundError("Run: python3 ai/train_model.py")
    return json.loads(MODEL_PATH.read_text())


def validate(payload: dict) -> dict[str, float]:
    cleaned = {}
    for feature, (low, high) in LIMITS.items():
        try: value = float(payload[feature])
        except (KeyError, TypeError, ValueError): raise ValueError(f"{feature} must be a number")
        if not low <= value <= high: raise ValueError(f"{feature} must be between {low} and {high}")
        cleaned[feature] = value
    value = payload.get("previous_caesarean")
    if not isinstance(value, bool): raise ValueError("previous_caesarean must be true or false")
    cleaned["previous_caesarean"] = 1.0 if value else 0.0
    return cleaned


def predict(payload: dict) -> dict:
    model = load_model()
    row = validate(payload)
    contributions = []
    logit = model["intercept"]
    for i, feature in enumerate(model["features"]):
        standardised = (row[feature] - model["means"][i]) / model["scales"][i]
        contribution = model["coefficients"][i] * standardised
        logit += contribution
        contributions.append({
            "feature": feature, "label": LABELS[feature],
            "contribution": round(contribution, 4),
            "direction": "increases" if contribution > 0 else "reduces",
        })
    probability = sigmoid(logit)
    thresholds = model["risk_thresholds"]
    tier = "high" if probability >= thresholds["high"] else "moderate" if probability >= thresholds["moderate"] else "low"
    influential = sorted(contributions, key=lambda item: abs(item["contribution"]), reverse=True)[:4]
    return {
        "probability": round(probability, 4), "percentage": round(probability * 100, 1),
        "tier": tier, "explanations": influential,
        "model": {"version": model["version"], "trained_on": model["trained_on"]},
        "disclaimer": model["disclaimer"],
    }


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_json(self, status: int, body: dict) -> None:
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers(); self.wfile.write(data)

    def do_GET(self) -> None:
        if self.path == "/api/health":
            try:
                model = load_model()
                self.send_json(200, {"status": "ok", "model_version": model["version"]})
            except FileNotFoundError as error: self.send_json(503, {"status": "model_missing", "detail": str(error)})
            return
        if self.path == "/api/model-card":
            try:
                model = load_model()
                self.send_json(200, {k: model[k] for k in ("model_type", "version", "trained_on", "features", "risk_thresholds", "metrics", "disclaimer")})
            except FileNotFoundError as error: self.send_json(503, {"detail": str(error)})
            return
        super().do_GET()

    def do_POST(self) -> None:
        if self.path != "/api/predict": self.send_json(404, {"detail": "Not found"}); return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 10_000: raise ValueError("Request is too large")
            payload = json.loads(self.rfile.read(length))
            self.send_json(200, predict(payload))
        except (ValueError, json.JSONDecodeError) as error: self.send_json(422, {"detail": str(error)})
        except FileNotFoundError as error: self.send_json(503, {"detail": str(error)})


if __name__ == "__main__":
    print("MamaSense running at http://127.0.0.1:4173")
    ThreadingHTTPServer(("127.0.0.1", 4173), Handler).serve_forever()
