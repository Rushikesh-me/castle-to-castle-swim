import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/utils/auth";
import { createEmergencyRecord, updateEmergencyLocation, getEmergencyByDeviceId } from "@/app/utils/db/helpers";

// Generate a unique device ID based on user agent and other available info
function generateDeviceId(request: NextRequest): string {
	const userAgent = request.headers.get('user-agent') || '';
	const acceptLanguage = request.headers.get('accept-language') || '';
	const platform = request.headers.get('sec-ch-ua-platform') || '';
	
	// Create a hash-like string from available device info
	const deviceString = `${userAgent}-${acceptLanguage}-${platform}`;
	return Buffer.from(deviceString).toString('base64').substring(0, 16);
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { location, isSwimmer } = body;
		
		if (!location || !location.lat || !location.lng) {
			return NextResponse.json({ error: "Location is required" }, { status: 400 });
		}

		const deviceId = generateDeviceId(request);
		const timestamp = new Date().toISOString();
		
		// Check if this device already has an active emergency
		const existingEmergency = await getEmergencyByDeviceId(deviceId);
		
		if (existingEmergency && existingEmergency.status === 'active') {
			// Update location of existing emergency
			await updateEmergencyLocation(deviceId, location);
			return NextResponse.json({ 
				message: "Emergency location updated",
				deviceId,
				status: "updated"
			});
		}

		// Create new emergency record
		let emergencyData: {
			deviceId: string;
			location: { lat: number; lng: number };
			timestamp: string;
			isSwimmer: boolean;
			status: 'active';
			username?: string;
			swimType?: string;
			teamName?: string;
			firstName?: string;
			lastName?: string;
		} = {
			deviceId,
			location,
			timestamp,
			isSwimmer: isSwimmer || false,
			status: 'active',
		};

		// If user is logged in, add swimmer information
		if (isSwimmer) {
			try {
				const session = await auth();
				if (session?.user) {
					emergencyData = {
						...emergencyData,
						username: session.user.name || undefined,
						swimType: session.user.swim_type || undefined,
						teamName: session.user.team_name || undefined,
						firstName: (session.user as { first_name?: string }).first_name,
						lastName: (session.user as { last_name?: string }).last_name,
					};
				}
			} catch (error) {
				// Continue without session data if auth fails
			}
		}

		const success = await createEmergencyRecord(emergencyData);
		
		if (success) {
			return NextResponse.json({ 
				message: "Emergency SOS sent successfully",
				deviceId,
				status: "created"
			});
		} else {
			return NextResponse.json({ error: "Failed to create emergency record" }, { status: 500 });
		}
	} catch (error) {
		console.error('Emergency SOS error:', error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function PUT(request: NextRequest) {
	try {
		const body = await request.json();
		const { deviceId, location } = body;
		
		if (!deviceId || !location) {
			return NextResponse.json({ error: "Device ID and location are required" }, { status: 400 });
		}

		const success = await updateEmergencyLocation(deviceId, location);
		
		if (success) {
			return NextResponse.json({ message: "Emergency location updated successfully" });
		} else {
			return NextResponse.json({ error: "Failed to update emergency location" }, { status: 500 });
		}
	} catch (error) {
		console.error('Emergency location update error:', error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
