const crypto = require('crypto');
const db = require('../config/db');

function checksum(value) {
  if (value === null || value === undefined) {
    return null;
  }
  return crypto.createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

async function recordSyncAudit(
  {
    direction,
    executedBy,
    requestCount = 0,
    insertedCount = 0,
    updatedCount = 0,
    skippedCount = 0,
    conflictCount = 0,
    status,
    request,
    errorMessage = null,
    startedAt = new Date(),
    finishedAt = new Date()
  },
  executor = db
) {
  await executor.execute(
    `INSERT INTO sync_audit_log
      (direction, executed_by, request_count, inserted_count, updated_count, skipped_count,
       conflict_count, status, request_checksum, started_at, finished_at, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      direction,
      executedBy || null,
      requestCount,
      insertedCount,
      updatedCount,
      skippedCount,
      conflictCount,
      status,
      checksum(request),
      startedAt,
      finishedAt,
      errorMessage
    ]
  );
}

module.exports = {
  recordSyncAudit,
  checksum
};
