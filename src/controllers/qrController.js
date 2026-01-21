const db = require('../config/db');
const { findTokenByBarcode } = require('../services/qrTokens');

const COIN_REWARD_RAW = Number(process.env.COIN_REWARD_PER_SCAN || 1);
const COIN_REWARD = Number.isFinite(COIN_REWARD_RAW) ? COIN_REWARD_RAW : 1;

function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

exports.scan = async (req, res) => {
  const barcodeValue = String(req.body?.barcodeValue || '').trim();
  if (!barcodeValue) {
    return res.status(422).json({ message: 'barcodeValue es obligatorio.' });
  }

  const now = new Date();
  let tokenRow;
  try {
    tokenRow = await findTokenByBarcode(barcodeValue, now);
  } catch (error) {
    console.error('Error al validar QR', error);
    return res.status(500).json({ message: 'Error al validar el QR.' });
  }
  if (!tokenRow) {
    return res.status(404).json({ message: 'QR invalido o expirado.' });
  }

  const awardDate = toDateString(now);
  const scannerId = req.user?.id || null;
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [[userRow]] = await connection.execute(
      'SELECT creditos FROM usuarios WHERE id = ? FOR UPDATE',
      [tokenRow.user_id]
    );
    const currentCredits = Number(userRow?.creditos || 0);

    const [awardResult] = await connection.execute(
      `INSERT IGNORE INTO coin_daily_awards (user_id, award_date, scanner_id)
       VALUES (?, ?, ?)`,
      [tokenRow.user_id, awardDate, scannerId]
    );

    if (awardResult.affectedRows === 0) {
      await connection.execute(
        'UPDATE user_qr_tokens SET last_used_at = ? WHERE id = ?',
        [now, tokenRow.id]
      );
      await connection.commit();
      return res.json({
        awarded: false,
        creditos: currentCredits,
        message: 'El usuario ya registro un scan el dia de hoy.'
      });
    }

    const updatedCredits = currentCredits + COIN_REWARD;
    await connection.execute('UPDATE usuarios SET creditos = ? WHERE id = ?', [
      updatedCredits,
      tokenRow.user_id
    ]);

    await connection.execute(
      `INSERT INTO coin_transactions (user_id, delta, type, scanner_id)
       VALUES (?, ?, 'scan_reward', ?)`,
      [tokenRow.user_id, COIN_REWARD, scannerId]
    );

    await connection.execute(
      'UPDATE user_qr_tokens SET last_used_at = ? WHERE id = ?',
      [now, tokenRow.id]
    );

    await connection.commit();
    return res.json({
      awarded: true,
      creditos: updatedCredits,
      delta: COIN_REWARD
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Error al revertir la transaccion de scan', rollbackError);
      }
    }
    console.error('Error en scan de QR', error);
    return res.status(500).json({ message: 'Error al registrar el scan.' });
  } finally {
    if (connection) {
      await connection.release();
    }
  }
};
