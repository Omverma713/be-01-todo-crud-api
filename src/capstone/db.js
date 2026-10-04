const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const dbPath = process.env.DATABASE_FILE || path.join(__dirname, '../../data/capstone.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_message TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('billing', 'bug', 'feature', 'other')),
    urgency TEXT NOT NULL CHECK(urgency IN ('low', 'normal', 'high')),
    confidence REAL NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'resolved')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
  CREATE INDEX IF NOT EXISTS idx_tickets_urgency ON tickets(urgency);
  CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category);

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'agent',
    created_at TEXT NOT NULL
  );
`);

// Password hashing helper (SHA-256 with salt)
function hashPassword(password, salt = 'capstone_salt_2026') {
  return crypto.createHmac('sha256', salt).update(password).digest('hex');
}

// Seed default support agent if not present
const defaultAgentEmail = 'agent@support.com';
const existingAgent = db.prepare('SELECT * FROM users WHERE email = ?').get(defaultAgentEmail);
if (!existingAgent) {
  const insertUser = db.prepare(`
    INSERT INTO users (email, password_hash, name, role, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertUser.run(
    defaultAgentEmail,
    hashPassword('Password123!'),
    'Support Agent Demo',
    'agent',
    new Date().toISOString()
  );
}

// Ticket CRUD operations
function createTicket({ customer_message, category, urgency, confidence, reason, status = 'pending' }) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO tickets (customer_message, category, urgency, confidence, reason, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(customer_message, category, urgency, confidence, reason, status, now, now);
  return getTicketById(Number(info.lastInsertRowid));
}

function getTicketById(id) {
  return db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
}

function listTickets({ status, urgency, category, limit = 50, offset = 0 } = {}) {
  let query = 'SELECT * FROM tickets WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (urgency) {
    query += ' AND urgency = ?';
    params.push(urgency);
  }
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }

  query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(query).all(...params);
}

function updateTicketStatus(id, status) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE tickets
    SET status = ?, updated_at = ?
    WHERE id = ?
  `);
  const info = stmt.run(status, now, id);
  if (info.changes === 0) return null;
  return getTicketById(id);
}

function getPendingHighUrgencyTickets() {
  return db.prepare(`
    SELECT * FROM tickets
    WHERE status = 'pending' AND urgency = 'high'
    ORDER BY id ASC
  `).all();
}

function getUnresolvedTicketStats() {
  const totalUnresolved = db.prepare(`
    SELECT COUNT(*) AS count FROM tickets WHERE status != 'resolved'
  `).get().count;

  const highUrgencyPending = db.prepare(`
    SELECT COUNT(*) AS count FROM tickets WHERE status = 'pending' AND urgency = 'high'
  `).get().count;

  const categoryBreakdown = db.prepare(`
    SELECT category, COUNT(*) AS count
    FROM tickets
    WHERE status != 'resolved'
    GROUP BY category
  `).all();

  return {
    totalUnresolved,
    highUrgencyPending,
    categoryBreakdown
  };
}

// User operations
function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function verifyUserPassword(email, plainPassword) {
  const user = getUserByEmail(email);
  if (!user) return null;
  const computedHash = hashPassword(plainPassword);
  if (computedHash === user.password_hash) {
    const { password_hash, ...safeUser } = user;
    return safeUser;
  }
  return null;
}

module.exports = {
  db,
  createTicket,
  getTicketById,
  listTickets,
  updateTicketStatus,
  getPendingHighUrgencyTickets,
  getUnresolvedTicketStats,
  getUserByEmail,
  verifyUserPassword,
  hashPassword
};
