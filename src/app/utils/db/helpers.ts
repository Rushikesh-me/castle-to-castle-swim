import { GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand, BatchGetCommand, QueryCommandOutput } from "@aws-sdk/lib-dynamodb";
import ddb from "./ddb";
import { createHmac } from "crypto";
import { SwimmerTrack, SwimmerUser } from "@/app/types";
import axios from "axios";
import * as cheerio from "cheerio";
import { getCurrentEpochString } from "../timeUtils";

// Cache for iDonate totals to avoid repeated API calls
const donationsCache = new Map<string, { amount: number | null; timestamp: number }>();
const DONATIONS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache for swimmer data
const swimmersCache = new Map<string, { data: SwimmerUser[]; timestamp: number }>();
const SWIMMERS_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

async function fetchIdonateTotal(idonateUrl?: string): Promise<number | null> {
	try {
		if (!idonateUrl) return null;
		
		// Check cache first
		const cached = donationsCache.get(idonateUrl);
		if (cached && Date.now() - cached.timestamp < DONATIONS_CACHE_TTL) {
			return cached.amount;
		}

		const { data: html } = await axios.get(idonateUrl, { timeout: 5000 });

		// Load HTML into cheerio for parsing
		const $ = cheerio.load(html);

		// Select the <p> element with class "text-close-icon false"
		const amountText = $('p.font-degular-regular.text-base.leading-content-title.tracking-contents.text-form-desc').first().text().trim();
		if (!amountText) return null;
		
		// Extract the numeric part from the amount text (e.g., "€950" -> 950)
		const numericStr = amountText.replace(/[^\d]/g, '');
		const amount = parseFloat(numericStr);
		
		// Cache the result
		donationsCache.set(idonateUrl, { amount, timestamp: Date.now() });
		
		return amount;
	} catch (error) {
		console.warn(`Failed to fetch iDonate total for ${idonateUrl}:`, error);
		return null;
	}
}

// Batch fetch iDonate totals for multiple swimmers
export async function batchFetchIdonateTotals(idonateUrls: string[]): Promise<Map<string, number | null>> {
	const results = new Map<string, number | null>();
	const uniqueUrls = [...new Set(idonateUrls.filter(url => url))];
	
	if (uniqueUrls.length === 0) return results;
	
	// Process in parallel with concurrency limit to avoid overwhelming external API
	const concurrencyLimit = 5;
	const chunks = [];
	for (let i = 0; i < uniqueUrls.length; i += concurrencyLimit) {
		chunks.push(uniqueUrls.slice(i, i + concurrencyLimit));
	}
	
	for (const chunk of chunks) {
		const chunkPromises = chunk.map(async (url) => {
			const amount = await fetchIdonateTotal(url);
			return { url, amount };
		});
		
		const chunkResults = await Promise.allSettled(chunkPromises);
		chunkResults.forEach((result) => {
			if (result.status === 'fulfilled') {
				results.set(result.value.url, result.value.amount);
			}
		});
	}
	
	return results;
}

// Batch fetch locations for multiple swimmers
export async function batchFetchLocations(usernames: string[], locationLimit: number = 20): Promise<Map<string, SwimmerTrack[]>> {
	const results = new Map<string, SwimmerTrack[]>();
	
	if (usernames.length === 0) return results;
	
	// Process in parallel with concurrency limit
	const concurrencyLimit = 10;
	const chunks = [];
	for (let i = 0; i < usernames.length; i += concurrencyLimit) {
		chunks.push(usernames.slice(i, i + concurrencyLimit));
	}
	
	for (const chunk of chunks) {
		const chunkPromises = chunk.map(async (username) => {
			try {
				const locationResult = await ddb.send(new QueryCommand({
					TableName: process.env.LOCATIONS_TABLE_NAME!,
					KeyConditionExpression: "pk = :pk",
					ExpressionAttributeValues: { ":pk": username },
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
					pk: item.pk || username,
					tid: item.tid || "unknown",
				}));
				
				return { username, locations };
			} catch (error) {
				console.warn(`Failed to fetch locations for ${username}:`, error);
				return { username, locations: [] };
			}
		});
		
		const chunkResults = await Promise.allSettled(chunkPromises);
		chunkResults.forEach((result) => {
			if (result.status === 'fulfilled') {
				results.set(result.value.username, result.value.locations);
			}
		});
	}
	
	return results;
}

