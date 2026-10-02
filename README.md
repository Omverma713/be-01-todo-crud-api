# BE-01 — Build Your First CRUD API

Node.js + Express in-memory To-Do API.

## Run
npm install
npm start

Swagger: http://localhost:3000/docs

## Endpoints
- GET /tasks
- GET /tasks/:id
- POST /tasks
- PUT /tasks/:id
- DELETE /tasks/:id

## Required status codes
200 reads/updates, 201 create, 204 delete, 400 invalid body, 404 unknown id.

## Stage commits
Stage 0: hello server
Stage 1: root and health endpoints
Stage 2: read endpoints with 404
Stage 3: create with validation
Stage 4: full CRUD
Stage 5: Swagger UI
Stage 6: publish and docs

Data is intentionally stored only in memory, so restarting the server resets the tasks.
