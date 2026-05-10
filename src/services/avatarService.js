// src/services/avatarService.js
// ==============================
// Génération d'avatars pour les élèves

class AvatarService {
    
    static COLORS = [
        { bg: '#E63946', fg: '#FFFFFF' },
        { bg: '#F4A261', fg: '#1D3557' },
        { bg: '#2A9D8F', fg: '#FFFFFF' },
        { bg: '#E9C46A', fg: '#264653' },
        { bg: '#264653', fg: '#F4A261' },
        { bg: '#8B4513', fg: '#F5DEB3' },
        { bg: '#D62828', fg: '#FCBF49' },
        { bg: '#006D77', fg: '#E29578' },
    ];
    
    static getInitials(firstName, lastName) {
        const f = firstName?.charAt(0)?.toUpperCase() || '?';
        const l = lastName?.charAt(0)?.toUpperCase() || '';
        return `${f}${l}`;
    }
    
    static generateSVG(firstName, lastName, seed = null) {
        const initials = this.getInitials(firstName, lastName);
        const colorIndex = seed !== null 
            ? seed % this.COLORS.length 
            : Math.floor(Math.random() * this.COLORS.length);
        const colors = this.COLORS[colorIndex];
        
        return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="5" width="90" height="90" rx="15" fill="${colors.bg}"/>
    <circle cx="50" cy="50" r="25" fill="${colors.fg}" opacity="0.3"/>
    <text x="50" y="58" font-family="Arial" font-size="28" font-weight="bold" text-anchor="middle" fill="${colors.fg}">${initials}</text>
</svg>`;
    }
    
    static generate(firstName, lastName, seed = null) {
        const svg = this.generateSVG(firstName, lastName, seed);
        const colorIndex = seed !== null 
            ? seed % this.COLORS.length 
            : Math.floor(Math.random() * this.COLORS.length);
        
        return {
            svg,
            initials: this.getInitials(firstName, lastName),
            color_scheme: this.COLORS[colorIndex],
            seed: seed !== null ? seed : Math.floor(Math.random() * 1000)
        };
    }
}

module.exports = AvatarService;