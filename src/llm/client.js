/**
 * Week 7 Assignment A17 - LLM Client
 * Initializes OpenAI SDK configured for OpenRouter.
 */

const OpenAI = require('openai');

function getLLMClient() {
  const baseURL = process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1';
  const apiKey = process.env.LLM_API_KEY || 'stub-key';

  return new OpenAI({
    baseURL,
    apiKey,
    timeout: 30000, // 30 seconds explicit timeout (Stage 4)
    maxRetries: 0 // Disable SDK internal silent retries in favor of our explicit retry policy (Stage 4)
  });
}

module.exports = {
  getLLMClient
};
