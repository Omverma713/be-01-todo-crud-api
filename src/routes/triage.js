/**
 * Week 7 Assignment A17 - Triage Route
 * POST /triage
 */

const express = require('express');
const router = express.Router();
const { TriageInputSchema, TriageOutputSchema } = require('../llm/schema');

// Deterministic stub response generator
function getStubResponse(text) {
  const lower = text.toLowerCase();
  let category = 'other';
  let urgency = 'normal';
  let reason = 'General customer support inquiry.';
  let confidence = 0.85;

  if (lower.includes('charge') || lower.includes('bill') || lower.includes('invoice') || lower.includes('refund') || lower.includes('subscription') || lower.includes('payment')) {
    category = 'billing';
    urgency = lower.includes('twice') || lower.includes('fraud') ? 'high' : 'normal';
    reason = 'Customer is reporting a billing or subscription payment inquiry.';
    confidence = 0.95;
  } else if (lower.includes('bug') || lower.includes('crash') || lower.includes('broken') || lower.includes('error') || lower.includes('fail')) {
    category = 'bug';
    urgency = lower.includes('crash') || lower.includes('down') ? 'high' : 'normal';
    reason = 'Customer encountered an application bug or unexpected error.';
    confidence = 0.92;
  } else if (lower.includes('feature') || lower.includes('add') || lower.includes('suggest') || lower.includes('request') || lower.includes('dark mode')) {
    category = 'feature';
    urgency = 'low';
    reason = 'Customer submitted a product feature enhancement request.';
    confidence = 0.90;
  } else if (text.trim().length < 5 || lower.includes('hello') || lower.includes('hey')) {
    category = 'other';
    urgency = 'low';
    reason = 'Inquiry contains insufficient detail for specific categorization.';
    confidence = 0.35;
  }

  const stubData = { category, urgency, confidence, reason };
  return TriageOutputSchema.parse(stubData);
}

router.post('/', async (req, res, next) => {
  try {
    // 1. Validate input with Zod BEFORE any model call
    const validationResult = TriageInputSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errorDetail = validationResult.error.issues[0];
      return res.status(400).json({
        error: errorDetail.message,
        field: errorDetail.path.join('.') || 'text'
      });
    }

    const { text } = validationResult.data;

    // 2. Stub Mode check (LLM_STUB=1)
    const isStub = process.env.LLM_STUB === '1' || process.env.LLM_STUB === 'true';
    if (isStub) {
      const stubResponse = getStubResponse(text);
      return res.status(200).json(stubResponse);
    }

    // Pass through to service for Stages 2-5 when not in stub mode
    const llmService = require('../llm/service');
    const result = await llmService.triageText(text);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return next(error);
  }
});

module.exports = router;
module.exports.getStubResponse = getStubResponse;
