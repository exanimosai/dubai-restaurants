// backend/src/routes/places.ts
import express from 'express';
import { authenticateToken } from '../middleware/auth';
import GooglePlacesService from '../services/googlePlaces';

const router = express.Router();
const placesService = new GooglePlacesService(process.env.GOOGLE_MAPS_API_KEY!);

// Search places
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

// Get place details
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

export default router;