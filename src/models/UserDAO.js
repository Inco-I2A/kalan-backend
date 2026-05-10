// src/models/UserDAO.js
// =====================
// Gestion des utilisateurs (élèves)

const { get, all, run } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class UserDAO {
    
    static get LEVELS() {
        return [
            { name: 'Graine', min: 0, color: '#8B4513' },
            { name: 'Pousse', min: 100, color: '#228B22' },
            { name: 'Baobab', min: 300, color: '#2E8B57' },
            { name: 'Feu de brousse', min: 600, color: '#FF4500' },
            { name: 'Griot', min: 1000, color: '#FFD700' },
            { name: 'Masque', min: 1500, color: '#4B0082' },
            { name: 'Ancêtre', min: 2200, color: '#8B0000' },
            { name: 'Sage', min: 3000, color: '#1E90FF' }
        ];
    }
    
    static getLevelInfo(level) {
        const levels = this.LEVELS;
        const info = levels[Math.min(level - 1, levels.length - 1)];
        const nextLevel = levels[Math.min(level, levels.length - 1)];
        
        return {
            ...info,
            next_level_name: nextLevel?.name || 'Max',
            next_level_min: nextLevel?.min || null,
            progress: 0 // Calculé dynamiquement
        };
    }
    
    static async create({ firstName, lastName, pseudo, school_id, class_id }) {
        if (!firstName || firstName.length < 2) {
            throw new Error('Le prénom doit contenir au moins 2 caractères');
        }
        if (!lastName || lastName.length < 2) {
            throw new Error('Le nom doit contenir au moins 2 caractères');
        }
        if (!pseudo || pseudo.length < 2) {
            throw new Error('Le pseudo doit contenir au moins 2 caractères');
        }
        if (!school_id || !class_id) {
            throw new Error('L\'école et la classe sont obligatoires');
        }
        
        const uuid = uuidv4();
        
        const result = await run(
            `INSERT INTO users (uuid, firstName, lastName, pseudo, school_id, class_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [uuid, firstName, lastName, pseudo, school_id, class_id]
        );
        
        return this.findById(result.lastID);
    }
    
    static async findById(id) {
        return get(
            `SELECT u.*, s.name as school_name, c.name as class_name
             FROM users u
             LEFT JOIN schools s ON u.school_id = s.id
             LEFT JOIN classes c ON u.class_id = c.id
             WHERE u.id = ?`,
            [id]
        );
    }
    
    static async findByUuid(uuid) {
        return get(
            `SELECT u.*, s.name as school_name, c.name as class_name
             FROM users u
             LEFT JOIN schools s ON u.school_id = s.id
             LEFT JOIN classes c ON u.class_id = c.id
             WHERE u.uuid = ? AND u.is_active = 1`,
            [uuid]
        );
    }
    
    static async findByPseudo(pseudo) {
        return get(
            `SELECT u.*, s.name as school_name, c.name as class_name
             FROM users u
             LEFT JOIN schools s ON u.school_id = s.id
             LEFT JOIN classes c ON u.class_id = c.id
             WHERE u.pseudo = ? AND u.is_active = 1`,
            [pseudo]
        );
    }
    
    static async findAll({ limit = 50, offset = 0, school_id = null, class_id = null, order_by = 'created_at', order_dir = 'DESC' }) {
        let sql = `
            SELECT u.*, s.name as school_name, c.name as class_name
            FROM users u
            LEFT JOIN schools s ON u.school_id = s.id
            LEFT JOIN classes c ON u.class_id = c.id
            WHERE u.is_active = 1
        `;
        const params = [];
        
        if (school_id) {
            sql += ' AND u.school_id = ?';
            params.push(school_id);
        }
        
        if (class_id) {
            sql += ' AND u.class_id = ?';
            params.push(class_id);
        }
        
        sql += ` ORDER BY u.${order_by} ${order_dir} LIMIT ? OFFSET ?`;
        params.push(limit, offset);
        
        return all(sql, params);
    }
    
    static async addPoints(uuid, points) {
        const user = await this.findByUuid(uuid);
        if (!user) throw new Error('Utilisateur non trouvé');
        
        const newTotal = (user.total_points || 0) + points;
        const newXp = (user.xp || 0) + points;
        
        // Calculer le niveau
        let newLevel = 1;
        for (let i = this.LEVELS.length - 1; i >= 0; i--) {
            if (newXp >= this.LEVELS[i].min) {
                newLevel = i + 1;
                break;
            }
        }
        
        await run(
            `UPDATE users 
             SET total_points = ?, xp = ?, level = ?, updated_at = datetime('now')
             WHERE uuid = ?`,
            [newTotal, newXp, newLevel, uuid]
        );
        
        return this.findByUuid(uuid);
    }
    
    static async updateStreak(uuid) {
        const user = await this.findByUuid(uuid);
        if (!user) throw new Error('Utilisateur non trouvé');
        
        const lastActive = user.last_active ? new Date(user.last_active) : null;
        const now = new Date();
        let newStreak = user.streak_days || 0;
        
        if (lastActive) {
            const diffDays = Math.floor((now - lastActive) / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
                newStreak += 1;
            } else if (diffDays > 1) {
                newStreak = 1; // Reset
            }
        } else {
            newStreak = 1;
        }
        
        await run(
            `UPDATE users 
             SET streak_days = ?, last_active = datetime('now')
             WHERE uuid = ?`,
            [newStreak, uuid]
        );
        
        return this.findByUuid(uuid);
    }
    
    static async updateAvatar(uuid, svg, seed) {
        await run(
            `UPDATE users SET avatar_svg = ?, avatar_seed = ?, updated_at = datetime('now') WHERE uuid = ?`,
            [svg, seed, uuid]
        );
        return this.findByUuid(uuid);
    }
    
    static async updateProfile(uuid, fields) {
        const allowed = ['firstName', 'lastName', 'pseudo', 'language_pref'];
        const updates = [];
        const values = [];
        
        for (const [key, value] of Object.entries(fields)) {
            if (allowed.includes(key)) {
                updates.push(`${key} = ?`);
                values.push(value);
            }
        }
        
        if (updates.length === 0) return null;
        
        values.push(uuid);
        
        await run(
            `UPDATE users SET ${updates.join(', ')}, updated_at = datetime('now') WHERE uuid = ?`,
            values
        );
        
        return this.findByUuid(uuid);
    }
    
    static async getStats(uuid) {
        const user = await this.findByUuid(uuid);
        if (!user) return null;
        
        const stats = await get(
            `SELECT 
                (SELECT COUNT(*) FROM decks WHERE user_id = ?) as deck_count,
                (SELECT COUNT(*) FROM flashcards WHERE user_id = ?) as flashcard_count,
                (SELECT COUNT(*) FROM quizzes WHERE user_id = ? AND status = 'completed') as quiz_count,
                (SELECT SUM(score) FROM quizzes WHERE user_id = ? AND status = 'completed') as total_score`,
            [user.id, user.id, user.id, user.id]
        );
        
        const badges = await all(
            `SELECT badge_id, unlocked_at FROM user_badges WHERE user_id = ?`,
            [user.id]
        );
        
        return {
            ...user,
            ...stats,
            level_info: this.getLevelInfo(user.level),
            badges
        };
    }
    
    static async delete(uuid) {
        // Soft delete
        await run(
            `UPDATE users SET is_active = 0, updated_at = datetime('now') WHERE uuid = ?`,
            [uuid]
        );
        return true;
    }
}

module.exports = UserDAO;