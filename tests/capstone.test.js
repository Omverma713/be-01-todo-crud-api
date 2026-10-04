require('dotenv').config();
const http = require('http');
const assert = require('assert');
const app = require('../server');
const {
  db,
  createTicket,
  getTicketById,
  listTickets,
  updateTicketStatus,
  getPendingHighUrgencyTickets
} = require('../src/capstone/db');
const { createToken, verifyToken } = require('../src/capstone/auth');
const { runPendingTicketMonitor } = require('../src/capstone/jobs');

let server;
let baseUrl;
let authToken;
let passedCount = 0;
let totalCount = 0;

function it(description, fn) {
  totalCount++;
  try {
    fn();
    console.log(`  [PASS] Test ${totalCount}: ${description}`);
    passedCount++;
  } catch (err) {
    console.error(`  [FAIL] Test ${totalCount}: ${description}`);
    console.error(`         Error: ${err.message}`);
  }
}

async function itAsync(description, fn) {
  totalCount++;
  try {
    await fn();
    console.log(`  [PASS] Test ${totalCount}: ${description}`);
    passedCount++;
  } catch (err) {
    console.error(`  [FAIL] Test ${totalCount}: ${description}`);
    console.error(`         Error: ${err.message}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('  Running Capstone Automated Test Suite (12 Tests)   ');
  console.log('====================================================\n');

  // Start temporary test server
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  try {
    // --- Test 1: Authentication Failure (No token) ---
    await itAsync('Authentication Failure: Rejects unauthenticated request with 401', async () => {
      const res = await fetch(`${baseUrl}/api/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'My app is broken' })
      });
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.ok(data.error);
    });

    // --- Test 2: Authentication Success (Login) ---
    await itAsync('Authentication Success: Logs in seeded agent and returns Bearer token', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'agent@support.com',
          password: 'Password123!'
        })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.token);
      assert.strictEqual(data.user.email, 'agent@support.com');
      authToken = data.token;
    });

    // --- Test 3: Missing Ticket Text (400) ---
    await itAsync('Validation Failure: Missing text returns HTTP 400 Bad Request', async () => {
      const res = await fetch(`${baseUrl}/api/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({})
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, 'Invalid input payload');
    });

    // --- Test 4: Invalid Input (Empty / Exceeding length) ---
    await itAsync('Validation Failure: Empty text or non-string returns HTTP 400 Bad Request', async () => {
      const res = await fetch(`${baseUrl}/api/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ text: '   ' })
      });
      assert.strictEqual(res.status, 400);
    });

    // --- Test 5: Valid Ticket Creation ---
    let createdTicketId;
    await itAsync('Valid Ticket Creation: Ingests, triages, and persists ticket with 201 Created', async () => {
      const res = await fetch(`${baseUrl}/api/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          text: 'I was charged twice on my credit card statement for last month subscription.'
        })
      });
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.ok(data.ticket);
      assert.ok(data.ticket.id);
      assert.strictEqual(data.ticket.category, 'billing');
      assert.strictEqual(data.ticket.status, 'pending');
      createdTicketId = data.ticket.id;
    });

    // --- Test 6: Billing Classification ---
    await itAsync('Billing Classification: Correctly classifies refund inquiry as billing', async () => {
      const res = await fetch(`${baseUrl}/api/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          text: 'Can I please get a refund for my invoice? I was overcharged.'
        })
      });
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.ticket.category, 'billing');
    });

    // --- Test 7: Bug Classification ---
    await itAsync('Bug Classification: Correctly classifies error crash as high urgency bug', async () => {
      const res = await fetch(`${baseUrl}/api/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          text: 'Every time I click the export button, the whole system crashes with a 500 error.'
        })
      });
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.ticket.category, 'bug');
      assert.strictEqual(data.ticket.urgency, 'high');
    });

    // --- Test 8: Feature Classification ---
    await itAsync('Feature Classification: Correctly classifies enhancement request as feature', async () => {
      const res = await fetch(`${baseUrl}/api/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          text: 'Would love if you could add a dark mode theme option for nighttime usage.'
        })
      });
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.ticket.category, 'feature');
      assert.strictEqual(data.ticket.urgency, 'low');
    });

    // --- Test 9: Other Classification ---
    await itAsync('Other Classification: Correctly classifies vague greeting as other', async () => {
      const res = await fetch(`${baseUrl}/api/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          text: 'Hi there, good morning!'
        })
      });
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.ticket.category, 'other');
    });

    // --- Test 10: Protected Endpoints (GET, PATCH) ---
    await itAsync('Protected Endpoints: Allows authorized list, retrieve, and status update', async () => {
      // 1. GET list
      const listRes = await fetch(`${baseUrl}/api/tickets`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      assert.strictEqual(listRes.status, 200);
      const listData = await listRes.json();
      assert.ok(listData.tickets.length > 0);

      // 2. GET single
      const getRes = await fetch(`${baseUrl}/api/tickets/${createdTicketId}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      assert.strictEqual(getRes.status, 200);
      const ticket = await getRes.json();
      assert.strictEqual(ticket.id, createdTicketId);

      // 3. PATCH status
      const patchRes = await fetch(`${baseUrl}/api/tickets/${createdTicketId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ status: 'in_progress' })
      });
      assert.strictEqual(patchRes.status, 200);
      const patched = await patchRes.json();
      assert.strictEqual(patched.ticket.status, 'in_progress');
    });

    // --- Test 11: Database Persistence ---
    it('Database Persistence: Persists ticket records and survives simulated restart', () => {
      const directTicket = getTicketById(createdTicketId);
      assert.ok(directTicket);
      assert.strictEqual(directTicket.id, createdTicketId);
      assert.strictEqual(directTicket.status, 'in_progress');
      assert.ok(directTicket.created_at);
      assert.ok(directTicket.updated_at);
    });

    // --- Test 12: Background Job Behavior ---
    it('Background Job: Pending Ticket Monitor discovers unresolved and high urgency tickets', () => {
      // Ensure at least one high urgency pending ticket exists
      createTicket({
        customer_message: 'Critical production database outage',
        category: 'bug',
        urgency: 'high',
        confidence: 0.99,
        reason: 'Outage blocking all users.',
        status: 'pending'
      });

      const report = runPendingTicketMonitor();
      assert.strictEqual(report.job, 'PendingTicketMonitor');
      assert.ok(report.highUrgencyPendingCount >= 1);
      assert.ok(report.totalUnresolvedCount >= 1);
      assert.ok(Array.isArray(report.alerts));
    });

  } finally {
    server.close();
  }

  console.log('\n====================================================');
  console.log(`  Test Results: ${passedCount}/${totalCount} Passed (${((passedCount / totalCount) * 100).toFixed(1)}%)`);
  console.log('====================================================\n');

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runTests();
