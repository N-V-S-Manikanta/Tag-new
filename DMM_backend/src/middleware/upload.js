import multer from 'multer';

// We keep files in memory and hand the buffer to the storage driver
// (local disk or Cloudinary). This keeps the upload code driver-agnostic.
const storage = multer.memoryStorage();

const ALLOWED = {
  image: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/svg+xml'],
  doc: [
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/postscript', // .ai
    'image/vnd.adobe.photoshop', // .psd
    'application/octet-stream', // some .psd/.ai come through as this
  ],
};

const fileFilter = (req, file, cb) => {
  const all = [...ALLOWED.image, ...ALLOWED.doc];
  if (all.includes(file.mimetype)) return cb(null, true);
  cb(new Error(`Unsupported file type: ${file.mimetype}`));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

export default upload;
