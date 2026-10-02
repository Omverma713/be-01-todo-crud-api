const express=require('express'); const swaggerUi=require('swagger-ui-express'); const openapi=require('./openapi.json');
const db = require('./db');
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
app.use('/docs',swaggerUi.serve,swaggerUi.setup(openapi)); app.listen(PORT,()=>console.log(`Task API: http://localhost:${PORT} | Swagger: http://localhost:${PORT}/docs`));
