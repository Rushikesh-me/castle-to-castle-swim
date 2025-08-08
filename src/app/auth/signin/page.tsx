"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { SignInSchema } from "@/app/utils/validation";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type SignInFormData = {
	username: string;
	password: string;
};

export default function SignInPage() {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const router = useRouter();
	const searchParams = useSearchParams();
	const message = searchParams.get("message");

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<SignInFormData>({
		resolver: zodResolver(SignInSchema),
	});

	const onSubmit = async (data: SignInFormData) => {
		setIsLoading(true);
		setError("");

		try {
			const result = await signIn("credentials", {
				username: data.username,
				password: data.password,
				redirect: false,
			});

			if (result?.error) {
				console.log("Sign in error:", result.error);
				setError("Invalid username or password");
			} else {
				router.push("/dashboard");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message :"Something went wrong");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-gray-50">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle className="text-center">Swimmer Sign In</CardTitle>
				</CardHeader>
				<CardContent>
					{message && <div className="text-sm text-green-600 bg-green-50 p-3 rounded mb-4">{message}</div>}

					<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
						{error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded">{error}</div>}

						<div>
							<label className="block text-sm font-medium mb-1">Username</label>
							<Input {...register("username")} placeholder="Enter username" className={errors.username ? "border-red-500" : ""} />
							{errors.username && <p className="text-sm text-red-600 mt-1">{errors.username.message}</p>}
						</div>

						<div>
							<label className="block text-sm font-medium mb-1">Password</label>
							<Input type="password" {...register("password")} placeholder="Enter password" className={errors.password ? "border-red-500" : ""} />
							{errors.password && <p className="text-sm text-red-600 mt-1">{errors.password.message}</p>}
						</div>

						<Button type="submit" className="w-full" disabled={isLoading}>
							{isLoading ? "Signing in..." : "Sign In"}
						</Button>

						<p className="text-center text-sm text-gray-600">
							Don&apos;t have an account?{" "}
							<Link href="/auth/signup" className="text-blue-600 hover:underline">
								Sign up
							</Link>
						</p>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
