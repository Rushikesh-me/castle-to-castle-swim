// app/api/swimmers/enhance/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/utils/auth";
import { batchFetchLocations, batchFetchIdonateTotals } from "@/app/utils/db/helpers";

export async function POST(request: NextRequest) {
	try {
		const session = await auth();

		const { usernames, idonateUrls, locationLimit = 20 } = await request.json();

		if (!usernames || !Array.isArray(usernames)) {
			return NextResponse.json({ error: "Invalid usernames array" }, { status: 400 });
		}

		// Fetch locations and donations in parallel
		const [locationsMap, donationsMap] = await Promise.all([
			batchFetchLocations(usernames, locationLimit),
			batchFetchIdonateTotals(idonateUrls || [])
		]);

		// Convert maps to objects for JSON response
		const locations = Object.fromEntries(locationsMap);
		const donations = Object.fromEntries(donationsMap);

		return NextResponse.json({
			locations,
			donations,
			timestamp: Date.now()
		});
	} catch (error) {
		console.error("Failed to enhance swimmers data:", error);
		return NextResponse.json({ error: "Failed to enhance swimmers data" }, { status: 500 });
	}
}
