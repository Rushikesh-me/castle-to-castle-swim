// app/api/test/backend/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/utils/auth";
import { 
	getAllSwimmers, 
	getActiveSwimmersWithLocations, 
	getSwimmerCompleteHistory 
} from "@/app/utils/db/helpers";

interface TestResult {
	endpoint: string;
	status: "success" | "error";
	message: string;
	data?: string | object;
}

export async function GET() {
	const session = await auth();
	
	if (!session?.user?.is_admin) {
		return NextResponse.json({ error: "Admin access required for backend testing" }, { status: 403 });
	}

	const results: TestResult[] = [];

	// Test 1: Get all swimmers
	try {
		const swimmers = await getAllSwimmers();
		results.push({
			endpoint: "getAllSwimmers",
			status: "success",
			message: `Found ${swimmers.length} swimmers`,
			data: { count: swimmers.length }
		});
	} catch (error) {
		results.push({
			endpoint: "getAllSwimmers",
			status: "error",
			message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
		});
	}

	// Test 2: Get active swimmers with locations (solo)
	try {
		const activeSwimmers = await getActiveSwimmersWithLocations("solo", 5);
		results.push({
			endpoint: "getActiveSwimmersWithLocations (solo)",
			status: "success",
			message: `Found ${activeSwimmers.length} active solo swimmers`,
			data: { 
				count: activeSwimmers.length,
				samples: activeSwimmers.slice(0, 2).map(s => ({
					username: s.username,
					locationCount: s.locations.length
				}))
			}
		});
	} catch (error) {
		results.push({
			endpoint: "getActiveSwimmersWithLocations (solo)",
			status: "error",
			message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
		});
	}

	// Test 3: Get active swimmers with locations (relay)
	try {
		const activeSwimmers = await getActiveSwimmersWithLocations("relay", 5);
		results.push({
			endpoint: "getActiveSwimmersWithLocations (relay)",
			status: "success",
			message: `Found ${activeSwimmers.length} active relay swimmers`,
			data: { count: activeSwimmers.length }
		});
	} catch (error) {
		results.push({
			endpoint: "getActiveSwimmersWithLocations (relay)",
			status: "error",
			message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
		});
	}

	// Test 4: Get all active swimmers
	try {
		const activeSwimmers = await getActiveSwimmersWithLocations(undefined, 10);
		results.push({
			endpoint: "getActiveSwimmersWithLocations (all)",
			status: "success",
			message: `Found ${activeSwimmers.length} active swimmers total`,
			data: { count: activeSwimmers.length }
		});
	} catch (error) {
		results.push({
			endpoint: "getActiveSwimmersWithLocations (all)",
			status: "error",
			message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
		});
	}

	// Test 5: Test validation for invalid swim type
	try {
		await getActiveSwimmersWithLocations("invalid", 10);
		results.push({
			endpoint: "getActiveSwimmersWithLocations (validation)",
			status: "error",
			message: "Validation should have failed for invalid swim type",
		});
	} catch (error) {
		results.push({
			endpoint: "getActiveSwimmersWithLocations (validation)",
			status: "success",
			message: "Validation correctly rejected invalid swim type",
			data: JSON.stringify(error)
		});
	}

	// Test 6: Test getting swimmer history (if any swimmers exist)
	try {
		const swimmers = await getAllSwimmers();
		if (swimmers.length > 0) {
			const testUsername = swimmers[0].username;
			const history = await getSwimmerCompleteHistory(testUsername);
			results.push({
				endpoint: "getSwimmerCompleteHistory",
				status: "success",
				message: `Found ${history.length} location points for ${testUsername}`,
				data: { 
					username: testUsername,
					locationCount: history.length,
					hasData: history.length > 0
				}
			});
		} else {
			results.push({
				endpoint: "getSwimmerCompleteHistory",
				status: "success",
				message: "No swimmers available to test history",
			});
		}
	} catch (error) {
		results.push({
			endpoint: "getSwimmerCompleteHistory",
			status: "error",
			message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
		});
	}

	// Summary
	const successCount = results.filter(r => r.status === "success").length;
	const errorCount = results.filter(r => r.status === "error").length;

	return NextResponse.json({
		summary: {
			total: results.length,
			success: successCount,
			errors: errorCount,
			status: errorCount === 0 ? "all_tests_passed" : "some_tests_failed"
		},
		results,
		timestamp: new Date().toISOString(),
		environment: {
			usersTable: process.env.USERS_TABLE_NAME,
			locationsTable: process.env.LOCATIONS_TABLE_NAME,
			region: process.env.DYNAMODB_REGION
		}
	});
}