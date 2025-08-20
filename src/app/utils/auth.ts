// auth.ts
import NextAuth from "next-auth";
import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { DynamoDBAdapter } from "@auth/dynamodb-adapter";
import Credentials from "next-auth/providers/credentials";
import { createHmac } from "crypto";
import { z } from "zod";
import { SwimmerUser } from "../types";

const config = {
	credentials: {
		accessKeyId: process.env.APP_AWS_ACCESS_KEY ?? "",
		secretAccessKey: process.env.APP_AWS_SECRET_KEY ?? "",
	},
	region: process.env.DYNAMODB_REGION ?? "eu-west-1",
};

const client = DynamoDBDocument.from(new DynamoDB(config), {
	marshallOptions: {
		convertEmptyValues: true,
		removeUndefinedValues: true,
		convertClassInstanceToMap: true,
	},
});

const LoginSchema = z.object({
	username: z.string().min(1, "Username is required"),
	password: z.string().min(6, "Password must be at least 6 characters"),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
	adapter: DynamoDBAdapter(client, {
		tableName: process.env.USERS_TABLE_NAME,
	}),
	session: { strategy: "jwt" },
	providers: [
		Credentials({
			credentials: {
				username: { label: "Username", type: "text" },
				password: { label: "Password", type: "password" },
			},
			async authorize(credentials) {
				const validatedFields = LoginSchema.safeParse(credentials);
		
				if (!validatedFields.success) {
					return null;
				}

				const { username, password } = validatedFields.data;

				try {
					// Get user from DynamoDB; try USER then TEAM namespace
					const resultUser = await client.get({
						TableName: process.env.USERS_TABLE_NAME || "swimmers",
						Key: { pk: `USER`, sk: username },
					});
					const resultTeam = resultUser.Item
						? null
						: await client.get({
							TableName: process.env.USERS_TABLE_NAME || "swimmers",
							Key: { pk: `TEAM`, sk: username },
						});
					const user = (resultUser.Item || resultTeam?.Item) as SwimmerUser | undefined;
					if (!user) {
						return null;
					}

					// Verify password
					const hashedPassword = createHmac('sha256', process.env.SECRET_KEY || "")
					.update(password)
					.digest('hex');
					
					if (hashedPassword !== user.password) {
						return null;
					}

					return {
						id: user.username,
						name: user.username,
						email: user.email || "",
						is_admin: user.is_admin || false,
						is_active: user.is_active || false,
						team_name: user.team_name || "",
						swim_type: user.swim_type,
						avatar: user.avatar || "",
						idonate_url: (user as Partial<SwimmerUser>).idonate_url || "",
						bio: (user as Partial<SwimmerUser>).bio || "",
						first_name: (user as Partial<SwimmerUser>).first_name || "",
						last_name: (user as Partial<SwimmerUser>).last_name || "",
						location: (user as Partial<SwimmerUser>).location || "",
					};
				} catch (error) {
			
					return null;
				}
			},
		}),
	],
	callbacks: {
		async jwt({ token, user, trigger, session }) {
			if (user) {
				token.is_admin = user.is_admin;
				token.is_active = user.is_active;
				token.team_name = user.team_name;
				token.swim_type = user.swim_type;
				token.avatar = user.avatar;
				token.idonate_url = (user as Partial<SwimmerUser>).idonate_url || "";
				token.bio = (user as Partial<SwimmerUser>).bio || "";
				token.first_name = (user as Partial<SwimmerUser>).first_name || "";
				token.last_name = (user as Partial<SwimmerUser>).last_name || "";
				token.location = (user as Partial<SwimmerUser>).location || "";
			}
			
			// Handle session updates
			if (trigger === "update" && session) {
				// Update token with session data
				if ((session as Partial<SwimmerUser>).is_active !== undefined) {
					token.is_active = (session as Partial<SwimmerUser>).is_active as boolean;
				}
				if ((session as Partial<SwimmerUser>).email !== undefined) {
					token.email = (session as Partial<SwimmerUser>).email as string;
				}
				if ((session as Partial<SwimmerUser>).team_name !== undefined) {
					token.team_name = (session as Partial<SwimmerUser>).team_name as string;
				}
				if ((session as Partial<SwimmerUser>).swim_type !== undefined) {
					token.swim_type = (session as Partial<SwimmerUser>).swim_type as string;
				}
				if ((session as Partial<SwimmerUser>).avatar !== undefined) {
					token.avatar = (session as Partial<SwimmerUser>).avatar as string;
				}
				if ((session as Partial<SwimmerUser>).idonate_url !== undefined) {
					token.idonate_url = (session as Partial<SwimmerUser>).idonate_url as string;
				}
				if ((session as Partial<SwimmerUser>).bio !== undefined) {
					token.bio = (session as Partial<SwimmerUser>).bio as string;
				}
				if ((session as Partial<SwimmerUser>).first_name !== undefined) {
					token.first_name = (session as Partial<SwimmerUser>).first_name as string;
				}
				if ((session as Partial<SwimmerUser>).last_name !== undefined) {
					token.last_name = (session as Partial<SwimmerUser>).last_name as string;
				}
				if ((session as Partial<SwimmerUser>).location !== undefined) {
					token.location = (session as Partial<SwimmerUser>).location as string;
				}
			}
			
			return token;
		},
		async session({ session, token }) {
			session.user.id = token.sub!;
			session.user.is_admin = token.is_admin as boolean;
			session.user.is_active = token.is_active as boolean;
			session.user.team_name = token.team_name as string;
			session.user.swim_type = token.swim_type as string;
			session.user.avatar = token.avatar as string;
			(session.user as Partial<SwimmerUser>).idonate_url = (token as Partial<SwimmerUser>).idonate_url as string;
			(session.user as Partial<SwimmerUser>).bio = (token as Partial<SwimmerUser>).bio as string;
			(session.user as Partial<SwimmerUser>).first_name = (token as Partial<SwimmerUser>).first_name as string;
			(session.user as Partial<SwimmerUser>).last_name = (token as Partial<SwimmerUser>).last_name as string;
			(session.user as Partial<SwimmerUser>).location = (token as Partial<SwimmerUser>).location as string;
			return session;
		},
	},
	pages: {
		signIn: "/auth/signin",
		signOut: "/auth/signout",
	},
});
