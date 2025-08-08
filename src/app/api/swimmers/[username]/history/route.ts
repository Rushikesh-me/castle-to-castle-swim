// app/api/swimmers/[username]/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/utils/auth";
import { getSwimmerCompleteHistory } from "@/app/utils/db/helpers";

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ username: string }> }
) {
	try {
		const session = await auth();
		const { username } = await params;


		// Allow users to access their own history or admins to access any history
		

		const history = await getSwimmerCompleteHistory(username);
		return NextResponse.json(history);
	} catch (error) {
		const { username } = await params;
		console.error(`Failed to fetch history for swimmer ${username}:`, error);
		return NextResponse.json({ error: "Failed to fetch swimmer history" }, { status: 500 });
	}
}