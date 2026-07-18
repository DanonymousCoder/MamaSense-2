const model = require('../../ai/model/model.json');

async function handler(event) {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: JSON.stringify({ detail: 'Method not allowed' }) };
  const { model_type, version, trained_on, features, risk_thresholds, metrics, disclaimer } = model;
  return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }, body: JSON.stringify({ model_type, version, trained_on, features, risk_thresholds, metrics, disclaimer }) };
}

module.exports = { handler };
