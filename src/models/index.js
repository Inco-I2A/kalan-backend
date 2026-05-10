// src/models/index.js
// ===================

const UserDAO = require('./UserDAO');
const SchoolDAO = require('./SchoolDAO');
const DeckDAO = require('./DeckDAO');
const FlashcardDAO = require('./FlashcardDAO');
const QuizDAO = require('./QuizDAO');

module.exports = {
    UserDAO,
    SchoolDAO,
    DeckDAO,
    FlashcardDAO,
    QuizDAO
};