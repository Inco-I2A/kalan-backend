// src/models/SchoolDAO.js
// =======================
// Gestion des écoles et classes

const { get, all, run } = require('../config/database');

class SchoolDAO {
    
    static async createSchool({ name, region = '', city = '', type = 'public' }) {
        if (!name || name.length < 2) {
            throw new Error('Le nom de l\'école doit contenir au moins 2 caractères');
        }
        
        const result = await run(
            `INSERT INTO schools (name, region, city, type)
             VALUES (?, ?, ?, ?)`,
            [name, region, city, type]
        );
        
        return this.findSchoolById(result.lastID);
    }
    
    static async createClass({ school_id, name, level = 'college' }) {
        if (!name || name.length < 2) {
            throw new Error('Le nom de la classe doit contenir au moins 2 caractères');
        }
        
        const result = await run(
            `INSERT INTO classes (school_id, name, level)
             VALUES (?, ?, ?)`,
            [school_id, name, level]
        );
        
        return this.findClassById(result.lastID);
    }
    
    static async findSchoolById(id) {
        return get('SELECT * FROM schools WHERE id = ?', [id]);
    }
    
    static async findClassById(id) {
        return get(
            `SELECT c.*, s.name as school_name 
             FROM classes c
             LEFT JOIN schools s ON c.school_id = s.id
             WHERE c.id = ?`,
            [id]
        );
    }
    
    static async findAllSchools({ search = null, limit = 50, offset = 0 }) {
        let sql = 'SELECT * FROM schools WHERE 1=1';
        const params = [];
        
        if (search) {
            sql += ' AND (name LIKE ? OR city LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        
        sql += ' ORDER BY name ASC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        
        return all(sql, params);
    }
    
    static async findClassesBySchool(schoolId) {
        return all(
            `SELECT c.*, 
                (SELECT COUNT(*) FROM users WHERE class_id = c.id AND is_active = 1) as student_count
             FROM classes c
             WHERE c.school_id = ?
             ORDER BY c.name ASC`,
            [schoolId]
        );
    }
    
    static async findSchoolByIdWithClasses(id) {
        const school = await this.findSchoolById(id);
        if (!school) return null;
        
        const classes = await this.findClassesBySchool(id);
        return { ...school, classes };
    }
    
    static async updateSchool(id, fields) {
        const allowed = ['name', 'region', 'city', 'type'];
        const updates = [];
        const values = [];
        
        for (const [key, value] of Object.entries(fields)) {
            if (allowed.includes(key)) {
                updates.push(`${key} = ?`);
                values.push(value);
            }
        }
        
        if (updates.length === 0) return null;
        
        values.push(id);
        
        await run(
            `UPDATE schools SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`,
            values
        );
        
        return this.findSchoolById(id);
    }
    
    static async deleteSchool(id) {
        const result = await run('DELETE FROM schools WHERE id = ?', [id]);
        return result.changes > 0;
    }
}

module.exports = SchoolDAO;