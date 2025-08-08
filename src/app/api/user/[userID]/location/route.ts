import ddb from "@/app/utils/db/ddb";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { NextRequest, NextResponse } from "next/server";

export const GET = async (request: NextRequest) => {
	const userID = request.nextUrl.pathname.split("/")[3];
	if (!userID) {
		return new NextResponse(JSON.stringify({ error: "User ID is required" }), {
			status: 400,
			headers: {
				"Content-Type": "application/json",
			},
		});
	}

	const queryCommand = {
		TableName: process.env.LOCATIONS_TABLE_NAME || "locations",
		KeyConditionExpression: "pk = :pk",
		ExpressionAttributeValues: {
			":pk": userID,
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
		return new NextResponse(JSON.stringify({ user: Items }), {
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
