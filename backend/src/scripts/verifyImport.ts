// src/scripts/verifyImport.ts
import { config } from 'dotenv';
config();

import { pool } from '../config/database';

async function verifyImport() {
    try {
        console.log('Starting verification...\n');

        // Get total count
        const countResult = await pool.query('SELECT COUNT(*) FROM restaurants');
        console.log(`Total restaurants in database: ${countResult.rows[0].count}`);

        // Get breakdown by category
        const categoryCount = await pool.query(`
            SELECT category, COUNT(*) 
            FROM restaurants 
            GROUP BY category 
            ORDER BY COUNT(*) DESC
        `);
        
        console.log('\nBreakdown by category:');
        categoryCount.rows.forEach(cat => {
            console.log(`${cat.category}: ${cat.count}`);
        });

        // Check for missing data
        const missingData = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE google_place_id IS NULL) as missing_place_id,
                COUNT(*) FILTER (WHERE latitude IS NULL) as missing_location,
                COUNT(*) FILTER (WHERE rating IS NULL) as missing_rating,
                COUNT(*) FILTER (WHERE address IS NULL) as missing_address
            FROM restaurants
        `);
        
        console.log('\nMissing data check:');
        console.log('Missing Google Place ID:', missingData.rows[0].missing_place_id);
        console.log('Missing Location:', missingData.rows[0].missing_location);
        console.log('Missing Rating:', missingData.rows[0].missing_rating);
        console.log('Missing Address:', missingData.rows[0].missing_address);

        // List restaurants without Google Places data
        const missingPlaces = await pool.query(`
            SELECT name, category 
            FROM restaurants 
            WHERE google_place_id IS NULL
            ORDER BY name
        `);

        if (missingPlaces.rows.length > 0) {
            console.log('\nRestaurants missing Google Places data:');
            missingPlaces.rows.forEach(restaurant => {
                console.log(`- ${restaurant.name} (${restaurant.category})`);
            });
        }

        // Show sample of successful imports
        const sample = await pool.query(`
            SELECT 
                name, 
                category,
                address,
                seating,
                is_licensed,
                has_shisha,
                rating
            FROM restaurants 
            WHERE google_place_id IS NOT NULL 
            LIMIT 5
        `);

        console.log('\nSample of successful imports:');
        sample.rows.forEach(restaurant => {
            console.log('\nRestaurant:', restaurant.name);
            console.log('Category:', restaurant.category);
            console.log('Address:', restaurant.address);
            console.log('Seating:', restaurant.seating);
            console.log('Licensed:', restaurant.is_licensed ? 'Yes' : 'No');
            console.log('Shisha:', restaurant.has_shisha ? 'Yes' : 'No');
            console.log('Rating:', restaurant.rating);
        });

    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        await pool.end();
    }
}

verifyImport();