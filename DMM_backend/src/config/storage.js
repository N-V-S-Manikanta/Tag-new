// Storage abstraction. Default driver is "local" (disk via Multer).
// Switch STORAGE_DRIVER=cloudinary in .env to upload to Cloudinary instead.
// Controllers only ever call uploadBuffer()/deleteFile() so the rest of the
// codebase doesn't care which driver is active.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = path.resolve(__dirname, '../../uploads');

const driver = (process.env.STORAGE_DRIVER || 'local').toLowerCase();

/**
 * Persist a file buffer and return { url, publicId }.
 * @param {Buffer} buffer
 * @param {object} opts { folder, originalName, mimetype }
 */
async function uploadBuffer(buffer, { folder = 'misc', originalName = 'file' }) {
  if (driver === 'cloudinary') {
    return uploadToCloudinary(buffer, folder, originalName);
  }
  return uploadToLocal(buffer, folder, originalName);
}

async function deleteFile(publicId) {
  if (!publicId) return;
  if (driver === 'cloudinary') {
    const { v2: cloudinary } = await import('cloudinary');
    configureCloudinary(cloudinary);
    await cloudinary.uploader.destroy(publicId, { resource_type: 'auto' });
    return;
  }
  // local: publicId is a path relative to uploads root
  const abs = path.join(UPLOAD_ROOT, publicId);
  if (abs.startsWith(UPLOAD_ROOT) && fs.existsSync(abs)) fs.unlinkSync(abs);
}

// ---------- local driver ----------
function uploadToLocal(buffer, folder, originalName) {
  const dir = path.join(UPLOAD_ROOT, folder);
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(originalName) || '';
  const base = path
    .basename(originalName, ext)
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .slice(0, 40);
  const unique = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const filename = `${base || 'file'}-${unique}${ext}`;
  const relPath = path.posix.join(folder, filename);
  fs.writeFileSync(path.join(dir, filename), buffer);
  return {
    url: `/uploads/${relPath}`, // served statically by express
    publicId: relPath,
  };
}

// ---------- cloudinary driver ----------
function configureCloudinary(cloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

async function uploadToCloudinary(buffer, folder, originalName) {
  const { v2: cloudinary } = await import('cloudinary');
  configureCloudinary(cloudinary);
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `dmm/${folder}`, resource_type: 'auto', public_id: path.parse(originalName).name },
      (err, result) => {
        if (err) return reject(err);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

export { uploadBuffer, deleteFile, driver, UPLOAD_ROOT };
