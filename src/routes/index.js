// src/routes/index.js
// ===================

const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const schoolRoutes = require('./schoolRoutes');
const deckRoutes = require('./deckRoutes');
const quizRoutes = require('./quizRoutes');
const ocrRoutes = require('./ocrRoutes');

module.exports = {
    authRoutes,
    userRoutes,
    schoolRoutes,
    deckRoutes,
    quizRoutes,
    ocrRoutes
};