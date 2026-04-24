exports.deprecatedRegister = async (req, res) => {
  return res.status(410).json({
    message:
      'El registro local fue retirado. Usa el flujo de lookup y beneficiarios-staging.'
  });
};
