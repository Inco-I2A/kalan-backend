// tests/quiz-timed.test.js
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/database');
const UserDAO = require('../src/models/UserDAO');
const FlashcardDAO = require('../src/models/FlashcardDAO');
const DeckDAO = require('../src/models/DeckDAO');
const { generateToken } = require('../src/services/authService');

// Helpers inline (pas de fichier ./helpers)
async function setupTestDB() {
    // La base est déjà initialisée par database.js au require
    // On nettoie juste les tables de test
    await db.run(`DELETE FROM quiz_answers WHERE quiz_id IN (SELECT id FROM quizzes WHERE title LIKE 'Test%')`);
    await db.run(`DELETE FROM quiz_questions WHERE quiz_id IN (SELECT id FROM quizzes WHERE title LIKE 'Test%')`);
    await db.run(`DELETE FROM quizzes WHERE title LIKE 'Test%'`);
}

async function createTestUser() {
    const school = await db.run(
        `INSERT INTO schools (name, country, city, created_at) VALUES (?, ?, ?, datetime('now'))`,
        ['Test School', 'Burkina Faso', 'Ouagadougou']
    );
    
    const user = await UserDAO.create({
        school_id: school.lastID,
        firstName: 'Test',
        lastName: 'User',
        pseudo: 'testuser_' + Date.now(),
        password: 'password123',
        class: '6ème A',
        language: 'fr'
    });
    return user;
}

async function createTestFlashcards(userId, count = 5) {
    const deck = await DeckDAO.create({
        user_id: userId,
        title: 'Test Deck ' + Date.now(),
        description: 'For testing',
        is_public: false
    });
    
    const cards = [];
    for (let i = 0; i < count; i++) {
        const card = await FlashcardDAO.create({
            deck_id: deck.id,
            front: `Question ${i + 1}`,
            back: `Réponse ${i + 1}`,
            tags: 'test'
        });
        cards.push(card);
    }
    return cards;
}

function getAuthToken(user) {
    return generateToken(user);
}

describe('Quiz Chronométré', () => {
    let token;
    let user;
    let flashcards;

    beforeAll(async () => {
        await setupTestDB();
        user = await createTestUser();
        token = getAuthToken(user);
        flashcards = await createTestFlashcards(user.id, 5);
    });

    afterAll(async () => {
        await setupTestDB();
    });

    describe('POST /api/quizzes/timed', () => {
        it('devrait créer un quiz chronométré avec succès', async () => {
            const res = await request(app)
                .post('/api/quizzes/timed')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    flashcard_ids: flashcards.map(f => f.id),
                    title: 'Test Quiz'
                })
                .expect(201);

            expect(res.body.success).toBe(true);
            expect(res.body.data.quiz.type).toBe('timed');
            expect(res.body.data.current_question).toBeDefined();
            expect(res.body.data.current_question.options).toHaveLength(4);
            expect(res.body.data.current_question.correct_answer).toBeDefined();
            expect(typeof res.body.data.current_question.correct_answer).toBe('number');
        });

        it('devrait refuser sans flashcards', async () => {
            const res = await request(app)
                .post('/api/quizzes/timed')
                .set('Authorization', `Bearer ${token}`)
                .send({ flashcard_ids: [] })
                .expect(400);

            expect(res.body.success).toBe(false);
        });
    });

    describe('POST /api/quizzes/:uuid/answer-timed', () => {
        let quizUuid;
        let questionId;
        let correctAnswer;

        beforeEach(async () => {
            const res = await request(app)
                .post('/api/quizzes/timed')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    flashcard_ids: flashcards.map(f => f.id),
                    title: 'Answer Test'
                });

            quizUuid = res.body.data.quiz.id;
            questionId = res.body.data.current_question.id;
            correctAnswer = res.body.data.current_question.correct_answer;
        });

        it('devrait accepter une réponse correcte', async () => {
            const res = await request(app)
                .post(`/api/quizzes/${quizUuid}/answer-timed`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                    question_id: questionId,
                    answer: correctAnswer,
                    time_spent: 5
                })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.result.isCorrect).toBe(true);
            expect(res.body.data.result.points).toBeGreaterThan(0);
        });

        it('devrait accepter une réponse incorrecte', async () => {
            const wrongAnswer = (correctAnswer + 1) % 4;

            const res = await request(app)
                .post(`/api/quizzes/${quizUuid}/answer-timed`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                    question_id: questionId,
                    answer: wrongAnswer,
                    time_spent: 10
                })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.result.isCorrect).toBe(false);
            expect(res.body.data.result.points).toBe(0);
        });

        it('devrait retourner la question suivante', async () => {
            const res = await request(app)
                .post(`/api/quizzes/${quizUuid}/answer-timed`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                    question_id: questionId,
                    answer: correctAnswer,
                    time_spent: 3
                })
                .expect(200);

            expect(res.body.data.next_question).toBeDefined();
            if (res.body.data.next_question) {
                expect(res.body.data.next_question.correct_answer).toBeDefined();
            }
        });

        it('devrait compléter le quiz après la dernière question', async () => {
            let currentQuiz = await request(app)
                .get(`/api/quizzes/${quizUuid}`)
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            while (currentQuiz.body.data.current_question) {
                const q = currentQuiz.body.data.current_question;
                
                const answerRes = await request(app)
                    .post(`/api/quizzes/${quizUuid}/answer-timed`)
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        question_id: q.id,
                        answer: q.correct_answer,
                        time_spent: 2
                    });

                if (answerRes.body.data.is_complete) {
                    expect(answerRes.body.data.next_question).toBeNull();
                    break;
                }

                currentQuiz = await request(app)
                    .get(`/api/quizzes/${quizUuid}`)
                    .set('Authorization', `Bearer ${token}`);
            }
        });
    });

    describe('GET /api/quizzes/:uuid/results', () => {
        it('devrait retourner les résultats du quiz', async () => {
            const createRes = await request(app)
                .post('/api/quizzes/timed')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    flashcard_ids: flashcards.slice(0, 2).map(f => f.id),
                    title: 'Results Test'
                });

            const quizUuid = createRes.body.data.quiz.id;

            for (let i = 0; i < 2; i++) {
                const quizState = await request(app)
                    .get(`/api/quizzes/${quizUuid}`)
                    .set('Authorization', `Bearer ${token}`);

                const q = quizState.body.data.current_question;
                if (!q) break;

                await request(app)
                    .post(`/api/quizzes/${quizUuid}/answer-timed`)
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        question_id: q.id,
                        answer: q.correct_answer,
                        time_spent: 3
                    });
            }

            const res = await request(app)
                .get(`/api/quizzes/${quizUuid}/results`)
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.summary).toBeDefined();
            expect(res.body.data.details).toBeInstanceOf(Array);
        });
    });
});