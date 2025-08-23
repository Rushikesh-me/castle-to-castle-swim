import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/utils/auth";
import ddb from "@/app/utils/db/ddb";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";


export async function GET(request: NextRequest) {
	try {
		// Check if user is authenticated and is admin
		const session = await auth();
		if (!session?.user?.is_admin) {
			return NextResponse.json({ error: "Admin access required" }, { status: 403 });
		}

		// Fetch all items from location_check table
		const command = new ScanCommand({
			TableName: "location_check",

		});

		const response = await ddb.send(command);
		const items = response.Items || [];

		// Transform data for frontend
		const locationChecks = items.map(item => {
			// Validate that current_timestamp is a valid timestamp
			const isValidCurrentTimestamp = item.current_timestamp && !isNaN(parseInt(item.current_timestamp));
			const isValidPreviousTimestamp = item.previous_timestamp && 
				!isNaN(parseInt(item.previous_timestamp)) && 
				item.previous_timestamp !== "SWIMMER";
			
			return {
				username: item.pk,
				timestamp: item.current_timestamp,
				lat: item.lat,
				lon: item.lon,
				is_team: item.is_team,
				previous_timestamp: item.previous_timestamp,
				formatted_time: isValidCurrentTimestamp 
					? new Date(parseInt(item.current_timestamp) * 1000).toLocaleString()
					: "Invalid timestamp",
				previous_formatted_time: isValidPreviousTimestamp
					? new Date(parseInt(item.previous_timestamp) * 1000).toLocaleString()
					: null
			};
		});

		return NextResponse.json({ locationChecks });
	} catch (error) {
		console.error("Error fetching location check data:", error);
		return NextResponse.json(
			{ error: "Failed to fetch location check data" },
			{ status: 500 }
		);
	}
}
