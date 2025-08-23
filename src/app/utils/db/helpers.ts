import { GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand, BatchGetCommand, QueryCommandOutput, UpdateCommandInput } from "@aws-sdk/lib-dynamodb";
import ddb from "./ddb";
import { createHmac } from "crypto";
import { SwimmerTrack, SwimmerUser } from "@/app/types";
import axios from "axios";
import * as cheerio from "cheerio";
import { getCurrentEpochString } from "../timeUtils";

// Cache for iDonate totals to avoid repeated API calls
const donationsCache = new Map<string, { amount: number | null; timestamp: number }>();
const DONATIONS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache for basic swimmer data (without locations) - only cache the static user info
const swimmersCache = new Map<string, { data: SwimmerUser[]; timestamp: number }>();
const SWIMMERS_CACHE_TTL = 30 * 1000; // 30 seconds - more aggressive caching for faster switching

// Cache for real-time locations - shorter TTL to ensure freshness
const locationsCache = new Map<string, { data: SwimmerTrack[]; timestamp: number }>();
const LOCATIONS_CACHE_TTL = 10 * 1000; // 10 seconds - very short TTL for real-time data

// Function to clear locations cache (useful when switching categories)
export function clearLocationsCache(): void {
	locationsCache.clear();
}

async function fetchIdonateTotal(idonateUrl?: string): Promise<number | null> {
	try {
		if (!idonateUrl) return null;
		
		// Check cache first
		const cached = donationsCache.get(idonateUrl);
		if (cached && Date.now() - cached.timestamp < DONATIONS_CACHE_TTL) {
			return cached.amount;
		}
		//wait for js to load
		const { data: html } = await axios.get(idonateUrl, { timeout: 5000});

		// Load HTML into cheerio for parsing
		const $ = cheerio.load(html);

		// Select the <p> element with class "text-close-icon false"
		//if the url contains "team"
		const amountText = $('p.font-degular-regular.text-base.leading-content-title.tracking-contents.text-form-desc').first().text().trim();
		if (!amountText) {			
			// Try to extract raised amount from the full page text
			const fullText = $('script').text();
			const raisedIndex = fullText.match(/"raised\\":\s*(\d+)/)?.index;
			if(raisedIndex) {
				//get amount from raised index + 10 to first , found
				const amount = fullText.substring(raisedIndex + 10, fullText.indexOf(',', raisedIndex + 10));
				if(amount) {
					 return parseFloat(amount);
				}
			}
			return null;
		}
		
		// Extract the numeric part from the amount text (e.g., "€950" -> 950)
		const numericStr = amountText.replace(/[^\d]/g, '');
		const amount = parseFloat(numericStr);
		
		// Cache the result
		donationsCache.set(idonateUrl, { amount, timestamp: Date.now() });
		return amount;
	} catch (error) {
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

// Batch fetch locations for multiple swimmers with caching
export async function batchFetchLocations(usernames: string[], locationLimit: number = 20): Promise<Map<string, SwimmerTrack[]>> {
	const results = new Map<string, SwimmerTrack[]>();
	
	if (usernames.length === 0) return results;
	
		// Check cache first for each username
	const uncachedUsernames: string[] = [];
	const cachedResults = new Map<string, SwimmerTrack[]>();
	
	for (const username of usernames) {
		const cacheKey = `locations_${username}_${locationLimit}`;
		const cached = locationsCache.get(cacheKey);
		
		if (cached && Date.now() - cached.timestamp < LOCATIONS_CACHE_TTL) {
			// Use cached data
			cachedResults.set(username, cached.data);
		} else {
			// Need to fetch fresh data
			uncachedUsernames.push(username);
		}
	}
	
	// Return cached results immediately if all data is cached
	if (uncachedUsernames.length === 0) {
		return cachedResults;
	}
	
	// Fetch uncached data in parallel
	const concurrencyLimit = 25; // Increased from 10 for faster processing
	const chunks = [];
	for (let i = 0; i < uncachedUsernames.length; i += concurrencyLimit) {
		chunks.push(uncachedUsernames.slice(i, i + concurrencyLimit));
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
				return { username, locations: [] };
			}
		});
		
		const chunkResults = await Promise.allSettled(chunkPromises);
		chunkResults.forEach((result) => {
			if (result.status === 'fulfilled') {
				// Transform the raw location data to SwimmerTrack format
				const swimmerTracks: SwimmerTrack[] = result.value.locations.map(location => ({
					team_name: "", // Default empty team name for individual locations
					username: result.value.username,
					swim_type: "solo", // Default swim type, could be enhanced later
					locations: [location] // Wrap single location in array
				}));
				
				// Cache the result
				const cacheKey = `locations_${result.value.username}_${locationLimit}`;
				locationsCache.set(cacheKey, { 
					data: swimmerTracks, 
					timestamp: Date.now() 
				});
				
				results.set(result.value.username, swimmerTracks);
			}
		});
	}
	
	// Combine cached and fresh results
	return new Map([...cachedResults, ...results]);
}

