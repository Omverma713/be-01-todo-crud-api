/**
 * Week 7 Assignment A17 - LLM Triage Service
 * Handles Prompt Loading, LLM Execution, Retries, Repair, Quarantine, Cost Logging, and Kill Switch.
 */

const fs = require('fs');
const path = require('path');
const { getLLMClient } = require('./client');
const { extractAndParseJSON } = require('./parser');
const { TriageOutputSchema } = require('./schema');

const PROMPT_PATH = path.resolve(__dirname, '../../prompts/triage-v1.md');
const LOGS_DIR = path.resolve(__dirname, '../../logs');
const QUARANTINE_FILE = path.join(LOGS_DIR, 'quarantine.jsonl');

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

let cachedSystemPrompt = null;
function getSystemPrompt() {
  if (!cachedSystemPrompt) {
    cachedSystemPrompt = fs.readFileSync(PROMPT_PATH, 'utf-8');
  }
  return cachedSystemPrompt;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Log structured cost and execution telemetry
function logCostMetrics({ promptVersion, model, inputTokens, outputTokens, durationMs, repairCount }) {
  const costRecord = {
    timestamp: new Date().toISOString(),
    prompt_version: promptVersion,
    model: model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    duration_ms: durationMs,
    repair_count: repairCount
  };
  console.log('[LLM_TELEMETRY]', JSON.stringify(costRecord));
  return costRecord;
}

// Log unrecoverable failed model output to quarantine
function logQuarantine({ text, error, promptVersion, rawModelOutput, repairAttempts }) {
  const quarantineRecord = {
    timestamp: new Date().toISOString(),
    input: text,
    prompt_version: promptVersion,
    error: error.message || String(error),
    raw_model_output: rawModelOutput,
    repair_attempts: repairAttempts
  };
  fs.appendFileSync(QUARANTINE_FILE, JSON.stringify(quarantineRecord) + '\n', 'utf-8');
  console.warn('[QUARANTINE]', JSON.stringify(quarantineRecord));
}

/**
 * Execute chat completion with explicit exponential backoff + jitter retry policy.
 * Retries ONLY timeout, 429, 5xx. Does NOT retry 400, 401, 403.
 */
async function callModelWithRetry(client, requestPayload) {
  const maxRetries = 3;
  const backoffDelays = [1000, 2000, 4000];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const startTime = Date.now();
      const response = await client.chat.completions.create(requestPayload);
      const durationMs = Date.now() - startTime;
      return { response, durationMs };
    } catch (err) {
      const status = err.status || err.statusCode;
      const isTimeout = err.name === 'APIConnectionTimeoutError' || err.code === 'ETIMEDOUT' || err.message.includes('timeout');

      // Non-retryable client errors (400, 401, 403)
      if (status === 400 || status === 401 || status === 403) {
        console.error(`[LLM_CALL] Non-retryable HTTP ${status} error: ${err.message}`);
        const customErr = new Error(`LLM provider error (${status}): ${err.message}`);
        customErr.statusCode = status === 401 ? 500 : status; // Internal server configuration issue if 401
        throw customErr;
      }

      // Retryable conditions: timeout, 429, or 5xx
      const isRetryable = isTimeout || status === 429 || (status >= 500 && status <= 599);

      if (!isRetryable || attempt >= maxRetries) {
        if (isTimeout) {
          const timeoutErr = new Error('LLM request timed out after 30 seconds.');
          timeoutErr.statusCode = 504;
          throw timeoutErr;
        }
        throw err;
      }

      // Calculate backoff with jitter
      let delayMs = backoffDelays[attempt] || 4000;
      const jitter = Math.floor(Math.random() * 250);

      // Respect Retry-After header on 429 if present
      if (status === 429 && err.headers && err.headers['retry-after']) {
        const retryAfterSec = parseFloat(err.headers['retry-after']);
        if (!isNaN(retryAfterSec) && retryAfterSec > 0) {
          delayMs = retryAfterSec * 1000;
        }
      }

      console.warn(`[LLM_RETRY] Attempt ${attempt + 1} failed (${err.message}). Retrying in ${delayMs + jitter}ms...`);
      await sleep(delayMs + jitter);
    }
  }
}

/**
 * Main Triage orchestrator
 */
async function triageText(text) {
  // 1. Kill Switch Check (LLM_ENABLED=false)
  if (process.env.LLM_ENABLED === 'false') {
    return {
      category: 'other',
      urgency: 'normal',
      confidence: 0,
      reason: 'LLM processing is currently disabled.'
    };
  }

  // 2. Stub Mode Check (LLM_STUB=1)
  if (process.env.LLM_STUB === '1' || process.env.LLM_STUB === 'true' || !process.env.LLM_API_KEY || process.env.LLM_API_KEY === 'your_openrouter_key') {
    const { getStubResponse } = require('../routes/triage');
    return getStubResponse(text);
  }

  const promptVersion = 'triage-v1';
  const model = process.env.LLM_MODEL || 'openrouter/free';
  const systemPrompt = getSystemPrompt();
  const client = getLLMClient();

  const initialMessages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: JSON.stringify({ text }) }
  ];

  let rawOutput = '';
  let repairCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalDurationMs = 0;

  // 3. First Attempt
  try {
    const { response, durationMs } = await callModelWithRetry(client, {
      model,
      messages: initialMessages,
      temperature: 0.2
    });

    totalDurationMs += durationMs;
    totalInputTokens += response.usage?.prompt_tokens || 0;
    totalOutputTokens += response.usage?.completion_tokens || 0;

    rawOutput = response.choices[0]?.message?.content || '';
    const parsedResult = extractAndParseJSON(rawOutput);

    logCostMetrics({
      promptVersion,
      model,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      durationMs: totalDurationMs,
      repairCount: 0
    });

    return parsedResult;
  } catch (initialErr) {
    if (initialErr.statusCode && initialErr.statusCode !== 422) {
      throw initialErr;
    }

    console.warn(`[REPAIR_TRIGGERED] First response failed validation: ${initialErr.message}`);
    repairCount = 1;

    // 4. Exactly ONE Repair Attempt
    try {
      const repairMessages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify({ text }) },
        { role: 'assistant', content: rawOutput },
        {
          role: 'user',
          content: `Your previous answer was rejected for this reason:\n${initialErr.validationErrors || initialErr.message}\n\nReturn ONLY corrected JSON matching the required schema.\nNo explanation.\nNo markdown.\nNo additional fields.`
        }
      ];

      const { response: repairRes, durationMs: repairDuration } = await callModelWithRetry(client, {
        model,
        messages: repairMessages,
        temperature: 0.0
      });

      totalDurationMs += repairDuration;
      totalInputTokens += repairRes.usage?.prompt_tokens || 0;
      totalOutputTokens += repairRes.usage?.completion_tokens || 0;

      const repairRawOutput = repairRes.choices[0]?.message?.content || '';
      const repairedResult = extractAndParseJSON(repairRawOutput);

      logCostMetrics({
        promptVersion,
        model,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        durationMs: totalDurationMs,
        repairCount: 1
      });

      return repairedResult;
    } catch (repairErr) {
      // 5. Quarantine and return 422
      logQuarantine({
        text,
        error: repairErr,
        promptVersion,
        rawModelOutput: rawOutput,
        repairAttempts: 1
      });

      const failureErr = new Error('Model output failed schema validation and repair retry.');
      failureErr.statusCode = 422;
      throw failureErr;
    }
  }
}

module.exports = {
  triageText,
  getSystemPrompt,
  logCostMetrics,
  logQuarantine,
  QUARANTINE_FILE
};
