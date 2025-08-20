"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import EnhancedSwimTracker from "@/app/components/map/EnhancedSwimTracker";
import { ErrorBoundary } from "@/app/components/ErrorBoundary";
import { RefreshCw, AlertCircle, ArrowLeft, MapPin, Users } from "lucide-react";
import type { SwimmerTrack } from "@/app/types";
import Link from "next/link";
import { SwimmerProvider, useSwimmers } from "@/app/utils/providers/SwimmerProvider";

type SwimCategory = "solo" | "relay";

function MapPageContent() {
	const { swimmers, isLoading, error, selectedCategory, setSelectedCategory, fetchSwimmers } = useSwimmers();
	const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

	// Refresh timestamp on fetch
	useEffect(() => {
		setLastRefresh(new Date());
	}, [swimmers]);

	return (
		<div className="min-h-screen bg-gray-50">
			{/* Header */}
			<header className="bg-white shadow-sm border-b sticky top-0 z-40">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between items-center h-16">
						<div className="flex items-center space-x-4">
							<Link href="/dashboard">
								<Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900">
									<ArrowLeft className="w-4 h-4 mr-2" />
									Back to Dashboard
								</Button>
							</Link>
							<div>
								<h1 className="text-xl font-bold text-gray-900">Live Swim Tracker</h1>
								{lastRefresh && (
									<p className="text-xs text-gray-500">
										Last updated: {lastRefresh.toLocaleTimeString()}
									</p>
								)}
							</div>
						</div>
						
						<div className="flex items-center space-x-3">
							{error && (
								<div className="text-sm text-red-600 bg-red-50 px-3 py-1 rounded-lg">
									{error}
								</div>
							)}
							<Button
								variant="outline"
								size="sm"
								onClick={() => fetchSwimmers(selectedCategory)}
								disabled={isLoading}
								className="flex items-center"
							>
								<RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
								Refresh
							</Button>
						</div>
					</div>
				</div>
			</header>

			{/* Category Tabs */}
			<div className="bg-white border-b">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex space-x-8">
						<button
							onClick={() => setSelectedCategory("solo")}
							className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
								selectedCategory === "solo"
									? "border-blue-500 text-blue-600"
									: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
							}`}
						>
							<div className="flex items-center space-x-2">
								<MapPin className="w-4 h-4" />
								<span>Solo Swimmers</span>
							</div>
						</button>
						<button
							onClick={() => setSelectedCategory("relay")}
							className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
								selectedCategory === "relay"
									? "border-blue-500 text-blue-600"
									: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
							}`}
						>
							<div className="flex items-center space-x-2">
								<Users className="w-4 h-4" />
								<span>Relay Teams</span>
							</div>
						</button>
					</div>
				</div>
			</div>

			{/* Map Container */}
			<div className="h-[calc(100vh-8rem)]">
				<ErrorBoundary>
					<EnhancedSwimTracker />
				</ErrorBoundary>
			</div>
		</div>
	);
}

export default function MapPage() {
	return (
		<SwimmerProvider>
			<MapPageContent />
		</SwimmerProvider>
	);
}