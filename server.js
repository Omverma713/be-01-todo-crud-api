require('dotenv').config();
const express=require('express'); const swaggerUi=require('swagger-ui-express'); const openapi=require('./openapi.json');
const db = require('./db');
const supabase = require('./supabase');
const app=express(); const PORT=3000; app.use(express.json());
let tasks=[{id:1,title:'Learn REST APIs',done:false},{id:2,title:'Build CRUD endpoints',done:false},{id:3,title:'Test with Swagger',done:true}]; let nextId=4;
app.get('/',(req,res)=>res.json({name:'Task API',version:'1.0',endpoints:['/tasks']}));
app.get('/health',(req,res)=>res.json({status:'ok'}));
app.get('/tasks', (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks').all();
  res.status(200).json(tasks);
});
app.get('/tasks/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.status(200).json(task);
});
app.post('/tasks', (req, res) => {
  const { title } = req.body;
  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title is required and must not be empty' });
  }
  const stmt = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
  const info = stmt.run(title.trim(), 0);
  const task = {
    id: Number(info.lastInsertRowid),
    title: title.trim(),
    done: 0
  };
  res.status(201).json(task);
});
app.put('/tasks/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const { title, done } = req.body;
  if (
    (title !== undefined && (typeof title !== 'string' || !title.trim())) ||
    (done !== undefined && typeof done !== 'boolean')
  ) {
    return res.status(400).json({ error: 'title must be a non-empty string and done must be a boolean' });
  }

  const updatedTitle = title !== undefined ? title.trim() : existing.title;
  const updatedDone = done !== undefined ? (done ? 1 : 0) : existing.done;

  db.prepare('UPDATE tasks SET title = ?, done = ? WHERE id = ?').run(updatedTitle, updatedDone, req.params.id);

  const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  res.status(200).json(updatedTask);
});

app.delete('/tasks/:id', (req, res) => {
  const info = db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  if (info.changes === 0) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.status(204).send();
});
// --- Auth Middleware ---
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const token = authHeader.split(' ')[1];
  if (!token || !token.trim()) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const { data: { user }, error } = await supabase.auth.getUser(token.trim());

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = user;
  next();
};

// --- Stage 1: Auth Routes ---

// POST /auth/signup
app.post('/auth/signup', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password || typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password.trim()) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password: password.trim()
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(201).json(data.user);
});

// POST /auth/login
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password || typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password.trim()) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password: password.trim()
  });

  if (error) {
    return res.status(401).json({ error: 'Invalid login credentials' });
  }

  return res.status(200).json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: data.user
  });
});

// POST /auth/logout (Stage 4)
app.post('/auth/logout', requireAuth, async (req, res) => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(204).send();
});

// --- Public & Protected Routes ---

// GET /public/info
app.get('/public/info', (req, res) => {
  res.status(200).json({
    message: 'Welcome stranger! This info is public.'
  });
});

// GET /protected/profile (Stage 4: Protected with reusable middleware)
app.get('/protected/profile', requireAuth, (req, res) => {
  return res.status(200).json({
    id: req.user.id,
    email: req.user.email,
    created_at: req.user.created_at
  });
});

// GET /protected/dashboard (Stage 4: Second protected route with reusable middleware)
app.get('/protected/dashboard', requireAuth, (req, res) => {
  return res.status(200).json({
    message: `Welcome to your dashboard, ${req.user.email}!`,
    user: {
      id: req.user.id,
      email: req.user.email,
      created_at: req.user.created_at
    }
  });
});

// --- Week 7 Assignment A17: LLM Triage Route ---
const triageRouter = require('./src/routes/triage');
app.use('/triage', triageRouter);

app.use('/docs',swaggerUi.serve,swaggerUi.setup(openapi)); app.listen(PORT,()=>{
  console.log(`Task API: http://localhost:${PORT} | Swagger: http://localhost:${PORT}/docs`);
  console.log(`Server running and connected to Supabase`);
});
