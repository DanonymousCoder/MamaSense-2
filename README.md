# MamaSense Prototype

A lightweight, mobile-first prototype demonstrating how routine antenatal care data can be converted into a tiered postpartum haemorrhage (PPH) risk result and portable Risk Card.

## Run locally

No install is required. From this folder, run:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Demo flow

1. Select **Use sample data** (or enter a patient record).
2. Select **Assess PPH risk**.
3. Review the risk tier, influencing factors, and preparation actions.
4. Select **Print Risk Card** to produce a portable patient summary.

## Prototype note

The scoring rules and recommendations are illustrative decision-support logic for demonstrating the MamaSense concept. They are not a validated clinical model and must not be used for diagnosis or patient care without clinical validation and governance.
