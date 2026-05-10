// tests/middleware.test.js
// ========================
// Tests du middleware d'authentification

const request = require('supertest');
const app = require('../src/app');
const { run } = require('../src/config/database');

beforeEach(async () => {
    await run('DELETE FROM quiz_questions');
    await run('DELETE FROM quizzes');
    await run('DELETE FROM flashcards');
    await run('DELETE FROM decks');
    await run('DELETE FROM users');
    await run('DELETE FROM classes');
    await run('DELETE FROM schools');
});

describe('🔒 Middleware Auth', () => {
    
    let token;
    
    beforeEach(async () => {
        const schoolRes = await request(app)
            .post('/api/schools')
            .send({ name: 'Lycée Test', city: 'Ouagadougou' });
        const schoolId = schoolRes.body.school.id;
        
        const classRes = await request(app)
            .post(`/api/schools/${schoolId}/classes`)
            .send({ name: 'Terminale S', level: 'lycee' });
        const classId = classRes.body.class.id;
        
        const authRes = await request(app)
            .post('/api/auth/register')
            .send({
                firstName: 'Test',
                lastName: 'Test',
                pseudo: 'TestUser',
                school_id: schoolId,
                class_id: classId
            });
        
        token = authRes.body.token;
    });
    
    test('GET /api/users/me sans token → 401', async () => {
        const res = await request(app)
            .get('/api/users/me')
            .expect(401);
        
        expect(res.body.success).toBe(false);
        expect(res.body.error).toContain('Token manquant');
    });
    
    test('GET /api/users/me avec token invalide → 401', async () => {
        const res = await request(app)
            .get('/api/users/me')
            .set('Authorization', 'Bearer token-invalide')
            .expect(401);
        
        expect(res.body.success).toBe(false);
    });
    
    test('GET /api/users/me avec token valide → 200', async () => {
        const res = await request(app)
            .get('/api/users/me')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
        
        expect(res.body.success).toBe(true);
        expect(res.body.user.pseudo).toBe('TestUser');
    });
    
    test('GET /api/users/me avec mauvais format → 401', async () => {
        const res = await request(app)
            .get('/api/users/me')
            .set('Authorization', 'Basic mauvais-format')
            .expect(401);
        
        expect(res.body.success).toBe(false);
        expect(res.body.error).toContain('Format');
    });
    
    test('POST /api/decks sans token → 401', async () => {
        const res = await request(app)
            .post('/api/decks')
            .send({ title: 'Test Deck' })
            .expect(401);
        
        expect(res.body.success).toBe(false);
    });
    
    test('POST /api/decks avec token valide → 201', async () => {
        const res = await request(app)
            .post('/api/decks')
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Test Deck' })
            .expect(201);
        
        expect(res.body.success).toBe(true);
        expect(res.body.deck.title).toBe('Test Deck');
    });
    
    test('GET /api/decks/public sans token → 200', async () => {
        const res = await request(app)
            .get('/api/decks/public')
            .expect(200);
        
        expect(res.body.success).toBe(true);
    });
    
    test('GET /api/schools sans token → 200', async () => {
        const res = await request(app)
            .get('/api/schools')
            .expect(200);
        
        expect(res.body.success).toBe(true);
    });
});