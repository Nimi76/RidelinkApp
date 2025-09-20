import { GoogleGenAI, Type } from "@google/genai";

// The API key is managed by the environment and should not be hardcoded.
const API_KEY = process.env.API_KEY;

let ai: GoogleGenAI | null = null;
if (API_KEY) {
    ai = new GoogleGenAI({ apiKey: API_KEY });
} else {
    console.warn("API_KEY for Gemini is not set. Fare estimation will not work.");
}


const rideEstimationSchema = {
    type: Type.OBJECT,
    properties: {
        distance_km: {
            type: Type.NUMBER,
            description: "Estimated driving distance in kilometers. Should be null if not determinable."
        },
        duration_minutes: {
            type: Type.NUMBER,
            description: "Estimated driving duration in minutes, considering typical traffic. Should be null if not determinable."
        },
    },
    required: ['distance_km', 'duration_minutes']
};


/**
 * Estimates the driving distance and duration between two locations using the Gemini API.
 * @param location The starting location.
 * @param destination The ending location.
 * @returns An object with the estimated distance in kilometers and duration in minutes, or null if it cannot be determined.
 */
export const getRideEstimate = async (location: string, destination:string): Promise<{ distance: number; duration: number; } | null> => {
    if (!ai) return null;

    try {
        const prompt = `You are a fare estimation assistant for a ride-hailing app in Nigeria. Estimate the driving distance in kilometers and the driving duration in minutes between the following locations.
        
        Pickup: "${location}"
        Destination: "${destination}"
        
        Provide your answer based on typical road routes and traffic conditions. If you cannot determine a reasonable estimate from the provided text, both distance and duration should be null.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: rideEstimationSchema,
                temperature: 0.1, // Lower temperature for more deterministic results
            },
        });
        
        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);

        if (result && typeof result.distance_km === 'number' && typeof result.duration_minutes === 'number') {
            return {
                distance: result.distance_km,
                duration: result.duration_minutes,
            };
        }
        
        return null;

    } catch (error) {
        console.error("Error getting ride estimate from Gemini:", error);
        return null;
    }
};
