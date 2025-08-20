/**
 * Time utility functions for epoch timestamp conversion
 */

/**
 * Convert a Date object to a stringified epoch timestamp
 * @param date - Date object to convert
 * @returns Stringified epoch timestamp (e.g., "1724013023")
 */
export function dateToEpochString(date: Date): string {
	return Math.floor(date.getTime() / 1000).toString();
}

/**
 * Convert a stringified epoch timestamp to a Date object
 * @param epochString - Stringified epoch timestamp (e.g., "1724013023")
 * @returns Date object
 */
export function epochStringToDate(epochString: string): Date {
	return new Date(parseInt(epochString) * 1000);
}

/**
 * Convert a stringified epoch timestamp to milliseconds
 * @param epochString - Stringified epoch timestamp (e.g., "1724013023")
 * @returns Milliseconds since Unix epoch
 */
export function epochStringToMs(epochString: string): number {
	return parseInt(epochString) * 1000;
}

/**
 * Get current time as a stringified epoch timestamp
 * @returns Current time as stringified epoch timestamp
 */
export function getCurrentEpochString(): string {
	return dateToEpochString(new Date());
}

/**
 * Check if a string is a valid epoch timestamp
 * @param epochString - String to validate
 * @returns True if valid epoch timestamp
 */
export function isValidEpochString(epochString: string): boolean {
	const epoch = parseInt(epochString);
	return !isNaN(epoch) && epoch > 0 && epoch < 9999999999; // Reasonable range
}

/**
 * Format a stringified epoch timestamp for display
 * @param epochString - Stringified epoch timestamp
 * @param format - Format type: 'relative', 'date', 'datetime', 'time'
 * @returns Formatted string
 */
export function formatEpochString(
	epochString: string, 
	format: 'relative' | 'date' | 'datetime' | 'time' = 'relative'
): string {
	if (!isValidEpochString(epochString)) {
		return 'Invalid time';
	}

	const date = epochStringToDate(epochString);
	const now = new Date();

	switch (format) {
		case 'relative':
			const diffMs = now.getTime() - date.getTime();
			const diffSeconds = Math.floor(diffMs / 1000);
			const diffMinutes = Math.floor(diffSeconds / 60);
			const diffHours = Math.floor(diffMinutes / 60);
			const diffDays = Math.floor(diffHours / 24);

			if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
			if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
			if (diffMinutes > 0) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
			if (diffSeconds > 0) return `${diffSeconds} second${diffSeconds > 1 ? 's' : ''} ago`;
			return 'Just now';

		case 'date':
			return date.toLocaleDateString();

		case 'datetime':
			return date.toLocaleString();

		case 'time':
			return date.toLocaleTimeString();

		default:
			return date.toLocaleString();
	}
}

/**
 * Calculate time difference between two epoch timestamps
 * @param startEpoch - Start time as stringified epoch
 * @param endEpoch - End time as stringified epoch
 * @returns Time difference in seconds
 */
export function getTimeDifference(startEpoch: string, endEpoch: string): number {
	if (!isValidEpochString(startEpoch) || !isValidEpochString(endEpoch)) {
		return 0;
	}
	return parseInt(endEpoch) - parseInt(startEpoch);
}

/**
 * Check if a race has started based on start_time
 * @param startTimeEpoch - Start time as stringified epoch
 * @returns True if race has started
 */
export function hasRaceStarted(startTimeEpoch?: string): boolean {
	if (!startTimeEpoch || !isValidEpochString(startTimeEpoch)) {
		return false;
	}
	const currentEpoch = Math.floor(Date.now() / 1000);
	return currentEpoch > parseInt(startTimeEpoch);
}

/**
 * Check if a race has finished based on finish_time
 * @param finishTimeEpoch - Finish time as stringified epoch
 * @returns True if race has finished
 */
export function hasRaceFinished(finishTimeEpoch?: string): boolean {
	if (!finishTimeEpoch || !isValidEpochString(finishTimeEpoch)) {
		return false;
	}
	const currentEpoch = Math.floor(Date.now() / 1000);
	return currentEpoch > parseInt(finishTimeEpoch);
}
