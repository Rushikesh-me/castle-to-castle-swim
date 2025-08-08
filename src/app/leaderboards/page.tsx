"use client";
import { SwimmerProvider, useSwimmers } from "@/app/utils/providers/SwimmerProvider";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { User, Users } from "lucide-react";
import Link from "next/link";

function LeaderboardsContent() {
  const {
    swimmers,
    isLoading,
    error,
    selectedCategory,
    setSelectedCategory,
    fetchSwimmers,
    page,
    setPage,
    hasMore,
  } = useSwimmers();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-bold text-gray-900">Leaderboards</h1>
            <Link href="/map">
              <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900">
                Back to Map
              </Button>
            </Link>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Segmented Control */}
        <div className="flex justify-center mb-6">
          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200">
            <div className="flex">
              <button
                onClick={() => setSelectedCategory("solo")}
                className={`flex items-center px-4 py-2 rounded-l-lg transition-all ${
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
                className={`flex items-center px-4 py-2 rounded-r-lg transition-all ${
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
        {/* Error */}
        {error && (
          <div className="text-center text-red-600 mb-4">{error}</div>
        )}
        {/* Swimmer List */}
        <div className="space-y-4">
          {swimmers.length === 0 && !isLoading && (
            <div className="text-center text-gray-500">No swimmers found for this category.</div>
          )}
          {swimmers.map((swimmer, idx) => (
            <Card key={swimmer.username} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-lg text-gray-900">{swimmer.team_name || swimmer.username}</div>
                <div className="text-xs text-gray-500 mb-1">{swimmer.swim_type === "solo" ? "Solo" : "Relay"}</div>
                <div className="text-sm text-gray-700">
                  Distance: {swimmer.locations && swimmer.locations.length > 1 ? `${((swimmer.locations.reduce((sum, loc, i, arr) => i > 0 ? sum + Math.sqrt(Math.pow(loc.lat - arr[i-1].lat, 2) + Math.pow(loc.lon - arr[i-1].lon, 2)) : sum, 0)) * 111139).toFixed(0)}m` : "N/A"}
                  {" | "}
                  Avg Pace: {swimmer.locations && swimmer.locations.length > 1 ? `${((swimmer.locations[swimmer.locations.length-1].tst - swimmer.locations[0].tst) / 60 / (swimmer.locations.length / 100)).toFixed(1)} min/100m` : "N/A"}
                </div>
              </div>
              <div className="text-xs text-gray-500">{idx + 1 + (page - 1) * 20} place</div>
            </Card>
          ))}
        </div>
        {/* Pagination / Infinite Scroll */}
        <div className="flex justify-center mt-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page + 1)}
            disabled={!hasMore || isLoading}
            className="mx-2"
          >
            Load More
          </Button>
          {page > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page === 1 || isLoading}
              className="mx-2"
            >
              Previous Page
            </Button>
          )}
        </div>
        {isLoading && (
          <div className="text-center text-gray-500 mt-4">Loading...</div>
        )}
      </main>
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