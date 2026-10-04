/**
 * Week 7 Assignment A17 - Cost & Performance Telemetry
 * Structured logging for prompt tokens, completion tokens, latency, and repairs.
 */

function createTelemetryRecord({ promptVersion, model, inputTokens, outputTokens, durationMs, repairCount }) {
  return {
    timestamp: new Date().toISOString(),
    prompt_version: promptVersion,
    model: model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    duration_ms: durationMs,
    repair_count: repairCount
  };
}

module.exports = {
  createTelemetryRecord
};
