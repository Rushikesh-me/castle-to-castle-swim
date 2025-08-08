// app/dashboard/page.tsx
"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UpdateProfileSchema } from "@/app/utils/validation";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Play, Square, Users, User, LogOut, Settings, Trophy, Activity, AlertCircle, CheckCircle, Map } from "lucide-react";
import Link from "next/link";

type UpdateProfileData = {
	email: string;
	team_name: string;
	swim_type: "solo" | "relay";
	avatar?: string;
};

type Swimmer = {
	username: string;
	email: string;
	team_name: string;
	swim_type: string;
	is_active: boolean;
};

export default function Dashboard() {
	const { data: session, status, update } = useSession();
	const [swimmers, setSwimmers] = useState<Swimmer[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [message, setMessage] = useState("");
	const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");

	useEffect(() => {
		console.log("session",session);
	}, [session]);

	const {
		register,
		handleSubmit,
		formState: { errors },
		setValue,
		watch
	} = useForm<UpdateProfileData>({
		resolver: zodResolver(UpdateProfileSchema),
	});

	const swimType = watch("swim_type");

	const fetchSwimmers = useCallback(async () => {
		try {
			const response = await fetch("/api/swimmers");
			const data = await response.json();
			setSwimmers(data);
		} catch (error) {
			console.error("Failed to fetch swimmers:", error);
			showMessage("Failed to fetch swimmers", "error");
		}
	}, []);

	useEffect(() => {
		if (session?.user) {
			setValue("email", session.user.email || "");
			setValue("team_name", session.user.team_name || "");
			setValue("swim_type", (session.user.swim_type as "solo" | "relay") || "solo");
			setValue("avatar", session.user.avatar || "");
		}

		if (session?.user?.is_admin) {
			fetchSwimmers();
		}
	}, [session, setValue, fetchSwimmers]);

	const showMessage = (msg: string, type: "success" | "error" | "info" = "info") => {
		setMessage(msg);
		setMessageType(type);
		setTimeout(() => setMessage(""), 5000);
	};

	const handleProfileUpdate = async (data: UpdateProfileData) => {
		setIsLoading(true);
		setMessage("");

		try {
			const response = await fetch("/api/profile", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			});

			if (response.ok) {
				const responseData = await response.json();
				// Update session with new profile data
				await update({
					email: responseData.user.email,
					team_name: responseData.user.team_name,
					swim_type: responseData.user.swim_type,
					avatar: responseData.user.avatar,
				});
				showMessage("Profile updated successfully", "success");
			} else {
				throw new Error("Failed to update profile");
			}
		} catch (error) {
			console.error("Profile update error:", error);
			showMessage("Failed to update profile", "error");
		} finally {
			setIsLoading(false);
		}
	};

	const toggleRaceStatus = async () => {
		setIsLoading(true);
		try {
			const response = await fetch("/api/race-status", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					username: session?.user?.name,
					is_active: !session?.user?.is_active,
				}),
			});

			if (response.ok) {
				const data = await response.json();
				// Update session with new data
				await update({
					is_active: data.user.is_active,
				});
				showMessage(`Race ${!session?.user?.is_active ? "started" : "stopped"}`, "success");
			}
		} catch (error) {
			console.error("Race status update error:", error);
			showMessage("Failed to update race status", "error");
		} finally {
			setIsLoading(false);
		}
	};

	const toggleSwimmerStatus = async (username: string, currentStatus: boolean) => {
		try {
			const response = await fetch("/api/race-status", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					username,
					is_active: !currentStatus,
				}),
			});

			if (response.ok) {
				await fetchSwimmers();
				showMessage(`Swimmer ${username} status updated`, "success");
			}
		} catch (error) {
			console.error("Swimmer status update error:", error);
			showMessage("Failed to update swimmer status", "error");
		}
	};

	if (status === "loading") {
		return (
			<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
					<div className="text-lg text-gray-700">Loading your dashboard...</div>
				</div>
			</div>
		);
	}

	if (!session) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50">
				<Card className="w-full max-w-md shadow-xl">
					<CardContent className="text-center p-8">
						<AlertCircle className="w-12 h-12 text-blue-600 mx-auto mb-4" />
						<h2 className="text-xl font-semibold mb-4">Access Required</h2>
						<p className="mb-6 text-gray-600">Please sign in to access the dashboard</p>
						<Button 
							onClick={() => (window.location.href = "/auth/signin")}
							className="w-full bg-blue-600 hover:bg-blue-700"
						>
							Sign In
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-100">
			{/* Header */}
			<header className="bg-white/80 backdrop-blur-sm shadow-lg border-b border-blue-200 sticky top-0 z-50">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between items-center h-16">
						<div className="flex items-center space-x-3">
							<div className="p-2 bg-blue-600 rounded-lg">
								<Trophy className="w-6 h-6 text-white" />
							</div>
							<h1 className="text-xl font-bold text-gray-900">
								{session.user.is_admin ? "Admin Dashboard" : "Swimmer Dashboard"}
							</h1>
						</div>
						<div className="flex items-center space-x-4">
							<div className="text-right">
								<p className="text-sm font-medium text-gray-900">{session.user.name}</p>
								<p className="text-xs text-gray-500">{session.user.email}</p>
							</div>
							<Button 
								variant="outline" 
								size="sm" 
								onClick={() => signOut({ callbackUrl: "/auth/signin" })}
								className="border-red-200 text-red-700 hover:bg-red-50"
							>
								<LogOut className="w-4 h-4 mr-2" />
								Sign Out
							</Button>
						</div>
					</div>
				</div>
			</header>

			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				{/* Status Message */}
				{message && (
					<div className={`mb-6 p-4 rounded-lg border-l-4 shadow-md ${
						messageType === "success" 
							? "bg-green-50 border-green-400 text-green-800" 
							: messageType === "error"
							? "bg-red-50 border-red-400 text-red-800"
							: "bg-blue-50 border-blue-400 text-blue-800"
					}`}>
						<div className="flex items-center">
							{messageType === "success" ? (
								<CheckCircle className="w-5 h-5 mr-2" />
							) : messageType === "error" ? (
								<AlertCircle className="w-5 h-5 mr-2" />
							) : (
								<Activity className="w-5 h-5 mr-2" />
							)}
							{message}
						</div>
					</div>
				)}

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
					{/* User Profile/Race Control */}
					<Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
						<CardHeader className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-t-lg">
							<CardTitle className="flex items-center">
								{session.user.is_admin ? (
									<>
										<Settings className="w-5 h-5 mr-2" />
										Race Control
									</>
								) : (
									<>
										<User className="w-5 h-5 mr-2" />
										Profile & Race Status
									</>
								)}
							</CardTitle>
						</CardHeader>
						<CardContent className="p-6">
							{!session.user.is_admin ? (
								<form onSubmit={handleSubmit(handleProfileUpdate as any)} className="space-y-6">
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div>
											<label className="block text-sm font-semibold mb-2 text-gray-700">Email</label>
											<Input 
												{...register("email")} 
												className={`${errors.email ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-blue-500"} transition-colors`}
												placeholder="your@email.com"
											/>
											{errors.email && <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>}
										</div>

										<div>
											<label className="block text-sm font-semibold mb-2 text-gray-700">Swim Type</label>
											<select 
												{...register("swim_type")} 
												className="w-full h-10 px-3 py-2 rounded-md border border-gray-300 bg-white text-sm focus:border-blue-500 focus:outline-none transition-colors"
											>
												<option value="solo">Solo</option>
												<option value="relay">Relay</option>
											</select>
										</div>
									</div>

									{swimType === "relay" && (
										<div>
											<label className="block text-sm font-semibold mb-2 text-gray-700">Team Name</label>
											<Input 
												{...register("team_name")} 
												className={`${errors.team_name ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-blue-500"} transition-colors`}
												placeholder="Enter your team name"
											/>
											{errors.team_name && <p className="text-sm text-red-600 mt-1">{errors.team_name.message}</p>}
										</div>
									)}

									<div>
										<label className="block text-sm font-semibold mb-2 text-gray-700">Avatar URL</label>
										<Input 
											{...register("avatar")} 
											className="border-gray-300 focus:border-blue-500 transition-colors"
											placeholder="https://example.com/avatar.jpg"
										/>
									</div>

									<div className="flex flex-col sm:flex-row gap-4 pt-4">
										<Button 
											type="submit" 
											disabled={isLoading}
											className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
										>
											{isLoading ? "Updating..." : "Update Profile"}
										</Button>

										<Button 
											type="button" 
											variant={session.user.is_active ? "destructive" : "default"} 
											onClick={toggleRaceStatus} 
											disabled={isLoading}
											className={`flex-1 ${session.user.is_active 
												? "bg-red-600 hover:bg-red-700" 
												: "bg-green-600 hover:bg-green-700"
											} disabled:opacity-50`}
										>
											{session.user.is_active ? (
												<>
													<Square className="w-4 h-4 mr-2" />
													Stop Race
												</>
											) : (
												<>
													<Play className="w-4 h-4 mr-2" />
													Start Race
												</>
											)}
										</Button>
									</div>
								</form>
							) : (
								<div className="text-center py-8">
									<Users className="w-16 h-16 mx-auto text-blue-400 mb-4" />
									<h3 className="text-lg font-semibold text-gray-900 mb-2">Admin Controls</h3>
									<p className="text-gray-600">As an admin, you can manage all swimmers from the swimmers list below.</p>
								</div>
							)}
						</CardContent>
					</Card>


					{/* add a card to show configuration data for owntracks app which swimmer can copy and paste to their app */}
					<Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
						<CardHeader className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-t-lg">
							<CardTitle className="flex items-center">
								<Settings className="w-5 h-5 mr-2" />
								OwnTracks Configuration
							</CardTitle>
						</CardHeader>
						<CardContent className="p-6">
							<div className="text-center py-8">
								<p className="text-gray-600">Copy and paste the following configuration data into your OwnTracks app:</p>
							</div>
							{/* show blocks with a copy button for url, username and password */}
							<div className="flex flex-col gap-4">
								<h3 className="text-md text-gray-900 mt-2">
									URL
								</h3>
								<div className="flex items-center gap-2">
									<p className="text-gray-600 text-sm w-full bg-gray-50 p-2 rounded-lg border border-gray-200">
									{"https://0bw7uu6i21.execute-api.eu-west-1.amazonaws.com/location"}
									</p>
									<Button variant="outline">Copy</Button>
								</div>
								<h3 className="text-md text-gray-900 mt-2">
									Username
								</h3>
								<div className="flex items-center gap-2">
									<p className="text-gray-600 text-sm w-full bg-gray-50 p-2 rounded-lg border border-gray-200">
										{session.user.name}
									</p>
									<Button variant="outline">Copy</Button>
								</div>
							</div>
							
							
						</CardContent>
					</Card>

					{/* Swimmers List (Admin only) */}
					{session.user.is_admin && (
						<Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
							<CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-lg">
								<CardTitle className="flex items-center">
									<Users className="w-5 h-5 mr-2" />
									Swimmers Management
								</CardTitle>
							</CardHeader>
							<CardContent className="p-6">
								<div className="space-y-4 max-h-96 overflow-y-auto">
									{swimmers.map((swimmer) => (
										<div 
											key={swimmer.username} 
											className={`flex items-center justify-between p-4 rounded-lg border transition-all hover:shadow-md ${
												swimmer.is_active 
													? "bg-green-50 border-green-200" 
													: "bg-gray-50 border-gray-200"
											}`}
										>
											<div className="flex-1">
												<div className="flex items-center space-x-2">
													<div className={`w-2 h-2 rounded-full ${
														swimmer.is_active ? "bg-green-500" : "bg-gray-400"
													}`}></div>
													<div className="font-semibold text-gray-900">{swimmer.username}</div>
												</div>
												<div className="text-sm text-gray-600 mt-1">
													{swimmer.team_name} • {swimmer.swim_type}
												</div>
												<div className="text-xs text-gray-500">{swimmer.email}</div>
											</div>
											<Button 
												size="sm" 
												variant={swimmer.is_active ? "destructive" : "default"} 
												onClick={() => toggleSwimmerStatus(swimmer.username, swimmer.is_active)}
												className={`ml-4 ${
													swimmer.is_active 
														? "bg-red-600 hover:bg-red-700" 
														: "bg-green-600 hover:bg-green-700"
												}`}
											>
												{swimmer.is_active ? (
													<>
														<Square className="w-4 h-4 mr-1" />
														Stop
													</>
												) : (
													<>
														<Play className="w-4 h-4 mr-1" />
														Start
													</>
												)}
											</Button>
										</div>
									))}
									{swimmers.length === 0 && (
										<div className="text-center py-12">
											<Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
											<p className="text-gray-500">No swimmers found</p>
										</div>
									)}
								</div>
							</CardContent>
						</Card>
					)}
				</div>
			</div>
		</div>
	);
}
