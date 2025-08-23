import { SwimmerTrack, DrawTrack, LocationPoint } from "@/app/types";
import { hasRaceStarted, epochStringToMs, getTimeDifference } from "./timeUtils";

// Constants for race locations (using lng for Google Maps compatibility)
export const SOLO_START_LOCATION = { lat: 53.541085, lng: -8.005591 };
export const RELAY_START_LOCATION = { lat: 53.540183, lng: -7.989841 };
export const END_LOCATION = { lat: 53.423516, lng: -7.941642 };

/**
 * Calculate distance between two points using Haversine formula
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const R = 6371e3; // Earth's radius in meters
	const φ1 = lat1 * Math.PI/180;
	const φ2 = lat2 * Math.PI/180;
	const Δφ = (lat2-lat1) * Math.PI/180;
	const Δλ = (lon2-lon1) * Math.PI/180;

	const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
			Math.cos(φ1) * Math.cos(φ2) *
			Math.sin(Δλ/2) * Math.sin(Δλ/2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

	return R * c;
}

/**
 * Calculate total race distance
 */
function calculateTotalRaceDistance(swimType: string): number {
	const startLocation = swimType === "solo" ? SOLO_START_LOCATION : RELAY_START_LOCATION;
	return calculateDistance(startLocation.lat, startLocation.lng, END_LOCATION.lat, END_LOCATION.lng);
}

/**
 * Calculate race progress percentage
 * Formula: [(distance of marker from start / (distance of marker from start + distance of marker from end)) * 100]
 */
export function calculateRaceProgress(swimmer: SwimmerTrack): number {
	if (!swimmer.start_time || !hasRaceStarted(swimmer.start_time) || swimmer.locations.length === 0) {
		return 0;
	}
	
	const startLocation = swimmer.swim_type === "solo" ? SOLO_START_LOCATION : RELAY_START_LOCATION;
	const lastLocation = swimmer.locations[swimmer.locations.length - 1];
	
	// Calculate distance from start to current marker position
	const distanceFromStart = calculateDistance(
		startLocation.lat,
		startLocation.lng,
		lastLocation.lat,
		lastLocation.lon
	);
	
	// Calculate distance from current marker position to end
	const distanceToEnd = calculateDistance(
		lastLocation.lat,
		lastLocation.lon,
		END_LOCATION.lat,
		END_LOCATION.lng
	);
	
	// Calculate total distance covered (start to current + current to end)
	const totalDistanceCovered = distanceFromStart + distanceToEnd;
	
	if (totalDistanceCovered === 0) return 0;
	
	// Return progress as percentage: (distance from start
	return Math.min((distanceFromStart / totalDistanceCovered) * 100, 100);
}

/**
 * Get marker position based on swimmer status
 */
export function getMarkerPosition(swimmer: SwimmerTrack): { lat: number; lng: number } {
	// Helper function to validate coordinates
	const isValidCoordinate = (lat: number, lng: number): boolean => {
		return typeof lat === 'number' && 
			   typeof lng === 'number' && 
			   !isNaN(lat) && !isNaN(lng) && 
			   isFinite(lat) && isFinite(lng) &&
			   lat >= -90 && lat <= 90 && 
			   lng >= -180 && lng <= 180;
	};
	
	// Check if race has started
	const raceHasStarted = swimmer.start_time ? hasRaceStarted(swimmer.start_time) : false;
	
	// If race hasn't started, always show at start position
	if (!raceHasStarted) {
		const startPos = swimmer.swim_type === "solo" ? SOLO_START_LOCATION : RELAY_START_LOCATION;
		return startPos;
	}
	
	// If race has started, prioritize real-time location
	if (swimmer.locations && swimmer.locations.length > 0) {
		// Check if the first item has nested locations (data structure issue)
		const firstItem = swimmer.locations[0] as unknown as { locations: LocationPoint[] };
		if (firstItem && firstItem.locations && Array.isArray(firstItem.locations) && firstItem.locations.length > 0) {
			// Data structure issue: locations array contains swimmer objects with nested locations
			const actualLastLocation = firstItem.locations[firstItem.locations.length - 1];
			
			if (isValidCoordinate(actualLastLocation.lat, actualLastLocation.lon)) {
				return { lat: actualLastLocation.lat, lng: actualLastLocation.lon };
			}
		}
		
		// Try normal location access
		const lastLocation = swimmer.locations[swimmer.locations.length - 1];
		
		if (isValidCoordinate(lastLocation.lat, lastLocation.lon)) {
			return { lat: lastLocation.lat, lng: lastLocation.lon };
		}
	}
	
	// If race has started but no valid location data, show at start position
	// This is a fallback for when location data is corrupted or invalid
	const startPos = swimmer.swim_type === "solo" ? SOLO_START_LOCATION : RELAY_START_LOCATION;
	return startPos;
}

/**
 * Enhanced function to extract and validate swim tracks from raw swimmer data
 */
