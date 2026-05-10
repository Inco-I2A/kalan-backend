// src/models/FlashcardDAO.js
// ==========================
// Gestion des flashcards (cartes de révision)

const { get, all, run } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class FlashcardDAO {
    
    static async create({ user_id, deck_id, front, back, category = '', difficulty = 1, source_type = 'manual' }) {
        const uuid = uuidv4();
        
        const result = await run(
            `INSERT INTO flashcards (uuid, user_id, deck_id, front, back, category, difficulty, source_type)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [uuid, user_id, deck_id, front, back, category, difficulty, source_type]
        );
        
        // Mettre à jour le compteur du deck directement en SQL (pas d'import DeckDAO)
        await run(
            `UPDATE decks 
             SET card_count = (SELECT COUNT(*) FROM flashcards WHERE deck_id = ?),
                 updated_at = datetime('now')
             WHERE id = ?`,
            [deck_id, deck_id]
        );
        
        return this.findById(result.lastID);
    }
    
    static async findById(id) {
        return get('SELECT * FROM flashcards WHERE id = ?', [id]);
    }
    
    static async findByUuid(uuid) {
        return get('SELECT * FROM flashcards WHERE uuid = ?', [uuid]);
    }
    
    static async findByDeck(deckId) {
        return all(
            'SELECT * FROM flashcards WHERE deck_id = ? ORDER BY created_at DESC',
            [deckId]
        );
    }
    
    static async findByUser(userId) {
        return all(
            'SELECT * FROM flashcards WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
    }
    
    static async markReviewed(flashcardId, isCorrect) {
        const card = await this.findById(flashcardId);
        if (!card) throw new Error('Flashcard non trouvée');
        
        let mastery = card.mastery_level || 0;
        
        if (isCorrect) {
            mastery = Math.min(5, mastery + 1);
        } else {
            mastery = Math.max(0, mastery - 1);
        }
        
        // Algorithme SRS simple : intervalle basé sur mastery
        const intervals = [1, 3, 7, 14, 30, 60]; // jours
        const days = intervals[mastery] || 1;
        const nextReview = new Date();
        nextReview.setDate(nextReview.getDate() + days);
        
        await run(
            `UPDATE flashcards 
             SET mastery_level = ?, review_count = review_count + 1, 
                 last_reviewed = datetime('now'), next_review = ?
             WHERE id = ?`,
            [mastery, nextReview.toISOString(), flashcardId]
        );
        
        return this.findById(flashcardId);
    }
    
    static async getTodayCount(userId) {
        const row = await get(
            `SELECT COUNT(*) as count FROM flashcards 
             WHERE user_id = ? AND date(created_at) = date('now')`,
            [userId]
        );
        return row ? row.count : 0;
    }
    
    static async getDueForReview(userId, deckId = null) {
        let sql = `
            SELECT * FROM flashcards 
             WHERE user_id = ? AND (next_review IS NULL OR next_review <= datetime('now'))
        `;
        const params = [userId];
        
        if (deckId) {
            sql += ' AND deck_id = ?';
            params.push(deckId);
        }
        
        sql += ' ORDER BY next_review ASC';
        
        return all(sql, params);
    }
    
    static async delete(uuid) {
        const card = await this.findByUuid(uuid);
        if (!card) return false;
        
        await run('DELETE FROM flashcards WHERE uuid = ?', [uuid]);
        
        // Mettre à jour le compteur du deck directement en SQL
        await run(
            `UPDATE decks 
             SET card_count = (SELECT COUNT(*) FROM flashcards WHERE deck_id = ?),
                 updated_at = datetime('now')
             WHERE id = ?`,
            [card.deck_id, card.deck_id]
        );
        
        return true;
    }
    
    static async update(uuid, fields) {
        const allowed = ['front', 'back', 'category', 'difficulty'];
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
            `UPDATE flashcards SET ${updates.join(', ')}, updated_at = datetime('now') WHERE uuid = ?`,
            values
        );
        
        return this.findByUuid(uuid);
    }
}

module.exports = FlashcardDAO;