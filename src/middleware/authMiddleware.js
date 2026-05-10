// src/middleware/authMiddleware.js
// ================================
// Vérification JWT pour protéger les routes

const { AuthService } = require('../services');

const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                error: 'Token manquant. Veuillez vous connecter.'
            });
        }
        
        const parts = authHeader.split(' ');
        
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return res.status(401).json({
                success: false,
                error: 'Format de token invalide. Utilisez : Bearer <token>'
            });
        }
        
        const token = parts[1];
        const decoded = AuthService.verifyToken(token);
        req.user = decoded;
        
        next();
        
    } catch (err) {
        return res.status(401).json({
            success: false,
            error: err.message
        });
    }
};

const optionalAuth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (authHeader) {
            const parts = authHeader.split(' ');
            if (parts.length === 2 && parts[0] === 'Bearer') {
                const decoded = AuthService.verifyToken(parts[1]);
                req.user = decoded;
            }
        }
        
        next();
    } catch (err) {
        next();
    }
};

module.exports = { authMiddleware, optionalAuth };