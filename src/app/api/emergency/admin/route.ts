import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/utils/auth";
import { getAllActiveEmergencies, resolveEmergency } from "@/app/utils/db/helpers";

export async function GET(request: NextRequest) {
	try {
		const session = await auth();
		
		if (!session?.user?.is_admin) {
			return NextResponse.json({ error: "Admin access required" }, { status: 403 });
		}

		const emergencies = await getAllActiveEmergencies();
		
		return NextResponse.json(emergencies);
	} catch (error) {
		console.error('Failed to fetch emergencies:', error);
		return NextResponse.json({ error: "Failed to fetch emergencies" }, { status: 500 });
	}
}

export async function PUT(request: NextRequest) {
	try {
		const session = await auth();
		
		if (!session?.user?.is_admin) {
			return NextResponse.json({ error: "Admin access required" }, { status: 403 });
		}

		const body = await request.json();
		const { deviceId, status } = body;
		
		if (!deviceId || status !== 'resolved') {
			return NextResponse.json({ error: "Device ID and status 'resolved' are required" }, { status: 400 });
		}

		const success = await resolveEmergency(deviceId);
		
		if (success) {
			return NextResponse.json({ message: "Emergency resolved successfully" });
		} else {
			return NextResponse.json({ error: "Failed to resolve emergency" }, { status: 500 });
		}
	} catch (error) {
		console.error('Emergency resolve error:', error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
