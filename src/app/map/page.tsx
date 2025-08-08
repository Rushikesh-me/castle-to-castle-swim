"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import EnhancedSwimTracker from "@/app/components/map/EnhancedSwimTracker";
import { ErrorBoundary } from "@/app/components/ErrorBoundary";
import { RefreshCw, AlertCircle, ArrowLeft } from "lucide-react";
import type { SwimmerTrack } from "@/app/types";
import Link from "next/link";
import { SwimmerProvider, useSwimmers } from "@/app/utils/providers/SwimmerProvider";

// Add SwimCategory type

type SwimCategory = "solo" | "relay";

function MapPageContent() {
	const { swimmers, isLoading, error, selectedCategory, setSelectedCategory, fetchSwimmers } = useSwimmers();
	const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

	// Refresh timestamp on fetch
	useEffect(() => {
		setLastRefresh(new Date());
	}, [swimmers]);

	// if (!session) {
	// 	return (
	// 		<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50">
	// 			<Card className="w-full max-w-md shadow-xl">
	// 				<CardContent className="text-center p-8">
	// 					<AlertCircle className="w-12 h-12 text-blue-600 mx-auto mb-4" />
	// 					<h2 className="text-xl font-semibold mb-4">Access Required</h2>
	// 					<p className="mb-6 text-gray-600">Please sign in to view the swim tracker</p>
	// 					<Button 
	// 						onClick={() => (window.location.href = "/auth/signin")}
	// 						className="w-full bg-blue-600 hover:bg-blue-700"
	// 					>
	// 						Sign In
	// 					</Button>
	// 				</CardContent>
	// 			</Card>
	// 		</div>
	// 	);
	// }

	return (
		<div className="min-h-screen bg-gray-50">
			{/* Header */}
			{/* <header className="bg-white shadow-sm border-b sticky top-0 z-40">
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
							<div className="text-right">
								<p className="text-sm font-medium text-gray-900">{session.user.name}</p>
								<p className="text-xs text-gray-500">{session.user.email}</p>
							</div>
						</div>
					</div>
				</div>
			</header> */}

			{/* Map Container */}
			<div className="h-[calc(100vh-4rem)]">
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
			<MapPageContent  />
		</SwimmerProvider>
	);
}