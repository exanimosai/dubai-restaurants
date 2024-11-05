import express from 'express';
import { authenticateToken } from '../middleware/auth';
import GooglePlacesService from '../services/googlePlaces';
import { pool as dbPool } from '../config/database';  // Renamed import
import { Pool, QueryResult as PgQueryResult } from 'pg';  // Updated import

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

// Types
interface Restaurant {
    id?: number;
    name: string;
    category: 'Bar' | 'Restaurant' | 'Cafe';
    price_range?: string;
    vibe: string[];
    latitude: string;
    longitude: string;
    address: string;
    seating: 'Indoor' | 'Al Fresco' | 'Both';
    is_licensed: boolean;
    has_shisha: boolean;
    google_place_id: string;
    added_by?: number;
    created_at?: Date;
    updated_at?: Date;
}

// New POST endpoint for creating restaurants
router.post('/', authenticateToken, async (req, res) => {
    try {
        console.log('Received restaurant creation request:', req.body);
        
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
        }: Restaurant = req.body;

        // Validate required fields
        const requiredFields = {
            name,
            category,
            latitude,
            longitude,
            address,
            seating
        };

        const missingFields = Object.entries(requiredFields)
            .filter(([_, value]) => !value)
            .map(([key]) => key);

        if (missingFields.length > 0) {
            console.log('Missing required fields:', missingFields);
            return res.status(400).json({ 
                error: 'Missing required fields', 
                missingFields 
            });
        }

        console.log('Attempting database insertion...');
        
        const result: PgQueryResult = await dbPool.query(
            `INSERT INTO restaurants 
            (name, category, price_range, vibe, latitude, longitude, address, 
             seating, is_licensed, has_shisha, google_place_id, added_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *`,
            [
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
                (req as any).user?.id
            ]
        );

        console.log('Restaurant created successfully:', result.rows[0]);
        res.status(201).json(result.rows[0]);
    } catch (error: any) {
        console.error('Detailed create restaurant error:', {
            message: error.message,
            stack: error.stack,
            code: error.code,
            detail: error.detail
        });
        
        if (error.code === '23505') {
            res.status(409).json({ 
                error: 'Restaurant already exists',
                detail: error.detail 
            });
        } else {
            res.status(500).json({ 
                error: 'Failed to create restaurant',
                detail: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
});

// Search route
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

// Get place details route
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

// Test database connection route
router.get('/test-db', authenticateToken, async (req, res) => {
    try {
        const result: PgQueryResult = await dbPool.query('SELECT NOW()');
        res.json({ 
            success: true, 
            timestamp: result.rows[0].now,
            user: (req as any).user 
        });
    } catch (error: any) {
        console.error('Database test error:', {
            message: error.message,
            code: error.code
        });
        res.status(500).json({ error: 'Database connection failed' });
    }
});

// Get single restaurant
router.get('/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await dbPool.query(
        'SELECT * FROM restaurants WHERE id = $1',
        [id]
      );
  
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Restaurant not found' });
      }
  
      res.json(result.rows[0]);
    } catch (error: any) {
      console.error('Error fetching restaurant:', error);
      res.status(500).json({ error: 'Failed to fetch restaurant' });
    }
  });
  
  // Update restaurant
  router.put('/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
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
  
      // Verify restaurant exists
      const checkResult = await dbPool.query(
        'SELECT id FROM restaurants WHERE id = $1',
        [id]
      );
  
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Restaurant not found' });
      }
  
      const result = await dbPool.query(
        `UPDATE restaurants 
         SET name = $1, category = $2, price_range = $3, vibe = $4,
             latitude = $5, longitude = $6, address = $7, seating = $8,
             is_licensed = $9, has_shisha = $10, google_place_id = $11,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $12
         RETURNING *`,
        [
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
          id
        ]
      );
  
      res.json(result.rows[0]);
    } catch (error: any) {
      console.error('Error updating restaurant:', error);
      res.status(500).json({ error: 'Failed to update restaurant' });
    }
  });
  
  // Delete restaurant
  router.delete('/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Verify restaurant exists
      const checkResult = await dbPool.query(
        'SELECT id FROM restaurants WHERE id = $1',
        [id]
      );
  
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Restaurant not found' });
      }
  
      await dbPool.query('DELETE FROM restaurants WHERE id = $1', [id]);
      
      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting restaurant:', error);
      res.status(500).json({ error: 'Failed to delete restaurant' });
    }
  });
  
  export default router;