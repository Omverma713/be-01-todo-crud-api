/**
 * The Polite Scraper - Week 5 Assignment A9
 * Target: Books to Scrape (https://books.toscrape.com/)
 */

const BASE_URL = 'https://books.toscrape.com/';
const USER_AGENT = 'FlyRankInternship-A9/1.0 (+https://github.com/Omverma713/be-01-todo-crud-api)';

async function checkRobots() {
  console.log('Target: Books to Scrape (https://books.toscrape.com/)');
  console.log('Checking robots.txt...');
  try {
    const res = await fetch(`${BASE_URL}robots.txt`, {
      headers: { 'User-Agent': USER_AGENT }
    });
    if (res.status === 404) {
      console.log('Result: no robots file found (HTTP 404)');
    } else {
      console.log(`Result: HTTP ${res.status}`);
    }
  } catch (err) {
    console.error('Error fetching robots.txt:', err.message);
  }
}

if (require.main === module) {
  checkRobots();
}

module.exports = {
  BASE_URL,
  USER_AGENT,
  checkRobots
};
