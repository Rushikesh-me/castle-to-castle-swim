"use client";
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { SwimmerTrack, DrawTrack, LocationPoint } from "@/app/types";
import { extractTracks } from "@/app/utils/usersData";

type SwimCategory = "solo" | "relay";

interface SwimmerContextType {
	swimmers: SwimmerTrack[];
	tracks: DrawTrack[];
	isLoading: boolean;
	isLoadingEnhanced: boolean;
	error: string | null;
	selectedCategory: SwimCategory;
	setSelectedCategory: (cat: SwimCategory) => Promise<void>;
	fetchSwimmers: (category?: SwimCategory) => Promise<void>;
	fetchSwimmersFast: (category?: SwimCategory) => Promise<void>;
	enhanceSwimmersData: () => Promise<void>;
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
	const fetchSwimmersFast = useCallback(async (category: SwimCategory = selectedCategory) => {

		setIsLoading(true);
		setError(null);
		try {
			const response = await fetch(`/api/swimmers/fast?category=${category}`);
			if (!response.ok) throw new Error(`Failed to fetch swimmers: ${response.status}`);
			const data = await response.json();
	
			
			setSwimmers(data);
			const extractedTracks = extractTracks(data);
			setTracks(extractedTracks);
			setHasMore(Array.isArray(data) && data.length === 20);
			setEnhancedDataLoaded(false); // Reset enhanced data flag
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch swimmers");
			setSwimmers([]);
			setTracks([]);
			setHasMore(false);
		} finally {
			setIsLoading(false);
		}
	}, [selectedCategory]);

	// Enhance swimmers with locations and donations
	const enhanceSwimmersData = useCallback(async () => {
		// Use functional state update to get current swimmers without dependency
		setSwimmers(currentSwimmers => {
			if (enhancedDataLoaded || currentSwimmers.length === 0) return currentSwimmers;
			
			// Additional safety check: ensure we're enhancing data for the current category
			if (currentSwimmers.length > 0 && currentSwimmers[0]?.swim_type !== selectedCategory) {
				return currentSwimmers; // Don't enhance if category doesn't match
			}
			
			setIsLoadingEnhanced(true);
			
			// Extract data from current swimmers
			const usernames = currentSwimmers.map(s => s.username);
			const idonateUrls = currentSwimmers.map(s => s.idonate_url).filter(Boolean);
			
			fetch("/api/swimmers/enhance", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ usernames, idonateUrls, locationLimit: 20 })
			})
			.then(response => {
				if (!response.ok) throw new Error(`Failed to enhance data: ${response.status}`);
				return response.json();
			})
			.then(enhancedData => {
				// Double-check category still matches before updating
				setSwimmers(latestSwimmers => {
					if (latestSwimmers.length > 0 && latestSwimmers[0]?.swim_type !== selectedCategory) {
						return latestSwimmers; // Don't update if category changed
					}
					
					// Update swimmers with enhanced data
					const enhancedSwimmers = currentSwimmers.map(swimmer => ({
						...swimmer,
						locations: enhancedData.locations[swimmer.username] || [],
						donations_total: swimmer.idonate_url ? (enhancedData.donations[swimmer.idonate_url] || null) : null,
					}));
					
					const extractedTracks = extractTracks(enhancedSwimmers);
					setTracks(extractedTracks);
					setEnhancedDataLoaded(true);
					
					return enhancedSwimmers;
				});
			})
			.catch(err => {
				// Don't fail completely, just log the warning
			})
			.finally(() => {
				setIsLoadingEnhanced(false);
			});
			
			return currentSwimmers; // Return current state unchanged for this update
		});
	}, [enhancedDataLoaded, selectedCategory]);

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

	// Enhanced category switching with progressive loading
	const setSelectedCategory = useCallback(async (category: SwimCategory) => {
		// Clear any existing data first
		setSwimmers([]);
		setTracks([]);
		setEnhancedDataLoaded(false);
		
		// Update the category state
		setSelectedCategoryState(category);
		
		// Fast fetch for the new category
		await fetchSwimmersFast(category);
		
		// Enhance data in background after a delay
		setTimeout(() => {
			// Only enhance if we're still on the same category
			if (category === selectedCategory) {
				enhanceSwimmersData();
			}
		}, 100);
	}, [fetchSwimmersFast, enhanceSwimmersData, selectedCategory]);

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

	// Only refetch when page changes, not when category changes
	useEffect(() => {
		if (page > 1) {
			fetchSwimmersFast(selectedCategory);
		}
	}, [page, fetchSwimmersFast, selectedCategory]);

	// Auto-enhance data after fast fetch (only when not already enhanced and category matches)
	useEffect(() => {
		if (swimmers.length > 0 && !enhancedDataLoaded && !isLoading) {
			// Delay enhancement to allow UI to render first
			const timer = setTimeout(() => {
				// Only enhance if we're still on the same category
				if (swimmers.length > 0 && swimmers[0]?.swim_type === selectedCategory) {
					enhanceSwimmersData();
				}
			}, 500);
			return () => clearTimeout(timer);
		}
	}, [swimmers.length, enhancedDataLoaded, isLoading, selectedCategory]);



	const value: SwimmerContextType = {
		swimmers,
		tracks,
		isLoading,
		isLoadingEnhanced,
		error,
		selectedCategory,
		setSelectedCategory,
		fetchSwimmers,
		fetchSwimmersFast,
		enhanceSwimmersData,
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