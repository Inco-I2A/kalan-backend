// src/services/index.js
// =====================

const AuthService = require('./authService');
const GamificationService = require('./gamificationService');
const OCRService = require('./ocrService');
const AvatarService = require('./avatarService');

module.exports = {
    AuthService,
    GamificationService,
    OCRService,
    AvatarService
};