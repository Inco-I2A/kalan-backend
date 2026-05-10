// src/routes/ocrRoutes.js
// =======================
// Import PDF et Photos → OCR → Flashcards

const express = require('express');
const router = express.Router();
const upload = require('../config/upload');
const OCRService = require('../services/ocrService');
const { FlashcardDAO, DeckDAO, UserDAO } = require('../models');
const { GamificationService } = require('../services');
const { authMiddleware } = require('../middleware');

/**
 * @swagger
 * tags:
 *   name: OCR & Import
 *   description: Import de documents (PDF, photos) pour génération automatique de flashcards
 */

/**
 * @swagger
 * /api/ocr/import:
 *   post:
 *     summary: Importer un PDF ou des photos pour générer des flashcards
 *     tags: [OCR & Import]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [files]
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               deck_id:
 *                 type: string
 *               deck_title:
 *                 type: string
 *               category:
 *                 type: string
 *               max_cards:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Flashcards générées
 */
router.post('/import', 
    authMiddleware,
    upload.array('files', 5),
    async (req, res, next) => {
    
    try {
        const userUuid = req.user.uuid;
        const { deck_id, deck_title, category, max_cards = 20 } = req.body;
        
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Aucun fichier fourni. Envoyez des fichiers via le champ "files"'
            });
        }
        
        const user = await UserDAO.findByUuid(userUuid);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Utilisateur non trouvé'
            });
        }
        
        const hasPDF = req.files.some(f => f.mimetype === 'application/pdf');
        const hasImage = req.files.some(f => f.mimetype.startsWith('image/'));
        const sourceType = hasPDF && hasImage ? 'mixed' : (hasPDF ? 'pdf' : 'image');
        
        let allText = '';
        const fileStats = [];
        
        for (const file of req.files) {
            try {
                const text = await OCRService.extractText(file.buffer, file.mimetype);
                allText += ' ' + text;
                fileStats.push({
                    originalname: file.originalname,
                    mimetype: file.mimetype,
                    size: file.size,
                    textLength: text.length
                });
            } catch (err) {
                console.warn(`Erreur OCR pour ${file.originalname}:`, err.message);
                fileStats.push({
                    originalname: file.originalname,
                    mimetype: file.mimetype,
                    error: err.message
                });
            }
        }
        
        if (!allText.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Aucun texte extrait des fichiers. Vérifiez la qualité du document.'
            });
        }
        
        let deck;
        if (deck_id) {
            deck = await DeckDAO.findByUuid(deck_id);
            if (!deck) {
                return res.status(404).json({
                    success: false,
                    error: 'Deck non trouvé'
                });
            }
        } else {
            const title = deck_title || `Import ${sourceType.toUpperCase()} - ${new Date().toLocaleDateString('fr-FR')}`;
            deck = await DeckDAO.create({
                user_id: user.id,
                title,
                description: `Généré automatiquement depuis ${req.files.length} fichier(s) ${sourceType}`,
                category: category || '',
                is_public: false
            });
        }
        
        const cardData = await OCRService.generateFlashcards(allText, {
            maxCards: parseInt(max_cards),
            category: category || ''
        });
        
        const flashcards = [];
        for (const card of cardData) {
            try {
                const created = await FlashcardDAO.create({
                    user_id: user.id,
                    deck_id: deck.id,
                    front: card.front,
                    back: card.back,
                    category: card.category,
                    source_type: card.source_type
                });
                flashcards.push(created);
            } catch (err) {
                console.warn('Erreur création flashcard:', err.message);
            }
        }
        
        let pointsResult = null;
        try {
            pointsResult = await GamificationService.addPoints(userUuid, 'flashcard_create');
        } catch (pointsErr) {
            console.warn('Points non attribués:', pointsErr.message);
        }
        
        res.status(201).json({
            success: true,
            message: `${flashcards.length} flashcards générées depuis le ${sourceType.toUpperCase()}`,
            source_type: sourceType,
            deck: await DeckDAO.findByUuid(deck.uuid),
            flashcards,
            stats: {
                files_processed: req.files.length,
                files_details: fileStats,
                total_text_length: allText.length,
                cards_generated: flashcards.length,
                points: pointsResult
            }
        });
        
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/ocr/preview:
 *   post:
 *     summary: Prévisualiser l'extraction OCR
 *     tags: [OCR & Import]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Texte extrait
 */
router.post('/preview',
    authMiddleware,
    upload.single('file'),
    async (req, res, next) => {
    
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Aucun fichier fourni'
            });
        }
        
        const text = await OCRService.extractText(req.file.buffer, req.file.mimetype);
        const previewCards = await OCRService.generateFlashcards(text, { maxCards: 5 });
        
        res.json({
            success: true,
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            text_length: text.length,
            text_preview: text.substring(0, 500) + (text.length > 500 ? '...' : ''),
            preview_cards: previewCards
        });
        
    } catch (err) {
        next(err);
    }
});

module.exports = router;