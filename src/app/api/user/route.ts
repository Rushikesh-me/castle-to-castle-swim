import ddb from "@/app/utils/db/ddb";
import { PutCommand, QueryCommand, QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import { NextRequest, NextResponse } from "next/server";

export const GET = async (request: NextRequest) => {
	//check for isActive filter
	const isActive = request.nextUrl.searchParams.get("isActive") === "true";
	const queryCommand: QueryCommandInput = {
		TableName: process.env.USERS_TABLE_NAME || "users",
		KeyConditionExpression: "pk = :pk",
		ExpressionAttributeValues: {
			":pk": "USER",
		},
	};
	if (isActive) {
		queryCommand.FilterExpression = "is_active = :is_active";
		queryCommand.ExpressionAttributeValues = {
			...queryCommand.ExpressionAttributeValues,
			":is_active": true,
		};
	}
	try {
		const data = await ddb.send(new QueryCommand(queryCommand));
		// @TODO : verify is items has users
		if (!data.Items || data.Items.length === 0) {
			return new NextResponse(JSON.stringify({ message: "No users found" }), {
				status: 404,
				headers: {
					"Content-Type": "application/json",
				},
			});
		}
		const { Items, $metadata } = data;
		return new NextResponse(JSON.stringify({ users: Items }), {
			status: $metadata?.httpStatusCode || 200,
			headers: {
				"Content-Type": "application/json",
			},
		});
	} catch (error) {
		console.error("Error fetching users:", error);
		return new NextResponse(JSON.stringify({ error: "Internal server error" }), {
			status: 500,
			headers: {
				"Content-Type": "application/json",
			},
		});
	}
};

export const POST = async (request: NextRequest) => {
	try {
		const body = await request.json();
		const { username, email, password, team_name, swim_type, is_admin = false, is_active = false } = body;

		if (!username || !email || !password) {
			return new NextResponse(JSON.stringify({ error: "All fields are required" }), {
				status: 400,
				headers: {
					"Content-Type": "application/json",
				},
			});
		}

		//@todo: hash password before storing

		const putQuery = {
			TableName: process.env.USERS_TABLE_NAME || "users",
			Item: {
				pk: "USER",
				sk: username,
				username,
				email,
				password,
				team_name: team_name || "",
				swim_type: swim_type || "",
				created_at: new Date().toISOString(),
				is_admin: is_admin ? true : false,
				is_active: is_active ? true : false,
			},
		};

		const item = await ddb.send(new PutCommand(putQuery));

		if (!item) {
			return new NextResponse(JSON.stringify({ error: "Failed to create user" }), {
				status: 500,
				headers: {
					"Content-Type": "application/json",
				},
			});
		}

		const { $metadata, Attributes } = item;
		return new NextResponse(JSON.stringify({ message: "ddb response", user: Attributes }), {
			status: $metadata.httpStatusCode || 201,
			headers: {
				"Content-Type": "application/json",
			},
		});
	} catch (error) {
		console.error("Error creating user:", error);
		return new NextResponse(JSON.stringify({ error: "Internal server error" }), {
			status: 500,
			headers: {
				"Content-Type": "application/json",
			},
		});
	}
};
