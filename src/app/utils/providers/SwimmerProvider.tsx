"use client";
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { SwimmerTrack, DrawTrack, LocationPoint } from "@/app/types";
import { extractTracks, SOLO_START_LOCATION, RELAY_START_LOCATION } from "@/app/utils/usersData";
import { hasRaceStarted } from "@/app/utils/timeUtils";
import { clearLocationsCache } from "@/app/utils/db/helpers";

type SwimCategory = "solo" | "relay";

interface SwimmerContextType {
	swimmers: SwimmerTrack[];
	tracks: DrawTrack[];
	isLoading: boolean;
	isLoadingEnhanced: boolean;
	enhancedDataLoaded: boolean;
	error: string | null;
	selectedCategory: SwimCategory;
	setSelectedCategory: (cat: SwimCategory) => Promise<void>;
	fetchSwimmers: (category?: SwimCategory) => Promise<void>;
	fetchSwimmersFast: (category?: SwimCategory, forceRefresh?: boolean) => Promise<void>;
	enhanceSwimmersData: (categoryOverride?: SwimCategory) => Promise<void>;
	refreshData: () => Promise<void>;
	debugState: () => void;
	swimmerHistory: LocationPoint[];
	fetchSwimmerHistory: (username: string) => Promise<LocationPoint[]>;
	loadingHistory: boolean;
	page: number;
	setPage: (page: number) => void;
	hasMore: boolean;
	getDonationFor: (username: string) => number | null | undefined;
	selectedSwimmerFromUrl: string | null;
	setSelectedSwimmerFromUrl: (username: string | null) => void;
}

const SwimmerContext = createContext<SwimmerContextType | undefined>(undefined);

