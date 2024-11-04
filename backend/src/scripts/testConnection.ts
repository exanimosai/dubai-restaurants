// src/scripts/testConnection.ts
import { config } from 'dotenv';
config();

import { Pool } from 'pg';

async function testConnection() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        console.log('Testing database connection...');
        const result = await pool.query('SELECT NOW()');
        console.log('Connection successful, server time:', result.rows[0].now);
        
        // Test schema
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log('\nAvailable tables:', tables.rows.map(row => row.table_name));
        
    } catch (error) {
        console.error('Connection failed:', error);
    } finally {
        await pool.end();
    }
}

testConnection();