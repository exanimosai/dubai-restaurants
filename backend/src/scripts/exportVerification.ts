// src/scripts/exportVerification.ts
import { config } from 'dotenv';
config();

import { pool } from '../config/database';
import * as fs from 'fs';
import * as path from 'path';
import { Parser } from 'json2csv';

interface RestaurantStats {
    [key: string]: number;
}

async function exportVerification() {
    try {
        console.log('Starting export verification...');

        // Get all restaurants with full details
        const results = await pool.query(`
            SELECT 
                name,
                category,
                price_range,
                vibe,
                address,
                seating,
                is_licensed,
                has_shisha,
                rating,
                google_place_id,
                latitude,
                longitude,
                created_at
            FROM restaurants 
            ORDER BY name ASC
        `);

        // Transform the data
        const transformedData = results.rows.map(row => ({
            name: row.name,
            category: row.category,
            price_range: row.price_range || '',
            vibe: Array.isArray(row.vibe) ? row.vibe.join(', ') : row.vibe,
            address: row.address,
            seating: row.seating,
            is_licensed: row.is_licensed ? 'Yes' : 'No',
            has_shisha: row.has_shisha ? 'Yes' : 'No',
            rating: row.rating,
            google_place_id: row.google_place_id,
            latitude: row.latitude,
            longitude: row.longitude,
            created_at: row.created_at.toISOString()
        }));

        // Create CSV fields
        const fields = [
            'name',
            'category',
            'price_range',
            'vibe',
            'address',
            'seating',
            'is_licensed',
            'has_shisha',
            'rating',
            'google_place_id',
            'latitude',
            'longitude',
            'created_at'
        ];

        // Create Parser with options
        const json2csvParser = new Parser({ 
            fields,
            delimiter: ',',
            quote: '"'
        });

        // Convert to CSV
        const csv = json2csvParser.parse(transformedData);

        // Create exports directory if it doesn't exist
        const exportDir = path.join(__dirname, '../../exports');
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir);
        }

        // Create filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = path.join(exportDir, `restaurants_verification_${timestamp}.csv`);

        // Write CSV file
        fs.writeFileSync(filename, csv);

        console.log(`Export completed successfully!`);
        console.log(`Total restaurants exported: ${results.rows.length}`);
        console.log(`File saved to: ${filename}`);

        // Generate quick statistics
        const byCategory: RestaurantStats = results.rows.reduce((acc, curr) => {
            acc[curr.category] = (acc[curr.category] || 0) + 1;
            return acc;
        }, {} as RestaurantStats);

        const stats = {
            totalRestaurants: results.rows.length,
            byCategory,
            averageRating: results.rows.reduce((acc, curr) => acc + curr.rating, 0) / results.rows.length,
            licensedCount: results.rows.filter(r => r.is_licensed).length,
            shishaCount: results.rows.filter(r => r.has_shisha).length
        };

        // Write statistics to a separate file
        const statsFilename = path.join(exportDir, `statistics_${timestamp}.txt`);
        const statsContent = `
Restaurant Statistics (${new Date().toISOString()})
================================================
Total Restaurants: ${stats.totalRestaurants}

Breakdown by Category:
${Object.entries(stats.byCategory)
    .map(([category, count]) => 
        `${category}: ${count} (${Math.round((count / stats.totalRestaurants) * 100)}%)`
    )
    .join('\n')}

Average Rating: ${stats.averageRating.toFixed(2)}
Licensed Venues: ${stats.licensedCount} (${Math.round((stats.licensedCount/stats.totalRestaurants) * 100)}%)
Shisha Available: ${stats.shishaCount} (${Math.round((stats.shishaCount/stats.totalRestaurants) * 100)}%)
        `;

        fs.writeFileSync(statsFilename, statsContent);
        console.log(`Statistics file saved to: ${statsFilename}`);

    } catch (error) {
        console.error('Export failed:', error);
    } finally {
        await pool.end();
    }
}

exportVerification();