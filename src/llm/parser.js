/**
 * Week 7 Assignment A17 - LLM Response Parser & Cleaner
 * Handles markdown code fences, extra text, JSON parsing, and Zod validation.
 */

const { TriageOutputSchema } = require('./schema');

function extractAndParseJSON(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Raw model response is empty or non-string');
  }

  let cleaned = rawText.trim();

  // Strip markdown code fences if present (```json ... ``` or ``` ...)
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  // If there is preamble or postscript, extract the outermost JSON object {...}
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  let parsedObj;
  try {
    parsedObj = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Failed to parse JSON from model output: ${err.message}`);
  }

  // Validate with Zod schema
  const validationResult = TriageOutputSchema.safeParse(parsedObj);
  if (!validationResult.success) {
    const issueMessages = validationResult.error.issues.map(i => `${i.path.join('.') || 'root'}: ${i.message}`).join(', ');
    const schemaError = new Error(`Schema validation failed: ${issueMessages}`);
    schemaError.validationErrors = issueMessages;
    schemaError.parsedObject = parsedObj;
    throw schemaError;
  }

  return validationResult.data;
}

module.exports = {
  extractAndParseJSON
};
