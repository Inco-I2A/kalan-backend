// src/services/ocrService.js
// ==========================
// OCR : Extraction de texte depuis PDF ou images

const pdfParse = require('pdf-parse');

class OCRService {
    
    static async extractText(buffer, mimetype) {
        
        if (mimetype === 'application/pdf') {
            return this.extractFromPDF(buffer);
        }
        
        if (mimetype.startsWith('image/')) {
            return this.extractFromImage(buffer);
        }
        
        throw new Error(`Format non supporte : ${mimetype}`);
    }
    
    static async extractFromPDF(buffer) {
        try {
            const data = await pdfParse(buffer);
            return this.cleanText(data.text);
        } catch (err) {
            throw new Error(`Erreur lecture PDF : ${err.message}`);
        }
    }
    
    static async extractFromImage(buffer) {
        return `[IMAGE] - OCR image en cours d'integration. Image recue (${buffer.length} octets)`;
    }
    
    static cleanText(text) {
        return text
            .replace(/\s+/g, ' ')
            .replace(/(\r\n|\n|\r)/gm, ' ')
            .replace(/\t/g, ' ')
            .trim();
    }
    
    static async generateFlashcards(text, options = {}) {
        const { maxCards = 20, category = '' } = options;
        
        const sentences = this.splitIntoSentences(text);
        const flashcards = [];
        
        for (let i = 0; i < Math.min(sentences.length, maxCards); i++) {
            const sentence = sentences[i];
            const card = this.parseSentenceToCard(sentence, category);
            
            if (card) {
                flashcards.push(card);
            }
        }
        
        return flashcards;
    }
    
    static splitIntoSentences(text) {
        return text
            .split(/(?<=[.!?])\s+(?=[A-ZÀ-Ÿ])/)
            .map(s => s.trim())
            .filter(s => s.length > 10 && s.length < 500);
    }
    
    static parseSentenceToCard(sentence, category) {
        if (sentence.includes('?')) {
            const parts = sentence.split('?');
            return {
                front: parts[0].trim() + ' ?',
                back: parts.slice(1).join('?').trim() || 'A completer',
                category,
                source_type: 'pdf_import'
            };
        }
        
        const colonIndex = sentence.indexOf(':');
        if (colonIndex > 3 && colonIndex < 100) {
            return {
                front: sentence.substring(0, colonIndex).trim(),
                back: sentence.substring(colonIndex + 1).trim(),
                category,
                source_type: 'pdf_import'
            };
        }
        
        const estMatch = sentence.match(/^(.{3,50})\s+est\s+(.{5,200})/i);
        if (estMatch) {
            return {
                front: `Qu'est-ce que ${estMatch[1].trim()} ?`,
                back: estMatch[2].trim(),
                category,
                source_type: 'pdf_import'
            };
        }
        
        const mid = Math.floor(sentence.length / 2);
        const splitAt = sentence.indexOf(' ', mid);
        
        if (splitAt > 20) {
            return {
                front: sentence.substring(0, splitAt).trim() + '...',
                back: sentence.substring(splitAt).trim(),
                category,
                source_type: 'pdf_import'
            };
        }
        
        return null;
    }
}

module.exports = OCRService;