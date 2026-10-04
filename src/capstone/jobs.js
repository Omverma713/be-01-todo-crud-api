const { getPendingHighUrgencyTickets, getUnresolvedTicketStats } = require('./db');

let jobTimer = null;
const DEFAULT_INTERVAL_MS = 60000; // 1 minute

function runPendingTicketMonitor() {
  const timestamp = new Date().toISOString();
  const highUrgentPending = getPendingHighUrgencyTickets();
  const stats = getUnresolvedTicketStats();

  const report = {
    job: 'PendingTicketMonitor',
    timestamp,
    highUrgencyPendingCount: highUrgentPending.length,
    totalUnresolvedCount: stats.totalUnresolved,
    categoryBreakdown: stats.categoryBreakdown,
    alerts: highUrgentPending.map(t => ({
      ticketId: t.id,
      category: t.category,
      urgency: t.urgency,
      reason: t.reason,
      createdAt: t.created_at
    }))
  };

  // Structured operational log
  console.log(`[BACKGROUND JOB][${timestamp}] Pending Ticket Monitor Report:`);
  console.log(`  - Total Unresolved: ${report.totalUnresolvedCount}`);
  console.log(`  - High Urgency Pending: ${report.highUrgencyPendingCount}`);
  if (report.alerts.length > 0) {
    console.log(`  - CRITICAL ALERT: ${report.alerts.length} high-urgency ticket(s) need immediate attention!`);
    report.alerts.forEach(a => {
      console.log(`    * Ticket #${a.ticketId} [${a.category.toUpperCase()}]: ${a.reason}`);
    });
  } else {
    console.log(`  - Queue healthy: No high-urgency tickets pending.`);
  }

  return report;
}

function startBackgroundJobs(intervalMs = null) {
  if (process.env.JOB_ENABLED === 'false') {
    console.log('[BACKGROUND JOB] Disabled via JOB_ENABLED=false');
    return;
  }

  const interval = intervalMs || parseInt(process.env.JOB_INTERVAL_MS, 10) || DEFAULT_INTERVAL_MS;

  if (jobTimer) {
    clearInterval(jobTimer);
  }

  console.log(`[BACKGROUND JOB] Starting Pending Ticket Monitor (Interval: ${interval}ms)`);
  
  // Set recurring timer
  jobTimer = setInterval(() => {
    try {
      runPendingTicketMonitor();
    } catch (err) {
      console.error('[BACKGROUND JOB ERROR]', err.message);
    }
  }, interval);

  // Allow Node process to exit gracefully if only timer is running
  if (jobTimer.unref) {
    jobTimer.unref();
  }
}

function stopBackgroundJobs() {
  if (jobTimer) {
    clearInterval(jobTimer);
    jobTimer = null;
    console.log('[BACKGROUND JOB] Stopped background job timer.');
  }
}

module.exports = {
  runPendingTicketMonitor,
  startBackgroundJobs,
  stopBackgroundJobs
};
