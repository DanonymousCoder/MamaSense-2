const assert = require('node:assert/strict');
const { handler, predict } = require('../netlify/functions/predict');

const sample = { gestational_age: 34, bmi: 31.2, haemoglobin: 9.4, systolic_bp: 146, diastolic_bp: 92, previous_caesarean: true };
const result = predict(sample);
assert.equal(result.probability, 0.3473);
assert.equal(result.percentage, 34.7);
assert.equal(result.tier, 'high');
assert.equal(result.model.version, 'synthetic-v1');
assert.equal(result.explanations.length, 4);

handler({ httpMethod: 'POST', body: JSON.stringify(sample) }).then((apiResponse) => {
  assert.equal(apiResponse.statusCode, 200);
  assert.deepEqual(JSON.parse(apiResponse.body), result);
  console.log('Netlify prediction function: passed');
});
