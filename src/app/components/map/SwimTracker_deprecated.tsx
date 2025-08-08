"use client";

import { APIProvider, Map, AdvancedMarker, InfoWindow } from "@vis.gl/react-google-maps";
import { Fragment, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { extractTracks } from "@/app/utils/usersData";
import { Polyline } from "@/app/components/map/Polyline"; // Import your Polyline component
import type { SwimmerTrack, DrawTrack } from "@/app/types";

interface Props {
	swimmers: SwimmerTrack[];
}

export default function SwimTracker({ swimmers }: Props) {
	const [selected, setSelected] = useState<DrawTrack | null>(null);

	// Process swimmer data into drawable tracks
	const tracks = useMemo<DrawTrack[]>(() => {
		console.log("Processing swimmers:", swimmers?.length || 0);
		if (!swimmers || swimmers.length === 0) return [];

		const result = extractTracks(swimmers);
		console.log(
			"Extracted tracks:",
			result.length,
			"tracks with",
			result.reduce((sum, t) => sum + t.points.length, 0),
			"total points"
		);

		return result;
	}, [swimmers]);

	// Helper functions
	const formatTimestamp = useCallback((timestamp: number) => {
		return new Date(timestamp * 1000).toLocaleString(undefined, { hour12: false });
	}, []);

	const getConnectionLabel = useCallback((conn: string) => {
		return conn === "w" ? "Wi-Fi" : conn === "m" ? "Mobile" : "Unknown";
	}, []);

	const getBatteryColor = useCallback((battery: number) => {
		if (battery > 50) return "bg-success";
		if (battery > 20) return "bg-warning";
		return "bg-destructive";
	}, []);

	// Empty state
	if (tracks.length === 0) {
		return (
			<div className="flex h-full w-full items-center justify-center bg-background text-foreground">
				<div className="text-center space-y-4">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
					<div>
						<p className="text-lg font-semibold">Loading swim tracking data...</p>
						<p className="text-sm text-gray-600 mt-2">Swimmers provided: {swimmers?.length || 0}</p>
						{swimmers &&
							swimmers.map((s, i) => (
								<p key={i} className="text-xs text-gray-500">
									{s.username}: {s.locations?.length || 0} GPS points
								</p>
							))}
					</div>
				</div>
			</div>
		);
	}

	const fallbackCenter = tracks[0]?.points[0] || { lat: 53.4125, lng: -7.9045 };

	return (
		<div className="h-full w-full relative">

			<APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string}>
				<Map
					className="h-full w-full"
					defaultCenter={fallbackCenter}
					defaultZoom={14}
					mapId={process.env.NEXT_PUBLIC_MAP_ID}
					mapTypeId="satellite"
					gestureHandling="greedy"
					disableDefaultUI={false}
					
				>
					{/* Polylines for each track */}
					{tracks.map((track, index) => (
						<Polyline key={track.id} path={track.points} geodesic={true} strokeColor={index === 0 ? "#0D78AA" : `hsl(${index * 60}, 70%, 50%)`} strokeOpacity={0.8} strokeWeight={4} zIndex={1000} />
					))}

					{/* Current location markers for each swimmer */}
					{tracks.map((track, index) => (
						<Fragment key={track.id}>
							<AdvancedMarker position={{ lat: track.current.lat, lng: track.current.lon }} onClick={() => setSelected(track)} zIndex={2000}>
								<div className="relative">
									<div className="bg-primary text-primary-foreground rounded-full p-3 shadow-lg border-2 border-accent animate-pulse cursor-pointer hover:scale-110 transition-transform">
										<div className="w-4 h-4 bg-accent rounded-full"></div>
									</div>
									<div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur px-2 py-1 rounded text-xs font-semibold text-gray-800">{track.label}</div>
								</div>
							</AdvancedMarker>
						</Fragment>
					))}

					{/* Info window for selected swimmer */}
					{selected && (
						<InfoWindow
							position={{lat: selected.current.lat, lng: selected.current.lon}}
							onCloseClick={() => setSelected(null)}
							pixelOffset={[0, -40]}
						>
							<div className="bg-card text-card-fg rounded-lg shadow-lg max-w-sm p-4">
								<h3 className="text-lg font-semibold mb-3 text-primary flex items-center">
									<div className="w-3 h-3 bg-primary rounded-full mr-2"></div>
									{selected.label}
								</h3>

								<div className="space-y-2 text-sm">
									<div className="grid grid-cols-2 gap-2">
										<div>
											<span className="font-medium text-gray-600">Coordinates:</span>
											<div className="text-xs font-mono">
												{selected.current.lat.toFixed(6)}, {selected.current.lon.toFixed(6)}
											</div>
										</div>

										<div>
											<span className="font-medium text-gray-600">Last Update:</span>
											<div className="text-xs">{formatTimestamp(selected.current.tst)}</div>
										</div>
									</div>

									<div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
										<div className="text-center">
											<div className="font-medium text-gray-600">GPS Accuracy</div>
											<div className="text-sm font-semibold">{selected.current.acc}m</div>
										</div>

										<div className="text-center">
											<div className="font-medium text-gray-600">Connection</div>
											<div className="flex items-center justify-center">
												<div className={`w-2 h-2 rounded-full mr-1 ${selected.current.conn === "w" ? "bg-success" : "bg-warning"}`}></div>
												<span className="text-sm">{getConnectionLabel(selected.current.conn)}</span>
											</div>
										</div>

										<div className="text-center">
											<div className="font-medium text-gray-600">Battery</div>
											<div className="flex items-center justify-center">
												<div className={`w-2 h-2 rounded-full mr-1 ${getBatteryColor(selected.current.batt)}`}></div>
												<span className="text-sm font-semibold">{selected.current.batt}%</span>
											</div>
										</div>
									</div>

									<div className="text-xs text-gray-500 pt-2 border-t border-border">
										<div>Altitude: {selected.current.alt}m</div>
										<div>Tracker ID: {selected.current.tid}</div>
										<div>Track Points: {selected.points.length}</div>
									</div>
								</div>

								{/* Action buttons */}
								<div className="mt-4 pt-3 border-t border-border">
									<div className="flex space-x-2">
										<button className="bg-safety text-safety-foreground px-3 py-1 rounded text-xs font-medium hover:opacity-90 transition-opacity">🚨 Emergency</button>
										<button className="bg-secondary text-secondary-foreground px-3 py-1 rounded text-xs font-medium hover:opacity-90 transition-opacity">💬 Message</button>
										<button className="bg-primary text-primary-foreground px-3 py-1 rounded text-xs font-medium hover:opacity-90 transition-opacity">📍 Focus</button>
									</div>
								</div>
							</div>
						</InfoWindow>
					)}
				</Map>
			</APIProvider>
		</div>
	);
}
