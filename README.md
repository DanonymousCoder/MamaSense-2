# MamaSense Prototype

A lightweight, mobile-first prototype demonstrating how routine antenatal care data can be converted into a tiered postpartum haemorrhage (PPH) risk result and portable Risk Card.

## Run with the AI layer

No installation is required. From this folder, train the reproducible synthetic model once:

```bash
python3 ai/train_model.py
python3 ai/server.py
```

Then open `http://localhost:4173`.

## Demo flow

1. Select **Use sample data** (or enter a patient record).
2. Select **Assess PPH risk**.
3. Review the risk tier, influencing factors, and preparation actions.
4. Select **Print Risk Card** to produce a portable patient summary.

## Prototype note

The interface now calls an interpretable logistic-regression model and shows estimated probability plus directional feature contributions. If the AI API is unavailable, it automatically uses the original rule-based demonstration fallback.

The model was trained entirely on synthetic data. Its scoring, thresholds, and recommendations are illustrative and must not be used for diagnosis or patient care without representative clinical data, external validation, ethics approval, and clinical governance. See [`ai/README.md`](ai/README.md) for the feature contract and safeguards.
