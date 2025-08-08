// lib/validations.ts
import { z } from "zod";

export const SignUpSchema = z
	.object({
		username: z
			.string()
			.min(3, "Username must be at least 3 characters")
			.max(20, "Username must be less than 20 characters")
			.regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
		email: z.string().email("Please enter a valid email address"),
		password: z.string().min(6, "Password must be at least 6 characters").max(100, "Password must be less than 100 characters"),
		confirmPassword: z.string(),
		team_name: z.string(),
		swim_type: z.enum(["solo", "relay"]),
		avatar: z.string().optional(),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords don't match",
		path: ["confirmPassword"],
	});

export const SignInSchema = z.object({
	username: z.string().min(1, "Username is required"),
	password: z.string().min(1, "Password is required"),
});

export const UpdateProfileSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
	team_name: z.string(),
	swim_type: z.enum(["solo", "relay"]),
	avatar: z.string().optional(),
});
