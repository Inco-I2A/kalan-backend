// src/models/DeckDAO.js
// =====================
// Gestion des decks (paquets de flashcards)

const { get, all, run } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class DeckDAO {
    
    static async create({ user_id, title, description = '', category = '', is_public = false }) {
        const uuid = uuidv4();
        
        const result = await run(
            `INSERT INTO decks (uuid, user_id, title, description, category, is_public)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [uuid, user_id, title, description, category, is_public ? 1 : 0]
        );
        
        return this.findById(result.lastID);
    }
    
    static async findById(id) {
        return get(
            `SELECT d.*, u.firstName as author_firstName, u.lastName as author_lastName, u.pseudo as author_pseudo
             FROM decks d
             LEFT JOIN users u ON d.user_id = u.id
             WHERE d.id = ?`,
            [id]
        );
    }
    
    static async findByUuid(uuid) {
        return get(
            `SELECT d.*, u.firstName as author_firstName, u.lastName as author_lastName, u.pseudo as author_pseudo
             FROM decks d
             LEFT JOIN users u ON d.user_id = u.id
             WHERE d.uuid = ?`,
            [uuid]
        );
    }
    
    static async findByUser(userId) {
        return all(
            `SELECT d.*, 
                (SELECT COUNT(*) FROM flashcards WHERE deck_id = d.id) as card_count
             FROM decks d
             WHERE d.user_id = ?
             ORDER BY d.updated_at DESC`,
            [userId]
        );
    }
    
    static async findPublic({ category = null, search = null, limit = 20, offset = 0 }) {
        let sql = `
            SELECT d.*, u.pseudo as author_pseudo, u.firstName as author_firstName,
                (SELECT COUNT(*) FROM flashcards WHERE deck_id = d.id) as card_count
            FROM decks d
            LEFT JOIN users u ON d.user_id = u.id
            WHERE d.is_public = 1
        `;
        const params = [];
        
        if (category) {
            sql += ' AND d.category = ?';
            params.push(category);
        }
        
        if (search) {
            sql += ' AND (d.title LIKE ? OR d.description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        
        sql += ' ORDER BY d.download_count DESC, d.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        
        return all(sql, params);
    }
    
    static async updateCardCount(deckId) {
        return run(
            'UPDATE decks SET card_count = (SELECT COUNT(*) FROM flashcards WHERE deck_id = ?) WHERE id = ?',
            [deckId, deckId]
        );
    }
    
    static async incrementDownloads(uuid) {
        return run(
            'UPDATE decks SET download_count = download_count + 1 WHERE uuid = ?',
            [uuid]
        );
    }
    
    static async update(uuid, fields) {
        const allowed = ['title', 'description', 'category', 'is_public'];
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
            `UPDATE decks SET ${updates.join(', ')}, updated_at = datetime('now') WHERE uuid = ?`,
            values
        );
        
        return this.findByUuid(uuid);
    }
    
    static async delete(uuid) {
        const result = await run('DELETE FROM decks WHERE uuid = ?', [uuid]);
        return result.changes > 0;
    }
}

module.exports = DeckDAO;