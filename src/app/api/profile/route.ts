// app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/utils/auth";
import { updateSwimmerProfile } from "@/app/utils/db/helpers";
import { UpdateProfileSchema } from "@/app/utils/validation";
import { dateToEpochString } from "@/app/utils/timeUtils";
import { SwimmerUser } from "@/app/types";

export async function PUT(request: NextRequest) {
	try {
		const session = await auth();

		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const validatedData = UpdateProfileSchema.parse(body);

		// Convert datetime inputs to epoch timestamps if provided
		const updates: Partial<SwimmerUser> = {
			email: validatedData.email,
			team_name: validatedData.team_name,
			swim_type: validatedData.swim_type,
			avatar: validatedData.avatar,
			idonate_url: body.idonate_url ?? undefined,
			bio: validatedData.bio ?? undefined,
			first_name: validatedData.first_name ?? undefined,
			last_name: validatedData.last_name ?? undefined,
			location: validatedData.location ?? undefined,
		};

		// Handle start_time and finish_time conversion if provided
		if (body.start_time) {
			updates.start_time = dateToEpochString(new Date(body.start_time));
		}
		if (body.finish_time) {
			updates.finish_time = dateToEpochString(new Date(body.finish_time));
		}

		await updateSwimmerProfile(session.user.name!, updates, (validatedData.swim_type as "solo" | "relay"));

		// Return updated user data for session refresh
		const updatedUser = {
			...updates,
			start_time: updates.start_time || session.user.start_time,
			finish_time: updates.finish_time || session.user.finish_time,
		};

		return NextResponse.json({ 
			message: "Profile updated successfully",
			user: updatedUser
		});
	} catch (error) {
		return NextResponse.json({ error: "Failed to update profile", details: JSON.stringify(error) }, { status: 400 });
	}
}
