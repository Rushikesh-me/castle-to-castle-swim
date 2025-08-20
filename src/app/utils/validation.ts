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
		idonate_url: z.string().url().optional(),
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
	idonate_url: z.string().url().optional(),
	bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
	first_name: z.string().max(50, "First name must be less than 50 characters").optional(),
	last_name: z.string().max(50, "Last name must be less than 50 characters").optional(),
	location: z.string().max(100, "Location must be less than 100 characters").optional(),
	start_time: z.string().optional(), // ISO datetime string
	finish_time: z.string().optional(), // ISO datetime string
});
