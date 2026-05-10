// tests/routes.test.js
// ===================
// Tests d'intégration des routes API

const request = require('supertest');
const app = require('../src/app');
const { run } = require('../src/config/database');

beforeEach(async () => {
    await run('DELETE FROM quiz_questions');
    await run('DELETE FROM quizzes');
    await run('DELETE FROM flashcards');
    await run('DELETE FROM decks');
    await run('DELETE FROM user_badges');
    await run('DELETE FROM rankings');
    await run('DELETE FROM users');
    await run('DELETE FROM classes');
    await run('DELETE FROM schools');
});

describe('🏥 Health', () => {
    
    test('GET /health retourne OK', async () => {
        const res = await request(app)
            .get('/health')
            .expect(200);
        
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain('opérationnelle');
    });
    
    test('GET / retourne les endpoints', async () => {
        const res = await request(app)
            .get('/')
            .expect(200);
        
        expect(res.body.endpoints).toBeDefined();
        expect(res.body.endpoints.auth).toBe('/api/auth');
    });
});

describe('🏫 Schools API', () => {
    
    test('POST /api/schools crée une école', async () => {
        const res = await request(app)
            .post('/api/schools')
            .send({
                name: 'Lycée Saint Jean-Baptiste',
                city: 'Bobo-Dioulasso',
                region: 'Hauts-Bassins',
                type: 'public'
            })
            .expect(201);
        
        expect(res.body.success).toBe(true);
        expect(res.body.school.name).toBe('Lycée Saint Jean-Baptiste');
        expect(res.body.school.id).toBeDefined();
    });
    
    test('GET /api/schools liste les écoles', async () => {
        await request(app)
            .post('/api/schools')
            .send({ name: 'École Test', city: 'Ouagadougou' });
        
        const res = await request(app)
            .get('/api/schools')
            .expect(200);
        
        expect(res.body.success).toBe(true);
        expect(res.body.schools.length).toBeGreaterThan(0);
    });
    
    test('GET /api/schools/:id retourne une école avec ses classes', async () => {
        const schoolRes = await request(app)
            .post('/api/schools')
            .send({ name: 'École Test', city: 'Ouagadougou' });
        
        const schoolId = schoolRes.body.school.id;
        
        await request(app)
            .post(`/api/schools/${schoolId}/classes`)
            .send({ name: '6ème A', level: 'college' });
        
        const res = await request(app)
            .get(`/api/schools/${schoolId}`)
            .expect(200);
        
        expect(res.body.school.classes).toBeDefined();
        expect(res.body.school.classes.length).toBe(1);
    });
    
    test('POST /api/schools/:id/classes crée une classe', async () => {
        const schoolRes = await request(app)
            .post('/api/schools')
            .send({ name: 'École Test', city: 'Ouagadougou' });
        
        const schoolId = schoolRes.body.school.id;
        
        const res = await request(app)
            .post(`/api/schools/${schoolId}/classes`)
            .send({ name: 'Terminale S', level: 'lycee' })
            .expect(201);
        
        expect(res.body.class.name).toBe('Terminale S');
        expect(res.body.class.school_id).toBe(schoolId);
    });
});