// Fast fetch swimmers without locations (for initial display)
export async function getSwimmersFast(swimType?: string): Promise<SwimmerUser[]> {
	const cacheKey = `swimmers_${swimType || 'all'}`;
	const cached = swimmersCache.get(cacheKey);
	if (cached && Date.now() - cached.timestamp < SWIMMERS_CACHE_TTL) {
		return cached.data;
	}
	
	// Query all solo and/or relay entities
	const queries: Promise<QueryCommandOutput>[] = [];
	if (!swimType || swimType === "solo") {
		queries.push(ddb.send(new QueryCommand({
			TableName: process.env.USERS_TABLE_NAME!,
			KeyConditionExpression: "pk = :pk",
			FilterExpression: "swim_type = :swim_type",
			ExpressionAttributeValues: { ":pk": "USER", ":swim_type": "solo" },
		})));
	}
	if (!swimType || swimType === "relay") {
		queries.push(ddb.send(new QueryCommand({
			TableName: process.env.USERS_TABLE_NAME!,
			KeyConditionExpression: "pk = :pk",
			FilterExpression: "swim_type = :swim_type",
			ExpressionAttributeValues: { ":pk": "TEAM", ":swim_type": "relay" },
		})));
	}
	
	const results = await Promise.all(queries);
	const allSwimmers = results.flatMap(r => r.Items || []);
	
	// Cache the result
	swimmersCache.set(cacheKey, { data: allSwimmers, timestamp: Date.now() });
	
	return allSwimmers;
}

// Progressive loading: First return basic swimmer data, then enhance with locations and donations
export async function getActiveSwimmersWithLocations(swimType?: string, locationLimit: number = 20): Promise<SwimmerUser[]> {
	// Validate inputs
	if (locationLimit < 1 || locationLimit > 100) {
		throw new Error("Location limit must be between 1 and 100");
	}
	
	if (swimType && !["solo", "relay"].includes(swimType)) {
		throw new Error("Swim type must be 'solo' or 'relay'");
	}

	console.log("🔍 Fetching swimmers with type:", swimType, "limit:", locationLimit);

	// Step 1: Get basic swimmer data (fast)
	const basicSwimmers = await getSwimmersFast(swimType);
	
	if (basicSwimmers.length === 0) {
		console.log("❌ No swimmers found in database");
		return [];
	}

	// Step 2: Batch fetch locations and donations in parallel (slower but parallelized)
	const [locationsMap, donationsMap] = await Promise.all([
		batchFetchLocations(basicSwimmers.map(s => s.username), locationLimit),
		batchFetchIdonateTotals(basicSwimmers.map(s => s.idonate_url))
	]);

	// Step 3: Combine all data
	const swimmersWithLocations = basicSwimmers.map(swimmer => {
		const locations = locationsMap.get(swimmer.username) || [];
		const donations_total = donationsMap.get(swimmer.idonate_url) || null;
		
		return {
			username: swimmer.username,
			team_name: swimmer.team_name,
			swim_type: swimmer.swim_type,
			idonate_url: swimmer.idonate_url || "",
			donations_total,
			start_time: swimmer.start_time || "",
			finish_time: swimmer.finish_time || "",
			is_disqualified: swimmer.is_disqualified || false,
			bio: swimmer.bio || "",
			avatar: swimmer.avatar || "",
			// Solo swimmer specific fields
			first_name: swimmer.first_name || "",
			last_name: swimmer.last_name || "",
			email: swimmer.email || "",
			location: swimmer.location || "",
			// Relay team specific fields
			members: swimmer.members || undefined,
			team_captain: swimmer.team_captain || undefined,
			locations: locations,
		};
	});

	return swimmersWithLocations;
}

