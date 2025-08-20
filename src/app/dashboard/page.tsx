// app/dashboard/page.tsx
"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UpdateProfileSchema } from "@/app/utils/validation";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Users, User, LogOut, Settings, Trophy, Activity, AlertCircle, CheckCircle, Upload, RefreshCw } from "lucide-react";
import { formatEpochString } from "@/app/utils/timeUtils";
import { SwimmerUser } from "../types";

type UpdateProfileData = {
	email: string;
	team_name: string;
	swim_type: "solo" | "relay";
	avatar?: string;
	idonate_url?: string;
	bio?: string;
	first_name?: string;
	last_name?: string;
	location?: string;
	start_time?: string;
	finish_time?: string;
};

type Swimmer = {
	username: string;
	email: string;
	team_name: string;
	swim_type: string;
	is_active: boolean;
	start_time?: string;
	finish_time?: string;
	is_disqualified?: boolean;
	bio?: string;
	avatar?: string;
	first_name?: string;
	last_name?: string;
	location?: string;
	members?: Array<{
		avatar?: string;
		bio?: string;
		first_name: string;
		last_name: string;
	}>;
	team_captain?: {
		first_name: string;
		last_name: string;
	};
};

export default function Dashboard() {
	const { data: session, status, update } = useSession();
	const [swimmers, setSwimmers] = useState<Swimmer[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [message, setMessage] = useState("");
	const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");
	const [uploadingImage, setUploadingImage] = useState(false);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [updatingSwimmers, setUpdatingSwimmers] = useState<Set<string>>(new Set());

	const {
		register,
		handleSubmit,
		formState: { errors },
		setValue,
		watch
	} = useForm<UpdateProfileData>({
		resolver: zodResolver(UpdateProfileSchema),
	});



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
			setValue("idonate_url", (session.user as unknown as { idonate_url?: string })?.idonate_url || "");
			setValue("bio", (session.user as unknown as { bio?: string })?.bio || "");
			setValue("first_name", (session.user as unknown as { first_name?: string })?.first_name || "");
			setValue("last_name", (session.user as unknown as { last_name?: string })?.last_name || "");
			setValue("location", (session.user as unknown as { location?: string })?.location || "");
			setValue("start_time", session.user.start_time ? new Date(parseInt(session.user.start_time) * 1000).toISOString().slice(0, 16) : "");
			setValue("finish_time", session.user.finish_time ? new Date(parseInt(session.user.finish_time) * 1000).toISOString().slice(0, 16) : "");
		}
		if (session?.user?.is_admin) {
			fetchSwimmers();
		}
	}, [session, setValue, fetchSwimmers]);

	const showMessage = (msg: string, type: "success" | "error" | "info") => {
		setMessage(msg);
		setMessageType(type);
		setTimeout(() => setMessage(""), 5000);
	};

	const handleImageUpload = async () => {
		if (!selectedFile) return;

		setUploadingImage(true);
		const formData = new FormData();
		formData.append("image", selectedFile);
		formData.append("bio", watch("bio") || "");

		try {
			const response = await fetch("/api/upload", {
				method: "POST",
				body: formData,
			});

			if (response.ok) {
				const result = await response.json();
				setValue("avatar", result.avatar);
				setValue("bio", result.bio);
				setPreviewUrl(null);
				setSelectedFile(null);
				showMessage("Profile picture uploaded successfully!", "success");
				await update();
			} else {
				const error = await response.json();
				showMessage(error.error || "Failed to upload image", "error");
			}
		} catch (error) {
			console.error("Upload error:", error);
			showMessage("Failed to upload image", "error");
		} finally {
			setUploadingImage(false);
		}
	};

	const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file) {
			setSelectedFile(file);
			const reader = new FileReader();
			reader.onload = (e) => setPreviewUrl(e.target?.result as string);
			reader.readAsDataURL(file);
		}
	};

	const handleProfileUpdate = async (data: UpdateProfileData) => {
		setIsLoading(true);
		setMessage("");
		try {
			const response = await fetch("/api/profile", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: data.email,
					team_name: data.team_name,
					swim_type: data.swim_type,
					avatar: data.avatar,
					idonate_url: data.idonate_url,
					bio: data.bio,
					first_name: data.first_name,
					last_name: data.last_name,
					location: data.location,
					start_time: data.start_time,
					finish_time: data.finish_time,
				}),
			});

			if (response.ok) {
				const result = await response.json();
				showMessage("Profile updated successfully!", "success");
				// Update the session to reflect changes
				await update();
			} else {
				const error = await response.json();
				showMessage(error.error || "Failed to update profile", "error");
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

	// Admin functions for managing swimmer times and disqualification
	const updateSwimmerAdminFields = async (username: string, updates: { start_time?: string; finish_time?: string; is_disqualified?: boolean }, swimType: "solo" | "relay") => {
		setUpdatingSwimmers(prev => new Set(prev).add(username));
		try {
			const response = await fetch(`/api/admin?username=${username}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(updates),
			});

			if (response.ok) {
				showMessage("Swimmer updated successfully", "success");
				// Refresh swimmers list
				fetchSwimmers();
			} else {
				const error = await response.json();
				showMessage(error.error || "Failed to update swimmer", "error");
			}
		} catch (error) {
			console.error("Failed to update swimmer:", error);
			showMessage("Failed to update swimmer", "error");
		} finally {
			setUpdatingSwimmers(prev => {
				const newSet = new Set(prev);
				newSet.delete(username);
				return newSet;
			});
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
		<div className="min-h-screen pt-20 bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-100">
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
								<form onSubmit={handleSubmit(handleProfileUpdate)} className="space-y-6">
									{/* Email */}
									<div>
										<label className="block text-sm font-semibold mb-2 text-gray-700">Email</label>
										<input
											type="email"
											{...register("email", { required: "Email is required" })}
											className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
										/>
										{errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
									</div>

									{/* First Name and Last Name for Solo Swimmers */}
									{session.user.swim_type === "solo" && (
										<>
											<div>
												<label className="block text-sm font-semibold mb-2 text-gray-700">First Name</label>
												<input
													type="text"
													{...register("first_name")}
													className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
												/>
											</div>
											<div>
												<label className="block text-sm font-semibold mb-2 text-gray-700">Last Name</label>
												<input
													type="text"
													{...register("last_name")}
													className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
												/>
											</div>
										</>
									)}

									{/* Team Name for Relay Teams */}
									{session.user.swim_type === "relay" && (
										<div>
											<label className="block text-sm font-semibold mb-2 text-gray-700">Team Name</label>
											<input
												type="text"
												{...register("team_name", { required: "Team name is required" })}
												className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
											/>
											{errors.team_name && <p className="text-red-500 text-sm mt-1">{errors.team_name.message}</p>}
										</div>
									)}

									{/* Location */}
									<div>
										<label className="block text-sm font-semibold mb-2 text-gray-700">Location</label>
										<input
											type="text"
											{...register("location")}
											placeholder="e.g., Athlone, Dublin, Cork"
											className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
										/>
									</div>

									{/* Swim Type */}
									<div>
										<label className="block text-sm font-semibold mb-2 text-gray-700">Swim Type</label>
										<select
											{...register("swim_type", { required: "Swim type is required" })}
											className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
										>
											<option value="solo">Solo</option>
											<option value="relay">Relay</option>
										</select>
										{errors.swim_type && <p className="text-red-500 text-sm mt-1">{errors.swim_type.message}</p>}
									</div>

									{/* iDonate URL */}
									<div>
										<label className="block text-sm font-semibold mb-2 text-gray-700">iDonate URL</label>
										<input
											type="url"
											{...register("idonate_url")}
											placeholder="https://www.idonate.ie/fundraiser/..."
											className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
										/>
									</div>

									{/* Bio */}
									<div>
										<label className="block text-sm font-semibold mb-2 text-gray-700">Bio</label>
										<textarea
											{...register("bio")}
											rows={3}
											placeholder="Tell us about yourself or your team..."
											className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
										/>
									</div>

									{/* Start Time and Finish Time */}
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div>
											<label className="block text-sm font-semibold mb-2 text-gray-700">Start Time</label>
											<input
												type="datetime-local"
												{...register("start_time")}
												className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
											/>
											<p className="text-xs text-gray-500 mt-1">When your race will start</p>
										</div>
										<div>
											<label className="block text-sm font-semibold mb-2 text-gray-700">Finish Time</label>
											<input
												type="datetime-local"
												{...register("finish_time")}
												className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
											/>
											<p className="text-xs text-gray-500 mt-1">When you expect to finish (optional)</p>
										</div>
									</div>

									<Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
										Update Profile
									</Button>
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

					{/* Profile Picture Upload */}
					{!session.user.is_admin && (
						<Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
							<CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-t-lg">
								<CardTitle className="flex items-center">
									<Upload className="w-5 h-5 mr-2" />
									Profile Picture
								</CardTitle>
							</CardHeader>
							<CardContent className="p-6">
								<div className="space-y-4">
									{/* Current Profile Picture */}
									<div className="text-center">
										{session.user.avatar ? (
											<img 
												src={session.user.avatar} 
												alt="Profile" 
												className="w-24 h-24 rounded-full mx-auto border-4 border-purple-200"
											/>
										) : (
											<div className="w-24 h-24 bg-purple-200 rounded-full mx-auto flex items-center justify-center">
												<User className="w-12 h-12 text-purple-600" />
											</div>
										)}
									</div>

									{/* File Upload */}
									<div>
										<label className="block text-sm font-semibold mb-2 text-gray-700">Upload New Picture</label>
										<input
											type="file"
											accept="image/*"
											onChange={handleFileSelect}
											className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
										/>
									</div>

									{/* Preview */}
									{previewUrl && (
										<div className="text-center">
											<p className="text-sm text-gray-600 mb-2">Preview:</p>
											<img 
												src={previewUrl} 
												alt="Preview" 
												className="w-20 h-20 rounded-full mx-auto border-2 border-purple-300"
											/>
										</div>
									)}

									{/* Upload Button */}
									{selectedFile && (
										<Button 
											onClick={handleImageUpload}
											disabled={uploadingImage}
											className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
										>
											{uploadingImage ? (
												<>
													<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
													Uploading...
												</>
											) : (
												<>
													<Upload className="w-4 h-4 mr-2" />
													Upload Picture
												</>
											)}
										</Button>
									)}
								</div>
							</CardContent>
						</Card>
					)}

					{/* OwnTracks Configuration */}
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
							<div className="flex flex-col gap-4">
								<h3 className="text-md text-gray-900 mt-2">URL</h3>
								<div className="flex items-center gap-2">
									<p className="text-gray-600 text-sm w-full bg-gray-50 p-2 rounded-lg border border-gray-200">
									{session.user.swim_type === "solo" ? "https://0bw7uu6i21.execute-api.eu-west-1.amazonaws.com/location" : "https://0bw7uu6i21.execute-api.eu-west-1.amazonaws.com/location?is_team=true"}
									</p>
									<Button variant="outline" onClick={() => navigator.clipboard.writeText(session.user.swim_type === "solo" ? "https://0bw7uu6i21.execute-api.eu-west-1.amazonaws.com/location" : "https://0bw7uu6i21.execute-api.eu-west-1.amazonaws.com/location?is_team=true")}>Copy</Button>
								</div>
								<h3 className="text-md text-gray-900 mt-2">Username</h3>
								<div className="flex items-center gap-2">
									<p className="text-gray-600 text-sm w-full bg-gray-50 p-2 rounded-lg border border-gray-200">
										{session.user.swim_type === "solo" ? session.user.name : session.user.team_name}
									</p>
									<Button variant="outline" onClick={() => navigator.clipboard.writeText(session.user.swim_type === "solo" ? (session.user.name||"") : (session.user.team_name||""))}>Copy</Button>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Swimmers Management (Admin Only) */}
					{session.user.is_admin && (
						<Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
							<CardHeader className="pb-3">
								<div className="flex items-center justify-between">
									<div>
										<h3 className="text-lg font-semibold text-gray-900">Swimmers Management</h3>
										<p className="text-sm text-gray-600">Manage all registered swimmers and relay teams</p>
									</div>
									<Button onClick={fetchSwimmers} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
										<RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
										Refresh
									</Button>
								</div>
							</CardHeader>
							<CardContent className="p-6">
								<div className="space-y-4">
									{swimmers.map((swimmer) => (
										<div key={swimmer.username} className="border border-gray-200 rounded-lg p-4 bg-white">
											<div className="flex items-center justify-between mb-3">
												<div>
													<h4 className="font-semibold text-gray-900">
														{swimmer.swim_type === "solo" 
															? `${swimmer.first_name || ""} ${swimmer.last_name || ""}`.trim() || swimmer.username
															: swimmer.team_name || swimmer.username
														}
													</h4>
													<p className="text-sm text-gray-600">
														{swimmer.swim_type === "solo" ? "Solo Swimmer" : "Relay Team"}
														{swimmer.location && ` • ${swimmer.location}`}
													</p>
													<p className="text-xs text-gray-500">@{swimmer.username}</p>
												</div>
												<div className="flex items-center space-x-2">
													{swimmer.is_disqualified ? (
														<span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
															Disqualified
														</span>
													) : (
														<span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
															Active
														</span>
													)}
												</div>
											</div>
											
											{/* Current Times Display */}
											<div className="mb-3 p-3 bg-gray-50 rounded-lg">
												<div className="grid grid-cols-2 gap-4 text-xs">
													<div>
														<span className="font-medium text-gray-700">Current Start Time:</span>
														<div className="text-gray-600 mt-1">
															{swimmer.start_time && /^\d{9,10}$/.test(swimmer.start_time) ? (
																formatEpochString(swimmer.start_time, 'datetime')
															) : (
																<span className="text-gray-400">Not set</span>
															)}
														</div>
													</div>
													<div>
														<span className="font-medium text-gray-700">Current Finish Time:</span>
														<div className="text-gray-600 mt-1">
															{swimmer.finish_time && /^\d{9,10}$/.test(swimmer.finish_time) ? (
																formatEpochString(swimmer.finish_time, 'datetime')
															) : (
																<span className="text-gray-400">Not set</span>
															)}
														</div>
													</div>
												</div>
											</div>

											{/* Relay Team Members */}
											{swimmer.swim_type === "relay" && swimmer.members && swimmer.members.length > 0 && (
												<div className="mb-3">
													<p className="text-xs text-gray-600 mb-1">Team Members:</p>
													<div className="flex flex-wrap gap-2">
														{swimmer.members.map((member, index) => (
															<span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
																{member.first_name} {member.last_name}
															</span>
														))}
													</div>
													{swimmer.team_captain && (
														<p className="text-xs text-gray-500 mt-1">
															Captain: {swimmer.team_captain.first_name} {swimmer.team_captain.last_name}
														</p>
													)}
												</div>
											)}

											{/* Admin Controls Form */}
											<form onSubmit={async (e) => {
												e.preventDefault();
												const formData = new FormData(e.currentTarget);
												
												// Get start time components
												const startDate = formData.get('start_time_date') as string;
												const startHour = parseInt(formData.get('start_time_hour') as string) || 0;
												const startMinute = parseInt(formData.get('start_time_minute') as string) || 0;
												const startSecond = parseInt(formData.get('start_time_second') as string) || 0;
												
												// Get finish time components
												const finishDate = formData.get('finish_time_date') as string;
												const finishHour = parseInt(formData.get('finish_time_hour') as string) || 0;
												const finishMinute = parseInt(formData.get('finish_time_minute') as string) || 0;
												const finishSecond = parseInt(formData.get('finish_time_second') as string) || 0;
												
												console.log("📝 Form submitted:", { 
													startDate, startHour, startMinute, startSecond,
													finishDate, finishHour, finishMinute, finishSecond
												});
												
												const updates: Partial<SwimmerUser> = {};
												
												// Build start time ISO string if date is provided
												if (startDate) {
													const startDateTime = new Date(`${startDate}T${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}:${startSecond.toString().padStart(2, '0')}`);
													updates.start_time = startDateTime.toISOString();
													console.log("📝 Start time update:", updates.start_time);
												}
												
												// Build finish time ISO string if date is provided
												if (finishDate) {
													const finishDateTime = new Date(`${finishDate}T${finishHour.toString().padStart(2, '0')}:${finishMinute.toString().padStart(2, '0')}:${finishSecond.toString().padStart(2, '0')}`);
													updates.finish_time = finishDateTime.toISOString();
													console.log("📝 Finish time update:", updates.finish_time);
												}
												
												if (Object.keys(updates).length > 0) {
													console.log("📝 Sending updates to API:", updates);
													updateSwimmerAdminFields(swimmer.username, updates, swimmer.swim_type as "solo" | "relay");
												} else {
													console.log("⚠️ No updates to send");
												}
											}} className="space-y-3">
												<div className="flex flex-col md:flex-row gap-3 text-sm">
													<div className="flex flex-col space-y-2">
													<div>
														<label className="block text-xs font-medium text-gray-700 mb-1">Start Time</label>
														<div className="flex space-x-1">
															<input
																name="start_time_date"
																type="date"
																defaultValue={(typeof swimmer.start_time === "string") &&
																	/^\d{9,10}$/.test(swimmer.start_time) &&
																	Number(swimmer.start_time) >= 946684800 &&
																	Number(swimmer.start_time) <= 4102444800
																	  ? new Date(Number(swimmer.start_time) * 1000).toISOString().split('T')[0]
																	  : ""}
																className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
																disabled={updatingSwimmers.has(swimmer.username)}
															/>
															<input
																name="start_time_hour"
																type="number"
																min="0"
																max="23"
																placeholder="HH"
																defaultValue={(typeof swimmer.start_time === "string") &&
																	/^\d{9,10}$/.test(swimmer.start_time) &&
																	Number(swimmer.start_time) >= 946684800 &&
																	Number(swimmer.start_time) <= 4102444800
																	  ? new Date(Number(swimmer.start_time) * 1000).getHours()
																	  : ""}
																className="w-16 px-2 py-1 text-xs border border-gray-300 rounded text-center"
																disabled={updatingSwimmers.has(swimmer.username)}
															/>
															<span className="text-xs text-gray-500 self-center">:</span>
															<input
																name="start_time_minute"
																type="number"
																min="0"
																max="59"
																placeholder="MM"
																defaultValue={(typeof swimmer.start_time === "string") &&
																	/^\d{9,10}$/.test(swimmer.start_time) &&
																	Number(swimmer.start_time) >= 946684800 &&
																	Number(swimmer.start_time) <= 4102444800
																	  ? new Date(Number(swimmer.start_time) * 1000).getMinutes()
																	  : ""}
																className="w-16 px-2 py-1 text-xs border border-gray-300 rounded text-center"
																disabled={updatingSwimmers.has(swimmer.username)}
															/>
															<span className="text-xs text-gray-500 self-center">:</span>
															<input
																name="start_time_second"
																type="number"
																min="0"
																max="59"
																placeholder="SS"
																defaultValue={(typeof swimmer.start_time === "string") &&
																	/^\d{9,10}$/.test(swimmer.start_time) &&
																	Number(swimmer.start_time) >= 946684800 &&
																	Number(swimmer.start_time) <= 4102444800
																	  ? new Date(Number(swimmer.start_time) * 1000).getSeconds()
																	  : ""}
																className="w-16 px-2 py-1 text-xs border border-gray-300 rounded text-center"
																disabled={updatingSwimmers.has(swimmer.username)}
															/>
														</div>
													</div>
													<div>
														<label className="block text-xs font-medium text-gray-700 mb-1">Finish Time</label>
														<div className="flex space-x-1">
															<input
																name="finish_time_date"
																type="date"
																defaultValue={(typeof swimmer.finish_time === "string") &&
																	/^\d{9,10}$/.test(swimmer.finish_time) &&
																	Number(swimmer.finish_time) >= 946684800 &&
																	Number(swimmer.start_time) <= 4102444800
																	  ? new Date(Number(swimmer.finish_time) * 1000).toISOString().split('T')[0]
																	  : ""}
																className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
																disabled={updatingSwimmers.has(swimmer.username)}
															/>
															<input
																name="finish_time_hour"
																type="number"
																min="0"
																max="23"
																placeholder="HH"
																defaultValue={(typeof swimmer.finish_time === "string") &&
																	/^\d{9,10}$/.test(swimmer.finish_time) &&
																	Number(swimmer.finish_time) >= 946684800 &&
																	Number(swimmer.finish_time) <= 4102444800
																	  ? new Date(Number(swimmer.finish_time) * 1000).getHours()
																	  : ""}
																className="w-16 px-2 py-1 text-xs border border-gray-300 rounded text-center"
																disabled={updatingSwimmers.has(swimmer.username)}
															/>
															<span className="flex items-center justify-center w-4 text-xs text-gray-500">:</span>
															<input
																name="finish_time_minute"
																type="number"
																min="0"
																max="59"
																placeholder="MM"
																defaultValue={(typeof swimmer.finish_time === "string") &&
																	/^\d{9,10}$/.test(swimmer.finish_time) &&
																	Number(swimmer.finish_time) >= 946684800 &&
																	Number(swimmer.finish_time) <= 4102444800
																	  ? new Date(Number(swimmer.finish_time) * 1000).getMinutes()
																	  : ""}
																className="w-16 px-2 py-1 text-xs border border-gray-300 rounded text-center"
																disabled={updatingSwimmers.has(swimmer.username)}
															/>
															<span className="flex items-center justify-center w-4 text-xs text-gray-500">:</span>
															<input
																name="finish_time_second"
																type="number"
																min="0"
																max="59"
																placeholder="SS"
																defaultValue={(typeof swimmer.finish_time === "string") &&
																	/^\d{9,10}$/.test(swimmer.finish_time) &&
																	Number(swimmer.finish_time) >= 946684800 &&
																	Number(swimmer.finish_time) <= 4102444800
																	  ? new Date(Number(swimmer.finish_time) * 1000).getSeconds()
																	  : ""}
																className="w-16 px-2 py-1 text-xs border border-gray-300 rounded text-center"
																disabled={updatingSwimmers.has(swimmer.username)}
															/>
														</div>
													</div>
													</div>
													<div className="flex flex-col space-y-2">
														<label className="block text-xs font-medium text-gray-700 mb-1">Actions</label>
														<div className="flex flex-col h-full space-y-2">
															<Button
																type="submit"
																size="sm"
																className="flex-1 bg-blue-600 hover:bg-blue-700 text-xs"
																disabled={updatingSwimmers.has(swimmer.username)}
															>
																{updatingSwimmers.has(swimmer.username) ? (
																	<>
																		<div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
																		Saving...
																	</>
																) : (
																	"Save Times"
																)}
															</Button>
															<Button
																type="button"
																onClick={() => updateSwimmerAdminFields(swimmer.username, { is_disqualified: !swimmer.is_disqualified }, swimmer.swim_type as "solo" | "relay")}
																variant={swimmer.is_disqualified ? "default" : "destructive"}
																size="sm"
																className="flex-1 text-xs"
																disabled={updatingSwimmers.has(swimmer.username)}
															>
																{updatingSwimmers.has(swimmer.username) ? (
																	<div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
																) : (
																	swimmer.is_disqualified ? "Reinstate" : "Disqualify"
																)}
															</Button>
														</div>
													</div>
												</div>
											</form>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					)}
				</div>
			</div>
		</div>
	);
}
