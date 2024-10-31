// src/server.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { pool } from './config/database';

const app = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// Authentication middleware
const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    jwt.verify(token, process.env.JWT_SECRET!, (err: any, user: any) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};

// Public routes
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Auth routes
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        const user = result.rows[0];
        
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        await pool.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET!,
            { expiresIn: '24h' }
        );

        res.json({ 
            token, 
            user: { 
                id: user.id, 
                email: user.email, 
                role: user.role,
                name: user.name 
            } 
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Protected routes
app.get('/api/restaurants', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                r.*,
                u.name as added_by_user,
                u2.name as modified_by_user
            FROM restaurants r
            LEFT JOIN users u ON r.added_by = u.id
            LEFT JOIN users u2 ON r.last_modified_by = u2.id
            ORDER BY r.created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching restaurants:', error);
        res.status(500).json({ error: 'Failed to fetch restaurants' });
    }
});

app.post('/api/restaurants', authenticateToken, async (req, res) => {
    try {
        const { 
            name, category, price_range, vibe, 
            latitude, longitude, address, seating,
            is_licensed, has_shisha, google_place_id 
        } = req.body;

        const result = await pool.query(`
            INSERT INTO restaurants (
                name, category, price_range, vibe, 
                latitude, longitude, address, seating,
                is_licensed, has_shisha, google_place_id,
                added_by, last_modified_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
            RETURNING *
        `, [
            name, category, price_range, vibe,
            latitude, longitude, address, seating,
            is_licensed, has_shisha, google_place_id,
            req.user.id
        ]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding restaurant:', error);
        res.status(500).json({ error: 'Failed to add restaurant' });
    }
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
