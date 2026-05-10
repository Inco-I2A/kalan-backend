// src/routes/deckRoutes.js
// ========================
// Gestion des decks et flashcards — ROUTES PROTÉGÉES

const express = require('express');
const router = express.Router();
const { DeckDAO, FlashcardDAO, UserDAO } = require('../models');
const { GamificationService } = require('../services');
const { authMiddleware } = require('../middleware');

/**
 * @swagger
 * tags:
 *   name: Decks
 *   description: Gestion des paquets de flashcards (decks)
 */

/**
 * @swagger
 * /api/decks:
 *   get:
 *     summary: Mes decks
 *     tags: [Decks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des decks
 */
router.get('/', authMiddleware, async (req, res, next) => {
    try {
        const { uuid } = req.user;
        
        const user = await UserDAO.findByUuid(uuid);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Utilisateur non trouvé'
            });
        }
        
        const decks = await DeckDAO.findByUser(user.id);
        
        res.json({
            success: true,
            count: decks.length,
            decks
        });
        
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/decks/public:
 *   get:
 *     summary: Bibliothèque publique
 *     tags: [Decks]
 *     responses:
 *       200:
 *         description: Decks publics
 */
router.get('/public', async (req, res, next) => {
    try {
        const { category, search, limit = 20, offset = 0 } = req.query;
        
        const decks = await DeckDAO.findPublic({
            category: category || null,
            search: search || null,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        res.json({
            success: true,
            count: decks.length,
            decks
        });
        
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/decks:
 *   post:
 *     summary: Créer un deck
 *     tags: [Decks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               is_public:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Deck créé
 */
router.post('/', authMiddleware, async (req, res, next) => {
    try {
        const { uuid } = req.user;
        const { title, description, category, is_public } = req.body;
        
        const user = await UserDAO.findByUuid(uuid);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Utilisateur non trouvé'
            });
        }
        
        const deck = await DeckDAO.create({
            user_id: user.id,
            title,
            description: description || '',
            category: category || '',
            is_public: is_public || false
        });
        
        res.status(201).json({
            success: true,
            deck
        });
        
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/decks/{uuid}:
 *   get:
 *     summary: Détail d'un deck avec ses cartes
 *     tags: [Decks]
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deck trouvé
 */
router.get('/:uuid', async (req, res, next) => {
    try {
        const { uuid } = req.params;
        
        const deck = await DeckDAO.findByUuid(uuid);
        
        if (!deck) {
            return res.status(404).json({
                success: false,
                error: 'Deck non trouvé'
            });
        }
        
        const cards = await FlashcardDAO.findByDeck(deck.id);
        
        res.json({
            success: true,
            deck: {
                ...deck,
                cards
            }
        });
        
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/decks/{uuid}/quiz-ready:
 *   get:
 *     summary: Vérifier si le deck a assez de flashcards pour un quiz
 *     tags: [Decks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Statut du quiz
 */
router.get('/:uuid/quiz-ready', authMiddleware, async (req, res, next) => {
    try {
        const { uuid } = req.params;
        const deck = await DeckDAO.findByUuid(uuid);
        
        if (!deck) {
            return res.status(404).json({
                success: false,
                error: 'Deck non trouvé'
            });
        }
        
        const cards = await FlashcardDAO.findByDeck(deck.id);
        const canQuiz = cards.length >= 20;
        const questionCount = canQuiz ? Math.floor(cards.length / 10) : 0;
        
        res.json({
            success: true,
            deck_uuid: uuid,
            card_count: cards.length,
            can_start_quiz: canQuiz,
            min_required: 20,
            questions_available: questionCount,
            message: canQuiz 
                ? `Quiz disponible : ${questionCount} questions (1 par tranche de 10 flashcards)`
                : `Il faut encore ${20 - cards.length} flashcards pour débloquer le quiz`
        });
        
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/decks/{uuid}/cards:
 *   post:
 *     summary: Ajouter une flashcard
 *     tags: [Decks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [front, back]
 *             properties:
 *               front:
 *                 type: string
 *               back:
 *                 type: string
 *               category:
 *                 type: string
 *               difficulty:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Flashcard créée
 */
router.post('/:uuid/cards', authMiddleware, async (req, res, next) => {
    try {
        const deckUuid = req.params.uuid;
        const userUuid = req.user.uuid;
        const { front, back, category, difficulty } = req.body;
        
        const user = await UserDAO.findByUuid(userUuid);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Utilisateur non trouvé'
            });
        }
        
        const deck = await DeckDAO.findByUuid(deckUuid);
        
        if (!deck) {
            return res.status(404).json({
                success: false,
                error: 'Deck non trouvé'
            });
        }
        
        const card = await FlashcardDAO.create({
            user_id: user.id,
            deck_id: deck.id,
            front,
            back,
            category: category || '',
            difficulty: difficulty || 1
        });
        
        try {
            await GamificationService.addPoints(userUuid, 'flashcard_create');
        } catch (pointsErr) {
            console.warn('Points non attribués:', pointsErr.message);
        }
        
        res.status(201).json({
            success: true,
            card
        });
        
    } catch (err) {
        next(err);
    }
});

module.exports = router;