export const SwimmerProvider = ({ children }: { children: React.ReactNode }) => {
	const [swimmers, setSwimmers] = useState<SwimmerTrack[]>([]);
	const [tracks, setTracks] = useState<DrawTrack[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isLoadingEnhanced, setIsLoadingEnhanced] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selectedCategory, setSelectedCategoryState] = useState<SwimCategory>("solo");
	const [swimmerHistory, setSwimmerHistory] = useState<LocationPoint[]>([]);
	const [loadingHistory, setLoadingHistory] = useState(false);
	const [page, setPage] = useState(1);
	const [hasMore, setHasMore] = useState(true);
	const [selectedSwimmerFromUrl, setSelectedSwimmerFromUrl] = useState<string | null>(null);
	const [enhancedDataLoaded, setEnhancedDataLoaded] = useState(false);

	// Fast fetch swimmers (basic data only)
	const fetchSwimmersFast = useCallback(async (category: SwimCategory = selectedCategory, forceRefresh: boolean = false) => {
		setIsLoading(true);
		setError(null);
		
		// Clear locations cache if forcing refresh
		if (forceRefresh) {
			clearLocationsCache();
		}
		
		try {
			const response = await fetch(`/api/swimmers/fast?category=${category}`);
			if (!response.ok) throw new Error(`Failed to fetch swimmers: ${response.status}`);
			const data = await response.json();
	
			setSwimmers(data);
			
			// Create tracks with proper positioning logic
			const extractedTracks = extractTracks(data);
			setTracks(extractedTracks);
			
			setHasMore(Array.isArray(data) && data.length === 20);
			setEnhancedDataLoaded(false); // Reset enhanced data flag
			
			// Pass the category parameter to avoid race condition
			enhanceSwimmersData(category);
			
			// Add timeout fallback to prevent infinite loading (reduced since we only fetch locations)
			setTimeout(() => {
				if (!enhancedDataLoaded) {
					setEnhancedDataLoaded(true);
					setIsLoadingEnhanced(false);
				}
			}, 5000); // 5 second timeout - should be enough for locations only
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch swimmers");
			setSwimmers([]);
			setTracks([]);
			setHasMore(false);
			// Clear cache on error to prevent stale data
			clearLocationsCache();
			setIsLoading(false);
		} finally {
			// Don't set isLoading to false here - let the useEffect handle it when tracks are ready
		}
	}, [selectedCategory]);

	// OPTIMIZED: Enhance swimmers with locations first, then donations
	const enhanceSwimmersData = useCallback(async (categoryOverride?: SwimCategory) => {
		const targetCategory = categoryOverride || selectedCategory;
		
		// Use functional state update to get current swimmers without dependency
		setSwimmers(currentSwimmers => {
			if (currentSwimmers.length === 0) return currentSwimmers;
		
		// Don't enhance if already enhanced for current category
		if (enhancedDataLoaded && currentSwimmers.length > 0 && currentSwimmers[0]?.swim_type === targetCategory) {
			return currentSwimmers;
		}
			
			// Additional safety check: ensure we're enhancing data for the target category
			if (currentSwimmers.length > 0 && currentSwimmers[0]?.swim_type !== targetCategory) {
				return currentSwimmers; // Don't enhance if category changed
			}
			
			setIsLoadingEnhanced(true);
			
			// Extract data from current swimmers
			const usernames = currentSwimmers.map(s => s.username);
			const idonateUrls = currentSwimmers.map(s => s.idonate_url).filter(Boolean);
			
			// OPTIMIZATION: Fetch only latest location (locationLimit: 1) for fast marker positioning
			// Defer donations to avoid heavy parallel processing
			fetch("/api/swimmers/enhance", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ usernames, idonateUrls: [], locationLimit: 1 })
			})
			.then((locationsResponse) => {
				if (!locationsResponse.ok) throw new Error(`Failed to fetch locations: ${locationsResponse.status}`);
				return locationsResponse.json();
			})
			.then((locationsData) => {
				// Double-check category still matches before updating
				setSwimmers(latestSwimmers => {
					if (latestSwimmers.length > 0 && latestSwimmers[0]?.swim_type !== targetCategory) {
						return latestSwimmers; // Don't update if category changed
					}
					
					// Update swimmers with enhanced data (only locations for now)
					const enhancedSwimmers = currentSwimmers.map(swimmer => ({
						...swimmer,
						locations: locationsData.locations[swimmer.username] || [],
						// Keep existing donations_total, we'll fetch them later
					}));
					
					// CRITICAL: Update tracks with real locations immediately for fast marker display
					const extractedTracks = extractTracks(enhancedSwimmers);
					setTracks(extractedTracks);
					setEnhancedDataLoaded(true);
					
					// Start fetching donations in the background (non-blocking)
					fetchDonationsInBackground(enhancedSwimmers);
					
					return enhancedSwimmers;
				});
			})
			.catch(err => {
				// Set enhanced data as loaded even on error to prevent infinite loading
				setEnhancedDataLoaded(true);
				setIsLoadingEnhanced(false);
			})
			.finally(() => {
				setIsLoadingEnhanced(false);
			});
			
			return currentSwimmers; // Return current state unchanged for this update
		});
	}, [enhancedDataLoaded, selectedCategory]);

	// Fetch donations in the background (non-blocking)
	const fetchDonationsInBackground = useCallback(async (swimmersToUpdate: SwimmerTrack[]) => {
		const idonateUrls = swimmersToUpdate.map(s => s.idonate_url).filter(Boolean);
		if (idonateUrls.length === 0) return;
		
		try {
			const response = await fetch("/api/swimmers/enhance", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ usernames: [], idonateUrls, locationLimit: 0 })
			});
			
			if (!response.ok) throw new Error(`Failed to fetch donations: ${response.status}`);
			const donationsData = await response.json();
			
			// Update swimmers with donations data
			setSwimmers(currentSwimmers => {
				return currentSwimmers.map(swimmer => ({
					...swimmer,
					donations_total: swimmer.idonate_url ? (donationsData.donations[swimmer.idonate_url] || null) : null,
				}));
			});
		} catch (err) {
			// Silent fail for background donations
		}
	}, []);

	// Full fetch swimmers (legacy, kept for compatibility)
	const fetchSwimmers = useCallback(async (category: SwimCategory = selectedCategory) => {

		setIsLoading(true);
		setError(null);
		try {
			const response = await fetch(`/api/swimmers?category=${category}&page=${page}`);
			if (!response.ok) throw new Error(`Failed to fetch swimmers: ${response.status}`);
			const data = await response.json();
	
			
			setSwimmers(data);
			const extractedTracks = extractTracks(data);
			setTracks(extractedTracks);
			setHasMore(Array.isArray(data) && data.length === 20);
			setEnhancedDataLoaded(true); // Mark as fully loaded
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch swimmers");
			setSwimmers([]);
			setTracks([]);
			setHasMore(false);
		} finally {
			setIsLoading(false);
		}
	}, [selectedCategory, page]);

	// Refresh data with fresh real-time locations
	const refreshData = useCallback(async () => {
		// Clear locations cache to ensure fresh data
		clearLocationsCache();
		// Fetch fresh data for current category
		await fetchSwimmersFast(selectedCategory, true);
	}, [selectedCategory, fetchSwimmersFast]);

	// Debug function to check current state
	const debugState = useCallback(() => {
		// Production-ready debug function (no console logs)
	}, [selectedCategory, swimmers, tracks, isLoading, isLoadingEnhanced, enhancedDataLoaded]);

	// OPTIMIZED: Enhanced category switching with immediate data loading
	const setSelectedCategory = useCallback(async (category: SwimCategory) => {
		// Set loading state immediately when switching categories
		setIsLoading(true);
		setError(null);
		
		// Clear any existing data first
		setSwimmers([]);
		setTracks([]);
		setEnhancedDataLoaded(false);
		
		// Clear locations cache to ensure fresh real-time data
		clearLocationsCache();
		
		// Update the category state FIRST
		setSelectedCategoryState(category);
		
		// Fast fetch for the new category - await to ensure data loads immediately
		await fetchSwimmersFast(category);
	}, [fetchSwimmersFast]);

	// Fetch swimmer's full history
	const fetchSwimmerHistory = useCallback(async (username: string): Promise<LocationPoint[]> => {
		setLoadingHistory(true);
		try {
			const response = await fetch(`/api/swimmers/${username}/history?limit=1000`);
			if (!response.ok) throw new Error(`Failed to fetch swimmer history: ${response.status}`);
			const history = await response.json();
			setSwimmerHistory(history);
			return history;
		} catch (err) {
			setSwimmerHistory([]);
			return [];
		} finally {
			setLoadingHistory(false);
		}
	}, []);

	// Initial fetch on mount
	useEffect(() => {
		fetchSwimmersFast(selectedCategory);
	}, []); // Empty dependency array - only run on mount

	// Clear locations cache on unmount to prevent stale data
	useEffect(() => {
		return () => {
			clearLocationsCache();
		};
	}, []);

	// Only refetch when page changes, not when category changes
	useEffect(() => {
		if (page > 1) {
			fetchSwimmersFast(selectedCategory);
		}
	}, [page, fetchSwimmersFast, selectedCategory]);


  


	// Loading state management - stop loading when both basic data and real-time locations are ready
	useEffect(() => {
		if (isLoading && tracks.length > 0 && enhancedDataLoaded) {
			// Stop loading when both basic tracks and real-time locations are ready
			setIsLoading(false);
		}
	}, [tracks.length, isLoading, enhancedDataLoaded]);



	const value: SwimmerContextType = {
		swimmers,
		tracks,
		isLoading,
		isLoadingEnhanced,
		enhancedDataLoaded,
		error,
		selectedCategory,
		setSelectedCategory,
		fetchSwimmers,
		fetchSwimmersFast,
		enhanceSwimmersData,
		refreshData,
		debugState,
		swimmerHistory,
		fetchSwimmerHistory,
		loadingHistory,
		page,
		setPage,
		hasMore,
		getDonationFor: (username: string) => swimmers.find(s => s.username === username)?.donations_total,
		selectedSwimmerFromUrl,
		setSelectedSwimmerFromUrl,
	};

	return (
		<SwimmerContext.Provider value={value}>{children}</SwimmerContext.Provider>
	);
};

export function useSwimmers() {
	const ctx = useContext(SwimmerContext);
	if (!ctx) throw new Error("useSwimmers must be used within a SwimmerProvider");
	return ctx;
}