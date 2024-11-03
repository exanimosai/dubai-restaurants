// backend/src/services/googlePlaces.ts
import axios from 'axios';

interface PlaceSearchResult {
    place_id: string;
    name: string;
    formatted_address: string;
    geometry: {
        location: {
            lat: number;
            lng: number;
        }
    };
}

interface PlaceDetails {
    place_id: string;
    name: string;
    formatted_address: string;
    geometry: {
        location: {
            lat: number;
            lng: number;
        }
    };
    website?: string;
    formatted_phone_number?: string;
    rating?: number;
    price_level?: number;
}

class GooglePlacesService {
    private apiKey: string;
    private baseUrl = 'https://maps.googleapis.com/maps/api/place';

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async searchPlaces(query: string): Promise<PlaceSearchResult[]> {
        try {
            const response = await axios.get(`${this.baseUrl}/textsearch/json`, {
                params: {
                    query: `${query} restaurant in Dubai`,
                    key: this.apiKey,
                }
            });

            return response.data.results;
        } catch (error) {
            console.error('Error searching places:', error);
            throw error;
        }
    }

    async getPlaceDetails(placeId: string): Promise<PlaceDetails> {
        try {
            const response = await axios.get(`${this.baseUrl}/details/json`, {
                params: {
                    place_id: placeId,
                    fields: 'name,formatted_address,geometry,website,formatted_phone_number,rating,price_level',
                    key: this.apiKey,
                }
            });

            return response.data.result;
        } catch (error) {
            console.error('Error getting place details:', error);
            throw error;
        }
    }
}

export default GooglePlacesService;