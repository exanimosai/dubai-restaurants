// src/config/database.ts
import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

const poolConfig: PoolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: isProduction ? {
        rejectUnauthorized: false
    } : false
};

export const pool = new Pool(poolConfig);

// Connection event handlers
pool.on('connect', () => {
    console.log('Database connected successfully');
});

pool.on('error', (err: Error & { code?: string }) => {
    console.error('Unexpected database error:', err);
    // Don't exit process on connection error
    if (err.code === 'ECONNREFUSED') {
        console.error('Database connection refused - retrying...');
    }
});