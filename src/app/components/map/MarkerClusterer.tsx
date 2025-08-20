"use client";

import { useEffect, useState } from "react";
import { AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import type { DrawTrack, SwimmerTrack } from "@/app/types";

interface MarkerClustererProps {
  tracks: DrawTrack[];
  onMarkerClick: (track: DrawTrack) => void;
  selectedSwimmer: DrawTrack | null;
  swimmers: SwimmerTrack[];
}

interface Cluster {
  center: { lat: number; lng: number };
  tracks: DrawTrack[];
  bounds: google.maps.LatLngBounds;
}

// Simple Haversine distance calculation (doesn't require Google Maps Geometry library)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
}

export function MarkerClusterer({ tracks, onMarkerClick, selectedSwimmer, swimmers }: MarkerClustererProps) {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const map = useMap();

  console.log("🎯 MarkerClusterer received:", {
    tracksCount: tracks.length,
    swimmersCount: swimmers.length
  });

  // Cluster markers that are close together
  const createClusters = (tracks: DrawTrack[], zoom: number): Cluster[] => {
    if (tracks.length === 0) return [];

    // Filter out tracks with invalid coordinates
    const validTracks = tracks.filter(track => {
      const isValid = track.current && 
        typeof track.current.lat === 'number' && 
        typeof track.current.lon === 'number' &&
        !isNaN(track.current.lat) && 
        !isNaN(track.current.lon) &&
        isFinite(track.current.lat) && 
        isFinite(track.current.lon);
      
      if (!isValid) {
        console.warn(`⚠️ Skipping track ${track.id} with invalid coordinates:`, track.current);
      }
      return isValid;
    });

    if (validTracks.length === 0) {
      console.log("⚠️ No valid tracks to cluster");
      return [];
    }

    console.log(`🔍 Processing ${validTracks.length} valid tracks out of ${tracks.length} total`);

    const clusters: Cluster[] = [];
    const clusterRadius = Math.max(50, 1000 / Math.pow(2, zoom)); // Adjust radius based on zoom

    validTracks.forEach(track => {
      let addedToCluster = false;

      for (const cluster of clusters) {
        // Use our custom distance calculation instead of Google Maps Geometry
        const distance = calculateDistance(
          cluster.center.lat, cluster.center.lng,
          track.current.lat, track.current.lon
        );

        if (distance < clusterRadius) {
          cluster.tracks.push(track);
          cluster.bounds.extend({ lat: track.current.lat, lng: track.current.lon });
          
          // Recalculate cluster center
          const totalLat = cluster.tracks.reduce((sum, t) => sum + t.current.lat, 0);
          const totalLng = cluster.tracks.reduce((sum, t) => sum + t.current.lon, 0);
          cluster.center = {
            lat: totalLat / cluster.tracks.length,
            lng: totalLng / cluster.tracks.length
          };
          
          addedToCluster = true;
          break;
        }
      }

      if (!addedToCluster) {
        const bounds = new google.maps.LatLngBounds();
        bounds.extend({ lat: track.current.lat, lng: track.current.lon });
        
        clusters.push({
          center: { lat: track.current.lat, lng: track.current.lon },
          tracks: [track],
          bounds
        });
      }
    });

    return clusters;
  };

  // Update clusters when tracks change or zoom changes
  useEffect(() => {
    if (map) {
      const zoom = map.getZoom() || 14;
      console.log("🗺️ Creating clusters with zoom level:", zoom);
      const newClusters = createClusters(tracks, zoom);
      console.log("📊 Created clusters:", newClusters.length);
      console.log("📊 Cluster details:", newClusters.map(c => ({ 
        center: c.center, 
        trackCount: c.tracks.length,
        firstTrack: c.tracks[0]?.id 
      })));
      setClusters(newClusters);
    } else {
      // If no map yet, create clusters with default zoom
      console.log("🗺️ No map yet, creating clusters with default zoom");
      const newClusters = createClusters(tracks, 14);
      console.log("📊 Created clusters with default zoom:", newClusters.length);
      console.log("📊 Cluster details:", newClusters.map(c => ({ 
        center: c.center, 
        trackCount: c.tracks.length,
        firstTrack: c.tracks[0]?.id 
      })));
      setClusters(newClusters);
    }
  }, [tracks, map]);

  // If no clusters yet, show loading
  if (clusters.length === 0) {
    console.log("⏳ No clusters yet, waiting for map...");
    return null;
  }

  console.log("🎯 Rendering clusters:", clusters.length);

  return (
    <>
      {clusters.map((cluster, index) => {
        if (cluster.tracks.length === 1) {
          // Single marker
          const track = cluster.tracks[0];
          
          // Additional validation for rendering
          if (!track.current || 
              typeof track.current.lat !== 'number' || 
              typeof track.current.lon !== 'number' ||
              isNaN(track.current.lat) || 
              isNaN(track.current.lon) ||
              !isFinite(track.current.lat) || 
              !isFinite(track.current.lon)) {
            console.warn(`⚠️ Skipping invalid marker for track ${track.id}:`, track.current);
            return null;
          }
          
          const swimmerData = swimmers.find(s => s.username === track.id);
          const isSelected = selectedSwimmer?.id === track.id;
          
          console.log(`📍 Rendering single marker for ${track.id} at:`, { lat: track.current.lat, lng: track.current.lon });
          
          return (
            <AdvancedMarker
              key={track.id}
              position={{ lat: track.current.lat, lng: track.current.lon }}
              onClick={() => onMarkerClick(track)}
              zIndex={isSelected ? 3000 : 2000}
            >
              <div className="relative cursor-pointer">
                <div className="relative">
                  {/* Profile Picture */}
                  {swimmerData?.avatar ? (
                    <img 
                      src={swimmerData.avatar} 
                      alt={track.label}
                      className={`w-10 h-10 rounded-full border-3 shadow-lg ${
                        isSelected ? "border-orange-300 scale-110" : "border-blue-300"
                      }`}
                    />
                  ) : (
                    <div className={`w-10 h-10 rounded-full border-3 shadow-lg flex items-center justify-center ${
                      isSelected ? "bg-orange-500 border-orange-300 scale-110" : "bg-blue-500 border-blue-300"
                    }`}>
                      <span className="text-white font-bold text-sm">
                        {track.label.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  {/* Pointed bottom */}
                  <div className={`absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-3 border-r-3 border-t-3 border-transparent ${
                    isSelected ? "border-t-orange-300" : "border-t-blue-300"
                  }`}></div>
                </div>
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur px-2 py-1 rounded text-xs font-semibold text-gray-800 whitespace-nowrap shadow-sm">
                  {track.label}
                </div>
              </div>
            </AdvancedMarker>
          );
        } else {
          // Clustered markers
          
          // Validate cluster center coordinates
          if (!cluster.center || 
              typeof cluster.center.lat !== 'number' || 
              typeof cluster.center.lng !== 'number' ||
              isNaN(cluster.center.lat) || 
              isNaN(cluster.center.lng) ||
              !isFinite(cluster.center.lat) || 
              !isFinite(cluster.center.lng)) {
            console.warn(`⚠️ Skipping invalid cluster center:`, cluster.center);
            return null;
          }
          
          console.log(`📍 Rendering cluster with ${cluster.tracks.length} markers at:`, cluster.center);
          
          return (
            <AdvancedMarker
              key={`cluster-${index}`}
              position={cluster.center}
              onClick={() => {
                // Show popup for the first person in the cluster
                const firstTrack = cluster.tracks[0];
                if (firstTrack) {
                  console.log(`🎯 Cluster clicked, showing popup for first person: ${firstTrack.id}`);
                  onMarkerClick(firstTrack);
                }
              }}
              zIndex={1500}
            >
              <div className="relative cursor-pointer group">
                <div className="relative">
                  <div className="w-12 h-12 bg-purple-500 rounded-full border-4 border-purple-300 shadow-lg flex items-center justify-center transition-transform group-hover:scale-110">
                    <span className="text-white font-bold text-lg">
                      {cluster.tracks.length}
                    </span>
                  </div>
                  {/* Pointed bottom */}
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-purple-300"></div>
                </div>
                {/* Enhanced tooltip showing click functionality */}
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur px-2 py-1 rounded text-xs font-semibold text-gray-800 whitespace-nowrap shadow-sm">
                  <div className="text-center">
                    <div className="font-bold">{cluster.tracks.length} swimmers</div>
                    <div className="text-xs text-gray-600">Click to see first swimmer</div>
                  </div>
                </div>
              </div>
            </AdvancedMarker>
          );
        }
      })}
    </>
  );
}
