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
				console.log("Validated fields:", validatedFields);
				if (!validatedFields.success) {
					return null;
				}

				const { username, password } = validatedFields.data;

				try {
					// Get user from DynamoDB
					const result = await client.get({
						TableName: process.env.USERS_TABLE_NAME || "swimmers",
						Key: {
							pk: `USER`,
							sk: username,
						},
					});
					if (!result.Item) {
						return null;
					}

					const user = result.Item as SwimmerUser;

					// Verify password
					const hashedPassword = createHmac('sha256', process.env.SECRET_KEY || "")
					.update(password)
					.digest('hex'); // bcrypt.compare(password, user.password);
					
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
					};
				} catch (error) {
					console.error("Authentication error:", error);
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
			}
			
			// Handle session updates
			if (trigger === "update" && session) {
				// Update token with session data
				if (session.is_active !== undefined) {
					token.is_active = session.is_active;
				}
				if (session.email !== undefined) {
					token.email = session.email;
				}
				if (session.team_name !== undefined) {
					token.team_name = session.team_name;
				}
				if (session.swim_type !== undefined) {
					token.swim_type = session.swim_type;
				}
				if (session.avatar !== undefined) {
					token.avatar = session.avatar;
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
			return session;
		},
	},
	pages: {
		signIn: "/auth/signin",
		signOut: "/auth/signout",
	},
});