// Fast fetch swimmers without locations (for initial display)
export async function getSwimmersFast(swimType?: string): Promise<SwimmerUser[]> {
	const cacheKey = `swimmers_${swimType || 'all'}`;
	const cached = swimmersCache.get(cacheKey);
	if (cached && Date.now() - cached.timestamp < SWIMMERS_CACHE_TTL) {
		return cached.data;
	}
	
	// OPTIMIZED: Use GSI or direct queries without expensive filters
	let allSwimmers: SwimmerUser[] = [];
	
			if (swimType === "solo") {
		// Direct query for solo swimmers - much faster
		const soloResult = await ddb.send(new QueryCommand({
			TableName: process.env.USERS_TABLE_NAME!,
			KeyConditionExpression: "pk = :pk",
			ExpressionAttributeValues: { ":pk": "USER" },
			// OPTIMIZATION: Limit results to reduce data transfer
			Limit: 100,
		}));
		
		// Filter in memory (faster than DynamoDB filter for small datasets)
		allSwimmers = (soloResult.Items || []).filter(item => 
			item.swim_type === "solo" && !item.is_admin
		) as SwimmerUser[];
		
	} else if (swimType === "relay") {
		// Direct query for relay teams - much faster
		const relayResult = await ddb.send(new QueryCommand({
			TableName: process.env.USERS_TABLE_NAME!,
			KeyConditionExpression: "pk = :pk",
			ExpressionAttributeValues: { ":pk": "TEAM" },
			// OPTIMIZATION: Limit results to reduce data transfer
			Limit: 100,
		}));
		
		// Filter in memory (faster than DynamoDB filter for small datasets)
		allSwimmers = (relayResult.Items || []).filter(item => 
			item.swim_type === "relay" && !item.is_admin
		) as SwimmerUser[];
		
	} else {
		// Fetch both types in parallel
		const [soloResult, relayResult] = await Promise.all([
			ddb.send(new QueryCommand({
				TableName: process.env.USERS_TABLE_NAME!,
				KeyConditionExpression: "pk = :pk",
				ExpressionAttributeValues: { ":pk": "USER" },
				// OPTIMIZATION: Limit results to reduce data transfer
				Limit: 100,
			})),
			ddb.send(new QueryCommand({
				TableName: process.env.USERS_TABLE_NAME!,
				KeyConditionExpression: "pk = :pk",
				ExpressionAttributeValues: { ":pk": "TEAM" },
				// OPTIMIZATION: Limit results to reduce data transfer
				Limit: 100,
			}))
		]);
		
		// Combine and filter
		const soloSwimmers = (soloResult.Items || []).filter(item => 
			item.swim_type === "solo" && !item.is_admin
		);
		const relayTeams = (relayResult.Items || []).filter(item => 
			item.swim_type === "relay" && !item.is_admin
		);
		
		allSwimmers = [...soloSwimmers, ...relayTeams] as SwimmerUser[];
	}
	
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

	

	// Step 1: Get basic swimmer data (fast)
	const basicSwimmers = await getSwimmersFast(swimType);
	
	if (basicSwimmers.length === 0) {

		return [];
	}

	// Step 2: Batch fetch locations and donations in parallel (slower but parallelized)
	const [locationsMap, donationsMap] = await Promise.all([
		batchFetchLocations(basicSwimmers.map(s => s.username), locationLimit),
		batchFetchIdonateTotals(basicSwimmers.map(s => s.idonate_url).filter(url => url !== undefined))
	]);

	// Step 3: Combine all data
	const swimmersWithLocations = basicSwimmers.map(swimmer => {
		const locations = locationsMap.get(swimmer.username) || [];
		const donations_total = donationsMap.get(swimmer.idonate_url || "") || null;
		
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

	return swimmersWithLocations as unknown as SwimmerUser[];
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
			FilterExpression: "is_admin = :is_admin",
			ExpressionAttributeValues: { ":pk": "USER", ":is_admin": false },
		})),
		ddb.send(new QueryCommand({
			TableName: process.env.USERS_TABLE_NAME!,
			KeyConditionExpression: "pk = :pk",
			FilterExpression: "is_admin = :is_admin",
			ExpressionAttributeValues: { ":pk": "TEAM", ":is_admin": false },
		})),
	]);

	return [...(usersResult.Items || []), ...(teamsResult.Items || [])];
}

