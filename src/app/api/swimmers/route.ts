// app/api/swimmers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/utils/auth";
import { getAllSwimmers, getActiveSwimmersWithLocations } from "@/app/utils/db/helpers";

export async function GET(request: NextRequest) {
	try {
		const session = await auth();

		const { searchParams } = new URL(request.url);
		console.log("search params" , searchParams)
		const activeOnly = searchParams.get("active") === "true";
		const swimType = searchParams.get("category"); // "solo" or "relay"
		const locationLimit = Math.min(Math.max(parseInt(searchParams.get("location_limit") || "20"), 1), 100); // Limit between 1-100

		if (activeOnly) {
			console.log("fetching for swimType : ", swimType)
			// Any user can see active swimmers with recent locations
			const swimmers = await getActiveSwimmersWithLocations(swimType || undefined, locationLimit);
			return NextResponse.json(swimmers);
		} else if (session?.user.is_admin) {
			// Only admins can see all swimmers (existing functionality)
			const swimmers = await getAllSwimmers();
			return NextResponse.json(swimmers);
		} else {
			return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
		}
	} catch (error) {
		console.error("Failed to fetch swimmers:", error);
		return NextResponse.json({ error: "Failed to fetch swimmers" }, { status: 500 });
	}
}
