// src/routes/userRoutes.js
// ========================
// Profil, stats, classement — ROUTES PROTÉGÉES

const express = require('express');
const router = express.Router();
const { UserDAO } = require('../models');
const { authMiddleware } = require('../middleware');

/**
 * @swagger
 * tags:
 *   name: Utilisateurs
 *   description: Profil, statistiques et classement des élèves
 */

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Mon profil complet
 *     tags: [Utilisateurs]
 *     security:
 *       - bearerAuth: []
 */
router.get('/me', authMiddleware, async (req, res, next) => {
    try {
        const { uuid } = req.user;
        
        const stats = await UserDAO.getStats(uuid);
        
        if (!stats) {
            return res.status(404).json({
                success: false,
                error: 'Utilisateur non trouvé'
            });
        }
        
        res.json({
            success: true,
            user: stats
        });
        
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/users/leaderboard:
 *   get:
 *     summary: Classement global
 *     tags: [Utilisateurs]
 */
router.get('/leaderboard', async (req, res, next) => {
    try {
        const { limit = 50, offset = 0, school_id, class_id } = req.query;
        
        const users = await UserDAO.findAll({
            limit: parseInt(limit),
            offset: parseInt(offset),
            school_id: school_id || null,
            class_id: class_id || null,
            order_by: 'total_points',
            order_dir: 'DESC'
        });
        
        res.json({
            success: true,
            count: users.length,
            users: users.map(u => ({
                uuid: u.uuid,
                pseudo: u.pseudo,
                firstName: u.firstName,
                lastName: u.lastName,
                level: u.level,
                total_points: u.total_points,
                school_name: u.school_name,
                class_name: u.class_name
            }))
        });
        
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/users/{uuid}/stats:
 *   get:
 *     summary: Stats publiques d'un utilisateur
 *     tags: [Utilisateurs]
 */
router.get('/:uuid/stats', async (req, res, next) => {
    try {
        const { uuid } = req.params;
        const stats = await UserDAO.getStats(uuid);
        
        if (!stats) {
            return res.status(404).json({
                success: false,
                error: 'Utilisateur non trouvé'
            });
        }
        
        const { total_points, xp, streak_days, ...publicStats } = stats;
        
        res.json({
            success: true,
            user: publicStats
        });
        
    } catch (err) {
        next(err);
    }
});

module.exports = router;