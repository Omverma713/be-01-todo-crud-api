const express = require('express');
const { TriageInputSchema } = require('../llm/schema');
const { triageText } = require('../llm/service');
const {
  createTicket,
  getTicketById,
  listTickets,
  updateTicketStatus,
  getUnresolvedTicketStats
} = require('./db');
const { handleLogin, requireCapstoneAuth } = require('./auth');
const { runPendingTicketMonitor } = require('./jobs');

const router = express.Router();

// ==========================================
// Public Auth Endpoints
// ==========================================

// POST /api/auth/login
router.post('/auth/login', handleLogin);

// ==========================================
// Protected Ticket API Endpoints
// ==========================================

// POST /api/tickets - Ingest & Triage Ticket
router.post('/tickets', requireCapstoneAuth, async (req, res) => {
  const parsedInput = TriageInputSchema.safeParse(req.body);

  if (!parsedInput.success) {
    const issue = parsedInput.error.issues[0];
    return res.status(400).json({
      error: 'Invalid input payload',
      field: issue.path.join('.') || 'text',
      message: issue.message
    });
  }

  const { text } = parsedInput.data;

  // Extra guard for whitespace-only strings
  if (!text || !text.trim()) {
    return res.status(400).json({
      error: 'Invalid input payload',
      field: 'text',
      message: "Field 'text' must not be empty or whitespace"
    });
  }

  try {
    // Run LLM triage (supports stub mode, prompt v1, repair, quarantine, kill switch)
    const triageResult = await triageText(text);

    // Persist to SQLite Database
    const savedTicket = createTicket({
      customer_message: text,
      category: triageResult.category,
      urgency: triageResult.urgency,
      confidence: triageResult.confidence,
      reason: triageResult.reason,
      status: 'pending'
    });

    return res.status(201).json({
      message: 'Ticket created and triaged successfully',
      ticket: savedTicket
    });
  } catch (err) {
    const statusCode = err.statusCode || err.status || 500;
    if (statusCode === 422) {
      return res.status(422).json({
        error: 'Triage payload unprocessable after repair',
        message: err.message
      });
    }
    if (statusCode === 504) {
      return res.status(504).json({
        error: 'Gateway Timeout',
        message: 'LLM service did not respond in time'
      });
    }
    return res.status(statusCode).json({
      error: 'Triage Processing Error',
      message: err.message
    });
  }
});

// GET /api/tickets - List tickets with optional filtering
router.get('/tickets', requireCapstoneAuth, (req, res) => {
  const { status, urgency, category, limit, offset } = req.query;

  if (status && !['pending', 'in_progress', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'status must be pending, in_progress, or resolved' });
  }
  if (urgency && !['low', 'normal', 'high'].includes(urgency)) {
    return res.status(400).json({ error: 'urgency must be low, normal, or high' });
  }
  if (category && !['billing', 'bug', 'feature', 'other'].includes(category)) {
    return res.status(400).json({ error: 'category must be billing, bug, feature, or other' });
  }

  const tickets = listTickets({
    status,
    urgency,
    category,
    limit: limit ? parseInt(limit, 10) : 50,
    offset: offset ? parseInt(offset, 10) : 0
  });

  return res.status(200).json({
    count: tickets.length,
    tickets
  });
});

// GET /api/tickets/:id - Retrieve specific ticket
router.get('/tickets/:id', requireCapstoneAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ticket ID' });
  }

  const ticket = getTicketById(id);
  if (!ticket) {
    return res.status(404).json({ error: `Ticket #${id} not found` });
  }

  return res.status(200).json(ticket);
});

// PATCH /api/tickets/:id/status - Update ticket status
router.patch('/tickets/:id/status', requireCapstoneAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ticket ID' });
  }

  const { status } = req.body || {};
  if (!status || !['pending', 'in_progress', 'resolved'].includes(status)) {
    return res.status(400).json({
      error: 'Invalid status. Must be one of: pending, in_progress, resolved'
    });
  }

  const updatedTicket = updateTicketStatus(id, status);
  if (!updatedTicket) {
    return res.status(404).json({ error: `Ticket #${id} not found` });
  }

  return res.status(200).json({
    message: 'Ticket status updated successfully',
    ticket: updatedTicket
  });
});

// POST /api/jobs/run-monitor - Trigger background job on-demand
router.post('/jobs/run-monitor', requireCapstoneAuth, (req, res) => {
  const report = runPendingTicketMonitor();
  return res.status(200).json({
    message: 'Pending Ticket Monitor executed successfully',
    report
  });
});

// GET /api/stats - Queue statistics
router.get('/stats', requireCapstoneAuth, (req, res) => {
  const stats = getUnresolvedTicketStats();
  return res.status(200).json(stats);
});

module.exports = router;
