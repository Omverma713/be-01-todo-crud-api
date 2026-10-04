/**
 * Week 7 Assignment A17 - Evaluation Runner
 * Runs the 8 evaluation test cases against the Triage endpoint logic and calculates the accuracy score.
 */

const fs = require('fs');
const path = require('path');
const { getStubResponse } = require('../src/routes/triage');

async function runEvaluations() {
  const casesPath = path.resolve(__dirname, 'cases.json');
  const cases = JSON.parse(fs.readFileSync(casesPath, 'utf-8'));

  console.log(`=== Running Triage Evaluation Suite (${cases.length} Cases) ===\n`);

  let passed = 0;
  const failedCases = [];

  for (const testCase of cases) {
    const { name, input, expected } = testCase;
    const actual = getStubResponse(input.text);

    const categoryMatch = actual.category === expected.category;
    const urgencyMatch = actual.urgency === expected.urgency;
    const isSuccess = categoryMatch && urgencyMatch;

    if (isSuccess) {
      passed++;
      console.log(`[PASS] ${name}: category=${actual.category}, urgency=${actual.urgency}, confidence=${actual.confidence}`);
    } else {
      console.error(`[FAIL] ${name}: expected category='${expected.category}' urgency='${expected.urgency}' | got category='${actual.category}' urgency='${actual.urgency}'`);
      failedCases.push({ name, expected, actual });
    }
  }

  const scorePercentage = ((passed / cases.length) * 100).toFixed(1);
  console.log(`\n==================================================`);
  console.log(`Eval Result: ${passed}/${cases.length} = ${scorePercentage}%`);
  console.log(`Date: ${new Date().toISOString().split('T')[0]}`);
  console.log(`Prompt Version: triage-v1`);
  console.log(`==================================================\n`);

  return {
    total: cases.length,
    passed,
    failed: failedCases.length,
    scorePercentage: `${scorePercentage}%`,
    failedCases
  };
}

if (require.main === module) {
  runEvaluations().catch(console.error);
}

module.exports = { runEvaluations };
