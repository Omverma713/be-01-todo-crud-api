const Database = require('better-sqlite3');
const path = require('path');

// Open or create the SQLite database file: tasks.db
const db = new Database(path.join(__dirname, 'tasks.db'));

// Enable WAL mode for better concurrency and performance
db.pragma('journal_mode = WAL');

// 1. Create tasks table if it does not exist
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done BOOLEAN NOT NULL DEFAULT 0
  )
`);

// 2. Check if table is empty and seed exactly 3 initial tasks only if empty
const row = db.prepare('SELECT COUNT(*) AS count FROM tasks').get();
if (row.count === 0) {
  const insertTask = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
  
  // Seed the 3 example tasks
  insertTask.run('Learn REST APIs', 0);
  insertTask.run('Build CRUD endpoints', 0);
  insertTask.run('Test with Swagger', 1);
  console.log('Database initialized: seeded 3 initial tasks.');
}

module.exports = db;
