// tests/models.test.js
// ====================
// Tests unitaires des DAOs

const { UserDAO, SchoolDAO, DeckDAO, FlashcardDAO, QuizDAO } = require('../src/models');
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

describe('🏫 SchoolDAO', () => {
    
    test('createSchool() crée une école', async () => {
        const school = await SchoolDAO.createSchool({ name: 'Lycée Test', city: 'Ouagadougou' });
        expect(school.name).toBe('Lycée Test');
        expect(school.id).toBeDefined();
    });
    
    test('createSchool() rejette un nom trop court', async () => {
        await expect(SchoolDAO.createSchool({ name: 'A' }))
            .rejects.toThrow('nom');
    });
    
    test('findSchoolById() retrouve une école', async () => {
        const created = await SchoolDAO.createSchool({ name: 'Test' });
        const found = await SchoolDAO.findSchoolById(created.id);
        expect(found.name).toBe('Test');
    });
    
    test('findClassesBySchool() liste les classes', async () => {
        const school = await SchoolDAO.createSchool({ name: 'Test' });
        await SchoolDAO.createClass({ school_id: school.id, name: '6ème A' });
        
        const classes = await SchoolDAO.findClassesBySchool(school.id);
        expect(classes.length).toBe(1);
        expect(classes[0].name).toBe('6ème A');
    });
});

describe('👤 UserDAO', () => {
    
    let schoolId, classId;
    
    beforeEach(async () => {
        const school = await SchoolDAO.createSchool({ name: 'Test School' });
        schoolId = school.id;
        const classe = await SchoolDAO.createClass({ school_id: school.id, name: 'Test Class', level: 'college' });
        classId = classe.id;
    });
    
    test('create() crée un élève avec firstName/lastName/pseudo obligatoires', async () => {
        const user = await UserDAO.create({
            firstName: 'Aminata',
            lastName: 'Ouédraogo',
            pseudo: 'Amina2024',
            school_id: schoolId,
            class_id: classId
        });
        
        expect(user.uuid).toBeDefined();
        expect(user.firstName).toBe('Aminata');
    });
    
    test('create() rejette un prénom trop court', async () => {
        await expect(UserDAO.create({
            firstName: 'A',
            lastName: 'Test',
            pseudo: 'Test',
            school_id: schoolId,
            class_id: classId
        })).rejects.toThrow('prénom');
    });
    
    test('create() rejette sans school_id', async () => {
        await expect(UserDAO.create({
            firstName: 'Test',
            lastName: 'Test',
            pseudo: 'Test'
        })).rejects.toThrow('école');
    });
    
    test('findByUuid() retrouve un élève', async () => {
        const user = await UserDAO.create({
            firstName: 'Test',
            lastName: 'Test',
            pseudo: 'Test',
            school_id: schoolId,
            class_id: classId
        });
        
        const found = await UserDAO.findByUuid(user.uuid);
        expect(found.pseudo).toBe('Test');
    });
    
    test('addPoints() calcule le niveau correctement', async () => {
        const user = await UserDAO.create({
            firstName: 'Test',
            lastName: 'Test',
            pseudo: 'Test',
            school_id: schoolId,
            class_id: classId
        });
        
        await UserDAO.addPoints(user.uuid, 50);
        const updated = await UserDAO.findByUuid(user.uuid);
        
        expect(updated.total_points).toBe(50);
        expect(updated.xp).toBe(50);
    });
    
    test('addPoints() atteint Baobab à 300 XP', async () => {
        const user = await UserDAO.create({
            firstName: 'Test',
            lastName: 'Test',
            pseudo: 'Test',
            school_id: schoolId,
            class_id: classId
        });
        
        await UserDAO.addPoints(user.uuid, 350);
        const updated = await UserDAO.findByUuid(user.uuid);
        
        expect(updated.level).toBeGreaterThanOrEqual(3);
    });
    
    test('updateStreak() incrémente la série', async () => {
        const user = await UserDAO.create({
            firstName: 'Test',
            lastName: 'Test',
            pseudo: 'Test',
            school_id: schoolId,
            class_id: classId
        });
        
        await UserDAO.updateStreak(user.uuid);
        const updated = await UserDAO.findByUuid(user.uuid);
        
        expect(updated.streak_days).toBe(1);
    });
    
    test('delete() fait un soft delete', async () => {
        const user = await UserDAO.create({
            firstName: 'Test',
            lastName: 'Test',
            pseudo: 'Test',
            school_id: schoolId,
            class_id: classId
        });
        
        await UserDAO.delete(user.uuid);
        const deleted = await UserDAO.findByUuid(user.uuid);
        
        expect(deleted).toBeUndefined();
    });
});

describe('📚 DeckDAO', () => {
    
    let userId;
    
    beforeEach(async () => {
        const school = await SchoolDAO.createSchool({ name: 'Test School' });
        const classe = await SchoolDAO.createClass({ school_id: school.id, name: 'Test Class', level: 'college' });
        const user = await UserDAO.create({
            firstName: 'Test',
            lastName: 'Test',
            pseudo: 'Test',
            school_id: school.id,
            class_id: classe.id
        });
        userId = user.id;
    });
    
    test('create() crée un deck', async () => {
        const deck = await DeckDAO.create({
            user_id: userId,
            title: 'Mathématiques'
        });
        
        expect(deck.title).toBe('Mathématiques');
        expect(deck.uuid).toBeDefined();
    });
    
    test('findPublic() liste les decks publics', async () => {
        await DeckDAO.create({ user_id: userId, title: 'Public Deck', is_public: true });
        await DeckDAO.create({ user_id: userId, title: 'Private Deck', is_public: false });
        
        const publics = await DeckDAO.findPublic({});
        expect(publics.length).toBe(1);
        expect(publics[0].title).toBe('Public Deck');
    });
    
    test('incrementDownloads() compte les téléchargements', async () => {
        const deck = await DeckDAO.create({ user_id: userId, title: 'Test' });
        
        await DeckDAO.incrementDownloads(deck.uuid);
        const updated = await DeckDAO.findByUuid(deck.uuid);
        
        expect(updated.download_count).toBe(1);
    });
});

