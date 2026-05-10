// src/app.js
// ==========
// Configuration Express — KALAN Backend

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
require('dotenv').config();

const multer = require('multer');
const { authRoutes, userRoutes, schoolRoutes, deckRoutes, quizRoutes, ocrRoutes } = require('./routes');

const app = express();

// ============================================
// 1. MIDDLEWARES DE SÉCURITÉ
// ============================================

app.use(helmet());
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-User-UUID']
}));
app.use(compression());

// ============================================
// 2. MIDDLEWARES DE PARSING
// ============================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================
// 3. RATE LIMITING
// ============================================

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'test' ? 99999 : 100, // ← Désactivé en test
    message: {
        success: false,
        error: 'Trop de requêtes. Veuillez réessayer plus tard.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/', generalLimiter);

// ============================================
// 4. SWAGGER UI — Documentation API
// ============================================

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'KALAN API Documentation'
}));

app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
});

// ============================================
// 5. ROUTES
// ============================================

app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'KALAN API est opérationnelle ! 🚀',
        version: '1.1.0',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
    });
});

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Bienvenue sur KALAN API',
        endpoints: {
            health: '/health',
            auth: '/api/auth',
            users: '/api/users',
            schools: '/api/schools',
            decks: '/api/decks',
            quizzes: '/api/quizzes',
            ocr: '/api/ocr'
        }
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/decks', deckRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/ocr', ocrRoutes);

// ============================================
// 6. GESTION DES ERREURS
// ============================================

app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        error: 'Route non trouvée',
        path: req.path,
        method: req.method
    });
});

app.use((err, req, res, next) => {
    console.error('❌ Erreur serveur:', err);

    if (err instanceof multer.MulterError) {
        return res.status(400).json({
            success: false,
            error: err.message || 'Fichier invalide'
        });
    }

    const isDev = process.env.NODE_ENV === 'development';

    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Erreur interne du serveur',
        ...(isDev && { stack: err.stack })
    });
});

module.exports = app;