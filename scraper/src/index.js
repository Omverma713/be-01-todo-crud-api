/**
 * The Polite Scraper - Week 5 Assignment A9
 * Stage 1: Fetch Once, Cache Once
 */

const fs = require('fs');
const path = require('path');

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

async function runStage1() {
  console.log('=== Running Stage 1: Fetch Once, Cache Once ===');
  const result = await fetchWithCache(CATALOGUE_PAGE_1, 'catalogue-page-1.html');
  return result;
}

if (require.main === module) {
  runStage1().catch((err) => {
    console.error('Stage 1 Error:', err.message);
    process.exit(1);
  });
}

module.exports = {
  BASE_URL,
  CATALOGUE_PAGE_1,
  USER_AGENT,
  CACHE_DIR,
  fetchWithCache,
  runStage1
};
