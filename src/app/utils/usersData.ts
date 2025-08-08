import type { SwimmerTrack, DrawTrack, SwimmerUser } from "@/app/types";

/**
 * Enhanced function to extract and validate swim tracks from raw swimmer data
 */
export function extractTracks(swimmers: SwimmerTrack[]): DrawTrack[] {
	console.log("🔄 Processing swimmers:", swimmers?.length || 0);

	if (!Array.isArray(swimmers)) {
		console.error("❌ Invalid swimmers data - not an array:", typeof swimmers);
		return [];
	}

	const validTracks = swimmers
		.filter((swimmer) => {
			// Validate swimmer object structure
			if (!swimmer.username) {
				console.warn(`⚠️ Swimmer missing username:`, swimmer);
				return false;
			}

			if (!Array.isArray(swimmer.locations)) {
				console.warn(`⚠️ Swimmer ${swimmer.username} missing or invalid locations array`);
				return false;
			}

			if (swimmer.locations.length === 0) {
				console.warn(`⚠️ Swimmer ${swimmer.username} has no location data`);
				return false;
			}

			return true;
		})
		.map((swimmer): DrawTrack | null => {
			console.log(`🏊 Processing swimmer: ${swimmer.username} (${swimmer.locations.length} locations)`);

			// Validate and filter location points
			const validLocations = swimmer.locations.filter((location) => {
				const isValidLat = typeof location.lat === "number" && location.lat >= -90 && location.lat <= 90;
				const isValidLng = typeof location.lon === "number" && location.lon >= -180 && location.lon <= 180;
				const hasTimestamp = typeof location.tst === "number" && location.tst > 0;

				const isValid = isValidLat && isValidLng && hasTimestamp;

				if (!isValid) {
					console.warn(`🚫 Invalid location for ${swimmer.username}:`, {
						lat: location.lat,
						lon: location.lon,
						tst: location.tst,
						validLat: isValidLat,
						validLng: isValidLng,
						hasTimestamp: hasTimestamp,
					});
				}

				return isValid;
			});

			if (validLocations.length === 0) {
				console.error(`❌ No valid locations for swimmer ${swimmer.username}`);
				return null;
			}

			// Sort locations chronologically
			const sortedLocations = [...validLocations].sort((a, b) => a.tst - b.tst);

			// Convert to Google Maps LatLngLiteral format
			const pathPoints = sortedLocations.map((location) => ({
				lat: location.lat,
				lng: location.lon,
			}));

			const track: DrawTrack = {
				id: swimmer.username,
				label: swimmer.team_name === "solo" ? swimmer.username : swimmer.team_name,
				points: pathPoints,
				current: sortedLocations[sortedLocations.length - 1],
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
