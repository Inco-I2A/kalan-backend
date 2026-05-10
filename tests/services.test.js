// tests/services.test.js
// ======================
// Tests unitaires des Services

const { AuthService, GamificationService, AvatarService } = require('../src/services');
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

describe('🔐 AuthService', () => {
    
    let schoolId, classId;
    
    beforeEach(async () => {
        const school = await SchoolDAO.createSchool({ name: 'Test School' });
        schoolId = school.id;
        const classe = await SchoolDAO.createClass({ school_id: school.id, name: 'Test Class', level: 'college' });
        classId = classe.id;
    });
    
    test('register() crée un nouvel élève avec avatar', async () => {
        const result = await AuthService.register({
            firstName: 'Aminata',
            lastName: 'Ouédraogo',
            pseudo: 'Amina2024',
            school_id: schoolId,
            class_id: classId
        });
        
        expect(result.success).toBe(true);
        expect(result.isNew).toBe(true);
        expect(result.user.avatar).toBeDefined();
        expect(result.user.avatar).toContain('<svg');
        expect(result.token).toBeDefined();
    });
    
    test('register() met à jour un UUID existant', async () => {
        const first = await AuthService.register({
            firstName: 'Aminata',
            lastName: 'Ouédraogo',
            pseudo: 'Amina2024',
            school_id: schoolId,
            class_id: classId
        });
        
        const result = await AuthService.register({
            firstName: 'Aminata',
            lastName: 'Ouédraogo',
            pseudo: 'AminaNouveau',
            school_id: schoolId,
            class_id: classId,
            uuid: first.user.uuid
        });
        
        expect(result.isNew).toBe(false);
        expect(result.user.pseudo).toBe('AminaNouveau');
    });
    
    test('loginByUuid() connecte un élève existant', async () => {
        const registered = await AuthService.register({
            firstName: 'Test',
            lastName: 'Test',
            pseudo: 'Test',
            school_id: schoolId,
            class_id: classId
        });
        
        const result = await AuthService.loginByUuid(registered.user.uuid);
        
        expect(result.success).toBe(true);
        expect(result.user.pseudo).toBe('Test');
        expect(result.token).toBeDefined();
    });
    
    test('loginByUuid() rejette un UUID inconnu', async () => {
        await expect(AuthService.loginByUuid('uuid-invalide'))
            .rejects.toThrow('Utilisateur non trouvé');
    });
    
    test('verifyToken() vérifie un token valide', () => {
        const token = AuthService.generateToken({ id: 1, uuid: 'test-uuid', role: 'student' });
        const decoded = AuthService.verifyToken(token);
        
        expect(decoded.uuid).toBe('test-uuid');
        expect(decoded.role).toBe('student');
    });
    
    test('verifyToken() rejette un token invalide', () => {
        expect(() => AuthService.verifyToken('token-invalide'))
            .toThrow('Token invalide');
    });
    
    test('sanitizeUser() retire les champs sensibles', () => {
        const user = {
            id: 1,
            uuid: 'test',
            firstName: 'Test',
            is_active: 1,
            password: 'secret'
        };
        
        const sanitized = AuthService.sanitizeUser(user);
        
        expect(sanitized.id).toBeUndefined();
        expect(sanitized.is_active).toBeUndefined();
        expect(sanitized.firstName).toBe('Test');
    });
});

describe('🏆 GamificationService', () => {
    
    let userUuid;
    
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
        userUuid = user.uuid;
    });
    
    test('addPoints() attribue des points pour flashcard_create', async () => {
        const result = await GamificationService.addPoints(userUuid, 'flashcard_create');
        
        expect(result.pointsEarned).toBe(10);
        expect(result.totalPoints).toBe(10);
    });
    
    test('addPoints() rejette une action inconnue', async () => {
        const result = await GamificationService.addPoints(userUuid, 'action_inconnue');
        expect(result).toBeNull();
    });
    
    test('checkBadges() attribue le badge Graine au niveau 1', async () => {
        const badges = await GamificationService.checkBadges(userUuid);
        
        expect(badges.length).toBeGreaterThan(0);
        expect(badges.some(b => b.id === 'graine')).toBe(true);
    });
    
    test('processQuizResult() calcule les points du quiz', async () => {
        const user = await UserDAO.findByUuid(userUuid);
        const deck = await DeckDAO.create({ user_id: user.id, title: 'Test' });
        const quiz = await QuizDAO.create({ user_id: user.id, deck_id: deck.id });
        
        const q1 = await QuizDAO.addQuestion({
            quiz_id: quiz.id,
            question: 'Q1',
            options: JSON.stringify(['A', 'B', 'C', 'D']),
            correct_answer: 0
        });
        
        await QuizDAO.submitAnswer(q1.id, 0);
        
        const result = await GamificationService.processQuizResult(userUuid, quiz.uuid);
        
        expect(result.score).toBe(100);
        expect(result.pointsEarned).toBeGreaterThan(0);
        expect(result.status).toBe('passed');
    });
    
    test('getPointsTable() retourne la table des points', () => {
        const table = GamificationService.getPointsTable();
        
        expect(table.flashcard_create).toBe(10);
        expect(table.quiz_correct).toBe(10);
    });
    
    test('getBadges() retourne les badges', () => {
        const badges = GamificationService.getBadges();
        
        expect(badges.graine).toBeDefined();
        expect(badges.sage).toBeDefined();
    });
});

describe('🎨 AvatarService', () => {
    
    test('getInitials() extrait les initiales', () => {
        expect(AvatarService.getInitials('Aminata', 'Ouédraogo')).toBe('AO');
        expect(AvatarService.getInitials('Jean', 'Baptiste')).toBe('JB');
    });
    
    test('generateSVG() crée un SVG valide', () => {
        const svg = AvatarService.generateSVG('Aminata', 'Ouédraogo', 0);
        
        expect(svg).toContain('<svg');
        expect(svg).toContain('AO');
        expect(svg).toContain('</svg>');
    });
    
    test('generate() retourne toutes les données', () => {
        const avatar = AvatarService.generate('Aminata', 'Ouédraogo', 0);
        
        expect(avatar.svg).toBeDefined();
        expect(avatar.initials).toBe('AO');
        expect(avatar.color_scheme).toBeDefined();
        expect(avatar.seed).toBe(0);
    });
    
    test('generate() utilise un seed aléatoire si non fourni', () => {
        const avatar = AvatarService.generate('Aminata', 'Ouédraogo');
        
        expect(avatar.seed).toBeDefined();
        expect(typeof avatar.seed).toBe('number');
    });
});