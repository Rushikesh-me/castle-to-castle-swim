"use client";

import { APIProvider, Map, AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import { Fragment, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { extractTracks, calculateOptimalView } from "@/app/utils/usersData";
import { Polyline } from "@/app/components/map/Polyline";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import type { SwimmerTrack, DrawTrack, LocationPoint } from "@/app/types";
import { 
	ChevronLeft, 
	ChevronRight, 
	X, 
	Loader2, 
	Users, 
	User,
	Clock,
	MapPin,
	Activity,
	Battery,
	Signal
} from "lucide-react";
import { useSwimmers } from "@/app/utils/providers/SwimmerProvider";

type SwimCategory = "solo" | "relay";

interface SwimmerStats {
	totalDistance: number;
	duration: number;
	averagePace: number;
	currentLocation: LocationPoint;
}

export default function EnhancedSwimTracker() {
	const {
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
	} = useSwimmers();
	const [selectedSwimmer, setSelectedSwimmer] = useState<DrawTrack | null>(null);
	const [showBottomSheet, setShowBottomSheet] = useState(false);
	const [currentSwimmerIndex, setCurrentSwimmerIndex] = useState(0);
	
	// Map instance will be managed by useMap hook inside MapContent component

	// Process swimmer data into drawable tracks
	const availableSwimmers = useMemo(() => {
		return tracks.filter(track => track.points.length > 0);
	}, [tracks]);

	// Calculate swimmer stats
	const calculateSwimmerStats = useCallback((track: DrawTrack): SwimmerStats => {
		const locations = swimmerHistory.length > 0 ? swimmerHistory : 
			swimmers.find(s => s.username === track.id)?.locations || [];

		if (locations.length === 0) {
			return {
				totalDistance: 0,
				duration: 0,
				averagePace: 0,
				currentLocation: track.current
			};
		}

		// Calculate total distance using Haversine formula
		let totalDistance = 0;
		for (let i = 1; i < locations.length; i++) {
			const dist = calculateDistance(
				locations[i-1].lat, locations[i-1].lon,
				locations[i].lat, locations[i].lon
			);
			totalDistance += dist;
		}

		// Calculate duration
		const sortedLocations = [...locations].sort((a, b) => a.tst - b.tst);
		const duration = sortedLocations.length > 1 ? 
			sortedLocations[sortedLocations.length - 1].tst - sortedLocations[0].tst : 0;

		// Calculate average pace (minutes per 100m)
		const averagePace = duration > 0 && totalDistance > 0 ? 
			(duration / 60) / (totalDistance / 100) : 0;

		return {
			totalDistance,
			duration,
			averagePace,
			currentLocation: track.current
		};
	}, [swimmerHistory, swimmers]);

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
	}, []);

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

	// Empty state
	// if (tracks.length === 0 && !isLoading) {
	// 	return (
	// 		<div className="flex h-full w-full items-center justify-center bg-background text-foreground">
	// 			<div className="text-center space-y-4">
	// 				<div>
	// 					<p className="text-lg font-semibold">No active swimmers found</p>
	// 					<p className="text-sm text-gray-600 mt-2">
	// 						Switch between Solo and Relay tabs or wait for swimmers to become active
	// 					</p>
	// 				</div>
	// 				{fetchSwimmers && (
	// 					<Button onClick={() => fetchSwimmers(selectedCategory)} variant="outline">
	// 						Refresh
	// 					</Button>
	// 				)}
	// 			</div>
	// 		</div>
	// 	);
	// }

	const fallbackCenter = tracks[0]?.points[0] || { lat: 53.4125, lng: -7.9045 };

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
						<p className="text-lg font-semibold">No active swimmers found</p>
						<p className="text-sm text-gray-600 mt-2">
							Switch between Solo and Relay tabs or wait for swimmers to become active
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

					{/* Enhanced Markers */}
					{selectedSwimmer && swimmerHistory.length > 0 ? (
						<Fragment key={selectedSwimmer.id}>
							<AdvancedMarker
								position={{ lat: selectedSwimmer.current.lat, lng: selectedSwimmer.current.lon }}
								onClick={() => handleMarkerClick(selectedSwimmer)}
								zIndex={3000}
							>
								<div className="relative cursor-pointer">
									<div className={
										`relative rounded-full p-3 shadow-lg border-2 transition-all duration-300 hover:scale-110 bg-orange-500 border-orange-300 animate-pulse scale-110`
									}>
										<div className="w-4 h-4 bg-white rounded-full"></div>
										<div className={
											`absolute inset-0 rounded-full animate-ping bg-orange-400`
										} style={{ animationDuration: '2s' }}></div>
									</div>
									<div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur px-2 py-1 rounded text-xs font-semibold text-gray-800 whitespace-nowrap shadow-sm">
										{selectedSwimmer.label}
									</div>
								</div>
							</AdvancedMarker>
						</Fragment>
					) : (
						tracks.map((track, index) => (
							<Fragment key={track.id}>
								<AdvancedMarker
									position={{ lat: track.current.lat, lng: track.current.lon }}
									onClick={() => handleMarkerClick(track)}
									zIndex={selectedSwimmer?.id === track.id ? 3000 : 2000}
								>
									<div className="relative cursor-pointer">
										<div className={
											`relative rounded-full p-3 shadow-lg border-2 transition-all duration-300 hover:scale-110 ${selectedSwimmer?.id === track.id ? "bg-orange-500 border-orange-300 animate-pulse scale-110" : "bg-blue-500 border-blue-300 animate-pulse"}`
										}>
											<div className="w-4 h-4 bg-white rounded-full"></div>
											<div className={
												`absolute inset-0 rounded-full animate-ping ${selectedSwimmer?.id === track.id ? "bg-orange-400" : "bg-blue-400"}`
											} style={{ animationDuration: '2s' }}></div>
										</div>
										<div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur px-2 py-1 rounded text-xs font-semibold text-gray-800 whitespace-nowrap shadow-sm">
											{track.label}
										</div>
									</div>
								</AdvancedMarker>
							</Fragment>
						))
					)}
					
					<MapBoundsUpdater 
						swimmerHistory={swimmerHistory}
						selectedSwimmer={selectedSwimmer}
					/>
				</Map>
			</APIProvider>

			{/* Bottom Sheet */}
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
								{/* Profile photo or fallback initial */}
								<div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
									<span className="text-white font-bold text-lg">
										{selectedSwimmer.label.charAt(0).toUpperCase()}
									</span>
								</div>
								<div>
									<h3 className="text-lg font-bold text-gray-900">{selectedSwimmer.label}</h3>
									<p className="text-sm text-gray-500">Live Race Tracker</p>
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

						{/* Mini Map Overlay */}
						{/* {swimmerHistory.length > 1 && (
							<div className="mb-4">
								<MiniMapOverlay path={swimmerHistory} />
							</div>
						)} */}

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
										<p className="text-xs text-gray-500 mb-1">Duration</p>
										<p className="text-sm font-bold text-green-600">
											{formatDuration(swimmerStats.duration)}
										</p>
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

						{/* Live Stats */}
						{/* <div className="space-y-3 mb-4">
							<h4 className="font-semibold text-gray-900 flex items-center">
								<Activity className="w-4 h-4 mr-2" />
								Live Stats
							</h4>
							<div className="grid grid-cols-2 gap-3 text-sm">
								<div className="flex items-center justify-between">
									<span className="text-gray-600">Coordinates:</span>
									<span className="font-mono text-xs">
										{selectedSwimmer.current.lat.toFixed(6)}, {selectedSwimmer.current.lon.toFixed(6)}
									</span>
								</div>
								<div className="flex items-center justify-between">
									<span className="text-gray-600">Last Update:</span>
									<span className="text-xs">
										{new Date(selectedSwimmer.current.tst * 1000).toLocaleTimeString()}
									</span>
								</div>
								<div className="flex items-center justify-between">
									<span className="text-gray-600 flex items-center">
										<Battery className="w-3 h-3 mr-1" />
										Battery:
									</span>
									<span className={`font-semibold ${getBatteryColor(selectedSwimmer.current.batt)}`}>
										{selectedSwimmer.current.batt}%
									</span>
								</div>
								<div className="flex items-center justify-between">
									<span className="text-gray-600 flex items-center">
										<Signal className="w-3 h-3 mr-1" />
										Connection:
									</span>
									<span className={`font-semibold ${getConnectionColor(selectedSwimmer.current.conn)}`}>
										{selectedSwimmer.current.conn === "w" ? "Wi-Fi" : "Mobile"}
									</span>
								</div>
								<div className="flex items-center justify-between">
									<span className="text-gray-600">Accuracy:</span>
									<span className="font-semibold">{selectedSwimmer.current.acc}m</span>
								</div>
								<div className="flex items-center justify-between">
									<span className="text-gray-600">Altitude:</span>
									<span className="font-semibold">{selectedSwimmer.current.alt}m</span>
								</div>
								
								{typeof (selectedSwimmer.current as any).stroke_rate !== 'undefined' && (
									<div className="flex items-center justify-between col-span-2">
										<span className="text-gray-600">Stroke Rate:</span>
										<span className="font-semibold">{(selectedSwimmer.current as any).stroke_rate} spm</span>
									</div>
								)}
								{Array.isArray((selectedSwimmer.current as any).split_times) && (
									<div className="flex flex-col col-span-2">
										<span className="text-gray-600">Split Times:</span>
										<span className="font-mono text-xs">
											{(selectedSwimmer.current as any).split_times.join(', ')}
										</span>
									</div>
								)}
							</div>
						</div> */}

						{/* Navigation */}
						{availableSwimmers.length > 1 && (
							<div className="flex items-center justify-between pt-3 border-t border-gray-200">
								<Button
									variant="outline"
									size="sm"
									onClick={() => navigateSwimmer('prev')}
									disabled={loadingHistory}
									className="flex items-center"
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

// MiniMapOverlay component (add at the end of the file)
function MiniMapOverlay({ path }: { path: LocationPoint[] }) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	useEffect(() => {
		if (!canvasRef.current || path.length < 2) return;
		const canvas = canvasRef.current;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		// Find bounds
		const lats = path.map(p => p.lat);
		const lngs = path.map(p => p.lon);
		const minLat = Math.min(...lats), maxLat = Math.max(...lats);
		const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
		// Padding
		const pad = 10;
		const w = canvas.width - pad * 2;
		const h = canvas.height - pad * 2;
		// Draw path
		ctx.lineWidth = 3;
		ctx.lineJoin = "round";
		for (let i = 1; i < path.length; i++) {
			// Color by time/pace (simple gradient)
			const t = i / path.length;
			ctx.strokeStyle = `hsl(${(1-t)*120}, 70%, 50%)`;
			ctx.beginPath();
			const x1 = pad + ((path[i-1].lon - minLng) / (maxLng - minLng || 1)) * w;
			const y1 = pad + h - ((path[i-1].lat - minLat) / (maxLat - minLat || 1)) * h;
			const x2 = pad + ((path[i].lon - minLng) / (maxLng - minLng || 1)) * w;
			const y2 = pad + h - ((path[i].lat - minLat) / (maxLat - minLat || 1)) * h;
			ctx.moveTo(x1, y1);
			ctx.lineTo(x2, y2);
			ctx.stroke();
		}
		// Draw start/end points
		ctx.fillStyle = "#22c55e";
		ctx.beginPath();
		ctx.arc(pad + ((path[0].lon - minLng) / (maxLng - minLng || 1)) * w, pad + h - ((path[0].lat - minLat) / (maxLat - minLat || 1)) * h, 5, 0, 2 * Math.PI);
		ctx.fill();
		ctx.fillStyle = "#ef4444";
		ctx.beginPath();
		ctx.arc(pad + ((path[path.length-1].lon - minLng) / (maxLng - minLng || 1)) * w, pad + h - ((path[path.length-1].lat - minLat) / (maxLat - minLat || 1)) * h, 5, 0, 2 * Math.PI);
		ctx.fill();
	}, [path]);
	return (
		<div className="w-full flex justify-center">
			<canvas ref={canvasRef} width={220} height={120} className="rounded border shadow" />
		</div>
	);
}