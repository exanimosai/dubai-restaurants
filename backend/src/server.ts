// src/server.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { pool } from './config/database';
import placesRoutes from './routes/places';

// Types
interface AuthRequest extends Request {
    user?: {
        id: number;
        email: string;
        role: string;
    };
}

interface ErrorWithMessage extends Error {
    message: string;
    stack?: string;
}

const isErrorWithMessage = (error: unknown): error is ErrorWithMessage => {
    return (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as Record<string, unknown>).message === 'string'
    );
};

const toErrorWithMessage = (maybeError: unknown): ErrorWithMessage => {
    if (isErrorWithMessage(maybeError)) return maybeError;

    try {
        return new Error(JSON.stringify(maybeError));
    } catch {
        return new Error(String(maybeError));
    }
};

const app = express();

// Enhanced error logging
const logError = (error: unknown, context: string) => {
    const errorWithMessage = toErrorWithMessage(error);
    console.error('====================');
    console.error(`Error in ${context}:`);
    console.error('Message:', errorWithMessage.message);
    console.error('Stack:', errorWithMessage.stack);
    console.error('====================');
};

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use('/api/places', placesRoutes);
app.use('/api/restaurants', placesRouter);

// Basic route to test server is running
app.get('/', (_req: Request, res: Response) => {
    res.json({ message: 'Server is running' });
});

// Health check endpoint with detailed diagnostics
app.get('/health', async (_req: Request, res: Response) => {
    console.log('Health check requested');
    try {
        const dbResult = await pool.query('SELECT NOW()');
        
        res.json({
            status: 'ok',
            checks: {
                server: 'running',
                database: 'connected',
                timestamp: dbResult.rows[0].now,
                environment: process.env.NODE_ENV
            }
        });
    } catch (error: unknown) {
        logError(error, 'Health Check');
        res.status(500).json({
            status: 'error',
            message: 'Health check failed',
            error: process.env.NODE_ENV === 'development' 
                ? toErrorWithMessage(error).message 
                : 'Internal server error'
        });
    }
});

// Authentication middleware
const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        jwt.verify(token, process.env.JWT_SECRET!, (err: Error | null, user: any) => {
            if (err) return res.status(403).json({ error: 'Invalid token' });
            req.user = user;
            next();
        });
    } catch (error: unknown) {
        logError(error, 'Auth Middleware');
        res.status(500).json({ error: 'Authentication error' });
    }
};

// Auth routes
app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
        console.log('Login attempt received for:', req.body.email);
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        const user = result.rows[0];
        console.log('User found:', !!user);
        
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

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
    } catch (error: unknown) {
        logError(error, 'Login');
        res.status(500).json({ 
            error: 'Server error during login',
            details: process.env.NODE_ENV === 'development' 
                ? toErrorWithMessage(error).message 
                : undefined
        });
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
    } catch (error: unknown) {
        logError(error, 'Get Restaurants');
        res.status(500).json({ 
            error: 'Failed to fetch restaurants',
            details: process.env.NODE_ENV === 'development' 
                ? toErrorWithMessage(error).message 
                : undefined
        });
    }
});

// Global error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    logError(err, 'Global Error Handler');
    res.status(500).json({ 
        error: 'An unexpected error occurred',
        details: process.env.NODE_ENV === 'development' 
            ? toErrorWithMessage(err).message 
            : undefined
    });
});

// Server startup with retry logic
const startServer = async (): Promise<void> => {
    let retries = 5;
    
    while (retries) {
        try {
            console.log(`Starting server (attempt ${6 - retries}/5)...`);
            console.log('Environment:', process.env.NODE_ENV);
            console.log('Port:', process.env.PORT);
            
            // Test database connection
            console.log('Testing database connection...');
            await pool.query('SELECT NOW()');
            console.log('✅ Database connection successful');

            const PORT = parseInt(process.env.PORT || '3000', 10);
            app.listen(PORT, '0.0.0.0', () => {
                console.log(`✅ Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
            });
            
            return; // Successfully started
        } catch (error: unknown) {
            logError(error, 'Server Startup');
            retries -= 1;
            if (retries) {
                console.log(`Retrying in 5 seconds... (${retries} attempts remaining)`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            } else {
                console.error('Failed to start server after 5 attempts');
                process.exit(1);
            }
        }
    }
};

// Process handlers
process.on('unhandledRejection', (reason: unknown) => {
    logError(reason, 'Unhandled Rejection');
});

process.on('uncaughtException', (error: unknown) => {
    logError(error, 'Uncaught Exception');
    process.exit(1);
});

// Graceful shutdown
const shutDown = async (): Promise<void> => {
    console.log('Shutting down gracefully...');
    try {
        await pool.end();
        console.log('Database connections closed');
        process.exit(0);
    } catch (error: unknown) {
        logError(error, 'Shutdown');
        process.exit(1);
    }
};

process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);

// Start server
console.log('Initializing application...');
startServer().catch((error: unknown) => {
    logError(error, 'Server Initialization');
    process.exit(1);
});