// app/api/swimmers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/utils/auth";
import { getAllSwimmers, getActiveSwimmersWithLocations } from "@/app/utils/db/helpers";

export async function GET(request: NextRequest) {
	try {
		const session = await auth();

		const { searchParams } = new URL(request.url);
	
		const swimType = searchParams.get("category"); // "solo" or "relay"
		const locationLimit = Math.min(Math.max(parseInt(searchParams.get("location_limit") || "20"), 1), 100); // Limit between 1-100

		// Always fetch swimmers with locations (removed active parameter requirement)
	
		// Any user can see swimmers with recent locations
		const swimmers = await getActiveSwimmersWithLocations(swimType || undefined, locationLimit);
		return NextResponse.json(swimmers);
	} catch (error) {
		console.error("Failed to fetch swimmers:", error);
		return NextResponse.json({ error: "Failed to fetch swimmers" }, { status: 500 });
	}
}
