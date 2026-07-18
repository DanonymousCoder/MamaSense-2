const model = require('../../ai/model/model.json');

const LIMITS = {
  gestational_age: [1, 42], bmi: [10, 60], haemoglobin: [3, 20],
  systolic_bp: [60, 240], diastolic_bp: [30, 160],
};
const LABELS = {
  gestational_age: 'Gestational age', bmi: 'BMI', haemoglobin: 'Haemoglobin',
  systolic_bp: 'Systolic blood pressure', diastolic_bp: 'Diastolic blood pressure',
  previous_caesarean: 'Previous caesarean',
};
const headers = {
  'Content-Type': 'application/json', 'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function response(statusCode, body) { return { statusCode, headers, body: JSON.stringify(body) }; }

function validate(payload) {
  const cleaned = {};
  for (const [feature, [low, high]] of Object.entries(LIMITS)) {
    const value = Number(payload?.[feature]);
    if (!Number.isFinite(value)) throw new Error(`${feature} must be a number`);
    if (value < low || value > high) throw new Error(`${feature} must be between ${low} and ${high}`);
    cleaned[feature] = value;
  }
  if (typeof payload?.previous_caesarean !== 'boolean') throw new Error('previous_caesarean must be true or false');
  cleaned.previous_caesarean = payload.previous_caesarean ? 1 : 0;
  return cleaned;
}

function sigmoid(value) { return 1 / (1 + Math.exp(-Math.max(-35, Math.min(35, value)))); }

function predict(payload) {
  const row = validate(payload);
  let logit = model.intercept;
  const contributions = [];
  model.features.forEach((feature, index) => {
    const standardised = (row[feature] - model.means[index]) / model.scales[index];
    const contribution = model.coefficients[index] * standardised;
    logit += contribution;
    contributions.push({ feature, label: LABELS[feature], contribution: Number(contribution.toFixed(4)), direction: contribution > 0 ? 'increases' : 'reduces' });
  });
  const probability = sigmoid(logit);
  const tier = probability >= model.risk_thresholds.high ? 'high' : probability >= model.risk_thresholds.moderate ? 'moderate' : 'low';
  return {
    probability: Number(probability.toFixed(4)), percentage: Number((probability * 100).toFixed(1)), tier,
    explanations: contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 4),
    model: { version: model.version, trained_on: model.trained_on }, disclaimer: model.disclaimer,
  };
}

async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return response(405, { detail: 'Method not allowed' });
  try { return response(200, predict(JSON.parse(event.body || '{}'))); }
  catch (error) { return response(422, { detail: error instanceof SyntaxError ? 'Request body must be valid JSON' : error.message }); }
}

module.exports = { handler, predict };
