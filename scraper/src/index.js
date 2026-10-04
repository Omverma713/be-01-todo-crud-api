/**
 * The Polite Scraper - Week 5 Assignment A9
 * Stage 5: Survive Failures and Report the Run
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { z } = require('zod');

const BASE_URL = 'https://books.toscrape.com/';
const CATALOGUE_PAGE_1 = 'https://books.toscrape.com/catalogue/page-1.html';
const USER_AGENT = 'FlyRankInternship-A9/1.0 (+https://github.com/Omverma713/be-01-todo-crud-api)';
const REQUEST_TIMEOUT_MS = 8000;
const MIN_DELAY_MS = 500;

// Resolve directories
const CACHE_DIR = path.resolve(__dirname, '../cache');
const OUTPUT_DIR = path.resolve(__dirname, '../output');

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

let lastRequestTime = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function politeDelay() {
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < MIN_DELAY_MS) {
    await sleep(MIN_DELAY_MS - timeSinceLast);
  }
  lastRequestTime = Date.now();
}

/**
 * Fetches a URL with local file caching, timeout, status check, retry on 5xx/timeout, and politeness delay.
 */
async function fetchWithCache(url, cacheFileName, stats = null, silent = true) {
  const cachePath = path.join(CACHE_DIR, cacheFileName);

  if (fs.existsSync(cachePath)) {
    const html = fs.readFileSync(cachePath, 'utf-8');
    const size = Buffer.byteLength(html, 'utf-8');
    if (stats) stats.cacheHits++;
    if (!silent) {
      console.log(`CACHE HIT - File: ${cacheFileName} | Response size: ${size} bytes`);
    }
    return { html, fromCache: true, size };
  }

  // Attempt fetch with retry logic (retry once for timeout or HTTP 5xx; do NOT retry 404 or 403)
  const maxAttempts = 2;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await politeDelay();
      if (!silent) {
        console.log(`FETCH (Attempt ${attempt}/${maxAttempts}) - URL: ${url}`);
      }

      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });

      if (response.status === 404 || response.status === 403) {
        throw new Error(`HTTP ${response.status} ${response.statusText} (Non-retryable)`);
      }

      if (response.status >= 500) {
        throw new Error(`HTTP ${response.status} Server Error (Retryable)`);
      }

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status} Unexpected Status`);
      }

      const html = await response.text();
      const size = Buffer.byteLength(html, 'utf-8');

      fs.writeFileSync(cachePath, html, 'utf-8');
      if (stats) stats.pagesFetched++;
      if (!silent) {
        console.log(`FETCH SUCCESS - Saved to: ${cacheFileName} | Response size: ${size} bytes`);
      }

      return { html, fromCache: false, size };
    } catch (err) {
      lastError = err;
      const isRetryable = !err.message.includes('404') && !err.message.includes('403');
      if (attempt < maxAttempts && isRetryable) {
        if (!silent) {
          console.warn(`[RETRY] Fetch failed for ${url} (${err.message}). Retrying once...`);
        }
        await sleep(1000);
      } else {
        break;
      }
    }
  }

  throw lastError;
}

/**
 * Extracts book detail page URLs and the next catalogue link from a catalogue page HTML.
 */
function parseCataloguePage(html, pageUrl) {
  const $ = cheerio.load(html);
  const bookEntries = [];

  $('article.product_pod h3 a').each((_, el) => {
    const relativeHref = $(el).attr('href');
    if (relativeHref) {
      const absoluteUrl = new URL(relativeHref, pageUrl).href;
      bookEntries.push({
        url: absoluteUrl,
        sourcePage: pageUrl
      });
    }
  });

  const nextRel = $('li.next a').attr('href');
  const nextUrl = nextRel ? new URL(nextRel, pageUrl).href : null;

  return { bookEntries, nextUrl };
}

/**
 * Discovers catalogue pages up to maxPages and collects all book URLs with provenance.
 */
async function discoverCataloguePages(startUrl = CATALOGUE_PAGE_1, maxPages = 3, stats = null) {
  let currentUrl = startUrl;
  let pageIndex = 1;
  const discoveredBookEntries = [];

  while (currentUrl && pageIndex <= maxPages) {
    const cacheFileName = `catalogue-page-${pageIndex}.html`;
    const { html } = await fetchWithCache(currentUrl, cacheFileName, stats, false);
    const { bookEntries, nextUrl } = parseCataloguePage(html, currentUrl);

    discoveredBookEntries.push(...bookEntries);
    currentUrl = nextUrl;
    pageIndex++;
  }

  const cataloguePagesCount = pageIndex - 1;
  const discoveredCount = discoveredBookEntries.length;

  // Deduplicate by URL
  const uniqueEntriesMap = new Map();
  for (const entry of discoveredBookEntries) {
    if (!uniqueEntriesMap.has(entry.url)) {
      uniqueEntriesMap.set(entry.url, entry);
    }
  }
  const uniqueEntries = Array.from(uniqueEntriesMap.values());
  const uniqueCount = uniqueEntries.length;

  console.log(`catalogue_pages=${cataloguePagesCount}`);
  console.log(`discovered=${discoveredCount}`);
  console.log(`unique_urls=${uniqueCount}`);

  return {
    cataloguePagesCount,
    discoveredCount,
    uniqueCount,
    uniqueEntries
  };
}

/**
 * Derives a cache filename from a product detail URL.
 */
function getBookCacheFileName(productUrl) {
  const parsed = new URL(productUrl);
  const match = parsed.pathname.match(/\/catalogue\/([^/]+)\/index\.html/);
  if (match) {
    return `book-${match[1]}.html`;
  }
  const sanitized = parsed.pathname.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `book-${sanitized}.html`;
}

/**
 * Normalizes price text to numeric GBP value.
 */
function normalizePrice(priceText) {
  if (!priceText) return 0;
  const numericString = priceText.replace(/[^0-9.]/g, '');
  const val = parseFloat(numericString);
  return isNaN(val) ? 0 : Number(val.toFixed(2));
}

/**
 * Zod validation schema for book records.
 */
const BookSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty'),
  product_url: z.string().url('Product URL must be a valid URL'),
  price_text: z.string().min(1, 'Price text cannot be empty'),
  price_gbp: z.number().positive('Price in GBP must be a positive number'),
  availability_text: z.string().min(1, 'Availability text cannot be empty'),
  rating_text: z.string().min(1, 'Rating text cannot be empty'),
  description: z.string().nullable().optional(),
  source_page: z.string().url('Source page must be a valid URL'),
  fetched_at: z.string().min(1, 'Fetched at timestamp is required')
});

/**
 * Extracts raw book details from a book detail page HTML.
 */
function parseBookDetailPage(html, productUrl, sourcePage) {
  const $ = cheerio.load(html);

  // 1. Title
  const title = $('div.product_main h1').text().trim() || $('article.product_page h1').text().trim();

  // 2. Raw price text & Normalized numeric price
  const price_text = $('div.product_main p.price_color').text().trim();
  const price_gbp = normalizePrice(price_text);

  // 3. Availability text
  const rawAvailability = $('div.product_main p.instock.availability').text();
  const availability_text = rawAvailability.replace(/\s+/g, ' ').trim();

  // 4. Rating text
  const ratingClass = $('div.product_main p.star-rating').attr('class') || '';
  const rating_text = ratingClass.replace('star-rating', '').trim();

  // 5. Description (optional, null if missing)
  const descEl = $('#product_description + p');
  let description = null;
  if (descEl.length > 0) {
    const text = descEl.text().trim();
    if (text.length > 0) {
      description = text;
    }
  }

  // 6. Provenance
  const fetched_at = new Date().toISOString();

  return {
    title,
    product_url: productUrl,
    price_text,
    price_gbp,
    availability_text,
    rating_text,
    description,
    source_page: sourcePage,
    fetched_at
  };
}

/**
 * Scrapes, normalizes, validates, survives page failures, and generates run-report.json.
 */
async function runScraper(options = {}) {
  const startTime = new Date();
  const stats = {
    start_time: startTime.toISOString(),
    pagesFetched: 0,
    cacheHits: 0,
    validRecords: 0,
    invalidRecords: 0,
    failedPages: 0
  };

  const { uniqueEntries } = await discoverCataloguePages(CATALOGUE_PAGE_1, 3, stats);

  // If extra fake URLs are supplied for resilience testing
  const entriesToProcess = [...uniqueEntries];
  if (options.fakeUrls && Array.isArray(options.fakeUrls)) {
    for (const fakeUrl of options.fakeUrls) {
      entriesToProcess.push({
        url: fakeUrl,
        sourcePage: CATALOGUE_PAGE_1
      });
    }
  }

  const validBooksMap = new Map();
  const invalidRecords = [];
  const failedPageErrors = [];

  for (let i = 0; i < entriesToProcess.length; i++) {
    const entry = entriesToProcess[i];
    try {
      const cacheFileName = getBookCacheFileName(entry.url);
      const { html } = await fetchWithCache(entry.url, cacheFileName, stats, true);
      const rawRecord = parseBookDetailPage(html, entry.url, entry.sourcePage);

      const parseResult = BookSchema.safeParse(rawRecord);
      if (parseResult.success) {
        validBooksMap.set(parseResult.data.product_url, parseResult.data);
      } else {
        invalidRecords.push({
          record: rawRecord,
          errors: parseResult.error.format()
        });
      }
    } catch (err) {
      console.warn(`[SKIP] Page failed: ${entry.url} - Reason: ${err.message}`);
      stats.failedPages++;
      failedPageErrors.push({
        url: entry.url,
        error: err.message
      });
    }
  }

  const validBooks = Array.from(validBooksMap.values());
  stats.validRecords = validBooks.length;
  stats.invalidRecords = invalidRecords.length;

  const endTime = new Date();
  const durationSeconds = Number(((endTime.getTime() - startTime.getTime()) / 1000).toFixed(2));

  // Build final run report
  const runReport = {
    start_time: stats.start_time,
    end_time: endTime.toISOString(),
    duration_seconds: durationSeconds,
    pages_fetched: stats.pagesFetched,
    cache_hits: stats.cacheHits,
    valid_records: stats.validRecords,
    invalid_records: stats.invalidRecords,
    failed_pages: stats.failedPages
  };

  // Save files to output/
  const booksPath = path.join(OUTPUT_DIR, 'books.json');
  const errorsPath = path.join(OUTPUT_DIR, 'errors.json');
  const reportPath = path.join(OUTPUT_DIR, 'run-report.json');

  fs.writeFileSync(booksPath, JSON.stringify(validBooks, null, 2), 'utf-8');
  fs.writeFileSync(errorsPath, JSON.stringify(invalidRecords, null, 2), 'utf-8');
  fs.writeFileSync(reportPath, JSON.stringify(runReport, null, 2), 'utf-8');

  console.log(`detail_pages=${entriesToProcess.length - stats.failedPages}`);
  console.log(`valid_records=${stats.validRecords}`);
  console.log(`invalid_records=${stats.invalidRecords}`);
  console.log(`failed_pages=${stats.failedPages}`);
  console.log('Run report:');
  console.log(JSON.stringify(runReport, null, 2));

  return {
    validBooks,
    invalidRecords,
    runReport,
    failedPageErrors
  };
}

async function runStage5() {
  console.log('=== Running Stage 5: Survive Failures and Report the Run ===');
  return await runScraper();
}

if (require.main === module) {
  runStage5().catch((err) => {
    console.error('Stage 5 Error:', err.message);
    process.exit(1);
  });
}

module.exports = {
  BASE_URL,
  CATALOGUE_PAGE_1,
  USER_AGENT,
  CACHE_DIR,
  OUTPUT_DIR,
  BookSchema,
  normalizePrice,
  fetchWithCache,
  parseCataloguePage,
  discoverCataloguePages,
  getBookCacheFileName,
  parseBookDetailPage,
  runScraper,
  runStage5
};
