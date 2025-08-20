// app/auth/signup/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SignUpSchema } from "@/app/utils/validation";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import Link from "next/link";
import { useRouter } from "next/navigation";

type SignUpFormData = {
	username: string;
	email: string;
	password: string;
	confirmPassword: string;
	team_name: string;
	swim_type: "solo" | "relay";
	avatar?: string;
	idonate_url?: string;
};

export default function SignUpPage() {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const router = useRouter();

	const {
		register,
        formState: { errors },
		watch,
		getValues
	} = useForm<SignUpFormData>({
		resolver: zodResolver(SignUpSchema),
		defaultValues: {
			username: "",
			email: "",
			password: "",
			confirmPassword: "",
			team_name: "solo",
			swim_type: "solo",
			avatar: "",
			idonate_url: "",
		}
	});

	const onSubmit = async (data: SignUpFormData) => {
		setIsLoading(true);
		setError("");


		try {
			const response = await fetch("/api/auth/signup", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			});
			if(response.status === 201) {
				router.push("/auth/signin?message=Account created successfully");
			} else {
				const errorData = await response.json();
				setError(errorData.error || "Failed to create account");
			}
		} catch (err) {
	
			setError(err instanceof Error ? err.message : "Something went wrong");
			return;
		} finally {
			setIsLoading(false);
		}
		
    };

	return (
		<div className="flex min-h-screen items-center justify-center bg-gray-50">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle className="text-center">Create Swimmer Account</CardTitle>
				</CardHeader>
				<CardContent>
					<form onSubmit={(e) => { e.stopPropagation(); e.preventDefault(); onSubmit(getValues())}} className="space-y-4">
						{error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded">{error}</div>}

						<div>
							<label className="block text-sm font-medium mb-1">Username</label>
							<Input {...register("username")} placeholder="Enter username" className={errors.username ? "border-red-500" : ""} />
							{errors.username && <p className="text-sm text-red-600 mt-1">{errors.username.message}</p>}
						</div>

						<div>
							<label className="block text-sm font-medium mb-1">Email</label>
							<Input type="email" {...register("email")} placeholder="Enter email" className={errors.email ? "border-red-500" : ""} />
							{errors.email && <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>}
						</div>

						<div>
							<label className="block text-sm font-medium mb-1">Password</label>
							<Input type="password" {...register("password")} placeholder="Enter password" className={errors.password ? "border-red-500" : ""} />
							{errors.password && <p className="text-sm text-red-600 mt-1">{errors.password.message}</p>}
						</div>

						<div>
							<label className="block text-sm font-medium mb-1">Confirm Password</label>
							<Input type="password" {...register("confirmPassword")} placeholder="Confirm password" className={errors.confirmPassword ? "border-red-500" : ""} />
							{errors.confirmPassword && <p className="text-sm text-red-600 mt-1">{errors.confirmPassword.message}</p>}
						</div>

						<div>
							<label className="block text-sm font-medium mb-1">Swim Type</label>
							<select {...register("swim_type")} className={`w-full h-10 px-3 py-2 rounded-md border bg-background text-sm ${errors.swim_type ? "border-red-500" : "border-input"}`}>
								<option value="">Select swim type</option>
								<option value="solo">Solo</option>
								<option value="relay">Relay</option>
							</select>
							{errors.swim_type && <p className="text-sm text-red-600 mt-1">{errors.swim_type.message}</p>}
						</div>
						{watch("swim_type") === "relay" && (
							<div>
								<label className="block text-sm font-medium mb-1">Team Name</label>
								<Input {...register("team_name")} placeholder="Enter team name" className={errors.team_name ? "border-red-500" : ""} />
								{errors.team_name && <p className="text-sm text-red-600 mt-1">{errors.team_name.message}</p>}
							</div>
						)}

                        <div>
                            <label className="block text-sm font-medium mb-1">iDonate URL (Optional)</label>
                            <Input {...register("idonate_url")} placeholder="https://www.idonate.ie/..." />
                        </div>

						<div>
							<label className="block text-sm font-medium mb-1">Avatar URL (Optional)</label>
							<Input {...register("avatar")} placeholder="Enter avatar URL" className={errors.avatar ? "border-red-500" : ""} />
						</div>

						<Button type="submit" className="w-full" disabled={isLoading}>
							{isLoading ? "Creating Account..." : "Create Account"}
						</Button>

						<p className="text-center text-sm text-gray-600">
							Already have an account?{" "}
							<Link href="/auth/signin" className="text-blue-600 hover:underline">
								Sign in
							</Link>
						</p>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
