/**
 * The Polite Scraper - Week 5 Assignment A9
 * Stage 3: Extract Raw Book Details
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const BASE_URL = 'https://books.toscrape.com/';
const CATALOGUE_PAGE_1 = 'https://books.toscrape.com/catalogue/page-1.html';
const USER_AGENT = 'FlyRankInternship-A9/1.0 (+https://github.com/Omverma713/be-01-todo-crud-api)';
const REQUEST_TIMEOUT_MS = 8000;
const MIN_DELAY_MS = 500;

// Resolve cache directory
const CACHE_DIR = path.resolve(__dirname, '../cache');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
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
 * Fetches a URL with local file caching, timeout, status check, and politeness delay.
 */
async function fetchWithCache(url, cacheFileName, silent = false) {
  const cachePath = path.join(CACHE_DIR, cacheFileName);

  if (fs.existsSync(cachePath)) {
    const html = fs.readFileSync(cachePath, 'utf-8');
    const size = Buffer.byteLength(html, 'utf-8');
    if (!silent) {
      console.log(`CACHE HIT - File: ${cacheFileName} | Response size: ${size} bytes`);
    }
    return { html, fromCache: true, size };
  }

  // Polite delay before real network request
  await politeDelay();

  if (!silent) {
    console.log(`FETCH - URL: ${url}`);
  }
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  if (response.status !== 200) {
    throw new Error(`HTTP request failed with status ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  const size = Buffer.byteLength(html, 'utf-8');

  fs.writeFileSync(cachePath, html, 'utf-8');
  if (!silent) {
    console.log(`FETCH SUCCESS - Saved to: ${cacheFileName} | Response size: ${size} bytes`);
  }

  return { html, fromCache: false, size };
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
async function discoverCataloguePages(startUrl = CATALOGUE_PAGE_1, maxPages = 3) {
  let currentUrl = startUrl;
  let pageIndex = 1;
  const discoveredBookEntries = [];

  while (currentUrl && pageIndex <= maxPages) {
    const cacheFileName = `catalogue-page-${pageIndex}.html`;
    const { html } = await fetchWithCache(currentUrl, cacheFileName);
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
 * Extracts raw book details from a book detail page HTML.
 */
function parseBookDetailPage(html, productUrl, sourcePage) {
  const $ = cheerio.load(html);

  // 1. Title from product_main h1
  const title = $('div.product_main h1').text().trim() || $('article.product_page h1').text().trim();

  // 2. Price text
  const price_text = $('div.product_main p.price_color').text().trim();

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

  // 6. Provenance fields
  const fetched_at = new Date().toISOString();

  return {
    title,
    product_url: productUrl,
    price_text,
    availability_text,
    rating_text,
    description,
    source_page: sourcePage,
    fetched_at
  };
}

/**
 * Fetches and extracts all 60 book details.
 */
async function extractAllBookDetails() {
  const { uniqueEntries } = await discoverCataloguePages(CATALOGUE_PAGE_1, 3);
  const rawBooks = [];

  for (let i = 0; i < uniqueEntries.length; i++) {
    const entry = uniqueEntries[i];
    const cacheFileName = getBookCacheFileName(entry.url);
    const { html } = await fetchWithCache(entry.url, cacheFileName, true);
    const rawRecord = parseBookDetailPage(html, entry.url, entry.sourcePage);
    rawBooks.push(rawRecord);
  }

  console.log(`detail_pages=${rawBooks.length}`);
  console.log('Sample raw record:');
  console.log(JSON.stringify(rawBooks[0], null, 2));

  return rawBooks;
}

async function runStage3() {
  console.log('=== Running Stage 3: Extract Raw Book Details ===');
  return await extractAllBookDetails();
}

if (require.main === module) {
  runStage3().catch((err) => {
    console.error('Stage 3 Error:', err.message);
    process.exit(1);
  });
}

module.exports = {
  BASE_URL,
  CATALOGUE_PAGE_1,
  USER_AGENT,
  CACHE_DIR,
  fetchWithCache,
  parseCataloguePage,
  discoverCataloguePages,
  getBookCacheFileName,
  parseBookDetailPage,
  extractAllBookDetails,
  runStage3
};
