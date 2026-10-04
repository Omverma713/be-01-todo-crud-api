# The Polite Scraper (FlyRank Internship — Week 5 Assignment A9)

A resilient, polite web scraper built with Node.js, Cheerio, and Zod that extracts structured book data from Books to Scrape.

---

## 🎯 Target Classification

- **Target Site:** [Books to Scrape](https://books.toscrape.com/)
- **Why This Site Is Appropriate:** `books.toscrape.com` is an open sandbox website intentionally created and maintained for developers and students to practice web scraping techniques ethically without disrupting a commercial service.
- **Scope:** First 3 catalogue pages only (discovering exactly 60 unique book detail pages).
- **Data Collected:**
  - `title`: Book title string
  - `product_url`: Absolute URL to the product detail page
  - `price_text`: Raw price string (e.g., `£51.77`)
  - `price_gbp`: Normalized numeric price in GBP (e.g., `51.77`)
  - `availability_text`: Raw stock availability string
  - `rating_text`: Star rating text (e.g., `Three`)
  - `description`: Product description text (or `null` if absent)
  - `source_page`: The originating catalogue page URL
  - `fetched_at`: ISO 8601 timestamp of data retrieval
- **Why This Data Is Appropriate:** The collected data consists strictly of public, mock book listings designed for training and educational assessment. No personally identifiable information (PII), proprietary business data, or private user records are scraped.

---

## 🤖 Robots.txt & Ethics Check

- **Robots.txt Request:** Requested `https://books.toscrape.com/robots.txt`.
- **Result:** `no robots file found` (HTTP 404).
- **Ethical Rule:** A missing `robots.txt` is **not** interpreted as open permission. Politeness measures (honest User-Agent, request timeouts, minimum 500 ms delays between requests, and local HTML caching) are strictly applied.
- **Mandatory Commitment:**
  > "I will not reuse this code on another site without checking its rules and terms first."

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
    ├── books.json
    └── run-report.json
```
