"use client";

import { APIProvider, Map, AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import { Fragment, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Polyline } from "@/app/components/map/Polyline";
import { MarkerClusterer } from "@/app/components/map/MarkerClusterer";
import { Card} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import type { DrawTrack, LocationPoint } from "@/app/types";
import { 
	ChevronLeft, 
	ChevronRight, 
	X, 
	Loader2, 
	Users, 
	User,
	Share2,
	Trophy,
	MapPin,
	Percent,
	RefreshCw,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useSwimmers } from "@/app/utils/providers/SwimmerProvider";
import { hasRaceStarted as hasRaceStartedUtil, formatEpochString as formatEpochStringUtil } from "@/app/utils/timeUtils";
import { calculateRaceProgress } from "@/app/utils/usersData";

interface SwimmerStats {
	totalDistance: number;
	duration: number;
	averagePace: number;
	currentLocation: LocationPoint;
	raceProgress: number;
	donationsRanking: number;
	swimPositionRanking: number;
}

export default function EnhancedSwimTracker() {
	const searchParams = useSearchParams();
	const { swimmers, tracks, isLoading, isLoadingEnhanced, error, selectedCategory, setSelectedCategory, fetchSwimmers, swimmerHistory, fetchSwimmerHistory, loadingHistory, page, setPage, hasMore, selectedSwimmerFromUrl, setSelectedSwimmerFromUrl } = useSwimmers();
	const [selectedSwimmer, setSelectedSwimmer] = useState<DrawTrack | null>(null);
	const [showBottomSheet, setShowBottomSheet] = useState(false);
	const [currentSwimmerIndex, setCurrentSwimmerIndex] = useState(0);
	
	// Check URL parameters for user/team selection
	useEffect(() => {
		const userParam = searchParams.get('user');
		const teamParam = searchParams.get('team');
		
		if (userParam || teamParam) {
			const username = userParam || teamParam;
			setSelectedSwimmerFromUrl(username);
			
			// Find the swimmer and select them
			const swimmer = tracks.find(t => t.id === username);
			if (swimmer) {
				setSelectedSwimmer(swimmer);
				setShowBottomSheet(true);
				handleMarkerClick(swimmer);
			}
		}
	}, [searchParams, tracks, setSelectedSwimmerFromUrl]);

	// Map instance will be managed by useMap hook inside MapContent component

	// Process swimmer data into drawable tracks
	const availableSwimmers = useMemo(() => {
		// Show all swimmers, even if they have no location history
		console.log("Available swimmers:", tracks.length, "Swimmers data:", swimmers.length);
		console.log("Raw tracks:", tracks);
		console.log("Raw swimmers:", swimmers.slice(0, 3)); // Show first 3
		
		
		
		return tracks;
	}, [tracks, swimmers]);

	// Calculate swimmer stats
	const calculateSwimmerStats = useCallback((track: DrawTrack): SwimmerStats => {
		const locations = swimmerHistory.length > 0 ? swimmerHistory : 
			swimmers.find(s => s.username === track.id)?.locations || [];

		if (locations.length === 0) {
			return {
				totalDistance: 0,
				duration: 0,
				averagePace: 0,
				currentLocation: track.current,
				raceProgress: 0,
				donationsRanking: 0,
				swimPositionRanking: 0
			};
		}

		// Calculate total distance
		let totalDistance = 0;
		for (let i = 1; i < locations.length; i++) {
			const prev = locations[i - 1];
			const curr = locations[i];
			totalDistance += calculateDistance(prev.lat, prev.lon, curr.lat, curr.lon);
		}

		// Calculate duration and pace
		const duration = locations.length > 1 ? 
			(locations[locations.length - 1].tst - locations[0].tst) / 60 : 0; // in minutes
		const averagePace = duration > 0 ? totalDistance / duration : 0; // meters per minute

		// Get current swimmer data for race progress
		const currentSwimmerData = swimmers.find(s => s.username === track.id);
		const raceProgress = currentSwimmerData ? calculateRaceProgress(currentSwimmerData) : 0;

		// Calculate rankings
		const donationsRanking = swimmers
			.filter(s => s.donations_total !== null && s.donations_total !== undefined)
			.sort((a, b) => (b.donations_total || 0) - (a.donations_total || 0))
			.findIndex(s => s.username === track.id) + 1;

		const swimPositionRanking = swimmers
			.filter(s => s.start_time && hasRaceStartedUtil(s.start_time) && s.locations.length > 0)
			.sort((a, b) => {
				const aProgress = calculateRaceProgress(a);
				const bProgress = calculateRaceProgress(b);
				return bProgress - aProgress;
			})
			.findIndex(s => s.username === track.id) + 1;

		return {
			totalDistance,
			duration,
			averagePace,
			currentLocation: locations[locations.length - 1],
			raceProgress,
			donationsRanking: donationsRanking > 0 ? donationsRanking : 0,
			swimPositionRanking: swimPositionRanking > 0 ? swimPositionRanking : 0
		};
	}, [swimmers, swimmerHistory]);

	// Haversine distance calculation
	const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
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
	}, []);

	// Fetch swimmer's complete history with caching
	const historyCache = useRef<Record<string, LocationPoint[]>>({});
	
	// Handle marker click
	const handleMarkerClick = useCallback(async (track: DrawTrack) => {
		setSelectedSwimmer(track);
		setShowBottomSheet(true);
		
		// Find current swimmer index
		const index = availableSwimmers.findIndex(s => s.id === track.id);
		setCurrentSwimmerIndex(index);

		// Fetch complete history
		const history = await fetchSwimmerHistory(track.id);
		
		// Note: Map bounds will be updated in the MapContent component
		//@ts-nocheck
	}, [availableSwimmers, fetchSwimmerHistory]);

	// Navigate between swimmers
	const navigateSwimmer = useCallback(async (direction: 'prev' | 'next') => {
		if (availableSwimmers.length === 0) return;

		let newIndex = currentSwimmerIndex;
		if (direction === 'prev') {
			newIndex = currentSwimmerIndex > 0 ? currentSwimmerIndex - 1 : availableSwimmers.length - 1;
		} else {
			newIndex = currentSwimmerIndex < availableSwimmers.length - 1 ? currentSwimmerIndex + 1 : 0;
		}

		const newSwimmer = availableSwimmers[newIndex];
		setCurrentSwimmerIndex(newIndex);
		setSelectedSwimmer(newSwimmer);
		
		// Fetch new swimmer's history
		await fetchSwimmerHistory(newSwimmer.id);
	}, [availableSwimmers, currentSwimmerIndex, fetchSwimmerHistory]);

	// Close bottom sheet
	const closeBottomSheet = useCallback(() => {
		setShowBottomSheet(false);
		setSelectedSwimmer(null);
		setSelectedSwimmerFromUrl(null);
	}, [setSelectedSwimmerFromUrl]);

	// Format duration
	const formatDuration = useCallback((seconds: number): string => {
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
	}, []);

	// Format distance
	const formatDistance = useCallback((meters: number): string => {
		if (meters >= 1000) {
			return `${(meters / 1000).toFixed(2)}km`;
		}
		return `${meters.toFixed(0)}m`;
	}, []);

	// Get battery color
	const getBatteryColor = useCallback((battery: number) => {
		if (battery > 50) return "text-green-500";
		if (battery > 20) return "text-yellow-500";
		return "text-red-500";
	}, []);

	// Get connection color
	const getConnectionColor = useCallback((conn: string) => {
		return conn === "w" ? "text-green-500" : "text-orange-500";
	}, []);

	// Memoize swimmer stats for bottom sheet
	const swimmerStats = useMemo(() => {
		return selectedSwimmer ? calculateSwimmerStats(selectedSwimmer) : null;
	}, [selectedSwimmer, calculateSwimmerStats]);

	// Get current swimmer data
	const currentSwimmerData = useMemo(() => {
		return selectedSwimmer ? swimmers.find(s => s.username === selectedSwimmer.id) : null;
	}, [selectedSwimmer, swimmers]);

	// Handle share button click
	const handleShare = useCallback(() => {
		if (currentSwimmerData) {
			const shareUrl = `${window.location.origin}${window.location.pathname}?${currentSwimmerData.swim_type === 'relay' ? 'team' : 'user'}=${currentSwimmerData.username}`;
			if (navigator.share) {
				navigator.share({
					title: `${currentSwimmerData.team_name || currentSwimmerData.username} - Castle Swim`,
					url: shareUrl
				});
			} else {
				navigator.clipboard.writeText(shareUrl);
				// You could add a toast notification here
			}
		}
	}, [currentSwimmerData]);

	// Map center - use first track's location or fallback to solo start location
	const fallbackCenter = tracks.length > 0 && tracks[0]?.points.length > 0 
		? tracks[0].points[0] 
		: { lat: 53.541085, lng: -8.005591 }; // Solo start location

	return (
		<div className="h-full w-full relative">
			{/* Category Tabs */}
			<div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-10 outline-2 outline-ring rounded-lg outline-offset-2">
				<div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200">
					<div className="flex">
						<button
							onClick={() => setSelectedCategory("solo")}
							className={`flex items-center px-8 py-2 rounded-l-lg transition-all text-sm lg:text-xl ${
								selectedCategory === "solo"
									? "bg-blue-500 text-white shadow-md"
									: "text-gray-600 hover:bg-gray-100"
							}`}
						>
							<User className="w-4 h-4 mr-2" />
							Solo
						</button>
						<button
							onClick={() => setSelectedCategory("relay")}
							className={`flex items-center px-8 py-2 rounded-r-lg transition-all text-sm lg:text-xl ${
								selectedCategory === "relay"
									? "bg-blue-500 text-white shadow-md"
									: "text-gray-600 hover:bg-gray-100"
							}`}
						>
							<Users className="w-4 h-4 mr-2" />
							Relay
						</button>
					</div>
				</div>
			</div>

			{/* Loading indicator */}
			{isLoading && (
				<div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-10">
					<div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 px-4 py-2">
						<div className="flex items-center">
							<Loader2 className="w-4 h-4 mr-2 animate-spin" />
							<span className="text-sm text-gray-600">Loading swimmers...</span>
						</div>
					</div>
				</div>
			)}
			{(!isLoading && tracks.length === 0) && (
				<div className="flex h-full w-full items-center justify-center bg-background text-foreground">
				<div className="text-center space-y-4">
					<div>
						<p className="text-lg font-semibold">No swimmers found</p>
						<p className="text-sm text-gray-600 mt-2">
							No swimmers are registered in the system yet
						</p>
					</div>
					{fetchSwimmers && (
						<Button onClick={() => fetchSwimmers(selectedCategory)} variant="outline">
							Refresh
						</Button>
					)}
				</div>
			</div>
			)
			}

			<APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string}>
				<Map
					className="h-full w-full"
					defaultCenter={fallbackCenter}
					defaultZoom={14}
					mapId={process.env.NEXT_PUBLIC_MAP_ID}
					gestureHandling="greedy"
					disableDefaultUI={true}
					mapTypeControl={false}
					streetViewControl={false}
					fullscreenControl={false}
				>
					{/* Polylines - only show selected swimmer's full history or recent tracks for all */}
					{selectedSwimmer && swimmerHistory.length > 0 ? (
						<Polyline
							key={`${selectedSwimmer.id}-history`}
							path={swimmerHistory.map(loc => ({ lat: loc.lat, lng: loc.lon }))}
							geodesic={true}
							strokeColor="#FF6B35"
							strokeOpacity={0.8}
							strokeWeight={4}
							zIndex={1000}
						/>
					) : (
						tracks.map((track, index) => (
							<Polyline
								key={track.id}
								path={track.points}
								geodesic={true}
								strokeColor={`hsl(${index * 60}, 70%, 50%)`}
								strokeOpacity={0.6}
								strokeWeight={3}
								zIndex={1000}
							/>
						))
					)}

					{/* Enhanced Markers with Profile Pictures */}
					{selectedSwimmer && swimmerHistory.length > 0 ? (
						<Fragment key={selectedSwimmer.id}>
							<AdvancedMarker
								position={{ lat: selectedSwimmer.current.lat, lng: selectedSwimmer.current.lon }}
								onClick={() => handleMarkerClick(selectedSwimmer)}
								zIndex={3000}
							>
								<div className="relative cursor-pointer">
									<div className="relative">
										{/* Profile Picture */}
										{currentSwimmerData?.avatar ? (
											<img 
												src={currentSwimmerData.avatar} 
												alt={selectedSwimmer.label}
												className="w-12 h-12 rounded-full border-4 border-orange-300 shadow-lg"
											/>
										) : (
											<div className="w-12 h-12 bg-orange-500 rounded-full border-4 border-orange-300 shadow-lg flex items-center justify-center">
												<span className="text-white font-bold text-lg">
													{selectedSwimmer.label.charAt(0).toUpperCase()}
												</span>
											</div>
										)}
										{/* Pointed bottom */}
										<div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-orange-300"></div>
									</div>
									<div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur px-2 py-1 rounded text-xs font-semibold text-gray-800 whitespace-nowrap shadow-sm">
										{selectedSwimmer.label}
									</div>
								</div>
							</AdvancedMarker>
						</Fragment>
					) : (
						<>
							{/* Test marker to verify Google Maps is working */}
							<AdvancedMarker
								position={{ lat: 53.541085, lng: -8.005591 }}
								zIndex={1000}
							>
								<div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
									<span className="text-white text-xs font-bold">T</span>
								</div>
							</AdvancedMarker>
							
							<MarkerClusterer
								tracks={availableSwimmers}
								onMarkerClick={handleMarkerClick}
								selectedSwimmer={selectedSwimmer}
								swimmers={swimmers}
							/>
						</>
					)}
					
					<MapBoundsUpdater 
						swimmerHistory={swimmerHistory}
						selectedSwimmer={selectedSwimmer}
					/>
				</Map>
			</APIProvider>

			{/* Enhanced Bottom Sheet */}
			{showBottomSheet && selectedSwimmer && (
				<div className={
					`fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-xl shadow-2xl border-t
					transform transition-transform duration-300 ease-out
					${showBottomSheet ? 'translate-y-0' : 'translate-y-full'}`
				}>
					<div className="p-6 max-h-[80vh] overflow-y-auto">
						{/* Header */}
						<div className="flex items-center justify-between mb-4">
							<div className="flex items-center space-x-3">
								{/* Profile photo */}
								{swimmers.find(s => s.username === selectedSwimmer.id)?.avatar ? (
									<img 
										src={swimmers.find(s => s.username === selectedSwimmer.id)?.avatar} 
										alt={selectedSwimmer.label}
										className="w-12 h-12 rounded-full border-2 border-blue-200"
									/>
								) : (
									<div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
										<span className="text-white font-bold text-lg">
											{selectedSwimmer.label.charAt(0).toUpperCase()}
										</span>
									</div>
								)}
								<div>
									<h3 className="text-lg font-bold text-gray-900">
										{currentSwimmerData?.swim_type === 'relay' 
											? currentSwimmerData.team_name || selectedSwimmer.label
											: `${currentSwimmerData?.first_name || ""} ${currentSwimmerData?.last_name || ""}`.trim() || selectedSwimmer.label
										}
									</h3>
									<p className="text-sm text-gray-500">
										{currentSwimmerData?.swim_type === 'relay' ? 'Relay Team' : 'Solo Swimmer'}
									</p>
									{currentSwimmerData?.location && (
										<p className="text-xs text-gray-400">
											📍 {currentSwimmerData.location}
										</p>
									)}
								</div>
							</div>
							<Button
								variant="ghost"
								size="sm"
								onClick={closeBottomSheet}
								className="text-gray-500 hover:text-gray-700"
							>
								<X className="w-5 h-5" />
							</Button>
						</div>

						{/* Rankings and Progress */}
						{swimmerStats && (
							<div className="grid grid-cols-2 gap-3 mb-4">
								<Card className="p-3">
									<div className="text-center">
										<div className="flex items-center justify-center mb-1">
											<Trophy className="w-4 h-4 mr-1 text-yellow-500" />
											<p className="text-xs text-gray-500">Donations Rank</p>
										</div>
										<p className="text-sm font-bold text-yellow-600">
											#{swimmerStats.donationsRanking || 'N/A'}
										</p>
									</div>
								</Card>
								<Card className="p-3">
									<div className="text-center">
										<div className="flex items-center justify-center mb-1">
											<MapPin className="w-4 h-4 mr-1 text-blue-500" />
											<p className="text-xs text-gray-500">Swim Position</p>
										</div>
										<p className="text-sm font-bold text-blue-600">
											{swimmerStats.swimPositionRanking > 0 ? `#${swimmerStats.swimPositionRanking}` : 'N/A'}
										</p>
									</div>
								</Card>
							</div>
						)}

						{/* Race Progress */}
						{swimmerStats && swimmerStats.raceProgress > 0 && (
							<Card className="p-4 mb-4">
								<div className="flex items-center mb-2">
									<Percent className="w-4 h-4 mr-2 text-green-500" />
									<span className="text-sm font-semibold text-gray-700">Race Progress</span>
								</div>
								<div className="w-full bg-gray-200 rounded-full h-2">
									<div 
										className="bg-green-500 h-2 rounded-full transition-all duration-300"
										style={{ width: `${swimmerStats.raceProgress}%` }}
									></div>
								</div>
								<p className="text-xs text-gray-600 mt-1 text-center">
									{swimmerStats.raceProgress.toFixed(1)}% completed
								</p>
							</Card>
						)}

						{/* Bio */}
						{currentSwimmerData?.bio && (
							<Card className="p-4 mb-4">
								<h4 className="font-semibold text-gray-900 mb-2">Bio</h4>
								<p className="text-sm text-gray-700">{currentSwimmerData.bio}</p>
							</Card>
						)}

						{/* Race Times */}
						{(currentSwimmerData?.start_time || currentSwimmerData?.finish_time) && (
							<Card className="p-4 mb-4">
								<h4 className="font-semibold text-gray-900 mb-2">Race Times</h4>
								<div className="space-y-2 text-sm">
									{currentSwimmerData?.start_time && (
										<div className="flex justify-between">
											<span className="text-gray-600">Start Time:</span>
											<span className="font-medium">{formatEpochStringUtil(currentSwimmerData.start_time, 'datetime')}</span>
										</div>
									)}
									{currentSwimmerData?.finish_time && (
										<div className="flex justify-between">
											<span className="text-gray-600">Finish Time:</span>
											<span className="font-medium">{formatEpochStringUtil(currentSwimmerData.finish_time, 'datetime')}</span>
										</div>
									)}
									{currentSwimmerData?.start_time && !currentSwimmerData?.finish_time && (
										<div className="flex justify-between">
											<span className="text-gray-600">Status:</span>
											<span className={`font-medium ${hasRaceStartedUtil(currentSwimmerData.start_time) ? 'text-green-600' : 'text-yellow-600'}`}>
												{hasRaceStartedUtil(currentSwimmerData.start_time) ? 'In Progress' : 'Not Started'}
											</span>
										</div>
									)}
								</div>
							</Card>
						)}

						{/* Donate and Share */}
						<div className="flex items-center justify-between mb-4">
							<div className="text-sm text-gray-600">
								<span className="mr-3">Type: {currentSwimmerData?.swim_type === 'relay' ? 'Relay' : 'Solo'}</span>
								<span>
									Donations: {typeof currentSwimmerData?.donations_total === 'number' ?
										`€${(currentSwimmerData.donations_total as number).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'NA'}
								</span>
							</div>
						</div>

						<div className="flex gap-3 mb-4">
							{currentSwimmerData?.idonate_url ? (
								<a href={currentSwimmerData.idonate_url} target="_blank" rel="noopener noreferrer" className="flex-1">
									<Button className="w-full bg-green-600 hover:bg-green-700">Donate now</Button>
								</a>
							) : (
								<Button variant="outline" disabled className="flex-1">Donate now</Button>
							)}
							<Button 
								variant="outline" 
								onClick={handleShare}
								className="flex items-center"
							>
								<Share2 className="w-4 h-4 mr-2" />
								Share
							</Button>
						</div>

						{/* Stats Cards */}
						{swimmerStats && (
							<div className="grid grid-cols-3 gap-3 mb-4">
								<Card className="p-3">
									<div className="text-center">
										<p className="text-xs text-gray-500 mb-1">Distance</p>
										<p className="text-sm font-bold text-blue-600">
											{formatDistance(swimmerStats.totalDistance)}
										</p>
									</div>
								</Card>
								<Card className="p-3">
									<div className="text-center">
										<div className="text-center">
											<p className="text-xs text-gray-500 mb-1">Duration</p>
											<p className="text-sm font-bold text-green-600">
												{formatDuration(swimmerStats.duration)}
											</p>
										</div>
									</div>
								</Card>
								<Card className="p-3">
									<div className="text-center">
										<p className="text-xs text-gray-500 mb-1">Avg Pace</p>
										<p className="text-sm font-bold text-purple-600">
											{swimmerStats.averagePace > 0 ? `${swimmerStats.averagePace.toFixed(1)}min/100m` : "N/A"}
										</p>
									</div>
								</Card>
							</div>
						)}

						{/* Team details for relay */}
						{currentSwimmerData?.swim_type === 'relay' && (
							<div className="mb-4">
								<h4 className="font-semibold text-gray-900 mb-2">Team</h4>
								<div className="text-sm text-gray-700">
									<div className="mb-1">
										Captain: {currentSwimmerData.team_captain?.first_name} {currentSwimmerData.team_captain?.last_name}
									</div>
									<div>
										Members:
										<ul className="list-disc pl-5">
											{(currentSwimmerData.members || []).map((m, i) => (
												<li key={i}>{m.first_name} {m.last_name}</li>
											))}
										</ul>
									</div>
								</div>
							</div>
						)}

						{/* Navigation */}
						{availableSwimmers.length > 1 && (
							<div className="flex items-center justify-between pt-3 border-t border-gray-200">
								<Button
									variant="outline"
									size="sm"
									onClick={() => navigateSwimmer('prev')}
									disabled={loadingHistory}
									className="flex items-center bg-"
								>
									<ChevronLeft className="w-4 h-4 mr-1" />
									Previous
								</Button>
								<span className="text-sm text-gray-500">
									{currentSwimmerIndex + 1} of {availableSwimmers.length}
								</span>
								<Button
									variant="outline"
									size="sm"
									onClick={() => navigateSwimmer('next')}
									disabled={loadingHistory}
									className="flex items-center"
								>
									Next
									<ChevronRight className="w-4 h-4 ml-1" />
								</Button>
							</div>
						)}

						{/* Loading indicator for history */}
						{loadingHistory && (
							<div className="flex items-center justify-center py-4">
								<Loader2 className="w-5 h-5 animate-spin mr-2" />
								<span className="text-sm text-gray-600">Loading swimmer history...</span>
								</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

// Component to handle map bounds updates when swimmer is selected
function MapBoundsUpdater({ swimmerHistory, selectedSwimmer }: {
	swimmerHistory: LocationPoint[];
	selectedSwimmer: DrawTrack | null;
}) {
	const map = useMap();

	useEffect(() => {
		if (map && selectedSwimmer && swimmerHistory.length > 0) {
			const bounds = new google.maps.LatLngBounds();
			swimmerHistory.forEach((location: LocationPoint) => {
				bounds.extend({ lat: location.lat, lng: location.lon });
			});
			map.fitBounds(bounds, 50);
		}
	}, [map, selectedSwimmer, swimmerHistory]);

	return null;
}