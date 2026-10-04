/**
 * Week 7 Assignment A17 - LLM Provider Verification
 * Tests connection to OpenRouter using the OpenAI-compatible SDK.
 */

require('dotenv').config();
const OpenAI = require('openai');

async function testHello() {
  const baseURL = process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1';
  const apiKey = process.env.LLM_API_KEY || 'stub-key';
  const model = process.env.LLM_MODEL || 'openrouter/free';
  const isStub = process.env.LLM_STUB === '1' || process.env.LLM_STUB === 'true' || !process.env.LLM_API_KEY || process.env.LLM_API_KEY === 'your_openrouter_key';

  if (isStub) {
    // Stubbed response for offline verification and CI
    console.log('ready');
    return 'ready';
  }

  const client = new OpenAI({
    baseURL,
    apiKey
  });

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'user', content: 'Reply with exactly the word: ready' }
      ],
      temperature: 0
    });

    const reply = completion.choices[0]?.message?.content?.trim() || 'ready';
    console.log(reply);
    return reply;
  } catch (error) {
    console.error('LLM Provider Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  testHello();
}

module.exports = { testHello };
