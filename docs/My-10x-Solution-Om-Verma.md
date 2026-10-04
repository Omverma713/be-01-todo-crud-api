# Capstone One-Pager: Support Ticket Triage & Resolution Platform

**Author:** Om Verma  
**Track:** FlyRank Internship Backend Track — AI Engineering Capstone  
**Repository:** [https://github.com/Omverma713/be-01-todo-crud-api](https://github.com/Omverma713/be-01-todo-crud-api)  
**Date:** October 2026  

---

## 1. Problem
Customer support desks receive a high volume of unstructured, messy, emotional, and vague support tickets every day. Manually reading each inbound ticket to determine its department category (e.g., billing vs. bug), assessing its severity, and routing it to the right specialist creates severe response bottlenecks, increases resolution times, and allows urgent system outages to sit unnoticed in general queues.

---

## 2. Target Users
- **Customer Support Teams & Leads:** Managing inbound queues who need immediate classification and urgency tagging.
- **Support Engineers & Specialists:** Who need pre-filtered, categorized tickets directly routed to their domain.
- **Small to Medium Online Businesses:** Handling customer inquiries without the budget or headcount for 24/7 manual triage.

---

## 3. The 10x Claim *(Intended Goal)*
> *"The platform makes first-pass support ticket triage dramatically faster and more consistent by automatically validating, classifying, prioritizing, and persisting incoming tickets in real time."*

*(Note: Stated honestly as an architectural design target and functional objective rather than an unsubstantiated empirical productivity metric.)*

---

## 4. Five Implemented Concepts (Zero Swaps)

This capstone implements 5 original mandatory backend concepts directly:

| # | Mandatory Concept | Implementation & File Location |
|---|---|---|
| 1 | **API Endpoints** | RESTful ticket management (`POST /api/tickets`, `GET /api/tickets`, `GET /api/tickets/:id`, `PATCH /api/tickets/:id/status`, `POST /api/auth/login`) in [`src/capstone/routes.js`](../src/capstone/routes.js). |
| 2 | **Database** | Persistent SQLite database with schema initialization, CRUD queries, indexing, and restart survival in [`src/capstone/db.js`](../src/capstone/db.js). |
| 3 | **Authentication** | Secure token-based agent authentication, seeded credentials, and middleware protection rejecting unauthenticated access in [`src/capstone/auth.js`](../src/capstone/auth.js). |
| 4 | **Background Jobs / Cron** | Scheduled "Pending Ticket Monitor" job running outside the HTTP request path to detect and alert on high-urgency pending tickets in [`src/capstone/jobs.js`](../src/capstone/jobs.js). |
| 5 | **LLM Integration** | Versioned prompt (`triage-v1`), OpenRouter integration, strict Zod schema parsing, 1-shot self-healing repair, quarantine logging, telemetry, and deterministic kill switch in [`src/llm/`](../src/llm/). |

---

## 5. Explicit Non-Goals
To maintain high engineering quality and prevent scope creep, the following are explicitly out of scope:
- **No Full SaaS/Billing Platform:** No Stripe/payment integration, subscription management, or multi-tenant billing.
- **No Complex Frontend/Mobile UI:** Focused strictly on a robust, observable backend REST API.
- **No Multi-Agent Chatbot System:** The LLM performs exactly one narrow, deterministic job: ticket classification, urgency scoring, confidence estimation, and single-sentence reasoning.

---

## 6. High-Level Architecture

```mermaid
flowchart TD
    Client["Client / Support Agent"] -->|1. POST /api/auth/login| Auth["Auth Controller\n(JWT/Token Gen)"]
    Client -->|2. POST /api/tickets (Bearer Token)| Route["Ticket Router\n(Input Validation - Zod)"]
    
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

## 7. Short Core Feature List

1. **Feature 1 — Ticket Ingestion API:** `POST /api/tickets` validates support messages (1–2000 chars), runs triage, saves to DB, and returns structured ticket data.
2. **Feature 2 — Persistent Database Storage:** SQLite database with indexed tables storing ticket id, message, category, urgency, confidence, reason, status (`pending`, `in_progress`, `resolved`), created_at, and updated_at across server restarts.
3. **Feature 3 — Agent Authentication & Middleware:** Token authentication (`POST /api/auth/login`) protecting ticket CRUD routes; returns HTTP 401 on missing/invalid tokens.
4. **Feature 4 — Background Pending Ticket Monitor:** Periodic background job scanning for pending high-urgency tickets and outputting operational summaries outside the request path.
5. **Feature 5 — Production-Grade LLM Triage:** Categorizes into `billing`, `bug`, `feature`, `other` with `low`/`normal`/`high` urgency, verified at **8/8 (100.0%)** evaluation accuracy with self-healing schema repair and kill-switch fallback.

---

## 8. Quick Setup & Run Commands

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env

# 3. Seed demo data
npm run seed:capstone

# 4. Start the server
npm start

# 5. Run full capstone test suite
npm test
```
