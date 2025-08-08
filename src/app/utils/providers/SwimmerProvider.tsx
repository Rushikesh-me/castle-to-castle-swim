"use client";
import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { SwimmerTrack, DrawTrack, LocationPoint } from "@/app/types";
import { extractTracks } from "@/app/utils/usersData";

type SwimCategory = "solo" | "relay";

interface SwimmerContextType {
  swimmers: SwimmerTrack[];
  tracks: DrawTrack[];
  isLoading: boolean;
  error: string | null;
  selectedCategory: SwimCategory;
  setSelectedCategory: (cat: SwimCategory) => void;
  fetchSwimmers: (category?: SwimCategory) => Promise<void>;
  swimmerHistory: LocationPoint[];
  fetchSwimmerHistory: (username: string) => Promise<LocationPoint[]>;
  loadingHistory: boolean;
  page: number;
  setPage: (page: number) => void;
  hasMore: boolean;
}

const SwimmerContext = createContext<SwimmerContextType | undefined>(undefined);

export const SwimmerProvider = ({ children }: { children: React.ReactNode }) => {
  const [swimmers, setSwimmers] = useState<SwimmerTrack[]>([]);
  const [tracks, setTracks] = useState<DrawTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<SwimCategory>("solo");
  const [swimmerHistory, setSwimmerHistory] = useState<LocationPoint[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Fetch swimmers by category and page
  const fetchSwimmers = useCallback(async (category: SwimCategory = selectedCategory, pageNum: number = page) => {
    console.log("fetching for category :", selectedCategory)
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/swimmers?active=true&location_limit=20&category=${category}&page=${pageNum}`);
      if (!response.ok) throw new Error(`Failed to fetch swimmers: ${response.status}`);
      const data = await response.json();
      console.log("swimmers :", data)
      setSwimmers(data);
      setTracks(extractTracks(data));
      setHasMore(Array.isArray(data) && data.length === 20); // Assume 20 per page
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch swimmers");
      setSwimmers([]);
      setTracks([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, page]);

  // Fetch swimmer's full history
  const fetchSwimmerHistory = useCallback(async (username: string) => {
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
    fetchSwimmers(selectedCategory, page);
  }, [selectedCategory, page, fetchSwimmers]);

  const value: SwimmerContextType = {
    swimmers,
    tracks,
    isLoading,
    error,
    selectedCategory,
    setSelectedCategory,
    fetchSwimmers,
    swimmerHistory,
    fetchSwimmerHistory,
    loadingHistory,
    page,
    setPage,
    hasMore,
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