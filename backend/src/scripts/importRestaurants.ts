// src/scripts/importRestaurants.ts
import { pool } from '../config/database';
import GooglePlacesService from '../services/googlePlaces';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse';

interface RestaurantCSV {
    Name: string;
    Price: string;
    'Vibe - fixed keywords': string;
    'Optional tags': string;
    'Category - meals, drinks, shisha, cafe': string;
    'Al Fresco, Indoor': string;
    Licensed: string;
    Shisha: string;
}

interface PlaceData {
    place_id: string;
    formatted_address: string;
    geometry: {
        location: {
            lat: number;
            lng: number;
        }
    };
    rating?: number;
}

async function findGooglePlace(placesService: GooglePlacesService, name: string): Promise<PlaceData | null> {
    try {
        const searchResults = await placesService.searchPlaces(`${name} Dubai`);
        if (searchResults && searchResults.length > 0) {
            return searchResults[0];
        }
        return null;
    } catch (error) {
        console.error(`Error finding place for ${name}:`, error);
        return null;
    }
}

async function importRestaurants() {
    const placesService = new GooglePlacesService(process.env.GOOGLE_MAPS_API_KEY!);
    const csvFilePath = path.resolve(__dirname, '../../data/restaurants.csv');

    const fileContent = fs.readFileSync(csvFilePath, { encoding: 'utf-8' });
    
    parse(fileContent, {
        columns: true,
        skip_empty_lines: true
    }, async (err, records: RestaurantCSV[]) => {
        if (err) {
            console.error('Error parsing CSV:', err);
            return;
        }

        for (const record of records) {
            try {
                console.log(`Processing ${record.Name}...`);
                
                // Search Google Places
                const placeData = await findGooglePlace(placesService, record.Name);
                
                if (placeData) {
                    // Convert seating type string to enum value
                    let seating: string;
                    if (record['Al Fresco, Indoor'].includes(',')) {
                        seating = 'Both';
                    } else if (record['Al Fresco, Indoor'].includes('Al Fresco')) {
                        seating = 'Al Fresco';
                    } else {
                        seating = 'Indoor';
                    }

                    // Insert into database
                    await pool.query(
                        `INSERT INTO restaurants (
                            name, 
                            category,
                            price_range,
                            vibe,
                            latitude,
                            longitude,
                            address,
                            seating,
                            is_licensed,
                            has_shisha,
                            google_place_id,
                            rating
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                        ON CONFLICT (google_place_id) DO UPDATE
                        SET 
                            name = EXCLUDED.name,
                            category = EXCLUDED.category,
                            price_range = EXCLUDED.price_range,
                            vibe = EXCLUDED.vibe,
                            address = EXCLUDED.address,
                            seating = EXCLUDED.seating,
                            is_licensed = EXCLUDED.is_licensed,
                            has_shisha = EXCLUDED.has_shisha,
                            rating = EXCLUDED.rating,
                            updated_at = CURRENT_TIMESTAMP
                        `,
                        [
                            record.Name,
                            record['Category - meals, drinks, shisha, cafe'],
                            record.Price || null,
                            record['Vibe - fixed keywords'].split(',').map(v => v.trim()),
                            placeData.geometry.location.lat,
                            placeData.geometry.location.lng,
                            placeData.formatted_address,
                            seating,
                            record.Licensed === 'Yes',
                            record.Shisha === 'Yes',
                            placeData.place_id,
                            placeData.rating || null
                        ]
                    );
                    console.log(`✅ Imported ${record.Name} successfully`);
                } else {
                    console.warn(`⚠️ No Google Places match found for ${record.Name}`);
                }

                // Add delay to respect Google Places API rate limits
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`❌ Error importing ${record.Name}:`, error);
            }
        }

        console.log('Import completed');
        process.exit(0);
    });
}

// Run the import
importRestaurants().catch(error => {
    console.error('Import failed:', error);
    process.exit(1);
});