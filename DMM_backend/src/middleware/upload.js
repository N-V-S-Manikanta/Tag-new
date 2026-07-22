import multer from 'multer';

// We keep files in memory and hand the buffer to the storage driver
// (local disk or Cloudinary). This keeps the upload code driver-agnostic.
const storage = multer.memoryStorage();

const ALLOWED_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.svg',
  '.mp4',
  '.webm',
  '.mov',
  '.mkv',
  '.ogv',
  '.m4v',
  '.pdf',
  '.ppt',
  '.pptx',
  '.ai',
  '.psd',
  '.xlsx',
  '.xls',
  '.csv',
]);

const ALLOWED = {
  image: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/svg+xml'],
  video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska', 'video/ogg', 'video/x-m4v'],
  doc: [
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/postscript', // .ai
    'image/vnd.adobe.photoshop', // .psd
    'application/illustrator',
    'application/eps',
    'application/photoshop',
    'application/x-photoshop',
    'image/x-photoshop',
    'application/octet-stream', // some .psd/.ai/.xlsx come through as this
  ],
  sheet: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv', // .csv
    'application/csv',
    'text/plain',
  ],
};

const allowedMimeTypes = new Set([...ALLOWED.image, ...ALLOWED.video, ...ALLOWED.doc, ...ALLOWED.sheet]);

const getExtension = (filename = '') => {
  const dotIndex = filename.lastIndexOf('.');
  return dotIndex >= 0 ? filename.slice(dotIndex).toLowerCase() : '';
};

const fileFilter = (req, file, cb) => {
  const extension = getExtension(file.originalname);
  if (allowedMimeTypes.has(file.mimetype) || ALLOWED_EXTENSIONS.has(extension)) return cb(null, true);
  cb(new Error(`Unsupported file type: ${file.mimetype}`));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB (videos are larger than images)
});

export default upload;
