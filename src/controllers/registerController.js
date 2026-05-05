exports.deprecatedRegister = async (req, res) => {
  return res.status(410).json({
    message:
      'El registro directo fue retirado. Usa la activacion local con tarjeta en /api/v1/cardholders/verify-activation.'
  });
};
