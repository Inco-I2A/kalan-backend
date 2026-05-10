// src/models/QuizDAO.js

const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('../config/database');

class QuizDAO {
    // ... autres méthodes ...

    static async create({ user_id, title, type, status }) {
        const uuid = uuidv4();
        const result = await run(
            `INSERT INTO quizzes (uuid, user_id, title, type, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
            [uuid, user_id, title, type, status]
        );
        return this.findById(result.lastID);
    }

    // CORRECTION : plus de uuid dans quiz_questions
    static async addQuestion({ quiz_id, question, options, correct_answer, time_limit = 15 }) {
        const optionsJson = typeof options === 'string' ? options : JSON.stringify(options);
        
        const result = await run(
            `INSERT INTO quiz_questions (quiz_id, question, options, correct_answer, time_limit)
             VALUES (?, ?, ?, ?, ?)`,
            [quiz_id, question, optionsJson, correct_answer, time_limit]
        );
        
        return this.findQuestionById(result.lastID);
    }

    static async findQuestionById(id) {
        return get(`SELECT * FROM quiz_questions WHERE id = ?`, [id]);
    }

    static async findById(id) {
        return get(`SELECT * FROM quizzes WHERE id = ?`, [id]);
    }

    static async findByUuid(uuid) {
        return get(`SELECT * FROM quizzes WHERE uuid = ?`, [uuid]);
    }

    static async getNextQuestion(quizId, afterQuestionId = null) {
        if (afterQuestionId) {
            return get(
                `SELECT * FROM quiz_questions 
                 WHERE quiz_id = ? AND id > ? 
                 ORDER BY id ASC LIMIT 1`,
                [quizId, afterQuestionId]
            );
        }
        return get(
            `SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY id ASC LIMIT 1`,
            [quizId]
        );
    }

    static async getCurrentQuestion(quizId) {
        // Récupère la première question non répondue
        return get(
            `SELECT qq.* FROM quiz_questions qq
             LEFT JOIN quiz_answers qa ON qq.id = qa.question_id
             WHERE qq.quiz_id = ? AND qa.id IS NULL
             ORDER BY qq.id ASC LIMIT 1`,
            [quizId]
        );
    }

    static async recordAnswer({ quiz_id, question_id, user_id, answer, is_correct, time_spent, points }) {
        return run(
            `INSERT INTO quiz_answers (quiz_id, question_id, user_id, answer, is_correct, time_spent, points, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [quiz_id, question_id, user_id, answer, is_correct ? 1 : 0, time_spent, points]
        );
    }

    static async getScore(quizId) {
        const result = await get(
            `SELECT 
                COUNT(*) as total_answered,
                SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct_count,
                SUM(points) as total_points
             FROM quiz_answers WHERE quiz_id = ?`,
            [quizId]
        );
        return {
            total_answered: result.total_answered || 0,
            correct_count: result.correct_count || 0,
            total_points: result.total_points || 0,
            accuracy: result.total_answered > 0 
                ? Math.round((result.correct_count / result.total_answered) * 100) 
                : 0
        };
    }

    static async getProgress(quizId) {
        const total = await get(`SELECT COUNT(*) as count FROM quiz_questions WHERE quiz_id = ?`, [quizId]);
        const answered = await get(`SELECT COUNT(*) as count FROM quiz_answers WHERE quiz_id = ?`, [quizId]);
        return {
            total: total.count,
            answered: answered.count
        };
    }

    static async getDetailedResults(quizId) {
        return all(
            `SELECT 
                qq.question,
                qq.options,
                qq.correct_answer,
                qa.answer as user_answer,
                qa.is_correct,
                qa.time_spent,
                qa.points
             FROM quiz_questions qq
             LEFT JOIN quiz_answers qa ON qq.id = qa.question_id
             WHERE qq.quiz_id = ?
             ORDER BY qq.id ASC`,
            [quizId]
        );
    }

    static async getSummary(quizId) {
        return this.getScore(quizId);
    }

    static async finalize(quizId) {
        const score = await this.getScore(quizId);
        await run(
            `UPDATE quizzes SET status = 'completed', score = ?, completed_at = datetime('now') WHERE id = ?`,
            [score.total_points, quizId]
        );
        return this.findById(quizId);
    }

    // Pour les flashcards (utilisé dans quizRoutes)
    static async getFlashcardsByIds(ids) {
        return all(
            `SELECT * FROM flashcards WHERE id IN (${ids.map(() => '?').join(',')})`,
            ids
        );
    }
}

module.exports = QuizDAO;