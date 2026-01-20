const express = require('express');
const multer = require('multer');
const router = express.Router();
const registerController = require('../controllers/registerController');

// Campos esperados: multiples archivos con nombres de campo ine, comprobante, curpDoc
const upload = registerController.upload.fields([
  { name: 'ine', maxCount: 1 },
  { name: 'comprobante', maxCount: 1 },
  { name: 'curpDoc', maxCount: 1 }
]);

function handleUpload(req, res, next) {
  upload(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(422).json({ message: 'Cada archivo debe pesar maximo 2MB' });
        }
        return res.status(422).json({ message: err.message });
      }
      if (err?.code === 'UNSUPPORTED_FILE') {
        return res.status(422).json({ message: err.message });
      }
      return res.status(400).json({ message: err?.message || 'Error al subir archivos' });
    }
    next();
  });
}

router.post('/register', handleUpload, registerController.register);
router.post('/register/register', handleUpload, registerController.register);

module.exports = router;
