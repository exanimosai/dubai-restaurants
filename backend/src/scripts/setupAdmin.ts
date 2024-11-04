// src/scripts/setupAdmin.ts
import { config } from 'dotenv';
config();

import { Pool } from 'pg';
import bcrypt from 'bcrypt';

async function setupAdmin() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    // Admin user details
    const adminUser = {
        email: 'exanimosai@gmail.com',  // Your email
        password: 'dubaiFun25',         // Your password
        name: 'Admin User',
        role: 'admin'
    };

    try {
        console.log('Setting up admin user...');

        // Check if admin already exists
        const existingAdmin = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [adminUser.email]
        );

        if (existingAdmin.rows.length > 0) {
            console.log('Admin user already exists. Updating password...');
            
            // Update existing admin
            const passwordHash = await bcrypt.hash(adminUser.password, 10);
            await pool.query(
                'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2',
                [passwordHash, adminUser.email]
            );
            
            console.log('Admin password updated successfully');
        } else {
            // Create new admin user
            const passwordHash = await bcrypt.hash(adminUser.password, 10);
            
            await pool.query(
                `INSERT INTO users (email, password_hash, name, role) 
                 VALUES ($1, $2, $3, $4)`,
                [adminUser.email, passwordHash, adminUser.name, adminUser.role]
            );
            
            console.log('Admin user created successfully');
        }

        // Verify admin user
        const verifyAdmin = await pool.query(
            'SELECT id, email, role, created_at FROM users WHERE email = $1',
            [adminUser.email]
        );

        console.log('\nAdmin user details:');
        console.log(verifyAdmin.rows[0]);

    } catch (error) {
        console.error('Error setting up admin user:', error);
    } finally {
        await pool.end();
    }
}

setupAdmin();