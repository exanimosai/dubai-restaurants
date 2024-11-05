import express from 'express';
import { authenticateToken } from '../middleware/auth';
import GooglePlacesService from '../services/googlePlaces';
import { Pool } from 'pg'; // Add this if not already imported

const router = express.Router();
const placesService = new GooglePlacesService(process.env.GOOGLE_MAPS_API_KEY!);

// Existing routes
router.get('/search', authenticateToken, async (req, res) => {
    try {
        const { query } = req.query;
        if (!query || typeof query !== 'string') {
            return res.status(400).json({ error: 'Query parameter is required' });
        }

        const results = await placesService.searchPlaces(query);
        res.json(results);
    } catch (error) {
        console.error('Place search error:', error);
        res.status(500).json({ error: 'Failed to search places' });
    }
});

router.get('/details/:placeId', authenticateToken, async (req, res) => {
    try {
        const { placeId } = req.params;
        const details = await placesService.getPlaceDetails(placeId);
        res.json(details);
    } catch (error) {
        console.error('Place details error:', error);
        res.status(500).json({ error: 'Failed to get place details' });
    }
});

// New POST endpoint for creating restaurants
router.post('/', authenticateToken, async (req, res) => {
    try {
        const {
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
            google_place_id
        } = req.body;

        // Validate required fields
        if (!name || !address || !latitude || !longitude) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Assuming you have a database connection pool
        const pool = new Pool(); // Configure this with your database credentials

        const result = await pool.query(
            `INSERT INTO restaurants 
            (name, category, price_range, vibe, latitude, longitude, address, 
             seating, is_licensed, has_shisha, google_place_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *`,
            [name, category, price_range, vibe, latitude, longitude, address,
             seating, is_licensed, has_shisha, google_place_id]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create restaurant error:', error);
        res.status(500).json({ error: 'Failed to create restaurant' });
    }
});

export default router;