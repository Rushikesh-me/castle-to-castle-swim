import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/utils/auth";
import { updateSwimmerProfile } from "@/app/utils/db/helpers";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "@/app/utils/s3client";

interface ProfileUpdateData {
	avatar: string;
	bio?: string;
}

export async function POST(request: NextRequest) {
	try {
		const session = await auth();
		
		if (!session?.user) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const formData = await request.formData();
		const file = formData.get('file') as File;
		const bio = formData.get('bio') as string;

		if (!file) {
			return NextResponse.json({ error: "No file provided" }, { status: 400 });
		}

		// Validate file type
		if (!file.type.startsWith('image/')) {
			return NextResponse.json({ error: "File must be an image" }, { status: 400 });
		}

		// Validate file size (max 5MB)
		if (file.size > 5 * 1024 * 1024) {
			return NextResponse.json({ error: "File size must be less than 5MB" }, { status: 400 });
		}

		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		const fileKey = `profiles/${session.user.name}-${Date.now()}.jpg`;

		const command = new PutObjectCommand ({
			Bucket: "castle-to-castle-swim",
			Key: fileKey,
			Body: buffer,
			ContentType: file.type,
		});

		await s3Client.send(command);

		// Construct the S3 URL of the uploaded file
		const fileUrl = `https://${"castle-to-castle-swim"}.s3.eu-west-1.amazonaws.com/${fileKey}`;

		// Update the user's profile with the new avatar and bio
		const updates: ProfileUpdateData = { avatar: fileUrl };
		if (bio) {
			updates.bio = bio;
		}

		await updateSwimmerProfile(session.user.name!, updates, session.user.swim_type as "solo" | "relay");

		return NextResponse.json({ 
			success: true, 
			message: "Profile updated successfully",
			avatar: fileUrl,
			bio: bio || undefined
		});

	} catch (error) {
		console.error("Failed to upload profile picture:", error);
		return NextResponse.json({ error: "Failed to upload profile picture" }, { status: 500 });
	}
}
