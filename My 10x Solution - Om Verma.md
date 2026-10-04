# Capstone Overview: Support Ticket Triage & Resolution Platform

**Author:** Om Verma  
**Track:** FlyRank Internship Backend Track — AI Engineering Capstone  
**Repository:** [https://github.com/Omverma713/be-01-todo-crud-api](https://github.com/Omverma713/be-01-todo-crud-api)  
**Date:** October 2026  

---

## 1. What Problem Are You Solving?
Customer support teams are constantly inundated with unstructured, chaotic support messages ranging from high-severity application crashes to routine billing questions and vague greetings. Manually reviewing and sorting these requests creates substantial latency, leads to inconsistent urgency tagging, and risks critical outages languishing in triage queues while agents answer routine inquiries.

This platform solves this by providing a reliable, schema-validated backend service that automatically ingests support messages, determines the exact department category (`billing`, `bug`, `feature`, `other`), calculates urgency and calibrated confidence, persists the ticket with status tracking in a persistent database, and monitors unresolved tickets via an autonomous background job.

---

## 2. Target Users
1. **Support Desk Teams & Managers:** Requiring immediate automated routing and prioritization of inbound tickets.
2. **Support Engineers & Specialists:** Who need categorized ticket feeds and actionable triage summaries.
3. **Small & Medium Online Businesses:** Needing 24/7 automated first-pass triage without dedicated round-the-clock triage staff.

---

## 3. The 10x Claim *(Intended Goal)*
> *"The platform makes first-pass support ticket triage dramatically faster and more consistent by automatically validating, classifying, prioritizing, and storing incoming tickets in real time."*

*(Honesty note: This is an architectural goal and design target to standardize triage and eliminate manual sorting latency, not an exaggerated marketing metric.)*

---

## 4. How Did You Implement the Solution?

### Implemented Mandatory Concepts (5 Original Concepts, 0 Swaps)

| # | Concept | Where It Lives | Technical Highlights |
|---|---|---|---|
| 1 | **API Endpoints** | [`src/capstone/routes.js`](src/capstone/routes.js) | `POST /api/tickets`, `GET /api/tickets`, `GET /api/tickets/:id`, `PATCH /api/tickets/:id/status`, `POST /api/auth/login`. |
| 2 | **Database** | [`src/capstone/db.js`](src/capstone/db.js) | SQLite database (`data/capstone.db`) with tables `tickets` and `users`, indexed lookups, and guaranteed persistence across server restarts. |
| 3 | **Authentication** | [`src/capstone/auth.js`](src/capstone/auth.js) | Secure token-based authentication with seeded support agent credentials (`agent@support.com` / `Password123!`), protected ticket endpoints, and HTTP 401 rejection for unauthenticated requests. |
| 4 | **Background Jobs** | [`src/capstone/jobs.js`](src/capstone/jobs.js) | Periodic "Pending Ticket Monitor" job running outside the request path on a scheduled interval (every 60s) to aggregate unresolved/high-urgency tickets. |
| 5 | **LLM Integration** | [`src/llm/`](src/llm/) | Versioned prompt (`prompts/triage-v1.md`), OpenRouter client, Zod schema validation, 1-shot self-healing repair, quarantine logging, 30s timeout, exponential backoff with jitter, telemetry cost logging, offline stub mode, and instant kill switch. |

---

## 5. Explicit Non-Goals
- **No Full SaaS / Billing:** No payment gateways (Stripe/PayPal), subscriptions, or tenant billing.
- **No Complex Frontend UI:** Focuses purely on building a clean, reliable, and observable REST API.
- **No Uncontrolled Multi-Agent Loops:** The LLM is restricted to one narrow, deterministic task: ticket classification, urgency rating, confidence calculation, and single-sentence justification.

---

## 6. High-Level Architecture Diagram

```mermaid
flowchart TD
    Client["Client / Support Agent"] -->|1. POST /api/auth/login| Auth["Auth Controller\n(Token Generation)"]
    Client -->|2. POST /api/tickets (Bearer Token)| Route["Ticket Router\n(Zod Input Validation)"]
    
    Route -->|3. Validated Payload| LLM["LLM Triage Engine\n(OpenRouter / triage-v1)"]
    LLM -->|4. Structured JSON Result\n(Repair / Quarantine)| Route
    
    Route -->|5. Insert Ticket Record| DB[("Persistent SQLite DB\n(data/capstone.db)")]
    Route -->|6. HTTP 201 Created| Client
    
    subgraph Background Process
        Cron["Cron Scheduler\n(Every 60s)"] -->|Scan Unresolved & High Urgency| DB
        Cron -->|Log Alert / Summary| Log["Telemetry / Alert Log"]
    end
```

---

## 7. Short Feature List

1. **Feature 1 — Ticket Ingestion API:** Synchronous `POST /api/tickets` validating input length (1–2000 chars), running triage, and storing tickets.
2. **Feature 2 — Persistent Database Storage:** Complete CRUD capabilities with indexed queries and restart survival in `data/capstone.db`.
3. **Feature 3 — Agent Authentication & Middleware:** Role-protected routes requiring valid Bearer tokens; returns `401 Unauthorized` when token is omitted or invalid.
4. **Feature 4 — Background Pending Ticket Monitor:** Autonomous scheduled task running outside the request loop to track SLA compliance on urgent tickets.
5. **Feature 5 — Production-Grade LLM Triage:** Categorizes into `billing`, `bug`, `feature`, `other` with `low`/`normal`/`high` urgency, backed by an empirical **8/8 (100.0%)** evaluation score.

---

## 8. Empirical Results (Evaluation & Performance)

- **Benchmark Accuracy:** **8/8 = 100.0%** passing cases on the benchmark evaluation set (`evals/cases.json`).
- **Prompt Version:** `triage-v1`
- **Cost Efficiency:** ~$0.15–$0.35 per 10,000 requests on low-cost models ($0.00 on `openrouter/free`).
- **Reliability:** 100% test pass rate across all 12 core unit and integration tests.

---

## 9. Quick Setup & Run Instructions

```bash
# 1. Clone & Install
npm install

# 2. Configure Environment
cp .env.example .env

# 3. Seed Demo Data
npm run seed:capstone

# 4. Start the Application
npm start

# 5. Run Automated Tests
npm test
```