describe('🃏 FlashcardDAO', () => {
    
    let userId, deckId;
    
    beforeEach(async () => {
        const school = await SchoolDAO.createSchool({ name: 'Test School' });
        const classe = await SchoolDAO.createClass({ school_id: school.id, name: 'Test Class', level: 'college' });
        const user = await UserDAO.create({
            firstName: 'Test',
            lastName: 'Test',
            pseudo: 'Test',
            school_id: school.id,
            class_id: classe.id
        });
        userId = user.id;
        
        const deck = await DeckDAO.create({ user_id: userId, title: 'Test Deck' });
        deckId = deck.id;
    });
    
    test('create() crée une flashcard', async () => {
        const card = await FlashcardDAO.create({
            user_id: userId,
            deck_id: deckId,
            front: 'Question?',
            back: 'Réponse!'
        });
        
        expect(card.front).toBe('Question?');
        expect(card.mastery_level).toBe(0);
    });
    
    test('markReviewed() augmente le mastery si correct', async () => {
        const card = await FlashcardDAO.create({
            user_id: userId,
            deck_id: deckId,
            front: 'Q',
            back: 'R'
        });
        
        const updated = await FlashcardDAO.markReviewed(card.id, true);
        expect(updated.mastery_level).toBe(1);
    });
    
    test('markReviewed() diminue le mastery si faux', async () => {
        const card = await FlashcardDAO.create({
            user_id: userId,
            deck_id: deckId,
            front: 'Q',
            back: 'R'
        });
        
        await FlashcardDAO.markReviewed(card.id, true);
        const updated = await FlashcardDAO.markReviewed(card.id, false);
        expect(updated.mastery_level).toBe(0);
    });
    
    test('getTodayCount() limite anti-farming', async () => {
        await FlashcardDAO.create({ user_id: userId, deck_id: deckId, front: '1', back: '1' });
        await FlashcardDAO.create({ user_id: userId, deck_id: deckId, front: '2', back: '2' });
        
        const count = await FlashcardDAO.getTodayCount(userId);
        expect(count).toBe(2);
    });
    
    test('delete() met à jour le compteur du deck', async () => {
        const card = await FlashcardDAO.create({
            user_id: userId,
            deck_id: deckId,
            front: 'Q',
            back: 'R'
        });
        
        await FlashcardDAO.delete(card.uuid);
        const deck = await DeckDAO.findById(deckId);
        
        expect(deck.card_count).toBe(0);
    });
});

describe('📝 QuizDAO', () => {
    
    let userId, deckId;
    
    beforeEach(async () => {
        const school = await SchoolDAO.createSchool({ name: 'Test School' });
        const classe = await SchoolDAO.createClass({ school_id: school.id, name: 'Test Class', level: 'college' });
        const user = await UserDAO.create({
            firstName: 'Test',
            lastName: 'Test',
            pseudo: 'Test',
            school_id: school.id,
            class_id: classe.id
        });
        userId = user.id;
        
        const deck = await DeckDAO.create({ user_id: userId, title: 'Test Deck' });
        deckId = deck.id;
    });
    
    test('create() crée un quiz', async () => {
        const quiz = await QuizDAO.create({ user_id: userId, deck_id: deckId });
        expect(quiz.uuid).toBeDefined();
        expect(quiz.status).toBe('active');
    });
    
    test('addQuestion() ajoute une question', async () => {
        const quiz = await QuizDAO.create({ user_id: userId, deck_id: deckId });
        
        const q = await QuizDAO.addQuestion({
            quiz_id: quiz.id,
            question: 'Q1?',
            options: JSON.stringify(['A', 'B', 'C', 'D']),
            correct_answer: 0
        });
        
        expect(q.id).toBeDefined();
    });
    
    test('submitAnswer() vérifie la réponse', async () => {
        const quiz = await QuizDAO.create({ user_id: userId, deck_id: deckId });
        
        const q = await QuizDAO.addQuestion({
            quiz_id: quiz.id,
            question: 'Q1?',
            options: JSON.stringify(['A', 'B', 'C', 'D']),
            correct_answer: 1
        });
        
        const result = await QuizDAO.submitAnswer(q.id, 1);
        expect(result.isCorrect).toBe(true);
    });
    
    test('finalize() calcule le score', async () => {
        const quiz = await QuizDAO.create({ user_id: userId, deck_id: deckId });
        
        const q1 = await QuizDAO.addQuestion({
            quiz_id: quiz.id,
            question: 'Q1',
            options: JSON.stringify(['A', 'B']),
            correct_answer: 0
        });
        
        await QuizDAO.submitAnswer(q1.id, 0);
        const finalized = await QuizDAO.finalize(quiz.uuid);
        
        expect(finalized.score).toBe(100);
    });
    
    test('finalize() score 100% parfait', async () => {
        const quiz = await QuizDAO.create({ user_id: userId, deck_id: deckId });
        
        const q1 = await QuizDAO.addQuestion({
            quiz_id: quiz.id,
            question: 'Q1',
            options: JSON.stringify(['A', 'B']),
            correct_answer: 0
        });
        
        await QuizDAO.submitAnswer(q1.id, 0);
        const finalized = await QuizDAO.finalize(quiz.uuid);
        expect(finalized.score).toBe(100);
    });
});