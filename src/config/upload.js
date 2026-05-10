// src/config/upload.js
// ====================
// Configuration Multer pour upload fichiers (PDF, images)

const multer = require('multer');

// Stockage temporaire en mémoire (pour traitement OCR direct)
const storage = multer.memoryStorage();

// Filtre : PDF et images uniquement (MulterError → handler HTTP 400 dans app.js)
const fileFilter = (req, file, cb) => {
    const allowedMimes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp'
    ];

    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname);
        err.message = 'Format non supporte. Utilisez : PDF, JPG, PNG, WEBP';
        cb(err, false);
    }
};

// Limite : 10 Mo par fichier, max 5 fichiers
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10 Mo
        files: 5
    }
});

module.exports = upload;