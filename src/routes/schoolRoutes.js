// src/routes/schoolRoutes.js
// ==========================
// Écoles et classes (données de référence)

const express = require('express');
const router = express.Router();
const { SchoolDAO } = require('../models');

/**
 * @swagger
 * tags:
 *   name: Écoles
 *   description: Gestion des écoles et classes du Burkina Faso
 */

/**
 * @swagger
 * /api/schools:
 *   get:
 *     summary: Liste des écoles
 *     tags: [Écoles]
 */
router.get('/', async (req, res, next) => {
    try {
        const { search, limit = 50, offset = 0 } = req.query;
        
        const schools = await SchoolDAO.findAllSchools({
            search: search || null,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        res.json({
            success: true,
            count: schools.length,
            schools
        });
        
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/schools:
 *   post:
 *     summary: Créer une école
 *     tags: [Écoles]
 */
router.post('/', async (req, res, next) => {
    try {
        const { name, region, city, type } = req.body;
        
        const school = await SchoolDAO.createSchool({
            name,
            region: region || '',
            city: city || '',
            type: type || 'public'
        });
        
        res.status(201).json({
            success: true,
            school
        });
        
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/schools/{id}:
 *   get:
 *     summary: Détail d'une école
 *     tags: [Écoles]
 */
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const school = await SchoolDAO.findSchoolById(parseInt(id));
        
        if (!school) {
            return res.status(404).json({
                success: false,
                error: 'École non trouvée'
            });
        }
        
        const classes = await SchoolDAO.findClassesBySchool(parseInt(id));
        
        res.json({
            success: true,
            school: {
                ...school,
                classes
            }
        });
        
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/schools/{id}/classes:
 *   get:
 *     summary: Classes d'une école
 *     tags: [Écoles]
 */
router.get('/:id/classes', async (req, res, next) => {
    try {
        const { id } = req.params;
        const classes = await SchoolDAO.findClassesBySchool(parseInt(id));
        
        res.json({
            success: true,
            count: classes.length,
            classes
        });
        
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/schools/{id}/classes:
 *   post:
 *     summary: Créer une classe
 *     tags: [Écoles]
 */
router.post('/:id/classes', async (req, res, next) => {
    try {
        const schoolId = parseInt(req.params.id);
        const { name, level } = req.body;
        
        const classe = await SchoolDAO.createClass({
            school_id: schoolId,
            name,
            level: level || 'college'
        });
        
        res.status(201).json({
            success: true,
            class: classe
        });
        
    } catch (err) {
        next(err);
    }
});

module.exports = router;