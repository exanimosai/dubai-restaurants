// src/scripts/setupSchema.ts
import { config } from 'dotenv';
config();

import { Pool } from 'pg';

async function setupSchema() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        console.log('Setting up database schema...');

        // Create enum types
        await pool.query(`
            DO $$ BEGIN
                CREATE TYPE venue_category AS ENUM ('Bar', 'Restaurant', 'Cafe');
                CREATE TYPE seating_type AS ENUM ('Indoor', 'Al Fresco', 'Both');
                CREATE TYPE user_role AS ENUM ('admin', 'user');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);
        console.log('Created enum types');

        // Create users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                role user_role DEFAULT 'user',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP WITH TIME ZONE,
                CONSTRAINT check_user_limit CHECK (id <= 10)
            );
        `);
        console.log('Created users table');

        // Create restaurants table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS restaurants (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                category venue_category,
                price_range VARCHAR(50),
                vibe TEXT[],
                latitude DECIMAL(10, 8),
                longitude DECIMAL(11, 8),
                address TEXT,
                seating seating_type,
                is_licensed BOOLEAN DEFAULT false,
                has_shisha BOOLEAN DEFAULT false,
                google_place_id VARCHAR(255) UNIQUE,
                rating DECIMAL(3, 2),
                added_by INTEGER REFERENCES users(id),
                last_modified_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Created restaurants table');

        // Create indexes
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_restaurants_name ON restaurants(name);
            CREATE INDEX IF NOT EXISTS idx_restaurants_category ON restaurants(category);
            CREATE INDEX IF NOT EXISTS idx_google_place_id ON restaurants(google_place_id);
            CREATE INDEX IF NOT EXISTS idx_restaurants_location ON restaurants(latitude, longitude);
        `);
        console.log('Created indexes');

        // Verify tables
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log('\nAvailable tables:', tables.rows.map(row => row.table_name));

        console.log('\nSchema setup completed successfully');
    } catch (error) {
        console.error('Error setting up schema:', error);
    } finally {
        await pool.end();
    }
}

setupSchema();