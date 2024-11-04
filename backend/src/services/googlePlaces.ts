// src/services/googlePlaces.ts
import axios, { AxiosInstance } from 'axios';

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
    private client: AxiosInstance;
    private baseUrl: string;

    constructor(apiKey: string) {
        this.baseUrl = 'https://maps.googleapis.com/maps/api/place';
        this.client = axios.create({
            baseURL: this.baseUrl,
            params: {
                key: apiKey
            }
        });
    }

    async searchPlaces(query: string): Promise<PlaceSearchResult[]> {
        try {
            const response = await this.client.get('/textsearch/json', {
                params: {
                    query: `${query} restaurant in Dubai`
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
            const response = await this.client.get('/details/json', {
                params: {
                    place_id: placeId,
                    fields: 'name,formatted_address,geometry,website,formatted_phone_number,rating,price_level'
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