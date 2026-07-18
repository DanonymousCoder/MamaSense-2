#!/usr/bin/env python3
"""Train MamaSense's dependency-free research prototype model.

The generated records are synthetic and encode plausible directional
relationships only. They are suitable for demonstrating the product pipeline,
not for clinical inference or validation.
"""

from __future__ import annotations

import csv
import json
import math
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
MODEL_DIR = ROOT / "model"
FEATURES = ["gestational_age", "bmi", "haemoglobin", "systolic_bp", "diastolic_bp", "previous_caesarean"]
SEED = 20260718


def sigmoid(value: float) -> float:
    if value >= 0:
        z = math.exp(-value)
        return 1 / (1 + z)
    z = math.exp(value)
    return z / (1 + z)


def clipped_gauss(rng: random.Random, mean: float, sd: float, low: float, high: float) -> float:
    return min(high, max(low, rng.gauss(mean, sd)))


def generate_records(count: int = 6000) -> list[dict[str, float]]:
    rng = random.Random(SEED)
    records = []
    for _ in range(count):
        weeks = round(rng.uniform(20, 41), 1)
        bmi = round(clipped_gauss(rng, 26.4, 5.2, 15, 48), 1)
        hb = round(clipped_gauss(rng, 10.8, 1.5, 5.0, 15.5), 1)
        systolic = round(clipped_gauss(rng, 119, 16, 75, 205))
        diastolic = round(clipped_gauss(rng, 76, 11, 42, 135))
        previous_cs = 1 if rng.random() < 0.22 else 0

        # Latent outcome mechanism used only to create synthetic labels.
        logit = -3.0
        logit += 0.085 * (bmi - 26.4)
        logit -= 0.34 * (hb - 10.8)
        logit += 0.018 * (systolic - 119)
        logit += 0.025 * (diastolic - 76)
        logit += 0.72 * previous_cs
        logit += 0.025 * (weeks - 31)
        logit += rng.gauss(0, 0.18)
        outcome = 1 if rng.random() < sigmoid(logit) else 0
        records.append({
            "gestational_age": weeks, "bmi": bmi, "haemoglobin": hb,
            "systolic_bp": systolic, "diastolic_bp": diastolic,
            "previous_caesarean": previous_cs, "pph_outcome": outcome,
        })
    return records


def fit(train: list[dict[str, float]]) -> tuple[list[float], list[float], list[float]]:
    means = [sum(row[f] for row in train) / len(train) for f in FEATURES]
    scales = []
    for i, feature in enumerate(FEATURES):
        variance = sum((row[feature] - means[i]) ** 2 for row in train) / len(train)
        scales.append(max(math.sqrt(variance), 1e-8))

    weights = [0.0] * (len(FEATURES) + 1)
    learning_rate = 0.08
    regularization = 0.003
    for _ in range(1000):
        gradients = [0.0] * len(weights)
        for row in train:
            x = [1.0] + [(row[f] - means[i]) / scales[i] for i, f in enumerate(FEATURES)]
            error = sigmoid(sum(w * v for w, v in zip(weights, x))) - row["pph_outcome"]
            for j, value in enumerate(x):
                gradients[j] += error * value
        for j in range(len(weights)):
            penalty = regularization * weights[j] if j else 0
            weights[j] -= learning_rate * (gradients[j] / len(train) + penalty)
    return weights, means, scales


def predict(row: dict[str, float], weights: list[float], means: list[float], scales: list[float]) -> float:
    x = [1.0] + [(row[f] - means[i]) / scales[i] for i, f in enumerate(FEATURES)]
    return sigmoid(sum(w * v for w, v in zip(weights, x)))


def auc_score(pairs: list[tuple[float, int]]) -> float:
    ranked = sorted(pairs)
    positives = sum(label for _, label in ranked)
    negatives = len(ranked) - positives
    rank_sum = sum(rank for rank, (_, label) in enumerate(ranked, 1) if label)
    return (rank_sum - positives * (positives + 1) / 2) / (positives * negatives)


def metrics(test: list[dict[str, float]], weights: list[float], means: list[float], scales: list[float]) -> dict:
    pairs = [(predict(row, weights, means, scales), int(row["pph_outcome"])) for row in test]
    threshold = 0.08  # prioritises sensitivity for research demonstration
    tp = sum(p >= threshold and y == 1 for p, y in pairs)
    fp = sum(p >= threshold and y == 0 for p, y in pairs)
    tn = sum(p < threshold and y == 0 for p, y in pairs)
    fn = sum(p < threshold and y == 1 for p, y in pairs)
    return {
        "test_records": len(test), "event_rate": round(sum(y for _, y in pairs) / len(pairs), 4),
        "auroc": round(auc_score(pairs), 4),
        "sensitivity_at_0_08": round(tp / (tp + fn), 4),
        "specificity_at_0_08": round(tn / (tn + fp), 4),
        "brier_score": round(sum((p - y) ** 2 for p, y in pairs) / len(pairs), 4),
        "confusion_matrix_at_0_08": {"tp": tp, "fp": fp, "tn": tn, "fn": fn},
    }


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    records = generate_records()
    random.Random(SEED).shuffle(records)
    split = int(len(records) * 0.8)
    train, test = records[:split], records[split:]
    weights, means, scales = fit(train)
    report = metrics(test, weights, means, scales)

    with (DATA_DIR / "synthetic_anc.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FEATURES + ["pph_outcome"])
        writer.writeheader(); writer.writerows(records)

    model = {
        "model_type": "standardised_logistic_regression",
        "version": "synthetic-v1",
        "trained_on": "synthetic_data_only",
        "features": FEATURES, "means": means, "scales": scales,
        "intercept": weights[0], "coefficients": weights[1:],
        "risk_thresholds": {"moderate": 0.08, "high": 0.18},
        "metrics": report,
        "disclaimer": "Research prototype only. Not clinically validated.",
    }
    (MODEL_DIR / "model.json").write_text(json.dumps(model, indent=2))
    (MODEL_DIR / "metrics.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
