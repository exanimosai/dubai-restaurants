// src/server.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { pool } from './config/database';

// Types
interface AuthRequest extends Request {
    user?: {
        id: number;
        email: string;
        role: string;
    };
}

const app = express();

// Middleware
app.use(cors({
    origin: '*' // We'll configure this properly when we have a frontend
}));
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// Authentication middleware
const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
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
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({ error: 'Authentication error' });
    }
};

// Public routes
app.get('/health', async (req: Request, res: Response) => {
    try {
        const dbResult = await pool.query('SELECT NOW()');
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV,
            database: 'connected',
            dbTime: dbResult.rows[0].now
        });
    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: process.env.NODE_ENV === 'development' ? error : 'Internal server error'
        });
    }
});

// Auth routes
app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

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
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Protected routes
app.get('/api/restaurants', authenticateToken, async (req: AuthRequest, res: Response) => {
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

app.post('/api/restaurants', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { 
            name, category, price_range, vibe, 
            latitude, longitude, address, seating,
            is_licensed, has_shisha, google_place_id 
        } = req.body;

        if (!name || !category) {
            return res.status(400).json({ error: 'Name and category are required' });
        }

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
            req.user?.id
        ]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding restaurant:', error);
        res.status(500).json({ error: 'Failed to add restaurant' });
    }
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'An unexpected error occurred' });
});

// Initialize server
const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        // Test database connection
        await pool.query('SELECT NOW()');
        console.log('Database connection successful');

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Start server
startServer();

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});