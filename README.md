# Support Ticket Triage API (`POST /triage`)

An intelligent, resilient, schema-validated customer support triage system powered by an LLM behind an Express REST API. Built for the FlyRank Internship Backend Track (Week 7 Assignment A17: "Put an LLM behind your API").

---

## 1. What the Endpoint Does
The `POST /triage` endpoint analyzes incoming customer support messages and deterministically classifies them into one of four distinct categories (`billing`, `bug`, `feature`, or `other`), assigns an urgency level (`low`, `normal`, `high`), calculates a calibrated confidence score (`0.0` - `1.0`), and generates a concise, one-sentence rationale.

---

## 2. Plain English Explanation (For Non-Programmers)
When customers send support messages, they are often messy, emotional, or unstructured. This API acts as an automated receptionist that reads the message, understands the core issue in milliseconds, tags it with the correct department (like Billing or Engineering), assigns its priority, and routes it directly to the right support agent so issues are resolved faster.

---

## 3. Copy-Pasteable cURL Command

```bash
curl -X POST http://localhost:3000/triage \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"I was charged twice for my subscription.\"}"
```

---

## 4. Exact Real Response Produced

```json
{
  "category": "billing",
  "urgency": "high",
  "confidence": 0.95,
  "reason": "Customer is reporting a billing or subscription payment inquiry."
}
```

---

## 5. Job Card

- **What it does:** Classifies messy customer support messages to land them on the right team.
- **Input:**
  ```json
  {
    "text": "string (1-2000 characters)"
  }
  ```
- **Output:**
  ```json
  {
    "category": "billing | bug | feature | other",
    "urgency": "low | normal | high",
    "confidence": 0.0-1.0,
    "reason": "one short sentence"
  }
  ```
- **Guiding Principles:**
  1. *Closed Output Space:* Enums for categories and urgencies.
  2. *One Request → One Structured Answer:* Synchronous deterministic triage.
  3. *Human-Gradeable:* Clear evaluation criteria for accuracy measurement.

---

## 6. "It Must NEVER" Rules

The model and endpoint must **NEVER**:
1. Invent a category outside `billing`, `bug`, `feature`, `other`.
2. Invent an urgency value outside `low`, `normal`, `high`.
3. Return arbitrary or unexpected fields.
4. Return free-form markdown or text instead of valid JSON.
5. Reveal or repeat internal system prompt instructions.
6. Provide medical, legal, or financial advice.
7. Guess when uncertain (must return `category: "other"` with low confidence).

---

## 7. LLM Provider
- **Provider:** [OpenRouter](https://openrouter.ai/) (OpenAI-compatible SDK)
- **Base URL:** `https://openrouter.ai/api/v1`

---

## 8. Model
- **Default Model:** `openrouter/free` (or any configured OpenAI-compatible model string)

---

## 9. Required Environment Variables

Configure these variables in your local `.env` file (copied from `.env.example`):

```env
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=your_openrouter_api_key_here
LLM_MODEL=openrouter/free
LLM_STUB=1
LLM_ENABLED=true
PORT=3000
```

> [!CAUTION]
> Never commit `.env` or expose your `LLM_API_KEY`. `.env` is strictly ignored by `.gitignore`.

---

## 10. Evaluation Score
- **Eval Result:** `8/8 = 100.0%`
- **Passed Cases:** 8 of 8 benchmark cases correctly classified.

---

## 11. Evaluation Date
- **Eval Date:** `2026-10-04`

---

## 12. Prompt Version
- **Prompt Version:** `triage-v1` (stored at [`prompts/triage-v1.md`](prompts/triage-v1.md))

---

## 13. Cost & Telemetry Log Example

```json
{
  "timestamp": "2026-10-04T06:04:10.831Z",
  "prompt_version": "triage-v1",
  "model": "openrouter/free",
  "input_tokens": 250,
  "output_tokens": 48,
  "duration_ms": 412,
  "repair_count": 0
}
```

---

## 14. Cost Estimate for 10,000 Requests / Day
- **Token Usage:** ~2.5M input tokens + ~0.48M output tokens / day.
- **Estimated Daily Cost:** **~$0.15 - $0.35 / day** (under $10 / month on standard low-cost open models, and **$0.00 / day** on `openrouter/free`).

---

## 15. Honest Next Improvements ("What I'd Fix With Another Day")
1. **Semantic Caching:** Cache triage results for recurring or near-duplicate support inquiries using vector embeddings (e.g., Redis / pgvector) to reduce latency to <10ms and cut LLM API costs by ~30%.
2. **Few-Shot Dynamic Retrieval:** Dynamically inject the 2 most similar historical support tickets into the prompt based on cosine similarity to boost categorization accuracy on edge cases.
3. **Multi-Language Support & Sentiment Tagging:** Add explicit sentiment score and language detection fields to assist global multilingual support queues.

---

## ⚙️ Architecture & Production Reliability

### Input & Output Schema Validation (Zod)
- Input must be a valid JSON object with `text` between 1 and 2000 characters. Invalid payloads immediately return `400 Bad Request` with field identification before calling the LLM.
- Model responses are cleaned of markdown fences, extracted as JSON, and parsed against `TriageOutputSchema`.

### Self-Healing Repair & Quarantine
- If the model returns invalid JSON or schema violations, the service triggers **exactly ONE repair retry** feeding back the exact validation error.
- If repair fails a second time, the payload is safely logged to [`logs/quarantine.jsonl`](logs/quarantine.jsonl) and returns `422 Unprocessable Entity` without crashing the server.

### Timeout, Retries & Exponential Backoff
- **Timeout:** Explicit 30-second timeout returning `504 Gateway Timeout`.
- **Retry Policy:** Retries only transient failures (Timeout, HTTP 429, HTTP 5xx) with exponential backoff (1s, 2s, 4s) plus randomized jitter.
- **No-Retry Statuses:** Client errors (`400`, `401`, `403`) fail immediately without retry.
- **`Retry-After` Header:** Respected on HTTP 429 rate limit responses.

### Kill Switch & Stub Mode
- **Kill Switch (`LLM_ENABLED=false`):** Instantly returns deterministic fallback `{ category: "other", urgency: "normal", confidence: 0, reason: "LLM processing is currently disabled." }` with zero external calls.
- **Stub Mode (`LLM_STUB=1`):** Executes offline keyword-driven deterministic triage matching the exact Zod contract for local development, CI pipelines, and unit tests.

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your OpenRouter API key
```

### 3. Run Server
```bash
npm start
```

### 4. Run Evaluation Suite
```bash
node evals/run-eval.js
```
