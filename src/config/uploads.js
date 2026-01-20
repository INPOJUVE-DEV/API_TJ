const fs = require('fs');
const path = require('path');

function resolveUploadsDir() {
  const configured = (process.env.UPLOADS_DIR || 'uploads').trim() || 'uploads';
  return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
}

function ensureUploadsDir() {
  const uploadsDir = resolveUploadsDir();
  fs.mkdirSync(uploadsDir, { recursive: true });
  return uploadsDir;
}

module.exports = {
  ensureUploadsDir,
  resolveUploadsDir
};

