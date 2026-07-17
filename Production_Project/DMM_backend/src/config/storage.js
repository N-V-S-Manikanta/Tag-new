// Storage abstraction. Default driver is "local" (disk via Multer).
// Switch STORAGE_DRIVER=cloudinary in .env to upload to Cloudinary instead.
// Controllers only ever call uploadBuffer()/deleteFile() so the rest of the
// codebase doesn't care which driver is active.
// import fs from 'fs';
// import path from 'path';
// import { fileURLToPath } from 'url';
//import crypto from 'crypto';

//const __dirname = path.dirname(fileURLToPath(import.meta.url));
//const UPLOAD_ROOT = path.resolve(__dirname, '../../uploads');

//const driver = (process.env.STORAGE_DRIVER || 'local').toLowerCase();

/**
// * Persist a file buffer and return { url, publicId }.
// * @param {Buffer} buffer
// * @param {object} opts { folder, originalName, mimetype }
// */
//async function uploadBuffer(buffer, { folder = 'misc', originalName = 'file' }) {
//  if (driver === 'cloudinary') {
//    return uploadToCloudinary(buffer, folder, originalName);
//  }
//  return uploadToLocal(buffer, folder, originalName);
//}

//async function deleteFile(publicId) {
//  if (!publicId) return;
//  if (driver === 'cloudinary') {
//    const { v2: cloudinary } = await import('cloudinary');
//    configureCloudinary(cloudinary);
//    await cloudinary.uploader.destroy(publicId, { resource_type: 'auto' });
//    return;
//  }
  // local: publicId is a path relative to uploads root
//  const abs = path.join(UPLOAD_ROOT, publicId);
//  if (abs.startsWith(UPLOAD_ROOT) && fs.existsSync(abs)) fs.unlinkSync(abs);
//}

// ---------- local driver ----------
//function uploadToLocal(buffer, folder, originalName) {
//  const dir = path.join(UPLOAD_ROOT, folder);
//  fs.mkdirSync(dir, { recursive: true });
//  const ext = path.extname(originalName) || '';
//  const base = path
//    .basename(originalName, ext)
//    .replace(/[^a-zA-Z0-9-_]/g, '_')
//    .slice(0, 40);
//  const unique = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
//  const filename = `${base || 'file'}-${unique}${ext}`;
//  const relPath = path.posix.join(folder, filename);
//  fs.writeFileSync(path.join(dir, filename), buffer);
//  return {
//    url: `/uploads/${relPath}`, // served statically by express
//    publicId: relPath,
//  };
//}

// ---------- cloudinary driver ----------
//function configureCloudinary(cloudinary) {
//  cloudinary.config({
//    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//    api_key: process.env.CLOUDINARY_API_KEY,
//    api_secret: process.env.CLOUDINARY_API_SECRET,
//  });
//}

//async function uploadToCloudinary(buffer, folder, originalName) {
//   const { v2: cloudinary } = await import('cloudinary');
//   configureCloudinary(cloudinary);
//   return new Promise((resolve, reject) => {
//     const stream = cloudinary.uploader.upload_stream(
//       { folder: `dmm/${folder}`, resource_type: 'auto', public_id: path.parse(originalName).name },
//       (err, result) => {
//         if (err) return reject(err);
//         resolve({ url: result.secure_url, publicId: result.public_id });
//       }
//     );
//     stream.end(buffer);
//   });
// }

// export { uploadBuffer, deleteFile, driver, UPLOAD_ROOT };
// Storage abstraction
// Supports:
// 1. Local NAS Storage (TrueNAS NFS)
// 2. Cloudinary
//
// Change in .env
// STORAGE_DRIVER=local
// STORAGE_DRIVER=cloudinary

import fs from "fs";
import path from "path";
import crypto from "crypto";

// Root NAS mount point
const STORAGE_ROOT = process.env.STORAGE_ROOT || "/mnt/tag-storage";

// Driver
const driver = (process.env.STORAGE_DRIVER || "local").toLowerCase();

/**
 * Upload buffer
 * opts:
 * {
 *    module: "Templates",
 *    folder: "Placement 2026",
 *    originalName: "banner.jpg"
 * }
 */
async function uploadBuffer(
  buffer,
  {
    module = "Temp",
    folder = "",
    originalName = "file"
  }
) {
  if (driver === "cloudinary") {
    return uploadToCloudinary(buffer, module, folder, originalName);
  }

  return uploadToLocal(buffer, module, folder, originalName);
}

/**
 * Delete file
 */
async function deleteFile(publicId) {

  if (!publicId) return;

  if (driver === "cloudinary") {

    const { v2: cloudinary } = await import("cloudinary");

    configureCloudinary(cloudinary);

    await cloudinary.uploader.destroy(publicId, {
      resource_type: "auto"
    });

    return;
  }

  const filePath = path.join(STORAGE_ROOT, publicId);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * Create Folder
 */
function createFolder(moduleName, folderName) {

  const folderPath = path.join(
    STORAGE_ROOT,
    moduleName,
    folderName
  );

  fs.mkdirSync(folderPath, {
    recursive: true
  });

  return folderPath;
}

/**
 * Delete Folder
 */
function deleteFolder(moduleName, folderName) {

  const folderPath = path.join(
    STORAGE_ROOT,
    moduleName,
    folderName
  );

  if (fs.existsSync(folderPath)) {
    fs.rmSync(folderPath, {
      recursive: true,
      force: true
    });
  }
}

/**
 * List Files
 */
function listFiles(moduleName, folderName = "") {

  const folderPath = path.join(
    STORAGE_ROOT,
    moduleName,
    folderName
  );

  if (!fs.existsSync(folderPath)) {
    return [];
  }

  return fs.readdirSync(folderPath);
}

/**
 * LOCAL DRIVER (TrueNAS)
 */
function uploadToLocal(
  buffer,
  moduleName,
  folderName,
  originalName
) {

  const dir = path.join(
    STORAGE_ROOT,
    moduleName,
    folderName
  );

  fs.mkdirSync(dir, {
    recursive: true
  });

  const ext = path.extname(originalName);

  const base = path
    .basename(originalName, ext)
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .slice(0, 40);

  const unique = crypto.randomBytes(5).toString("hex");

  const filename = `${base}-${Date.now()}-${unique}${ext}`;

  const fullPath = path.join(dir, filename);

  fs.writeFileSync(fullPath, buffer);

  return {

    url: `/api/files/${moduleName}/${folderName}/${filename}`,

    publicId: path.join(
      moduleName,
      folderName,
      filename
    ),

    fullPath
  };
}

/**
 * Cloudinary
 */
function configureCloudinary(cloudinary) {

  cloudinary.config({

    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,

    api_key: process.env.CLOUDINARY_API_KEY,

    api_secret: process.env.CLOUDINARY_API_SECRET

  });

}

async function uploadToCloudinary(
  buffer,
  moduleName,
  folderName,
  originalName
) {

  const { v2: cloudinary } = await import("cloudinary");

  configureCloudinary(cloudinary);

  return new Promise((resolve, reject) => {

    const stream = cloudinary.uploader.upload_stream(

      {

        folder: `TAG/${moduleName}/${folderName}`,

        resource_type: "auto",

        public_id: path.parse(originalName).name

      },

      (err, result) => {

        if (err) return reject(err);

        resolve({

          url: result.secure_url,

          publicId: result.public_id

        });

      }

    );

    stream.end(buffer);

  });

}

export {
  uploadBuffer,
  deleteFile,
  createFolder,
  deleteFolder,
  listFiles,
  driver,
  STORAGE_ROOT
};