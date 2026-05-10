// src/models/QuizDAO.js

const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('../config/database');

class QuizDAO {

    static async create({ user_id, deck_id = null, type = 'standard', status = 'active' }) {
        const uuid = uuidv4();
        const result = await run(
            `INSERT INTO quizzes (uuid, user_id, deck_id, type, status)
             VALUES (?, ?, ?, ?, ?)`,
            [uuid, user_id, deck_id, type, status]
        );
        return this.findById(result.lastID);
    }

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

    static async resolveId(quizRef) {
        if (quizRef === null || quizRef === undefined) return null;
        if (typeof quizRef === 'number' && Number.isFinite(quizRef)) {
            return quizRef;
        }
        const row = await this.findByUuid(String(quizRef));
        return row ? row.id : null;
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
        return get(
            `SELECT qq.* FROM quiz_questions qq
             LEFT JOIN quiz_answers qa ON qq.id = qa.question_id AND qq.quiz_id = qa.quiz_id
             WHERE qq.quiz_id = ? AND qa.id IS NULL
             ORDER BY qq.id ASC LIMIT 1`,
            [quizId]
        );
    }

    /**
     * Enregistre une réponse (DAO / tests unitaires). Utilise le propriétaire du quiz comme user_id.
     */
    static async submitAnswer(questionId, userAnswer) {
        const question = await this.findQuestionById(questionId);
        if (!question) throw new Error('Question introuvable');

        const quiz = await this.findById(question.quiz_id);
        if (!quiz) throw new Error('Quiz introuvable');

        const isCorrect = parseInt(userAnswer, 10) === parseInt(question.correct_answer, 10);
        const points = isCorrect ? 100 : 0;

        await run(
            `INSERT INTO quiz_answers (quiz_id, question_id, user_id, answer, is_correct, time_spent, points, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [
                quiz.id,
                question.id,
                quiz.user_id,
                userAnswer,
                isCorrect ? 1 : 0,
                0,
                points
            ]
        );

        return { isCorrect };
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
             LEFT JOIN quiz_answers qa ON qq.id = qa.question_id AND qq.quiz_id = qa.quiz_id
             WHERE qq.quiz_id = ?
             ORDER BY qq.id ASC`,
            [quizId]
        );
    }

    static async getSummary(quizId) {
        return this.getScore(quizId);
    }

    static async finalize(quizRef) {
        const quizId = await this.resolveId(quizRef);
        if (quizId === null) throw new Error('Quiz introuvable');

        const totalRow = await get(`SELECT COUNT(*) as c FROM quiz_questions WHERE quiz_id = ?`, [quizId]);
        const totalQuestions = totalRow.c || 0;
        const score = await this.getScore(quizId);
        const correctCount = score.correct_count || 0;
        const percentage = totalQuestions > 0
            ? Math.round((correctCount / totalQuestions) * 100)
            : 0;

        await run(
            `UPDATE quizzes SET status = 'completed', score = ?, completed_at = datetime('now') WHERE id = ?`,
            [percentage, quizId]
        );
        return this.findById(quizId);
    }

    static async getFlashcardsByIds(ids) {
        return all(
            `SELECT * FROM flashcards WHERE id IN (${ids.map(() => '?').join(',')})`,
            ids
        );
    }
}

module.exports = QuizDAO;
