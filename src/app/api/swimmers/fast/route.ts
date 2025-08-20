// app/api/swimmers/fast/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/utils/auth";
import { getSwimmersFast } from "@/app/utils/db/helpers";

export async function GET(request: NextRequest) {
	try {
		const session = await auth();

		const { searchParams } = new URL(request.url);
		const swimType = searchParams.get("category"); // "solo" or "relay"

		// Fast fetch swimmers without locations and donations
		const swimmers = await getSwimmersFast(swimType || undefined);
		
		// Return basic swimmer data immediately
		const basicSwimmers = swimmers.map(swimmer => ({
			username: swimmer.username,
			team_name: swimmer.team_name,
			swim_type: swimmer.swim_type,
			idonate_url: swimmer.idonate_url || "",
			start_time: swimmer.start_time || "",
			finish_time: swimmer.finish_time || "",
			is_disqualified: swimmer.is_disqualified || false,
			bio: swimmer.bio || "",
			avatar: swimmer.avatar || "",
			first_name: swimmer.first_name || "",
			last_name: swimmer.last_name || "",
			email: swimmer.email || "",
			location: swimmer.location || "",
			members: swimmer.members || undefined,
			team_captain: swimmer.team_captain || undefined,
			// Placeholder for locations and donations
			locations: [],
			donations_total: null,
		}));

		return NextResponse.json(basicSwimmers);
	} catch (error) {
		console.error("Failed to fetch swimmers fast:", error);
		return NextResponse.json({ error: "Failed to fetch swimmers" }, { status: 500 });
	}
}
