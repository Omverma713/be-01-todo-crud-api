# The Polite Scraper (FlyRank Internship — Week 5 Assignment A9)

A polite, resilient web scraper built with **Node.js (v20+)**, **Cheerio**, and **Zod** that extracts and validates structured book data from Books to Scrape across the first 3 catalogue pages.

---

## 🎯 Target Classification & Scope

- **Target Site:** [Books to Scrape](https://books.toscrape.com/)
- **Why This Site Is Appropriate:** `books.toscrape.com` is an open sandbox website intentionally created and maintained for developers and students to practice web scraping techniques ethically without disrupting a commercial service.
- **Scope:** First 3 catalogue pages only, discovering and extracting exactly 60 unique book detail pages.
- **Data Collected:**
  - `title`: Book title string
  - `product_url`: Canonical absolute URL
  - `price_text`: Raw price string (e.g., `£51.77`)
  - `price_gbp`: Normalized numeric price in GBP (e.g., `51.77`)
  - `availability_text`: Raw stock availability string
  - `rating_text`: Star rating text (e.g., `Three`)
  - `description`: Product description text (or `null` if missing)
  - `source_page`: The originating catalogue page URL
  - `fetched_at`: ISO 8601 timestamp of data retrieval
- **Why This Data Is Appropriate:** The collected data consists strictly of public, mock book listings designed for training and educational assessment. No personally identifiable information (PII), proprietary business data, or private user records are scraped.

---

## 🤖 Robots.txt & Ethical Commitment

- **Robots.txt Request:** Requested `https://books.toscrape.com/robots.txt`.
- **Result:** `no robots file found` (HTTP 404).
- **Ethical Rule:** A missing `robots.txt` is **not** interpreted as open permission. Politeness measures (honest User-Agent, request timeouts, minimum 500 ms delays between requests, and local HTML caching) are strictly applied.
- **Mandatory Commitment:**
  > "I will not reuse this code on another site without checking its rules and terms first."

---

## 📜 Ethics Note

1. **Prefer Official APIs:** Always check for and utilize an official public API before attempting to scrape a website.
2. **Respect Boundaries:** Never bypass login walls, paywalls, CAPTCHAs, IP bans, or terms of service restrictions.
3. **Data Minimization:** Collect only the specific fields necessary for the assignment/application and never store unnecessary private user data.

---

## 🚀 Quick Start & Run Command

### 1. Installation
```bash
npm install
```

### 2. Single Run Command
```bash
npm run scrape
```
*(Alternatively: `node scraper/src/index.js`)*

---

## 🛠️ Tech Stack & Lane

- **Runtime:** Node.js 20+ (using native `fetch`)
- **HTML Parser:** Cheerio 1.x
- **Schema Validation:** Zod 3.x
- **Storage & Provenance:** Built-in FileSystem (`fs`, `path`) producing clean JSON outputs

---

## 🤝 Politeness & Resilience Rules

1. **Honest User-Agent:**
   `FlyRankInternship-A9/1.0 (+https://github.com/Omverma713/be-01-todo-crud-api)`
2. **Request Timeout:** Set to 8000 ms using `AbortSignal.timeout` to prevent hanging sockets.
3. **Polite Rate Limiting:** Enforces a minimum **500 ms delay** between any real network requests.
4. **Local Caching:** All fetched catalogue and detail pages are stored in `scraper/cache/` during development. Subsequent runs execute with zero outbound network traffic (`CACHE HIT`).
5. **Fault Tolerance & Retry Strategy:**
   - Retries **once** with backoff for network timeouts and HTTP 5xx server errors.
   - Does **not** retry HTTP 404 Not Found or HTTP 403 Forbidden.
   - Individual page failures are logged and skipped without crashing the run, preserving valid records.

---

## 💡 Why No Browser Was Needed

**Why the assignment needed no browser:**
The target website renders its entire catalogue and product data directly in the initial HTML response sent by the server. Because there is no client-side single-page application (SPA) hydration or dynamic JavaScript execution required, running a headless browser (such as Puppeteer or Playwright) would only add unnecessary CPU, memory, and runtime cost without any functional benefit. Fast, lightweight HTTP requests paired with Cheerio DOM parsing provide the most efficient and polite solution.

---

## ⚠️ Honest Limitation

- **Static Content Only:** This scraper is designed specifically for server-rendered HTML. It cannot scrape websites that rely on client-side JavaScript execution, user interactions, or infinite scrolling without an accompanying API or browser automation engine.

---

## 📊 Record Schema (Zod)

```typescript
const BookSchema = z.object({
  title: z.string().min(1),
  product_url: z.string().url(),
  price_text: z.string().min(1),
  price_gbp: z.number().positive(),
  availability_text: z.string().min(1),
  rating_text: z.string().min(1),
  description: z.string().nullable().optional(),
  source_page: z.string().url(),
  fetched_at: z.string().min(1)
});
```

---

## 📈 Sample Run Report (`output/run-report.json`)

```json
{
  "start_time": "2026-10-04T05:36:35.690Z",
  "end_time": "2026-10-04T05:36:35.921Z",
  "duration_seconds": 0.23,
  "pages_fetched": 0,
  "cache_hits": 63,
  "valid_records": 60,
  "invalid_records": 0,
  "failed_pages": 0
}
```

---

## 📂 Project Structure

```text
scraper/
├── README.md
├── .gitignore
├── src/
│   └── index.js
├── cache/            (Ignored from Git)
└── output/
    ├── books.json    (60 validated book records)
    ├── errors.json   (Empty on clean run)
    └── run-report.json
```