describe('🔐 Auth API', () => {
    
    let schoolId, classId;
    
    beforeEach(async () => {
        const schoolRes = await request(app)
            .post('/api/schools')
            .send({ name: 'Lycée Test', city: 'Ouagadougou' });
        schoolId = schoolRes.body.school.id;
        
        const classRes = await request(app)
            .post(`/api/schools/${schoolId}/classes`)
            .send({ name: 'Terminale S', level: 'lycee' });
        classId = classRes.body.class.id;
    });
    
    test('POST /api/auth/register crée un élève', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                firstName: 'Aminata',
                lastName: 'Ouédraogo',
                pseudo: 'Amina2024',
                school_id: schoolId,
                class_id: classId
            })
            .expect(201);
        
        expect(res.body.success).toBe(true);
        expect(res.body.user.firstName).toBe('Aminata');
        expect(res.body.user.uuid).toBeDefined();
        expect(res.body.user.avatar).toBeDefined();
        expect(res.body.token).toBeDefined();
        expect(res.body.isNew).toBe(true);
    });
    
    test('POST /api/auth/register met à jour un élève existant', async () => {
        const first = await request(app)
            .post('/api/auth/register')
            .send({
                firstName: 'Aminata',
                lastName: 'Ouédraogo',
                pseudo: 'Amina2024',
                school_id: schoolId,
                class_id: classId
            });
        
        const uuid = first.body.user.uuid;
        
        const second = await request(app)
            .post('/api/auth/register')
            .send({
                firstName: 'Aminata',
                lastName: 'Ouédraogo',
                pseudo: 'AminaNouveau',
                school_id: schoolId,
                class_id: classId,
                uuid: uuid
            })
            .expect(200);
        
        expect(second.body.isNew).toBe(false);
        expect(second.body.user.pseudo).toBe('AminaNouveau');
    });
    
    test('POST /api/auth/register rejette un prénom trop court', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                firstName: 'A',
                lastName: 'Test',
                pseudo: 'Test',
                school_id: schoolId,
                class_id: classId
            })
            .expect(500);
        
        expect(res.body.success).toBe(false);
    });
    
    test('POST /api/auth/login connecte par UUID', async () => {
        const register = await request(app)
            .post('/api/auth/register')
            .send({
                firstName: 'Test',
                lastName: 'Test',
                pseudo: 'Test',
                school_id: schoolId,
                class_id: classId
            });
        
        const uuid = register.body.user.uuid;
        
        const res = await request(app)
            .post('/api/auth/login')
            .send({ uuid })
            .expect(200);
        
        expect(res.body.success).toBe(true);
        expect(res.body.user.pseudo).toBe('Test');
        expect(res.body.token).toBeDefined();
    });
    
    test('POST /api/auth/login rejette un UUID inconnu', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ uuid: 'uuid-invalide' })
            .expect(500);
        
        expect(res.body.success).toBe(false);
    });
});

describe('👤 Users API', () => {
    
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
        
        const userRes = await request(app)
            .post('/api/auth/register')
            .send({
                firstName: 'Test',
                lastName: 'Test',
                pseudo: 'TestUser',
                school_id: schoolId,
                class_id: classId
            });
        
        token = userRes.body.token;
    });
    
    test('GET /api/users/me retourne mon profil', async () => {
        const res = await request(app)
            .get('/api/users/me')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
        
        expect(res.body.success).toBe(true);
        expect(res.body.user.pseudo).toBe('TestUser');
    });
    
    test('GET /api/users/me rejette sans token', async () => {
        const res = await request(app)
            .get('/api/users/me')
            .expect(401);
        
        expect(res.body.success).toBe(false);
    });
    
    test('GET /api/users/leaderboard retourne le classement', async () => {
        const res = await request(app)
            .get('/api/users/leaderboard')
            .expect(200);
        
        expect(res.body.success).toBe(true);
        expect(res.body.users).toBeDefined();
        expect(res.body.users.length).toBeGreaterThan(0);
    });
});

describe('📚 Decks API', () => {
    
    let token, deckUuid;
    
    beforeEach(async () => {
        const schoolRes = await request(app)
            .post('/api/schools')
            .send({ name: 'Lycée Test', city: 'Ouagadougou' });
        const schoolId = schoolRes.body.school.id;
        
        const classRes = await request(app)
            .post(`/api/schools/${schoolId}/classes`)
            .send({ name: 'Terminale S', level: 'lycee' });
        const classId = classRes.body.class.id;
        
        const userRes = await request(app)
            .post('/api/auth/register')
            .send({
                firstName: 'Test',
                lastName: 'Test',
                pseudo: 'TestUser',
                school_id: schoolId,
                class_id: classId
            });
        
        token = userRes.body.token;
        
        const deckRes = await request(app)
            .post('/api/decks')
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Test Deck' });
        deckUuid = deckRes.body.deck.uuid;
    });
    
    test('POST /api/decks crée un deck', async () => {
        const res = await request(app)
            .post('/api/decks')
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'Mathématiques - Chapitre 3',
                description: 'Les équations',
                category: 'Mathématiques'
            })
            .expect(201);
        
        expect(res.body.success).toBe(true);
        expect(res.body.deck.title).toBe('Mathématiques - Chapitre 3');
        expect(res.body.deck.uuid).toBeDefined();
    });
    
    test('GET /api/decks public retourne la bibliothèque', async () => {
        await request(app)
            .post('/api/decks')
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'Deck Public',
                is_public: true
            });
        
        const res = await request(app)
            .get('/api/decks/public')
            .expect(200);
        
        expect(res.body.success).toBe(true);
        expect(res.body.decks.length).toBeGreaterThan(0);
    });
    
    test('GET /api/decks/:uuid retourne un deck avec ses cartes', async () => {
        const res = await request(app)
            .get(`/api/decks/${deckUuid}`)
            .expect(200);
        
        expect(res.body.deck.cards).toBeDefined();
    });
});