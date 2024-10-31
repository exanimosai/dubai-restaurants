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

// Log pool events
pool.on('connect', () => {
    console.log('Database connected successfully');
});

pool.on('error', (err: Error) => {
    console.error('Unexpected database error:', err);
});