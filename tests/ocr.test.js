// tests/ocr.test.js
// =================
// Tests OCR et Import PDF/Photos

const request = require('supertest');
const app = require('../src/app');
const { run } = require('../src/config/database');

beforeEach(async () => {
    await run('DELETE FROM flashcards');
    await run('DELETE FROM decks');
    await run('DELETE FROM users');
    await run('DELETE FROM classes');
    await run('DELETE FROM schools');
});

describe('📄 OCR & Import', () => {
    
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
    
    test('POST /api/ocr/preview sans fichier → 400', async () => {
        const res = await request(app)
            .post('/api/ocr/preview')
            .set('Authorization', `Bearer ${token}`)
            .expect(400);
        
        expect(res.body.success).toBe(false);
        expect(res.body.error).toContain('Aucun fichier');
    });
    
    test('POST /api/ocr/import sans fichier → 400', async () => {
        const res = await request(app)
            .post('/api/ocr/import')
            .set('Authorization', `Bearer ${token}`)
            .expect(400);
        
        expect(res.body.success).toBe(false);
        expect(res.body.error).toContain('Aucun fichier');
    });
    
    test('POST /api/ocr/import sans token → 401', async () => {
        const res = await request(app)
            .post('/api/ocr/import')
            .expect(401);
        
        expect(res.body.success).toBe(false);
    });
    
    test('POST /api/ocr/preview avec fichier invalide → 500', async () => {
        const res = await request(app)
            .post('/api/ocr/preview')
            .set('Authorization', `Bearer ${token}`)
            .attach('file', Buffer.from('texte simple'), 'test.txt')
            .expect(500);
        
        expect(res.body.success).toBe(false);
    });
});