// src/config/swagger.js
// =====================
// Configuration Swagger/OpenAPI pour KALAN

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'KALAN API',
            version: '1.1.0',
            description: `
🎓 **KALAN** — Application de flashcards pour l'éducation au Burkina Faso

## Fonctionnalités
- 📚 Création de flashcards avec OCR (photos de manuels)
- 🎯 Quiz auto-générés à partir des decks
- 🏆 Système de points et niveaux (Graine → Sage)
- 📡 Partage Bluetooth offline entre élèves
- 🌍 Support multilingue (Français, Mooré, Dioula, Fulfuldé)

## Authentification
Toutes les routes protégées nécessitent un header :
\`Authorization: Bearer <token_jwt>\`

## Contexte
- **Cible** : Élèves du Burkina Faso (collège/lycée)
- **Contrainte** : Fonctionne offline avec sync périodique
- **Device** : Android 2-4 Go RAM, app < 150 Mo
            `,
            contact: {
                name: 'Équipe KALAN',
                email: 'contact@kalan.bf'
            },
            license: {
                name: 'MIT',
                url: 'https://opensource.org/licenses/MIT'
            }
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Serveur de développement'
            },
            {
                url: 'https://api.kalan.bf',
                description: 'Serveur de production'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
            },
            schemas: {
                User: {
                    type: 'object',
                    properties: {
                        uuid: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
                        firstName: { type: 'string', example: 'Aminata' },
                        lastName: { type: 'string', example: 'Ouédraogo' },
                        pseudo: { type: 'string', example: 'Amina2024' },
                        level: { type: 'integer', example: 1, description: '1=Graine, 2=Pousse, 3=Baobab...' },
                        xp: { type: 'integer', example: 150 },
                        total_points: { type: 'integer', example: 150 },
                        school_name: { type: 'string', example: 'Lycée Technique de Ouagadougou' },
                        class_name: { type: 'string', example: 'Terminale S' },
                        avatar: { type: 'string', description: 'SVG avatar' }
                    }
                },
                School: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        name: { type: 'string', example: 'Lycée Saint Jean-Baptiste' },
                        city: { type: 'string', example: 'Bobo-Dioulasso' },
                        region: { type: 'string', example: 'Hauts-Bassins' },
                        type: { type: 'string', example: 'public' }
                    }
                },
                Class: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        name: { type: 'string', example: 'Terminale S' },
                        level: { type: 'string', example: 'lycee' },
                        student_count: { type: 'integer', example: 45 }
                    }
                },
                Deck: {
                    type: 'object',
                    properties: {
                        uuid: { type: 'string' },
                        title: { type: 'string', example: 'Mathématiques - Chapitre 3' },
                        description: { type: 'string' },
                        category: { type: 'string', example: 'Mathématiques' },
                        is_public: { type: 'boolean', example: false },
                        card_count: { type: 'integer', example: 12 },
                        download_count: { type: 'integer', example: 5 }
                    }
                },
                Flashcard: {
                    type: 'object',
                    properties: {
                        uuid: { type: 'string' },
                        front: { type: 'string', example: 'Quelle est la capitale du Burkina Faso ?' },
                        back: { type: 'string', example: 'Ouagadougou' },
                        category: { type: 'string' },
                        difficulty: { type: 'integer', example: 1 },
                        mastery_level: { type: 'integer', example: 0, description: '0-5, SRS' }
                    }
                },
                Quiz: {
                    type: 'object',
                    properties: {
                        uuid: { type: 'string' },
                        score: { type: 'integer', example: 85 },
                        total_questions: { type: 'integer', example: 10 },
                        correct_answers: { type: 'integer', example: 8 },
                        status: { type: 'string', example: 'passed', enum: ['passed', 'partial', 'failed'] }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        error: { type: 'string', example: 'Message d\'erreur' }
                    }
                }
            }
        }
    },
    apis: [
        './src/routes/*.js',
        './src/app.js'
    ]
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;