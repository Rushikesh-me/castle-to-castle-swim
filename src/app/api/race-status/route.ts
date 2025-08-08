// app/api/race-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/utils/auth";
import { updateSwimmerStatus } from "@/app/utils/db/helpers";

export async function POST(request: NextRequest) {
	try {
		const session = await auth();

		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { username, is_active } = await request.json();

		// Regular users can only update their own status
		if (!session.user.is_admin && username !== session.user.name) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		await updateSwimmerStatus(username, is_active);

		// Return updated user data for session refresh
		const updatedUser = {
			username,
			is_active,
		};

		return NextResponse.json({ 
			message: "Status updated successfully",
			user: updatedUser
		});
	} catch (error) {
		return NextResponse.json({ error: "Failed to update status",  details: JSON.stringify(error) }, { status: 500 });
	}
}
