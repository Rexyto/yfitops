import multer from 'multer';
import path from 'path';
import { CANCIONES_DIR, AUDIO_EXTS } from './config.js';

const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, CANCIONES_DIR),
  filename: (req, file, cb) => {
    const decodedName = decodeURIComponent(file.originalname);
    cb(null, `${Date.now()}-${decodedName}`);
  }
});

export const upload = multer({
  storage: audioStorage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    AUDIO_EXTS.includes(ext) ? cb(null, true) : cb(new Error('Solo audio'));
  }
});

const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, CANCIONES_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${req.params.id}${ext}`);
  }
});

export const uploadImage = multer({ storage: imageStorage });
