// src/config/database.ts
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isProduction ? {
        rejectUnauthorized: false,
        require: true
    } : false
});

// Test database connection on startup
pool.on('connect', () => {
    console.log('Database connected successfully');
});

pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
    // Don't exit process on connection error
    if (err.code === 'ECONNREFUSED') {
        console.error('Database connection refused - retrying...');
    }
});