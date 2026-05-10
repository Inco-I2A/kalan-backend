// src/routes/authRoutes.js
// ========================
// Routes d'authentification (inscription, connexion)

const express = require('express');
const router = express.Router();
const AuthService = require('../services/authService'); // ← Import direct

/**
 * @swagger
 * tags:
 *   name: Authentification
 *   description: Inscription et connexion des élèves (anonyme, sans mot de passe)
 */

router.post('/register', async (req, res, next) => {
    try {
        const { firstName, lastName, pseudo, school_id, class_id, uuid } = req.body;
        
        const result = await AuthService.register({
            firstName, lastName, pseudo, school_id, class_id, uuid
        });
        
        const statusCode = result.isNew ? 201 : 200;
        res.status(statusCode).json(result);
        
    } catch (err) {
        next(err);
    }
});

router.post('/login', async (req, res, next) => {
    try {
        const { uuid } = req.body;
        
        const result = await AuthService.loginByUuid(uuid);
        res.json(result);
        
    } catch (err) {
        next(err);
    }
});

router.post('/refresh', async (req, res, next) => {
    try {
        const { token } = req.body;
        
        const newToken = await AuthService.refreshToken(token);
        res.json({
            success: true,
            token: newToken
        });
        
    } catch (err) {
        next(err);
    }
});

module.exports = router;