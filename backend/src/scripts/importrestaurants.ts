// src/scripts/importRestaurants.ts
import { config } from 'dotenv';
config();

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
    Area?: string;          // New field
    'Full Name'?: string;   // New field
    Landmark?: string;      // New field
}

async function findGooglePlace(placesService: GooglePlacesService, restaurant: RestaurantCSV): Promise<any> {
    try {
        // Build search terms using all available information
        const searchTerms = [];
        
        // Add most specific search first
        if (restaurant['Full Name']) {
            searchTerms.push(restaurant['Full Name']);
        }

        // Add combinations with area and landmark
        if (restaurant.Area) {
            searchTerms.push(`${restaurant.Name} ${restaurant.Area} Dubai`);
            searchTerms.push(`${restaurant.Name} restaurant ${restaurant.Area} Dubai`);
        }

        if (restaurant.Landmark) {
            searchTerms.push(`${restaurant.Name} ${restaurant.Landmark} Dubai`);
        }

        // Add general searches as fallback
        searchTerms.push(
            `${restaurant.Name} Dubai restaurant`,
            `${restaurant.Name} Dubai ${restaurant['Category - meals, drinks, shisha, cafe'].toLowerCase()}`,
            `${restaurant.Name} Dubai UAE`
        );

        // Remove duplicates and empty terms
        const uniqueSearchTerms = [...new Set(searchTerms.filter(Boolean))];

        for (const searchTerm of uniqueSearchTerms) {
            console.log(`Trying search term: "${searchTerm}"`);
            const searchResults = await placesService.searchPlaces(searchTerm);
            
            if (searchResults && searchResults.length > 0) {
                console.log(`Found ${searchResults.length} results for "${searchTerm}":`);
                searchResults.forEach((result, index) => {
                    console.log(`${index + 1}. ${result.name} - ${result.formatted_address}`);
                });

                // Look for exact matches first
                const exactMatch = searchResults.find(place => {
                    const placeName = place.name.toLowerCase();
                    const searchName = restaurant.Name.toLowerCase();
                    return placeName.includes(searchName) || searchName.includes(placeName);
                });

                if (exactMatch) {
                    console.log('Found exact match:', exactMatch.name);
                    return exactMatch;
                }

                // If no exact match but we have results for a specific search, return the first one
                if (searchTerm.includes(restaurant.Area) || 
                    searchTerm.includes(restaurant.Landmark) ||
                    searchTerm === restaurant['Full Name']) {
                    console.log('Found location-specific match:', searchResults[0].name);
                    return searchResults[0];
                }
            }
        }

        console.log(`No matches found for "${restaurant.Name}" after trying all search terms`);
        return null;
    } catch (error) {
        console.error(`Error finding place for ${restaurant.Name}:`, error);
        return null;
    }
}

// src/scripts/importRestaurants.ts
// ... previous imports ...

async function importRestaurants() {
    try {
        // ... previous setup code ...

        parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true // Add this to trim whitespace
        }, async (err, records: RestaurantCSV[]) => {
            if (err) {
                throw new Error(`Error parsing CSV: ${err.message}`);
            }

            // Filter out empty rows
            const validRecords = records.filter(record => 
                record.Name && 
                record['Category - meals, drinks, shisha, cafe']
            );

            console.log(`Found ${validRecords.length} valid restaurants to process`);

            for (const record of validRecords) {
                try {
                    console.log(`\nProcessing ${record.Name}...`);
                    
                    const placeData = await findGooglePlace(placesService, record.Name);
                    
                    if (placeData) {
                        // Map category to enum value
                        let category: string;
                        const rawCategory = record['Category - meals, drinks, shisha, cafe'].toLowerCase();
                        if (rawCategory.includes('bar')) {
                            category = 'Bar';
                        } else if (rawCategory.includes('restaurant')) {
                            category = 'Restaurant';
                        } else if (rawCategory.includes('cafe')) {
                            category = 'Cafe';
                        } else {
                            console.warn(`Skipping ${record.Name} - invalid category: ${rawCategory}`);
                            continue;
                        }

                        // Map seating type
                        let seating: string;
                        const rawSeating = record['Al Fresco, Indoor'];
                        if (rawSeating.includes(',')) {
                            seating = 'Both';
                        } else if (rawSeating.includes('Al Fresco')) {
                            seating = 'Al Fresco';
                        } else {
                            seating = 'Indoor';
                        }

                        // Clean and validate vibe array
                        const vibe = record['Vibe - fixed keywords']
                            .split(',')
                            .map(v => v.trim())
                            .filter(Boolean); // Remove empty strings

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
                            ON CONFLICT (google_place_id) 
                            DO UPDATE SET 
                                name = EXCLUDED.name,
                                category = EXCLUDED.category,
                                price_range = EXCLUDED.price_range,
                                vibe = EXCLUDED.vibe,
                                updated_at = CURRENT_TIMESTAMP
                            RETURNING id`,
                            [
                                record.Name,
                                category,
                                record.Price || null,
                                vibe,
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
                        
                        console.log(`✅ Successfully imported ${record.Name}`);
                    } else {
                        console.log(`⚠️ No Google Places match found for ${record.Name}`);
                    }

                    // Add delay to respect API limits
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    console.error(`❌ Error importing ${record.Name}:`, error);
                }
            }

            console.log('\nImport completed');
            process.exit(0);
        });

    } catch (error) {
        console.error('Fatal error during import:', error);
        process.exit(1);
    }
}

// Run the import
console.log('Starting restaurant import process...');
importRestaurants().catch(error => {
    console.error('Import failed:', error);
    process.exit(1);
});
