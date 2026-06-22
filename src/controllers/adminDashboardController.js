const db = require('../config/db');
const safeLogger = require('../utils/safeLogger');

exports.getDashboard = async (req, res) => {
  try {
    const [[benefitsCount]] = await db.execute('SELECT COUNT(*) AS total FROM beneficios');
    const [stagingRows] = await db.execute(
      `SELECT status, COUNT(*) AS total
       FROM beneficiario_staging
       GROUP BY status`
    );
    const [[lastSyncRow]] = await db.execute(
      `SELECT finished_at AS lastRunAt, status AS lastStatus, request_count AS processed
       FROM sync_audit_log
       ORDER BY finished_at DESC
       LIMIT 1`
    );
    const [userRows] = await db.execute(
      `SELECT role, status, COUNT(*) AS total
       FROM usuarios
       GROUP BY role, status`
    );
    const [[cardholderSummaryRow]] = await db.execute(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN account_user_id IS NOT NULL THEN 1 ELSE 0 END) AS withAccount
       FROM cardholders_sync`
    );
    const [[failedIntegrationRow]] = await db.execute(
      `SELECT COUNT(*) AS total
       FROM integration_audit_log
       WHERE status_code >= 400
         AND created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)`
    );
    const [[lastPushRow]] = await db.execute(
      `SELECT attempted_at, status, response_status
       FROM staging_push_attempts
       ORDER BY attempted_at DESC
       LIMIT 1`
    );

    const staging = {
      pending: 0,
      accepted: 0,
      rejected: 0,
      error: 0
    };
    for (const row of stagingRows) {
      staging[String(row.status || '').toLowerCase()] = Number(row.total || 0);
    }

    const users = {
      admins: 0,
      readers: 0,
      blocked: 0
    };
    for (const row of userRows) {
      const role = String(row.role || '').toLowerCase();
      const status = String(row.status || '').toLowerCase();
      const total = Number(row.total || 0);
      if (role === 'admin') {
        users.admins += total;
      }
      if (role === 'reader') {
        users.readers += total;
      }
      if (status === 'blocked') {
        users.blocked += total;
      }
    }

    return res.json({
      staging,
      sync: {
        lastRunAt: lastSyncRow?.lastRunAt || null,
        lastStatus: lastSyncRow?.lastStatus || null,
        processed: Number(lastSyncRow?.processed || 0)
      },
      catalog: {
        benefits: Number(benefitsCount?.total || 0)
      },
      users,
      cardholders: {
        total: Number(cardholderSummaryRow?.total || 0),
        withAccount: Number(cardholderSummaryRow?.withAccount || 0)
      },
      integration: {
        failedCallsLast24h: Number(failedIntegrationRow?.total || 0)
      },
      stagingPush: {
        attemptedAt: lastPushRow?.attempted_at || null,
        status: lastPushRow?.status || null,
        responseStatus: lastPushRow?.response_status || null
      }
    });
  } catch (error) {
    safeLogger.error('Error al cargar dashboard admin', error);
    return res.status(500).json({ message: 'Error al cargar dashboard.' });
  }
};
