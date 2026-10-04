/**
 * The Polite Scraper - Week 5 Assignment A9
 * Stage 2: Discover Three Catalogue Pages
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
async function fetchWithCache(url, cacheFileName) {
  const cachePath = path.join(CACHE_DIR, cacheFileName);

  if (fs.existsSync(cachePath)) {
    const html = fs.readFileSync(cachePath, 'utf-8');
    const size = Buffer.byteLength(html, 'utf-8');
    console.log(`CACHE HIT - File: ${cacheFileName} | Response size: ${size} bytes`);
    return { html, fromCache: true, size };
  }

  // Polite delay before real network request
  await politeDelay();

  console.log(`FETCH - URL: ${url}`);
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
  console.log(`FETCH SUCCESS - Saved to: ${cacheFileName} | Response size: ${size} bytes`);

  return { html, fromCache: false, size };
}

/**
 * Extracts book detail page URLs and the next catalogue link from a catalogue page HTML.
 */
function parseCataloguePage(html, pageUrl) {
  const $ = cheerio.load(html);
  const bookUrls = [];

  $('article.product_pod h3 a').each((_, el) => {
    const relativeHref = $(el).attr('href');
    if (relativeHref) {
      const absoluteUrl = new URL(relativeHref, pageUrl).href;
      bookUrls.push(absoluteUrl);
    }
  });

  const nextRel = $('li.next a').attr('href');
  const nextUrl = nextRel ? new URL(nextRel, pageUrl).href : null;

  return { bookUrls, nextUrl };
}

/**
 * Discovers catalogue pages up to maxPages and collects all book URLs.
 */
async function discoverCataloguePages(startUrl = CATALOGUE_PAGE_1, maxPages = 3) {
  let currentUrl = startUrl;
  let pageIndex = 1;
  const discoveredBookUrls = [];

  while (currentUrl && pageIndex <= maxPages) {
    const cacheFileName = `catalogue-page-${pageIndex}.html`;
    const { html } = await fetchWithCache(currentUrl, cacheFileName);
    const { bookUrls, nextUrl } = parseCataloguePage(html, currentUrl);

    discoveredBookUrls.push(...bookUrls);
    currentUrl = nextUrl;
    pageIndex++;
  }

  const cataloguePagesCount = pageIndex - 1;
  const discoveredCount = discoveredBookUrls.length;
  const uniqueUrls = Array.from(new Set(discoveredBookUrls));
  const uniqueCount = uniqueUrls.length;

  console.log(`catalogue_pages=${cataloguePagesCount}`);
  console.log(`discovered=${discoveredCount}`);
  console.log(`unique_urls=${uniqueCount}`);

  return {
    cataloguePagesCount,
    discoveredCount,
    uniqueCount,
    uniqueUrls
  };
}

async function runStage2() {
  console.log('=== Running Stage 2: Discover Three Catalogue Pages ===');
  return await discoverCataloguePages(CATALOGUE_PAGE_1, 3);
}

if (require.main === module) {
  runStage2().catch((err) => {
    console.error('Stage 2 Error:', err.message);
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
  runStage2
};
