# MamaSense AI layer

This is a transparent research prototype built around standardised logistic regression.

## Feature contract

| Feature | Type | Accepted range | Source |
|---|---:|---:|---|
| Gestational age | number | 1–42 weeks | ANC record |
| BMI | number | 10–60 kg/m² | ANC measurement |
| Haemoglobin | number | 3–20 g/dL | Latest ANC test |
| Systolic BP | number | 60–240 mmHg | ANC measurement |
| Diastolic BP | number | 30–160 mmHg | ANC measurement |
| Previous caesarean | boolean | true/false | Patient history |

## Research safeguards

- The generated dataset is synthetic and contains no patient information.
- The model is not clinically validated and must not guide real patient care.
- Probability thresholds are demonstration settings, not clinical cut-offs.
- Every prediction returns directional feature contributions.
- Real deployment requires ethics approval, representative Nigerian data, external validation, calibration, bias analysis, clinical governance, and prospective monitoring.

## Files

- `train_model.py` generates the dataset, trains the model, and evaluates it.
- `model/model.json` stores the portable trained model and model card metadata.
- `model/metrics.json` stores held-out evaluation results.
- `server.py` serves the UI plus `/api/predict`, `/api/health`, and `/api/model-card`.