export async function createUser(userData: SwimmerUser) {
	// Check both USER and TEAM namespaces for username collision
	const [existingUserUserPk, existingUserTeamPk] = await Promise.all([
		ddb.send(new GetCommand({
			TableName: process.env.USERS_TABLE_NAME!,
			Key: { pk: `USER`, sk: userData.username },
		})),
		ddb.send(new GetCommand({
			TableName: process.env.USERS_TABLE_NAME!,
			Key: { pk: `TEAM`, sk: userData.username },
		})),
	]);

	if (existingUserUserPk.Item || existingUserTeamPk.Item) {
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
		pk: userData.swim_type === "relay" ? `TEAM` : `USER`,
		sk: userData.username,
		username: userData.username,
		email: userData.email,
		password: hashedPassword,
		team_name: userData.team_name || "solo",
		swim_type: userData.swim_type,
		is_admin: false,
		is_active: false,
		avatar: userData.avatar || "",
		idonate_url: (userData as Partial<SwimmerUser>).idonate_url || "",
		start_time: userData.start_time || "",
		finish_time: userData.finish_time || "",
		is_disqualified: userData.is_disqualified || false,
		bio: userData.bio || "",
		created_at: getCurrentEpochString(),
		updated_at: getCurrentEpochString(),
	};

	await ddb.send(new PutCommand({
		TableName: process.env.USERS_TABLE_NAME!,
		Item: newUser,
	}));

	return { username: userData.username, email: userData.email };
}

export async function getAllSwimmers() {
	const [usersResult, teamsResult] = await Promise.all([
		ddb.send(new QueryCommand({
			TableName: process.env.USERS_TABLE_NAME!,
			KeyConditionExpression: "pk = :pk",
			ExpressionAttributeValues: { ":pk": "USER" },
		})),
		ddb.send(new QueryCommand({
			TableName: process.env.USERS_TABLE_NAME!,
			KeyConditionExpression: "pk = :pk",
			ExpressionAttributeValues: { ":pk": "TEAM" },
		})),
	]);

	return [...(usersResult.Items || []), ...(teamsResult.Items || [])];
}

export async function updateSwimmerStatus(username: string, is_active: boolean) {
	try {
		await ddb.send(new UpdateCommand({
			TableName: process.env.USERS_TABLE_NAME!,
			Key: { pk: `USER`, sk: username },
			UpdateExpression: "SET is_active = :status, updated_at = :updated",
			ConditionExpression: "attribute_exists(pk)",
			ExpressionAttributeValues: {
				":status": is_active,
				":updated": getCurrentEpochString(),
			},
		}));
		return;
	} catch (e) {}
	await ddb.send(new UpdateCommand({
		TableName: process.env.USERS_TABLE_NAME!,
		Key: { pk: `TEAM`, sk: username },
		UpdateExpression: "SET is_active = :status, updated_at = :updated",
		ConditionExpression: "attribute_exists(pk)",
		ExpressionAttributeValues: {
			":status": is_active,
			":updated": getCurrentEpochString(),
		},
	}));
}

