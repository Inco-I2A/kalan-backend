const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware');
const { UserDAO } = require('../models');
const QuizDAO = require('../models/QuizDAO');

// POST /api/quizzes/timed — Créer un quiz chronométré
router.post('/timed', authMiddleware, async (req, res, next) => {
    try {
        const user = await UserDAO.findByUuid(req.user.uuid);
        if (!user) {
            return res.status(401).json({ success: false, error: 'Utilisateur non trouvé' });
        }
        const userId = user.id;
        const { flashcard_ids, title } = req.body;

        if (!flashcard_ids || !Array.isArray(flashcard_ids) || flashcard_ids.length === 0) {
            return res.status(400).json({ success: false, error: 'Au moins une flashcard requise' });
        }

        const quiz = await QuizDAO.create({
            user_id: userId,
            deck_id: null,
            type: 'timed',
            status: 'active'
        });

        const flashcards = await QuizDAO.getFlashcardsByIds(flashcard_ids);
        
        for (const card of flashcards) {
            const options = generateOptions(card, flashcards);
            const correctIndex = options.indexOf(card.back);
            
            await QuizDAO.addQuestion({
                quiz_id: quiz.id,
                question: card.front,
                options: options,
                correct_answer: correctIndex,
                time_limit: 15
            });
        }

        const firstQuestion = await QuizDAO.getNextQuestion(quiz.id);

        res.status(201).json({
            success: true,
            data: {
                quiz: {
                    id: quiz.uuid,
                    title: title || `Quiz ${new Date().toLocaleDateString()}`,
                    type: quiz.type,
                    status: quiz.status,
                    total_questions: flashcards.length,
                    current_question_index: 0
                },
                current_question: firstQuestion ? {
                    id: firstQuestion.id,
                    question: firstQuestion.question,
                    options: JSON.parse(firstQuestion.options),
                    time_limit: firstQuestion.time_limit,
                    correct_answer: firstQuestion.correct_answer
                } : null
            }
        });

    } catch (error) {
        next(error);
    }
});

// POST /api/quizzes/:uuid/answer-timed — Répondre
router.post('/:uuid/answer-timed', authMiddleware, async (req, res, next) => {
    try {
        const { uuid } = req.params;
        const user = await UserDAO.findByUuid(req.user.uuid);
        if (!user) {
            return res.status(401).json({ success: false, error: 'Utilisateur non trouvé' });
        }
        const userId = user.id;
        const { question_id, answer, time_spent } = req.body;

        if (question_id === undefined || answer === undefined) {
            return res.status(400).json({ success: false, error: 'question_id et answer requis' });
        }

        const quiz = await QuizDAO.findByUuid(uuid);
        if (!quiz || quiz.user_id !== userId) {
            return res.status(404).json({ success: false, error: 'Quiz non trouvé' });
        }

        const question = await QuizDAO.findQuestionById(question_id);
        if (!question || question.quiz_id !== quiz.id) {
            return res.status(400).json({ success: false, error: 'Question invalide' });
        }

        const isCorrect = parseInt(answer) === parseInt(question.correct_answer);
        const points = isCorrect ? Math.max(10, 20 - Math.floor(time_spent / 3)) : 0;

        await QuizDAO.recordAnswer({
            quiz_id: quiz.id,
            question_id: question.id,
            user_id: userId,
            answer: answer,
            is_correct: isCorrect,
            time_spent: time_spent || 0,
            points: points
        });

        const nextQuestion = await QuizDAO.getNextQuestion(quiz.id, question.id);
        const score = await QuizDAO.getScore(quiz.id);

        // Si plus de questions, finaliser
        if (!nextQuestion) {
            await QuizDAO.finalize(quiz.id);
        }

        res.json({
            success: true,
            data: {
                result: {
                    isCorrect: isCorrect,
                    correct_answer: question.correct_answer,
                    points: points,
                    time_spent: time_spent
                },
                score: score,
                next_question: nextQuestion ? {
                    id: nextQuestion.id,
                    question: nextQuestion.question,
                    options: JSON.parse(nextQuestion.options),
                    time_limit: nextQuestion.time_limit,
                    correct_answer: nextQuestion.correct_answer
                } : null,
                is_complete: !nextQuestion
            }
        });

    } catch (error) {
        next(error);
    }
});

// GET /api/quizzes/:uuid — État du quiz
router.get('/:uuid', authMiddleware, async (req, res, next) => {
    try {
        const { uuid } = req.params;
        const user = await UserDAO.findByUuid(req.user.uuid);
        if (!user) {
            return res.status(401).json({ success: false, error: 'Utilisateur non trouvé' });
        }
        const userId = user.id;

        const quiz = await QuizDAO.findByUuid(uuid);
        if (!quiz || quiz.user_id !== userId) {
            return res.status(404).json({ success: false, error: 'Quiz non trouvé' });
        }

        const currentQuestion = await QuizDAO.getCurrentQuestion(quiz.id);
        const score = await QuizDAO.getScore(quiz.id);
        const progress = await QuizDAO.getProgress(quiz.id);

        res.json({
            success: true,
            data: {
                quiz: {
                    id: quiz.uuid,
                    title: null,
                    status: quiz.status,
                    total_questions: progress.total,
                    answered_questions: progress.answered
                },
                current_question: currentQuestion ? {
                    id: currentQuestion.id,
                    question: currentQuestion.question,
                    options: JSON.parse(currentQuestion.options),
                    time_limit: currentQuestion.time_limit,
                    correct_answer: currentQuestion.correct_answer
                } : null,
                score: score
            }
        });

    } catch (error) {
        next(error);
    }
});

// GET /api/quizzes/:uuid/results — Résultats
router.get('/:uuid/results', authMiddleware, async (req, res, next) => {
    try {
        const { uuid } = req.params;
        const user = await UserDAO.findByUuid(req.user.uuid);
        if (!user) {
            return res.status(401).json({ success: false, error: 'Utilisateur non trouvé' });
        }
        const userId = user.id;

        const quiz = await QuizDAO.findByUuid(uuid);
        if (!quiz || quiz.user_id !== userId) {
            return res.status(404).json({ success: false, error: 'Quiz non trouvé' });
        }

        const results = await QuizDAO.getDetailedResults(quiz.id);
        const summary = await QuizDAO.getSummary(quiz.id);

        res.json({
            success: true,
            data: {
                summary: summary,
                details: results
            }
        });

    } catch (error) {
        next(error);
    }
});

// Génération des options QCM
function generateOptions(targetCard, allCards) {
    const correctAnswer = targetCard.back;
    const distractors = allCards
        .filter(c => c.id !== targetCard.id)
        .map(c => c.back)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);
    
    const options = [correctAnswer, ...distractors];
    
    // Mélange Fisher-Yates
    for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
    }
    
    return options;
}

module.exports = router;