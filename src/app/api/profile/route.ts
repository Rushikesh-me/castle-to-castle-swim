// app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/utils/auth";
import { updateSwimmerProfile } from "@/app/utils/db/helpers";
import { UpdateProfileSchema } from "@/app/utils/validation";

import { SwimmerUser } from "@/app/types";

export async function PUT(request: NextRequest) {
	try {
		const session = await auth();

		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const validatedData = UpdateProfileSchema.parse(body);

		// Convert validated data to updates
		const updates: Partial<SwimmerUser> = {
			team_name: validatedData.team_name,
			swim_type: validatedData.swim_type,
			avatar: validatedData.avatar,
			idonate_url: validatedData.idonate_url ?? undefined,
			bio: validatedData.bio ?? undefined,
			first_name: validatedData.first_name ?? undefined,
			last_name: validatedData.last_name ?? undefined,
			location: validatedData.location ?? undefined,
		};

		await updateSwimmerProfile(session.user.name!, updates, (validatedData.swim_type as "solo" | "relay"));

		// Return complete updated user data for session refresh
		const updatedUser = {
			...session.user,
			...updates,
		};

		return NextResponse.json({ 
			message: "Profile updated successfully",
			user: updatedUser
		});
	} catch (error) {
		console.error("Error updating profile:", error);
		return NextResponse.json({ error: "Failed to update profile", details: JSON.stringify(error) }, { status: 400 });
	}
}
