require('dotenv').config();
const { db, createTicket, getUserByEmail, createUser, hashPassword } = require('../src/capstone/db');

console.log('=== Seeding Capstone Demo Data ===');

// 1. Ensure Demo Support Agent
const agentEmail = 'agent@support.com';
const existingAgent = getUserByEmail(agentEmail);
if (!existingAgent) {
  const insertUser = db.prepare(`
    INSERT INTO users (email, password_hash, name, role, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertUser.run(
    agentEmail,
    hashPassword('Password123!'),
    'Support Agent Demo',
    'agent',
    new Date().toISOString()
  );
  console.log(' [OK] Seeded Agent User: agent@support.com / Password123!');
} else {
  console.log(' [OK] Agent User already exists: agent@support.com');
}

// 2. Seed Sample Tickets
const sampleTickets = [
  {
    customer_message: 'Our entire team cannot export monthly invoices. The API returns 500 error and blocks payroll.',
    category: 'bug',
    urgency: 'high',
    confidence: 0.95,
    reason: 'Critical bug impacting export functionality and blocking payroll.',
    status: 'pending'
  },
  {
    customer_message: 'I was charged $49 twice on my statement this morning for our annual plan.',
    category: 'billing',
    urgency: 'high',
    confidence: 0.98,
    reason: 'Double billing issue requiring immediate finance refund review.',
    status: 'pending'
  },
  {
    customer_message: 'Would love to have an option to customize table column widths in the reports view.',
    category: 'feature',
    urgency: 'low',
    confidence: 0.92,
    reason: 'Non-blocking UI customization feature request.',
    status: 'in_progress'
  },
  {
    customer_message: 'The sidebar icon slightly misaligns when switching between light and dark modes on Firefox.',
    category: 'bug',
    urgency: 'normal',
    confidence: 0.88,
    reason: 'Minor visual layout defect on Firefox.',
    status: 'resolved'
  },
  {
    customer_message: 'Just wanted to say thank you for the fast support yesterday!',
    category: 'other',
    urgency: 'low',
    confidence: 0.40,
    reason: 'Polite customer feedback and greeting without action item.',
    status: 'resolved'
  }
];

let addedCount = 0;
for (const t of sampleTickets) {
  // Check if similar ticket exists
  const existing = db.prepare('SELECT id FROM tickets WHERE customer_message = ?').get(t.customer_message);
  if (!existing) {
    createTicket(t);
    addedCount++;
  }
}

console.log(` [OK] Seeded ${addedCount} sample tickets into SQLite database.`);
console.log('=== Capstone Seeding Complete ===');
