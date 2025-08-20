import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/utils/auth";
import { updateSwimmerAdminFields } from "@/app/utils/db/helpers";
import { dateToEpochString } from "@/app/utils/timeUtils";

interface AdminUpdateRequest {
	start_time?: string; // ISO datetime string from form input
	finish_time?: string; // ISO datetime string from form input
	is_disqualified?: boolean;
}

export async function PUT(request: NextRequest) {
	try {
		const session = await auth();

		if (!session?.user?.is_admin) {
			return NextResponse.json({ error: "Admin access required" }, { status: 403 });
		}

		const body: AdminUpdateRequest = await request.json();

		
		// Convert ISO datetime strings to epoch timestamps
		const validUpdates: Record<string, string | boolean> = {};
		
		if (body.start_time) {
			validUpdates.start_time = dateToEpochString(new Date(body.start_time));
	
		}
		
		if (body.finish_time) {
			validUpdates.finish_time = dateToEpochString(new Date(body.finish_time));
	
		}
		
		if (body.is_disqualified !== undefined) {
			validUpdates.is_disqualified = body.is_disqualified;
		}

		if (Object.keys(validUpdates).length === 0) {
			return NextResponse.json({ error: "No valid updates provided" }, { status: 400 });
		}

		// Get username from query params
		const { searchParams } = new URL(request.url);
		const username = searchParams.get("username");

		if (!username) {
			return NextResponse.json({ error: "Username is required" }, { status: 400 });
		}



		await updateSwimmerAdminFields(username, validUpdates);



		return NextResponse.json({ 
			message: "Swimmer updated successfully",
			updates: validUpdates
		});
	} catch (error) {

		return NextResponse.json({ error: "Failed to update swimmer" }, { status: 500 });
	}
}
