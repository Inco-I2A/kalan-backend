// src/middleware/index.js
// =======================

const { authMiddleware, optionalAuth } = require('./authMiddleware');

module.exports = {
    authMiddleware,
    optionalAuth
};