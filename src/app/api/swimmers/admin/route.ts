import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/utils/auth";
import { getAllSwimmersIncludingAdmins } from "@/app/utils/db/helpers";

export async function GET(request: NextRequest) {
	try {
		const session = await auth();
		
		if (!session?.user?.is_admin) {
			return NextResponse.json({ error: "Admin access required" }, { status: 403 });
		}

		const swimmers = await getAllSwimmersIncludingAdmins();
		
		return NextResponse.json(swimmers);
	} catch (error) {
		return NextResponse.json({ error: "Failed to fetch swimmers" }, { status: 500 });
	}
}
