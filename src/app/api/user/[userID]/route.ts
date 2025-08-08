import ddb from "@/app/utils/db/ddb";
import { DeleteCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { NextRequest, NextResponse } from "next/server";

export const GET = async (request: NextRequest) => {
	const userID = request.nextUrl.pathname.split("/").pop();
	if (!userID) {
		return new NextResponse(JSON.stringify({ error: "User ID is required" }), {
			status: 400,
			headers: {
				"Content-Type": "application/json",
			},
		});
	}
	const queryCommand = {
		TableName: process.env.USERS_TABLE_NAME || "users",
		KeyConditionExpression: "pk = :pk AND sk = :sk",
		ExpressionAttributeValues: {
			":pk": "USER",
			":sk": userID,
		},
	};
	try {
		const data = await ddb.send(new QueryCommand(queryCommand));
		if (!data.Items || data.Items.length === 0) {
			return new NextResponse(JSON.stringify({ message: "User not found" }), {
				status: 404,
				headers: {
					"Content-Type": "application/json",
				},
			});
		}
		const { Items, $metadata } = data;
		return new NextResponse(JSON.stringify({ user: Items[0] }), {
			status: $metadata.httpStatusCode || 200,
			headers: {
				"Content-Type": "application/json",
			},
		});
	} catch (error) {
		console.error("Error fetching user:", error);
		return new NextResponse(JSON.stringify({ error: "Internal server error" }), {
			status: 500,
			headers: {
				"Content-Type": "application/json",
			},
		});
	}
};

export const PUT = async (request: NextRequest) => {
	const userID = request.nextUrl.pathname.split("/").pop();
	if (!userID) {
		return new NextResponse(JSON.stringify({ error: "User ID is required" }), {
			status: 400,
			headers: {
				"Content-Type": "application/json",
			},
		});
	}
	try {
		const body = await request.json();
		const { email, password, team_name, swim_type, is_admin, is_active } = body;

		const updateQuery = {
			TableName: process.env.USERS_TABLE_NAME || "users",
			Key: {
				pk: "USER",
				sk: userID,
			},
			UpdateExpression: "SET email = :email, password = :password, team_name = :team_name, swim_type = :swim_type, is_admin = :is_admin, is_active = :is_active",
			ExpressionAttributeValues: {
				":email": email,
				":password": password,
				":team_name": team_name,
				":swim_type": swim_type,
				":is_admin": is_admin ? true : false,
				":is_active": is_active ? true : false,
			},
			ReturnValues: "ALL_NEW" as const,
		};
		const data = await ddb.send(new UpdateCommand(updateQuery));
		if (!data.Attributes) {
			return new NextResponse(JSON.stringify({ message: "User not found" }), {
				status: 404,
				headers: {
					"Content-Type": "application/json",
				},
			});
		}
		return new NextResponse(JSON.stringify({ user: data.Attributes }), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
			},
		});
	} catch (error) {
		console.error("Error updating user:", error);
		return new NextResponse(JSON.stringify({ error: "Internal server error" }), {
			status: 500,
			headers: {
				"Content-Type": "application/json",
			},
		});
	}
};
export const DELETE = async (request: NextRequest) => {
	const userID = request.nextUrl.pathname.split("/").pop();
	if (!userID) {
		return new NextResponse(JSON.stringify({ error: "User ID is required" }), {
			status: 400,
			headers: {
				"Content-Type": "application/json",
			},
		});
	}
	const deleteQuery = {
		TableName: process.env.USERS_TABLE_NAME || "users",
		Key: {
			pk: "USER",
			sk: userID,
		},
	};
	try {
		await ddb.send(new DeleteCommand(deleteQuery));
		return new NextResponse(JSON.stringify({ message: "User deleted successfully" }), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
			},
		});
	} catch (error) {
		console.error("Error deleting user:", error);
		return new NextResponse(JSON.stringify({ error: "Internal server error" }), {
			status: 500,
			headers: {
				"Content-Type": "application/json",
			},
		});
	}
};
