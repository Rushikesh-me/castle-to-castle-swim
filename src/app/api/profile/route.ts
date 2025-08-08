// app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/utils/auth";
import { updateSwimmerProfile } from "@/app/utils/db/helpers";
import { UpdateProfileSchema } from "@/app/utils/validation";

export async function PUT(request: NextRequest) {
	try {
		const session = await auth();

		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const validatedData = UpdateProfileSchema.parse(body);

		await updateSwimmerProfile(session.user.name!, {
			email: validatedData.email,
			team_name: validatedData.team_name,
			swim_type: validatedData.swim_type,
			avatar: validatedData.avatar,
		});

		// Return updated user data for session refresh
		const updatedUser = {
			email: validatedData.email,
			team_name: validatedData.team_name,
			swim_type: validatedData.swim_type,
			avatar: validatedData.avatar,
		};

		return NextResponse.json({ 
			message: "Profile updated successfully",
			user: updatedUser
		});
	} catch (error: any) {
		return NextResponse.json({ error: error.message || "Failed to update profile" }, { status: 400 });
	}
}
