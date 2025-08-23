"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { ArrowLeft, MapPin, Clock, User, Users, RefreshCw, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface LocationCheck {
	username: string;
	timestamp: string;
	lat: number;
	lon: number;
	is_team: boolean;
	previous_timestamp: string | null;
	formatted_time: string;
	previous_formatted_time: string | null;
}

export default function LocationCheckPage() {
	const { data: session, status } = useSession();
	const [locationChecks, setLocationChecks] = useState<LocationCheck[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Define fetchLocationChecks function
	const fetchLocationChecks = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const response = await fetch("/api/location-check");
			if (!response.ok) {
				throw new Error(`Failed to fetch location checks: ${response.status}`);
			}
			const data = await response.json();
			setLocationChecks(data.locationChecks);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch location checks");
		} finally {
			setIsLoading(false);
		}
	}, []);

	// Call useEffect at the top level (before any early returns)
	useEffect(() => {
		if (session?.user?.is_admin) {
			fetchLocationChecks();
		}
	}, [session?.user?.is_admin, fetchLocationChecks]);

	// Redirect non-admin users
	if (status === "loading") {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
					<p className="text-gray-500">Loading...</p>
				</div>
			</div>
		);
	}

	if (!session?.user?.is_admin) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-center">
					<AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
					<h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
					<p className="text-gray-600 mb-4">This page is only accessible to administrators.</p>
					<Link href="/dashboard">
						<Button>Back to Dashboard</Button>
					</Link>
				</div>
			</div>
		);
	}



	const getStatusColor = (check: LocationCheck) => {
		const now = Date.now();
		const checkTime = parseInt(check.timestamp) * 1000;
		const timeDiff = now - checkTime;
		
		// Green: checked within last hour
		if (timeDiff < 60 * 60 * 1000) return "text-green-600";
		// Yellow: checked within last 24 hours
		if (timeDiff < 24 * 60 * 60 * 1000) return "text-yellow-600";
		// Red: checked more than 24 hours ago
		return "text-red-600";
	};

	const getStatusText = (check: LocationCheck) => {
		const now = Date.now();
		const checkTime = parseInt(check.timestamp) * 1000;
		const timeDiff = now - checkTime;
		
		if (timeDiff < 60 * 60 * 1000) return "Recent";
		if (timeDiff < 24 * 60 * 60 * 1000) return "Stale";
		return "Outdated";
	};

	const isValidTimestamp = (timestamp: string | null): boolean => {
		if (!timestamp) return false;
		// Check if it's a valid timestamp (not "SWIMMER" or other non-numeric values)
		return !isNaN(parseInt(timestamp)) && timestamp !== "SWIMMER";
	};

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
								<h1 className="text-xl font-bold text-gray-900">Location Check Status</h1>
								<p className="text-xs text-gray-500">
									Monitor location tracking before races start
								</p>
							</div>
						</div>
						
						<div className="flex items-center space-x-3">
							{error && (
								<div className="text-sm text-red-600 bg-red-50 px-3 py-1 rounded-lg">
									{error}
								</div>
							)}
							<Button
								onClick={fetchLocationChecks}
								disabled={isLoading}
								variant="outline"
								className="flex items-center"
							>
								<RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
								Refresh
							</Button>
						</div>
					</div>
				</div>
			</header>

			{/* Content */}
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				{/* Summary Cards */}
				<div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
					<Card>
						<CardContent className="p-6">
							<div className="flex items-center">
							<div className="p-2 bg-blue-100 rounded-lg">
								<MapPin className="w-6 h-6 text-blue-600" />
							</div>
							<div className="ml-4">
								<p className="text-sm font-medium text-gray-600">Total Users</p>
								<p className="text-2xl font-bold text-gray-900">{locationChecks.length}</p>
							</div>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardContent className="p-6">
							<div className="flex items-center">
							<div className="p-2 bg-green-100 rounded-lg">
								<Clock className="w-6 h-6 text-green-600" />
							</div>
							<div className="ml-4">
								<p className="text-sm font-medium text-gray-600">Recent (1h)</p>
								<p className="text-2xl font-bold text-gray-900">
									{locationChecks.filter(check => {
										if (!isValidTimestamp(check.timestamp)) return false;
										const timeDiff = Date.now() - (parseInt(check.timestamp) * 1000);
										return timeDiff < 60 * 60 * 1000;
									}).length}
								</p>
							</div>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardContent className="p-6">
							<div className="flex items-center">
							<div className="p-2 bg-yellow-100 rounded-lg">
								<Clock className="w-6 h-6 text-yellow-600" />
							</div>
							<div className="ml-4">
								<p className="text-sm font-medium text-gray-600">Stale (24h)</p>
								<p className="text-2xl font-bold text-gray-900">
									{locationChecks.filter(check => {
										if (!isValidTimestamp(check.timestamp)) return false;
										const timeDiff = Date.now() - (parseInt(check.timestamp) * 1000);
										return timeDiff >= 60 * 60 * 1000 && timeDiff < 24 * 60 * 60 * 1000;
									}).length}
								</p>
							</div>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardContent className="p-6">
							<div className="flex items-center">
							<div className="p-2 bg-red-100 rounded-lg">
								<Clock className="w-6 h-6 text-red-600" />
							</div>
							<div className="ml-4">
								<p className="text-sm font-medium text-gray-600">{`Outdated (\>24h)`}</p>
								<p className="text-2xl font-bold text-gray-900">
									{locationChecks.filter(check => {
										if (!isValidTimestamp(check.timestamp)) return false;
										const timeDiff = Date.now() - (parseInt(check.timestamp) * 1000);
										return timeDiff >= 24 * 60 * 60 * 1000;
									}).length}
								</p>
							</div>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Loading State */}
				{isLoading ? (
					<div className="text-center py-12">
						<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
						<p className="text-gray-500">Loading location checks...</p>
					</div>
				) : locationChecks.length === 0 ? (
					<div className="text-center py-12">
						<MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
						<p className="text-gray-500">No location checks found</p>
					</div>
				) : (
					<>
						{/* Location Checks List */}
						<div className="space-y-4">
							{locationChecks.map((check) => (
								<Card key={check.username} className="p-4">
									<div className="flex items-center justify-between">
										<div className="flex items-center space-x-4">
											<div className="p-2 bg-gray-100 rounded-lg">
												{check.is_team ? (
													<Users className="w-5 h-5 text-gray-600" />
												) : (
													<User className="w-5 h-5 text-gray-600" />
												)}
											</div>
											
											<div>
												<div className="font-semibold text-lg text-gray-900">
													{check.username}
												</div>
												<div className="text-sm text-gray-500">
													{check.is_team ? "Relay Team" : "Solo Swimmer"}
												</div>
											</div>
										</div>
										
										<div className="flex items-center space-x-6">
											<div className="text-right">
												<div className="text-sm text-gray-500">Coordinates</div>
												<div className="font-mono text-sm">
													{check.lat.toFixed(6)}, {check.lon.toFixed(6)}
												</div>
											</div>
											
											<div className="text-right">
												<div className="text-sm text-gray-500">Last Check</div>
												<div className={`font-medium ${getStatusColor(check)}`}>
													{getStatusText(check)}
												</div>
												<div className="text-xs text-gray-400">
													{check.formatted_time}
												</div>
											</div>
											
											{check.previous_timestamp && isValidTimestamp(check.previous_timestamp) && (
												<div className="text-right">
													<div className="text-sm text-gray-500">Previous</div>
													<div className="text-xs text-gray-400">
														{check.previous_formatted_time}
													</div>
												</div>
											)}
										</div>
									</div>
								</Card>
							))}
						</div>
					</>
				)}
			</div>
		</div>
	);
}
