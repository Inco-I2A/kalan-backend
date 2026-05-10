// src/services/authService.js
// ===========================
// Authentification JWT — CDC p.4

const jwt = require('jsonwebtoken');
const { UserDAO } = require('../models');
const AvatarService = require('./avatarService'); // ← Import direct, pas via index.js

const JWT_SECRET = process.env.JWT_SECRET || 'kalan-default-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

class AuthService {
    
    static generateToken(user) {
        return jwt.sign(
            { userId: user.id, uuid: user.uuid, role: 'student' },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
    }
    
    static verifyToken(token) {
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (err) {
            throw new Error('Token invalide ou expiré');
        }
    }
    
    static async register({ firstName, lastName, pseudo, school_id, class_id, uuid: existingUuid }) {
        if (!firstName || firstName.length < 2) {
            throw new Error('Le prénom doit contenir au moins 2 caractères');
        }
        if (!lastName || lastName.length < 2) {
            throw new Error('Le nom doit contenir au moins 2 caractères');
        }
        if (!pseudo || pseudo.length < 2) {
            throw new Error('Le pseudo doit contenir au moins 2 caractères');
        }
        
        let user;
        let isNew = true;
        
        if (existingUuid) {
            user = await UserDAO.findByUuid(existingUuid);
            if (user) {
                user = await UserDAO.updateProfile(existingUuid, { firstName, lastName, pseudo });
                isNew = false;
            }
        }
        
        if (!user) {
            user = await UserDAO.create({
                firstName,
                lastName,
                pseudo,
                school_id,
                class_id
            });
        }
        
        // Vérifier que AvatarService est bien défini
        if (!AvatarService || !AvatarService.generate) {
            throw new Error('AvatarService non initialisé correctement');
        }
        
        const avatar = AvatarService.generate(firstName, lastName, user.id);
        await UserDAO.updateAvatar(user.uuid, avatar.svg, avatar.seed);
        
        const token = this.generateToken(user);
        
        return {
            success: true,
            user: {
                ...this.sanitizeUser(user),
                avatar: avatar.svg,
                avatar_seed: avatar.seed
            },
            token,
            isNew,
            message: isNew ? 'Bienvenue sur KALAN !' : 'Profil mis à jour'
        };
    }
    
    static async loginByUuid(uuid) {
        const user = await UserDAO.findByUuid(uuid);
        
        if (!user) {
            throw new Error('Utilisateur non trouvé. Veuillez vous inscrire.');
        }
        
        if (!user.is_active) {
            throw new Error('Compte désactivé. Contactez l\'administration.');
        }
        
        await UserDAO.updateStreak(uuid);
        
        const token = this.generateToken(user);
        
        return {
            success: true,
            user: this.sanitizeUser(user),
            token,
            message: 'Connexion réussie !'
        };
    }
    
    static async refreshToken(token) {
        const decoded = this.verifyToken(token);
        const user = await UserDAO.findByUuid(decoded.uuid);
        
        if (!user) {
            throw new Error('Utilisateur non trouvé');
        }
        
        return this.generateToken(user);
    }
    
    static sanitizeUser(user) {
        const { id, is_active, ...safe } = user;
        return safe;
    }
}

module.exports = AuthService;