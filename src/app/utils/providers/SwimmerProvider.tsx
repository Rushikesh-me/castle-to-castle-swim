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
		console.log("🚀 Fast fetching for category:", category);
		setIsLoading(true);
		setError(null);
		try {
			const response = await fetch(`/api/swimmers/fast?category=${category}`);
			if (!response.ok) throw new Error(`Failed to fetch swimmers: ${response.status}`);
			const data = await response.json();
			console.log("🚀 Fast swimmers response:", data.length);
			
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
		if (enhancedDataLoaded || swimmers.length === 0) return;
		
		console.log("🔧 Enhancing swimmers data...");
		setIsLoadingEnhanced(true);
		try {
			const usernames = swimmers.map(s => s.username);
			const idonateUrls = swimmers.map(s => s.idonate_url).filter(Boolean);
			
			const response = await fetch("/api/swimmers/enhance", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ usernames, idonateUrls, locationLimit: 20 })
			});
			
			if (!response.ok) throw new Error(`Failed to enhance data: ${response.status}`);
			const enhancedData = await response.json();
			
			// Update swimmers with enhanced data
			const enhancedSwimmers = swimmers.map(swimmer => ({
				...swimmer,
				locations: enhancedData.locations[swimmer.username] || [],
				donations_total: swimmer.idonate_url ? (enhancedData.donations[swimmer.idonate_url] || null) : null,
			}));
			
			setSwimmers(enhancedSwimmers);
			const extractedTracks = extractTracks(enhancedSwimmers);
			setTracks(extractedTracks);
			setEnhancedDataLoaded(true);
			console.log("✅ Enhanced data loaded");
		} catch (err) {
			console.warn("Failed to enhance swimmers data:", err);
			// Don't fail completely, just log the warning
		} finally {
			setIsLoadingEnhanced(false);
		}
	}, [swimmers, enhancedDataLoaded]);

	// Full fetch swimmers (legacy, kept for compatibility)
	const fetchSwimmers = useCallback(async (category: SwimCategory = selectedCategory) => {
		console.log("🐌 Full fetching for category:", category);
		setIsLoading(true);
		setError(null);
		try {
			const response = await fetch(`/api/swimmers?category=${category}&page=${page}`);
			if (!response.ok) throw new Error(`Failed to fetch swimmers: ${response.status}`);
			const data = await response.json();
			console.log("🐌 Full swimmers response:", data.length);
			
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
		setSelectedCategoryState(category);
		// Fast fetch first, then enhance
		await fetchSwimmersFast(category);
		// Enhance data in background
		setTimeout(() => enhanceSwimmersData(), 100);
	}, [fetchSwimmersFast, enhanceSwimmersData]);

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

	// Refetch swimmers when category or page changes
	useEffect(() => {
		fetchSwimmersFast(selectedCategory);
	}, [page, fetchSwimmersFast, selectedCategory]);

	// Auto-enhance data after fast fetch
	useEffect(() => {
		if (swimmers.length > 0 && !enhancedDataLoaded && !isLoading) {
			// Delay enhancement to allow UI to render first
			const timer = setTimeout(() => enhanceSwimmersData(), 500);
			return () => clearTimeout(timer);
		}
	}, [swimmers, enhancedDataLoaded, isLoading, enhanceSwimmersData]);

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