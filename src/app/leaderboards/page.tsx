"use client";
import { SwimmerProvider, useSwimmers } from "@/app/utils/providers/SwimmerProvider";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { User, Users, Trophy, MapPin, ArrowLeft, Heart, Share2 } from "lucide-react";
import Link from "next/link";
import { useState, useMemo } from "react";
import type { SwimmerTrack } from "@/app/types";
import { hasRaceStarted, epochStringToMs, getTimeDifference } from "@/app/utils/timeUtils";
import { calculateDistance } from "@/app/utils/usersData";

type SwimCategory = "solo" | "relay";

type RankingType = "donations" | "swim_position";

function LeaderboardsContent() {
  const {
    swimmers,
    tracks,
    isLoading,
    isLoadingEnhanced,
    error,
    selectedCategory,
    setSelectedCategory,
    fetchSwimmers,
    page,
    setPage,
    hasMore,
  } = useSwimmers();

  const [rankingType, setRankingType] = useState<RankingType>("donations");

  // Calculate swim position ranking using tracks data for accurate positioning
  const calculateSwimPositionRanking = (swimmers: SwimmerTrack[]): SwimmerTrack[] => {
    const currentTime = Math.floor(Date.now() / 1000);
    
    return swimmers
      .filter(swimmer => {
        // Only include swimmers whose race has started
        if (!swimmer.start_time || !hasRaceStarted(swimmer.start_time)) return false;
        return true;
      })
      .map(swimmer => {
        const startTime = parseInt(swimmer.start_time!);
        const timeElapsed = currentTime - startTime;
        
        // Find the corresponding track for this swimmer
        const track = tracks.find(t => t.id === swimmer.username);
        let progress = 0;
        
        if (track?.current) {
          const startLocation = swimmer.swim_type === "solo" ? 
            { lat: 53.541085, lng: -8.005591 } : 
            { lat: 53.540183, lng: -7.989841 };
          const endLocation = { lat: 53.423516, lng: -7.941642 };
          
          // Debug: Log the coordinates being used
          console.log(`Calculating for ${swimmer.username}: start=${JSON.stringify(startLocation)}, current=${JSON.stringify(track.current)}, end=${JSON.stringify(endLocation)}`);
          
          // Use current marker position from track
          const currentLocation = track.current;
          
          // Calculate distance from start to current marker position
          const distanceFromStart = calculateDistance(
            startLocation.lat, startLocation.lng,
            currentLocation.lat, currentLocation.lon
          );
          
          // Calculate distance from current marker position to end
          const distanceToEnd = calculateDistance(
            currentLocation.lat, currentLocation.lon,
            endLocation.lat, endLocation.lng
          );
          
          // Calculate total distance covered (start to current + current to end)
          const totalDistanceCovered = distanceFromStart + distanceToEnd;
          
          if (totalDistanceCovered > 0) {
            progress = Math.min((distanceFromStart / totalDistanceCovered) * 100, 100);
          }
        }
        
        // Calculate ranking score: progress per unit time
        const rankingScore = timeElapsed > 0 ? progress / timeElapsed : 0;
        
        // Debug logging
        console.log(`Swimmer ${swimmer.username}: progress=${progress.toFixed(2)}%, timeElapsed=${timeElapsed}s, rankingScore=${rankingScore.toFixed(6)}`);
        
        return {
          ...swimmer,
          rankingScore
        };
      })
      .sort((a, b) => b.rankingScore - a.rankingScore);
      
    // Debug: Log the final sorted results
    const sortedResults = swimmers
      .filter(swimmer => {
        if (!swimmer.start_time || !hasRaceStarted(swimmer.start_time)) return false;
        return true;
      })
      .map(swimmer => {
        const track = tracks.find(t => t.id === swimmer.username);
        return {
          username: swimmer.username,
          hasTrack: !!track,
          hasCurrent: !!track?.current,
          currentLat: track?.current?.lat,
          currentLon: track?.current?.lon
        };
      });
    console.log('Swim position sorting debug:', sortedResults);
  };

  // Haversine distance calculation
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
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
  };

  // Sort swimmers based on ranking type
  const sortedSwimmers = useMemo(() => {
    if (rankingType === "donations") {
      // Sort by donations (fast, available immediately)
      return [...swimmers].sort((a, b) => {
        const aDonations = a.donations_total || 0;
        const bDonations = b.donations_total || 0;
        return bDonations - aDonations;
      });
    } else {
      // Sort by swim position (requires tracks data)
      if (tracks.length === 0) {
        // If tracks aren't ready yet, return original order
        return swimmers;
      }
      return calculateSwimPositionRanking(swimmers);
    }
  }, [swimmers, tracks, rankingType]);

  // Handle category change with progressive loading
  const handleCategoryChange = async (category: SwimCategory) => {
    await setSelectedCategory(category);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">Error: {error}</div>
          <Button onClick={() => fetchSwimmers(selectedCategory)}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full mt-20 bg-gray-50">
      {/* Header */}

      {/* Category Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 pt-2">
            <button
              onClick={() => handleCategoryChange("solo")}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                selectedCategory === "solo"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Solo Swimmers
            </button>
            <button
              onClick={() => handleCategoryChange("relay")}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                selectedCategory === "relay"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Relay Teams
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Ranking Toggle */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">Sort by:</span>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setRankingType("donations")}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  rankingType === "donations"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Donations
              </button>
              <button
                onClick={() => setRankingType("swim_position")}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  rankingType === "swim_position"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Swim Position
              </button>
            </div>
          </div>
          
          {/* Enhanced Data Loading Indicator */}
          {isLoadingEnhanced && (
            <div className="flex items-center text-sm text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              Loading enhanced data...
            </div>
          )}
          
          {/* Swim Position Sorting Status */}
          {rankingType === "swim_position" && tracks.length === 0 && (
            <div className="flex items-center text-sm text-orange-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600 mr-2"></div>
              Preparing swim position data...
            </div>
          )}
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading swimmers...</p>
          </div>
        ) : swimmers.length === 0 ? (
          <div className="text-center py-12">
            <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No swimmers found</p>
          </div>
        ) : (
          <>
            {/* Leaderboard List */}
            <div className="space-y-4">
              {sortedSwimmers.map((swimmer, index) => (
                <Card key={swimmer.username} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-semibold text-lg text-gray-900">
                        {swimmer.swim_type === "solo" 
                          ? `${swimmer.first_name || ""} ${swimmer.last_name || ""}`.trim() || swimmer.username
                          : swimmer.team_name || swimmer.username
                        }
                      </div>
                      <div className="text-xs text-gray-500 mb-1">
                        {swimmer.swim_type === "solo" ? "Solo" : "Relay"}
                        {swimmer.location && ` • ${swimmer.location}`}
                      </div>
                      <div className="text-sm text-gray-700">
                        {rankingType === "donations" ? (
                          <>
                            <span className="font-medium">€{swimmer.donations_total || 0}</span>
                            {isLoadingEnhanced && swimmer.donations_total === null && (
                              <span className="text-gray-400 ml-2">Loading...</span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="font-medium">
                              {swimmer.locations.length > 0 ? `#${index + 1}` : "Not started"}
                            </span>
                            {isLoadingEnhanced && swimmer.locations.length === 0 && (
                              <span className="text-gray-400 ml-2">Loading location data...</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">#{index + 1}</div>
                      <div className="text-xs text-gray-500">
                        {rankingType === "donations" ? "Donations" : "Position"}
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex items-center space-x-2">
                      {swimmer.idonate_url ? (
                        <Button
                          onClick={() => window.open(swimmer.idonate_url, '_blank')}
                          size="sm"
                          className="bg-red-500 hover:bg-red-600 text-white"
                        >
                          <Heart className="w-4 h-4 mr-2" />
                          Donate
                        </Button>
                      ) : (
                        <span className="text-sm text-gray-400 italic">No donation link available</span>
                      )}
                    </div>
                    
                    <Button
                      onClick={() => {
                        const shareUrl = `${window.location.origin}/map?${swimmer.swim_type === "solo" ? "user" : "team"}=${swimmer.username}`;
                        if (navigator.share) {
                          navigator.share({
                            title: `Support ${swimmer.swim_type === "solo" ? swimmer.first_name || swimmer.username : swimmer.team_name || swimmer.username}`,
                            text: `Check out ${swimmer.swim_type === "solo" ? "this swimmer" : "this relay team"} on the Castle Swim tracker!`,
                            url: shareUrl
                          });
                        } else {
                          navigator.clipboard.writeText(shareUrl);
                          // You could add a toast notification here
                        }
                      }}
                      size="sm"
                      variant="outline"
                      className="text-gray-600 hover:text-gray-800"
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      Share
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {hasMore && (
              <div className="mt-8 text-center">
                <Button
                  onClick={() => setPage(page + 1)}
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isLoading ? "Loading..." : "Load More"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function LeaderboardsPage() {
  return (
    <SwimmerProvider>
      <LeaderboardsContent />
    </SwimmerProvider>
  );
}