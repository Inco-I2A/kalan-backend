// src/config/database.js
// ======================
// Configuration SQLite — KALAN

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/kalan.db');

console.log('📁 Chemin base de données:', path.resolve(DB_PATH));

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('✅ Dossier data/ créé');
} else {
    console.log('✅ Dossier data/ existe déjà');
}

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Erreur connexion SQLite:', err.message);
    } else {
        console.log('✅ Connecté à SQLite — KALAN');
    }
});

// Promisify pour async/await
const get = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const all = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const run = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) {
                console.error('❌ SQL run() error:', err.message, '\n   SQL:', sql);
                reject(err);
            } else {
                resolve({ lastID: this.lastID, changes: this.changes });
            }
        });
    });
};

// Activer les clés étrangères
db.run('PRAGMA foreign_keys = ON', [], (err) => {
    if (err) {
        console.error('❌ Erreur activation FK:', err.message);
    } else {
        console.log('✅ Clés étrangères activées');
    }
});

// Initialisation des tables
async function initDatabase() {
    try {
        // Écoles
        await run(`
            CREATE TABLE IF NOT EXISTS schools (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                region TEXT DEFAULT '',
                city TEXT DEFAULT '',
                type TEXT DEFAULT 'public',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Classes
        await run(`
            CREATE TABLE IF NOT EXISTS classes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                school_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                level TEXT DEFAULT 'college',
                student_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
            )
        `);

        // Utilisateurs (élèves)
        await run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uuid TEXT UNIQUE NOT NULL,
                firstName TEXT NOT NULL,
                lastName TEXT NOT NULL,
                pseudo TEXT NOT NULL,
                school_id INTEGER NOT NULL,
                class_id INTEGER NOT NULL,
                level INTEGER DEFAULT 1,
                xp INTEGER DEFAULT 0,
                total_points INTEGER DEFAULT 0,
                streak_days INTEGER DEFAULT 0,
                last_active DATETIME,
                is_active INTEGER DEFAULT 1,
                language_pref TEXT DEFAULT 'fr',
                avatar_svg TEXT,
                avatar_seed INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (school_id) REFERENCES schools(id),
                FOREIGN KEY (class_id) REFERENCES classes(id)
            )
        `);

        // Decks
        await run(`
            CREATE TABLE IF NOT EXISTS decks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uuid TEXT UNIQUE NOT NULL,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                category TEXT DEFAULT '',
                is_public INTEGER DEFAULT 0,
                card_count INTEGER DEFAULT 0,
                download_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Flashcards
        await run(`
            CREATE TABLE IF NOT EXISTS flashcards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uuid TEXT UNIQUE NOT NULL,
                user_id INTEGER NOT NULL,
                deck_id INTEGER NOT NULL,
                front TEXT NOT NULL,
                back TEXT NOT NULL,
                category TEXT DEFAULT '',
                difficulty INTEGER DEFAULT 1,
                mastery_level INTEGER DEFAULT 0,
                review_count INTEGER DEFAULT 0,
                last_reviewed DATETIME,
                next_review DATETIME,
                source_type TEXT DEFAULT 'manual',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
            )
        `);

        // Quiz
        await run(`
            CREATE TABLE IF NOT EXISTS quizzes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uuid TEXT UNIQUE NOT NULL,
                user_id INTEGER NOT NULL,
                deck_id INTEGER,
                type TEXT DEFAULT 'standard',
                status TEXT DEFAULT 'active',
                score INTEGER DEFAULT 0,
                total_questions INTEGER DEFAULT 0,
                correct_answers INTEGER DEFAULT 0,
                total_time_limit INTEGER DEFAULT 300,
                time_per_question INTEGER DEFAULT 15,
                started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE SET NULL
            )
        `);

        // Questions de quiz
        await run(`
            CREATE TABLE IF NOT EXISTS quiz_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                quiz_id INTEGER NOT NULL,
                flashcard_id INTEGER,
                question TEXT NOT NULL,
                options TEXT NOT NULL,
                correct_answer INTEGER NOT NULL,
                explanation TEXT DEFAULT '',
                time_limit INTEGER DEFAULT 15,
                time_spent INTEGER DEFAULT 0,
                user_answer INTEGER,
                is_correct INTEGER,
                is_answered INTEGER DEFAULT 0,
                is_skipped INTEGER DEFAULT 0,
                skipped_at DATETIME,
                points_earned INTEGER DEFAULT 0,
                display_order INTEGER DEFAULT 0,
                answered_at DATETIME,
                FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
                FOREIGN KEY (flashcard_id) REFERENCES flashcards(id) ON DELETE SET NULL
            )
        `);

        // Badges utilisateurs
        await run(`
            CREATE TABLE IF NOT EXISTS user_badges (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                badge_id TEXT NOT NULL,
                unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Classement
        await run(`
            CREATE TABLE IF NOT EXISTS rankings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                class_id INTEGER,
                school_id INTEGER,
                period TEXT DEFAULT 'weekly',
                score INTEGER DEFAULT 0,
                rank INTEGER,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        console.log('✅ SQLite version:', db.version || '3.44.2');
        console.log('✅ Base prête !');
        
    } catch (err) {
        console.error('❌ Erreur initialisation DB:', err);
        throw err;
    }
}

initDatabase();

module.exports = { db, get, all, run };