export async function updateSwimmerProfile(
	username: string,
	updates: {
		email?: string;
		team_name?: string;
		swim_type?: string;
		avatar?: string;
		idonate_url?: string;
		bio?: string;
		first_name?: string;
		last_name?: string;
		location?: string;
		start_time?: string;
		finish_time?: string;
	},
	swimTypeHint?: "solo" | "relay"
) {
	const updateExpressions: string[] = [];
	const expressionAttributeValues : Record<string, string | null | number | boolean> = {
		":updated": getCurrentEpochString(),
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
	if (typeof updates.idonate_url !== "undefined") {
		updateExpressions.push("idonate_url = :idonate_url");
		expressionAttributeValues[":idonate_url"] = updates.idonate_url || "";
	}
	if (updates.bio) {
		updateExpressions.push("bio = :bio");
		expressionAttributeValues[":bio"] = updates.bio;
	}
	if (updates.first_name) {
		updateExpressions.push("first_name = :first_name");
		expressionAttributeValues[":first_name"] = updates.first_name;
	}
	if (updates.last_name) {
		updateExpressions.push("last_name = :last_name");
		expressionAttributeValues[":last_name"] = updates.last_name;
	}
	if (updates.location) {
		updateExpressions.push("location = :location");
		expressionAttributeValues[":location"] = updates.location;
	}
	if (updates.start_time) {
		updateExpressions.push("start_time = :start_time");
		expressionAttributeValues[":start_time"] = updates.start_time;
	}
	if (updates.finish_time) {
		updateExpressions.push("finish_time = :finish_time");
		expressionAttributeValues[":finish_time"] = updates.finish_time;
	}

	if (updateExpressions.length === 0) return;

	const tryUpdate = async (pk: "USER" | "TEAM") => {
		await ddb.send(new UpdateCommand({
			TableName: process.env.USERS_TABLE_NAME!,
			Key: { pk, sk: username },
			UpdateExpression: `SET ${updateExpressions.join(", ")}, updated_at = :updated`,
			ConditionExpression: "attribute_exists(pk)",
			ExpressionAttributeValues: expressionAttributeValues,
		}));
	};

	if (swimTypeHint === "solo") {
		await tryUpdate("USER");
	} else if (swimTypeHint === "relay") {
		await tryUpdate("TEAM");
	} else {
		try {
			await tryUpdate("USER");
		} catch {
			await tryUpdate("TEAM");
		}
	}
}

// New function to update admin-controlled fields
export async function updateSwimmerAdminFields(
	username: string,
	updates: {
		start_time?: string;
		finish_time?: string;
		is_disqualified?: boolean;
	},
	swimTypeHint?: "solo" | "relay"
) {
	console.log("🔧 updateSwimmerAdminFields called:", { username, updates, swimTypeHint });
	
	const updateExpressions: string[] = [];
	const expressionAttributeValues : Record<string, string | null | number | boolean> = {
		":updated": getCurrentEpochString(),
	};

	if (updates.start_time) {
		updateExpressions.push("start_time = :start_time");
		expressionAttributeValues[":start_time"] = updates.start_time;
	}
	if (updates.finish_time) {
		updateExpressions.push("finish_time = :finish_time");
		expressionAttributeValues[":finish_time"] = updates.finish_time;
	}
	if (typeof updates.is_disqualified !== "undefined") {
		updateExpressions.push("is_disqualified = :is_disqualified");
		expressionAttributeValues[":is_disqualified"] = updates.is_disqualified;
	}

	if (updateExpressions.length === 0) {
		console.log("⚠️ No updates to apply");
		return;
	}

	console.log("🔧 Update expressions:", updateExpressions);
	console.log("🔧 Expression attribute values:", expressionAttributeValues);

	const tryUpdate = async (pk: "USER" | "TEAM") => {
		console.log(`🔄 Trying to update with pk: ${pk}`);
		try {
			// First check if the item exists
			const getResult = await ddb.send(new GetCommand({
				TableName: process.env.USERS_TABLE_NAME!,
				Key: { pk, sk: username },
			}));
			
			if (!getResult.Item) {
				console.log(`❌ Item not found with pk: ${pk}, sk: ${username}`);
				throw new Error(`Swimmer not found with pk: ${pk}`);
			}
			
			console.log(`📋 Found item:`, getResult.Item);
			
			const result = await ddb.send(new UpdateCommand({
				TableName: process.env.USERS_TABLE_NAME!,
				Key: { pk, sk: username },
				UpdateExpression: `SET ${updateExpressions.join(", ")}, updated_at = :updated`,
				ExpressionAttributeValues: expressionAttributeValues,
			}));
			console.log(`✅ Successfully updated with pk: ${pk}`, result);
			return result;
		} catch (error) {
			console.log(`❌ Failed to update with pk: ${pk}:`, error);
			throw error;
		}
	};

	if (swimTypeHint === "solo") {
		console.log("🎯 Using solo hint, updating USER");
		await tryUpdate("USER");
	} else if (swimTypeHint === "relay") {
		console.log("🎯 Using relay hint, updating TEAM");
		await tryUpdate("TEAM");
	} else {
		console.log("🎯 No hint, trying USER first, then TEAM");
		try {
			await tryUpdate("USER");
		} catch (error) {
			console.log("🔄 USER update failed, trying TEAM");
			await tryUpdate("TEAM");
		}
	}
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
