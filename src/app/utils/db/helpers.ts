import { GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import ddb from "./ddb";
import { createHmac } from "crypto";
import { SwimmerUser } from "@/app/types";

export async function createUser(userData: SwimmerUser) {
	const existingUser = await ddb.send(
		new GetCommand({
			TableName: process.env.USERS_TABLE_NAME!,
			Key: {
				pk: `USER`,
				sk: userData.username,
			},
		})
	);

	if (existingUser.Item) {
		throw new Error("Username already exists");
	}

	// Hash password
	if (!userData.password) {
		throw new Error("Password is required");
	}
	const hashedPassword = createHmac('sha256', process.env.SECRET_KEY || "")
    .update(userData.password)
    .digest('hex');

	const newUser = {
		pk: `USER`,
		sk: userData.username,
		username: userData.username,
		email: userData.email,
		password: hashedPassword,
		team_name: userData.team_name || "solo",
		swim_type: userData.swim_type,
		is_admin: false,
		is_active: false,
		avatar: userData.avatar || "",
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
	};

	await ddb.send(new PutCommand({
		TableName: process.env.USERS_TABLE_NAME!,
		Item: newUser,
	}));

	return { username: userData.username, email: userData.email };
}

export async function getAllSwimmers() {
	const result = await ddb.send(new QueryCommand({
		TableName: process.env.USERS_TABLE_NAME!,
		KeyConditionExpression: "pk = :pk",
		ExpressionAttributeValues: {
			":pk": "USER",
		},
	}));

	return result.Items || [];
}

export async function updateSwimmerStatus(username: string, is_active: boolean) {
	await ddb.send(
		new UpdateCommand({
			TableName: process.env.USERS_TABLE_NAME!,
			Key: {
				pk: `USER`,
				sk: username,
			},
			UpdateExpression: "SET is_active = :status, updated_at = :updated",
			ExpressionAttributeValues: {
				":status": is_active,
				":updated": new Date().toISOString(),
			},
		})
	);
}

export async function updateSwimmerProfile(
	username: string,
	updates: {
		email?: string;
		team_name?: string;
		swim_type?: string;
		avatar?: string;
	}
) {
	const updateExpressions = [];
	const expressionAttributeValues : Record<string, string | null | number | boolean> = {
		":updated": new Date().toISOString(),
	};

	if (updates.email) {
		updateExpressions.push("email = :email");
		expressionAttributeValues[":email"] = updates.email;
	}
	if (updates.team_name) {
		updateExpressions.push("team_name = :team");
		expressionAttributeValues[":team"] = updates.team_name;
	}
	if (updates.swim_type) {
		updateExpressions.push("swim_type = :swim");
		expressionAttributeValues[":swim"] = updates.swim_type;
	}
	if (updates.avatar) {
		updateExpressions.push("avatar = :avatar");
		expressionAttributeValues[":avatar"] = updates.avatar;
	}

	if (updateExpressions.length === 0) return;

	await ddb.send(new UpdateCommand({
		TableName: process.env.USERS_TABLE_NAME!,
		Key: {
			pk: `USER`,
			sk: username,
		},
		UpdateExpression: `SET ${updateExpressions.join(", ")}, updated_at = :updated`,
		ExpressionAttributeValues: expressionAttributeValues,
	}));
}

export async function getActiveSwimmersWithLocations(swimType?: string, locationLimit: number = 20) {
	// Validate inputs
	if (locationLimit < 1 || locationLimit > 100) {
		throw new Error("Location limit must be between 1 and 100");
	}
	
	if (swimType && !["solo", "relay"].includes(swimType)) {
		throw new Error("Swim type must be 'solo' or 'relay'");
	}

	// First, get active swimmers using Query (more efficient than Scan)
	const baseFilterExpression = "is_active = :active";
	const filterExpression = swimType 
		? `${baseFilterExpression} AND swim_type = :swim_type`
		: baseFilterExpression;
	
	const expressionAttributeValues: Record<string, string | null | number | boolean> = {
		":pk": "USER",
		":active": true,
	};

	if (swimType) {
		expressionAttributeValues[":swim_type"] = swimType;
	}

	const swimmerResult = await ddb.send(new QueryCommand({
		TableName: process.env.USERS_TABLE_NAME!,
		KeyConditionExpression: "pk = :pk",
		FilterExpression: filterExpression,
		ExpressionAttributeValues: expressionAttributeValues,
	}));

	const activeSwimmers = swimmerResult.Items || [];
	
	if (activeSwimmers.length === 0) {
		return [];
	}

	// For each active swimmer, fetch their recent locations
	const swimmersWithLocations = await Promise.all(
		activeSwimmers.map(async (swimmer) => {
			try {
				// Query locations for this swimmer, sorted by timestamp descending
				const locationResult = await ddb.send(new QueryCommand({
					TableName: process.env.LOCATIONS_TABLE_NAME!,
					KeyConditionExpression: "pk = :pk",
					ExpressionAttributeValues: {
						":pk": swimmer.username,
					},
					ScanIndexForward: false, // Sort descending (newest first)
					Limit: locationLimit,
				}));

				const locations = (locationResult.Items || []).map(item => ({
					acc: item.acc || 0,
					conn: item.conn || "unknown",
					tst: item.tst || 0,
					lon: item.lon || 0,
					lat: item.lat || 0,
					alt: item.alt || null,
					batt: item.batt || 0,
					pk: item.pk || swimmer.username,
					tid: item.tid || "unknown",
				}));

				return {
					username: swimmer.username,
					team_name: swimmer.team_name,
					swim_type: swimmer.swim_type,
					locations: locations,
				};
			} catch (error) {
				console.error(`Failed to fetch locations for swimmer ${swimmer.username}:`, error);
				return {
					username: swimmer.username,
					team_name: swimmer.team_name,
					swim_type: swimmer.swim_type,
					locations: [],
				};
			}
		})
	);

	return swimmersWithLocations;
}

export async function getSwimmerCompleteHistory(username: string) {
	// Validate input
	if (!username || typeof username !== 'string') {
		throw new Error("Valid username is required");
	}

	try {
		// Fetch all locations for a specific swimmer
		const locationResult = await ddb.send(new QueryCommand({
			TableName: process.env.LOCATIONS_TABLE_NAME!,
			KeyConditionExpression: "pk = :pk",
			ExpressionAttributeValues: {
				":pk": username,
			},
			ScanIndexForward: true, // Sort ascending (oldest first for complete history)
		}));

		const locations = (locationResult.Items || []).map(item => ({
			acc: item.acc || 0,
			conn: item.conn || "unknown",
			tst: item.tst || 0,
			lon: item.lon || 0,
			lat: item.lat || 0,
			alt: item.alt || null,
			batt: item.batt || 0,
			pk: item.pk || username,
			tid: item.tid || "unknown",
		}));

		return locations;
	} catch (error) {
		console.error(`Failed to fetch complete history for swimmer ${username}:`, error);
		throw error; // Re-throw to let the API route handle it
	}
}
