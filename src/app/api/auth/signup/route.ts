// app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createUser } from "@/app/utils/db/helpers";
import { SignUpSchema } from "@/app/utils/validation";
import { SwimmerUser } from "@/app/types";

type CreateUserData = {
	username: string;
	email: string;
	password: string;
	team_name: string;
	swim_type: "solo" | "relay";
	avatar?: string;
};

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const validatedData = SignUpSchema.parse(body);

		const userData: CreateUserData = {
			username: validatedData.username,
			email: validatedData.email,
			password: validatedData.password,
			team_name: validatedData.team_name || "solo",
			swim_type: validatedData.swim_type,
			avatar: validatedData.avatar || "",
		};

		await createUser(userData as SwimmerUser);

		return NextResponse.json({ message: "Account created successfully" }, { status: 201 });
	} catch (error: any) {
		console.error("Error in signup route:", error);
		return NextResponse.json({ error: error.message || "Failed to create account" }, { status: 400 });
	}
}
