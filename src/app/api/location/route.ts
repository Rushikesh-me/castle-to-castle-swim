// app/api/location/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import ddb from "@/app/utils/db/ddb";

interface LocationData {
	_type: string;
	acc: number;
	conn: "w" | "m" | string;
	tst: number;
	lon: number;
	lat: number;
	alt?: number;
	batt: number;
	tid: string;
	pk?: string; // username
}

export async function POST(request: NextRequest) {
	try {
		const body: LocationData = await request.json();
		
		// Validate required fields
		if (!body._type || body._type !== "location") {
			return NextResponse.json({ error: "Invalid location data type" }, { status: 400 });
		}

		if (typeof body.lat !== "number" || typeof body.lon !== "number" || typeof body.tst !== "number") {
			return NextResponse.json({ error: "Missing required location fields" }, { status: 400 });
		}

		// Extract username from authentication or body
		const username = body.pk || request.headers.get("x-username");
		
		if (!username) {
			return NextResponse.json({ error: "Username required" }, { status: 400 });
		}

		// Store location data
		const locationItem = {
			pk: username, // partition key
			sk: `LOCATION#${body.tst}`, // sort key with timestamp
			acc: body.acc || 0,
			conn: body.conn || "unknown",
			tst: body.tst,
			lon: body.lon,
			lat: body.lat,
			alt: body.alt || null,
			batt: body.batt || 0,
			tid: body.tid || "unknown",
			created_at: new Date().toISOString(),
		};

		await ddb.send(new PutCommand({
			TableName: process.env.LOCATIONS_TABLE_NAME!,
			Item: locationItem,
		}));

		return NextResponse.json({ success: true, message: "Location stored successfully" });
	} catch (error) {
		console.error("Failed to store location:", error);
		return NextResponse.json({ error: "Failed to store location" }, { status: 500 });
	}
}

export async function GET(request: NextRequest) {
	return NextResponse.json({ 
		message: "Location API endpoint",
		endpoints: {
			POST: "Store location data",
			GET: "This help message"
		}
	});
}