export function extractTracks(swimmers: SwimmerTrack[]): DrawTrack[] {
	if (!Array.isArray(swimmers)) {
		return [];
	}

	if (swimmers.length === 0) {
		return [];
	}

	const validTracks = swimmers
		.filter((swimmer) => {
			// Validate swimmer object structure
			if (!swimmer.username) {
				return false;
			}

			// Show all swimmers regardless of location history
			return true;
		})
		.map((swimmer): DrawTrack | null => {
			// Get marker position based on swimmer status
			const markerPosition = getMarkerPosition(swimmer);
			
			// Create a synthetic current location for the marker
			// Note: LocationPoint uses 'lon', but we need to convert to 'lng' for Google Maps
			const syntheticCurrent = {
				acc: 0,
				conn: "unknown",
				tst: Date.now() / 1000,
				lon: markerPosition.lng, // Convert lng back to lon for LocationPoint interface
				lat: markerPosition.lat,
				alt: null,
				batt: 100,
				pk: swimmer.username,
				tid: "synthetic",
			};

			// Convert locations to Google Maps LatLngLiteral format
			// LocationPoint uses 'lon', Google Maps uses 'lng'
			const pathPoints = (swimmer.locations || []).map((location) => ({
				lat: location.lat,
				lng: location.lon, // Convert lon to lng for Google Maps
			}));

			// Always create a track, even if no locations
			const track: DrawTrack = {
				id: swimmer.username,
				label: swimmer.swim_type === "solo" 
					? `${swimmer.first_name || ""} ${swimmer.last_name || ""}`.trim() || swimmer.username
					: swimmer.team_name || swimmer.username,
				points: pathPoints,
				current: syntheticCurrent,
			};

			return track;
		})
		.filter((track): track is DrawTrack => track !== null);


	return validTracks;
}

/**
 * Utility function to format duration in human-readable format
 */
function formatDuration(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = seconds % 60;

	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	} else if (minutes > 0) {
		return `${minutes}m ${secs}s`;
	} else {
		return `${secs}s`;
	}
}

/**
 * Calculate center point and zoom level for multiple tracks
 */
export function calculateOptimalView(tracks: DrawTrack[]): {
	center: google.maps.LatLngLiteral;
	bounds: google.maps.LatLngBounds | null;
} {
	if (tracks.length === 0) {
		return {
			center: { lat: 53.4125, lng: -7.9045 }, // Default to Ireland
			bounds: null,
		};
	}

	// Collect all points from all tracks
	const allPoints = tracks.flatMap((track) => track.points);

	if (allPoints.length === 0) {
		return {
			center: { lat: 53.4125, lng: -7.9045 },
			bounds: null,
		};
	}

	// Calculate bounds
	const bounds = new google.maps.LatLngBounds();
	allPoints.forEach((point) => bounds.extend(point));

	// Calculate center
	const center = bounds.getCenter().toJSON();

	return { center, bounds };
}

/**
 * Validate swimmer data structure
 */
export function validateSwimmerData(swimmers: Partial<SwimmerTrack>[]): {
	isValid: boolean;
	errors: string[];
	warnings: string[];
} {
	const errors: string[] = [];
	const warnings: string[] = [];

	if (!Array.isArray(swimmers)) {
		errors.push("Swimmers data must be an array");
		return { isValid: false, errors, warnings };
	}

	swimmers.forEach((swimmer, index) => {
		const swimmerRef = swimmer.username || `swimmer at index ${index}`;

		if (!swimmer.username) {
			errors.push(`${swimmerRef} is missing username`);
		}

		if (!Array.isArray(swimmer.locations)) {
			errors.push(`${swimmerRef} locations must be an array`);
		} else if (swimmer.locations.length === 0) {
			warnings.push(`${swimmerRef} has no location data`);
		}

		if (!swimmer.team_name && !swimmer.username) {
			warnings.push(`${swimmerRef} has no display name`);
		}
	});

	return {
		isValid: errors.length === 0,
		errors,
		warnings,
	};
}

/**
 * Calculate swim position ranking
 */
export function calculateSwimPositionRanking(swimmers: SwimmerTrack[]): SwimmerTrack[] {
	const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
	
	return swimmers
		.filter(swimmer => {
			// Only include swimmers whose race has started
			if (!swimmer.start_time || !hasRaceStarted(swimmer.start_time)) return false;
			return true;
		})
		.map(swimmer => {
			const startTime = parseInt(swimmer.start_time!);
			const timeElapsed = currentTime - startTime;
			
			// Calculate progress based on distance from start
			let progress = 0;
			if (swimmer.locations.length > 0) {
				const startLocation = swimmer.swim_type === "solo" ? SOLO_START_LOCATION : RELAY_START_LOCATION;
				
				// Calculate total race distance
				const totalRaceDistance = calculateDistance(
					startLocation.lat, 
					startLocation.lng, 
					END_LOCATION.lat, 
					END_LOCATION.lng
				);
				
				if (totalRaceDistance > 0) {
					const lastLocation = swimmer.locations[swimmer.locations.length - 1];
					const distanceFromStart = calculateDistance(
						startLocation.lat, 
						startLocation.lng,
						lastLocation.lat, 
						lastLocation.lon
					);
					progress = Math.min((distanceFromStart / totalRaceDistance) * 100, 100);
				}
			}
			
			// Calculate ranking score: progress per unit time
			const rankingScore = timeElapsed > 0 ? progress / timeElapsed : 0;
			
			return {
				...swimmer,
				rankingScore
			};
		})
		.sort((a, b) => (b.rankingScore || 0) - (a.rankingScore || 0));
}
