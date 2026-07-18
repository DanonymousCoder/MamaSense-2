const model = require('../../ai/model/model.json');

async function handler(event) {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: JSON.stringify({ detail: 'Method not allowed' }) };
  return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ status: 'ok', model_version: model.version, runtime: 'netlify-function' }) };
}

module.exports = { handler };
