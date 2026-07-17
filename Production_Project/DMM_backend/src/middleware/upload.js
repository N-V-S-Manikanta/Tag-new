import multer from 'multer';

// We keep files in memory and hand the buffer to the storage driver
// (local disk or Cloudinary). This keeps the upload code driver-agnostic.
const storage = multer.memoryStorage();

const ALLOWED = {
  image: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/svg+xml'],
  video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska', 'video/ogg', 'video/x-m4v'],
  doc: [
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/postscript', // .ai
    'image/vnd.adobe.photoshop', // .psd
    'application/octet-stream', // some .psd/.ai/.xlsx come through as this
  ],
  sheet: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv', // .csv
  ],
};

const fileFilter = (req, file, cb) => {
  const all = [...ALLOWED.image, ...ALLOWED.video, ...ALLOWED.doc, ...ALLOWED.sheet];
  if (all.includes(file.mimetype)) return cb(null, true);
  cb(new Error(`Unsupported file type: ${file.mimetype}`));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB (videos are larger than images)
});

export default upload;