// Function to get ALL swimmers including admins (for admin dashboard use)
export async function getAllSwimmersIncludingAdmins() {
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
	const expressionAttributeNames: Record<string, string> = {};
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
		updateExpressions.push("#user_location = :user_location");
		expressionAttributeNames["#user_location"] = "location";
		expressionAttributeValues[":user_location"] = updates.location;

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
		const command : UpdateCommandInput = {
			TableName: process.env.USERS_TABLE_NAME!,
			Key: { pk, sk: username },
			UpdateExpression: `SET ${updateExpressions.join(", ")}, updated_at = :updated`,
			ConditionExpression: "attribute_exists(pk)",
			ExpressionAttributeValues: expressionAttributeValues,	
		}
		if (Object.keys(expressionAttributeNames).length > 0) {
			command.ExpressionAttributeNames = expressionAttributeNames;
		}
		await ddb.send(new UpdateCommand(command));
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

		return;
	}

	

	const tryUpdate = async (pk: "USER" | "TEAM") => {

		try {
			// First check if the item exists
			const getResult = await ddb.send(new GetCommand({
				TableName: process.env.USERS_TABLE_NAME!,
				Key: { pk, sk: username },
			}));
			
			if (!getResult.Item) {
		
				throw new Error(`Swimmer not found with pk: ${pk}`);
			}
			
	
			
			const result = await ddb.send(new UpdateCommand({
				TableName: process.env.USERS_TABLE_NAME!,
				Key: { pk, sk: username },
				UpdateExpression: `SET ${updateExpressions.join(", ")}, updated_at = :updated`,
				ExpressionAttributeValues: expressionAttributeValues,
			}));
	
			return result;
		} catch (error) {
	
			throw error;
		}
	};

	if (swimTypeHint === "solo") {

		await tryUpdate("USER");
	} else if (swimTypeHint === "relay") {

		await tryUpdate("TEAM");
	} else {

		try {
			await tryUpdate("USER");
		} catch (error) {
	
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

// Emergency SOS functions
export async function createEmergencyRecord(emergencyData: {
	deviceId: string;
	username?: string;
	swimType?: string;
	teamName?: string;
	firstName?: string;
	lastName?: string;
	location: { lat: number; lng: number };
	timestamp: string;
	isSwimmer: boolean;
	status: 'active' | 'resolved';
}) {
	try {
		await ddb.send(new PutCommand({
			TableName: 'emergency',
			Item: {
				id: emergencyData.deviceId,
				...emergencyData,
				created_at: getCurrentEpochString(),
				updated_at: getCurrentEpochString(),
			},
		}));
		return true;
	} catch (error) {
		console.error('Failed to create emergency record:', error);
		return false;
	}
}

export async function updateEmergencyLocation(deviceId: string, location: { lat: number; lng: number }) {
	try {
		await ddb.send(new UpdateCommand({
			TableName: 'emergency',
			Key: { id: deviceId },
			UpdateExpression: 'SET #location = :location, updated_at = :updated_at',
			ExpressionAttributeNames: {
				'#location': 'location',
			},
			ExpressionAttributeValues: {
				':location': location,
				':updated_at': getCurrentEpochString(),
			},
		}));
		return true;
	} catch (error) {
		console.error('Failed to update emergency location:', error);
		return false;
	}
}

export async function resolveEmergency(deviceId: string) {
	try {
		await ddb.send(new UpdateCommand({
			TableName: 'emergency',
			Key: { id: deviceId },
			UpdateExpression: 'SET #status = :status, updated_at = :updated_at',
			ExpressionAttributeNames: {
				'#status': 'status',
			},
			ExpressionAttributeValues: {
				':status': 'resolved',
				':updated_at': getCurrentEpochString(),
			},
		}));
		return true;
	} catch (error) {
		console.error('Failed to resolve emergency:', error);
		return false;
	}
}

export async function getAllActiveEmergencies() {
	try {
		const result = await ddb.send(new ScanCommand({
			TableName: 'emergency',
			FilterExpression: '#status = :status',
			ExpressionAttributeNames: {
				'#status': 'status',
			},
			ExpressionAttributeValues: {
				':status': 'active',
			},
		}));
		return result.Items || [];
	} catch (error) {
		console.error('Failed to fetch emergencies:', error);
		return [];
	}
}

export async function getEmergencyByDeviceId(deviceId: string) {
	try {
		const result = await ddb.send(new GetCommand({
			TableName: 'emergency',
			Key: { id: deviceId },
		}));
		return result.Item;
	} catch (error) {
		console.error('Failed to fetch emergency record:', error);
		return null;
	}
}
