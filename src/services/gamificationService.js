// src/services/gamificationService.js
// ===================================
// Points, niveaux, badges

const { UserDAO } = require('../models');

const POINTS_TABLE = {
    'flashcard_create': 10,
    'flashcard_master': 5,
    'quiz_correct': 10,
    'quiz_wrong': 2,
    'quiz_pass': 50,
    'quiz_partial': 20,
    'share_bluetooth': 15,
    'download_deck': 10,
    'streak_3': 10,
    'streak_7': 50,
    'streak_30': 200,
    'streak_100': 500
};

const BADGES = {
    'graine': { name: 'Graine', category: 'evolutif', condition: 'level >= 1', icon: 'seed' },
    'pousse': { name: 'Pousse', category: 'evolutif', condition: 'level >= 2', icon: 'sprout' },
    'baobab': { name: 'Baobab', category: 'evolutif', condition: 'level >= 3', icon: 'tree' },
    'feu-de-brousse': { name: 'Feu de brousse', category: 'evolutif', condition: 'level >= 4', icon: 'fire' },
    'griot': { name: 'Griot', category: 'evolutif', condition: 'level >= 5', icon: 'scroll' },
    'masque': { name: 'Masque', category: 'evolutif', condition: 'level >= 6', icon: 'mask' },
    'ancetre': { name: 'Ancêtre', category: 'evolutif', condition: 'level >= 7', icon: 'crown' },
    'sage': { name: 'Sage', category: 'evolutif', condition: 'level >= 8', icon: 'star' }
};

class GamificationService {
    
    static async addPoints(userUuid, action, metadata = {}) {
        const basePoints = POINTS_TABLE[action];
        
        if (basePoints === undefined) {
            console.warn(`Action inconnue: ${action}`);
            return null;
        }
        
        if (action === 'flashcard_create') {
            const user = await UserDAO.findByUuid(userUuid);
            if (!user) throw new Error('Utilisateur non trouvé');
            
            const { get } = require('../config/database');
            const row = await get(`
                SELECT COUNT(*) as count 
                FROM flashcards 
                WHERE user_id = ? AND date(created_at) = date('now')
            `, [user.id]);
            
            if (row && row.count >= 50) {
                throw new Error('Limite de 50 flashcards/jour atteinte');
            }
        }
        
        const updatedUser = await UserDAO.addPoints(userUuid, basePoints);
        
        const newBadges = await this.checkBadges(userUuid);
        
        return {
            pointsEarned: basePoints,
            totalPoints: updatedUser.total_points,
            newLevel: updatedUser.level,
            levelInfo: UserDAO.getLevelInfo(updatedUser.level),
            newBadges
        };
    }
    
    static async checkBadges(userUuid) {
        const user = await UserDAO.findByUuid(userUuid);
        if (!user) return [];
        
        const unlocked = [];
        const { get, run } = require('../config/database');
        
        for (const [badgeId, badge] of Object.entries(BADGES)) {
            const existing = await get(
                'SELECT 1 FROM user_badges WHERE user_id = ? AND badge_id = ?',
                [user.id, badgeId]
            );
            
            if (existing) continue;
            
            if (this.evaluateCondition(badge.condition, user)) {
                await run(
                    'INSERT INTO user_badges (user_id, badge_id, unlocked_at) VALUES (?, ?, datetime("now"))',
                    [user.id, badgeId]
                );
                unlocked.push({ id: badgeId, ...badge });
            }
        }
        
        return unlocked;
    }
    
    static evaluateCondition(condition, user) {
        const match = condition.match(/^(\w+)\s*([>=<]+)\s*(\d+)$/);
        if (!match) return false;
        
        const [, field, operator, valueStr] = match;
        const targetValue = parseInt(valueStr);
        
        let userValue;
        if (field === 'level') userValue = user.level;
        else if (field === 'xp') userValue = user.xp;
        else if (field === 'total_points') userValue = user.total_points;
        else userValue = 0;
        
        return userValue >= targetValue;
    }
    
    static async processQuizResult(userUuid, quizUuid) {
        const user = await UserDAO.findByUuid(userUuid);
        if (!user) throw new Error('Utilisateur non trouvé');
        
        const { get } = require('../config/database');
        const quiz = await get(`
            SELECT q.*, COUNT(qq.id) as total_q, SUM(CASE WHEN qq.is_correct = 1 THEN 1 ELSE 0 END) as correct_q
            FROM quizzes q
            LEFT JOIN quiz_questions qq ON q.id = qq.quiz_id
            WHERE q.uuid = ?
            GROUP BY q.id
        `, [quizUuid]);
        
        if (!quiz) throw new Error('Quiz non trouvé');
        
        const total = quiz.total_q || 0;
        const correct = quiz.correct_q || 0;
        const score = total > 0 ? Math.round((correct / total) * 100) : 0;
        
        let points = 0;
        if (total > 0) {
            points += correct * POINTS_TABLE.quiz_correct;
            points += (total - correct) * POINTS_TABLE.quiz_wrong;
            
            if (score >= 60) {
                points += POINTS_TABLE.quiz_pass;
            } else if (score >= 40) {
                points += POINTS_TABLE.quiz_partial;
            }
        }
        
        let updatedUser = user;
        if (points > 0) {
            updatedUser = await UserDAO.addPoints(userUuid, points);
        }
        
        return {
            score,
            totalQuestions: total,
            correctAnswers: correct,
            pointsEarned: points,
            status: score >= 60 ? 'passed' : (score >= 40 ? 'partial' : 'failed'),
            totalPoints: updatedUser ? updatedUser.total_points : user.total_points,
            newLevel: updatedUser ? updatedUser.level : user.level,
            levelInfo: UserDAO.getLevelInfo(updatedUser ? updatedUser.level : user.level)
        };
    }
    
    static getPointsTable() {
        return { ...POINTS_TABLE };
    }
    
    static getBadges() {
        return { ...BADGES };
    }
}

module.exports = GamificationService;