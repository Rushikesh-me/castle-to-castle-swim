'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/app/components/ui/button';
import { AlertTriangle, Phone, MapPin, Clock, User, Users } from 'lucide-react';

export default function HelpPage() {
	const { data: session } = useSession();
	const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [sosSent, setSosSent] = useState(false);
	const [deviceId, setDeviceId] = useState<string | null>(null);
	const [locationError, setLocationError] = useState<string | null>(null);

	useEffect(() => {
		// Get user's current location
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					setLocation({
						lat: position.coords.latitude,
						lng: position.coords.longitude,
					});
					setLocationError(null);
				},
				(error) => {
					setLocationError('Unable to get your location. Please enable location services.');
				}
			);
		} else {
			setLocationError('Geolocation is not supported by this browser.');
		}
	}, []);

	const handleSOS = async () => {
		if (!location) {
			setLocationError('Location is required to send SOS. Please enable location services.');
			return;
		}

		setIsLoading(true);
		try {
			const response = await fetch('/api/emergency', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					location,
					isSwimmer: !!session?.user,
				}),
			});

			const data = await response.json();
			
			if (response.ok) {
				setSosSent(true);
				setDeviceId(data.deviceId);
				
				// Start periodic location updates
				if (data.status === 'created') {
					startLocationUpdates(data.deviceId);
				}
			} else {
				alert('Failed to send SOS: ' + data.error);
			}
		} catch (error) {
			alert('Failed to send SOS. Please try again.');
		} finally {
			setIsLoading(false);
		}
	};

	const startLocationUpdates = (deviceId: string) => {
		// Update location every 30 seconds
		const interval = setInterval(async () => {
			if (navigator.geolocation) {
				navigator.geolocation.getCurrentPosition(
					async (position) => {
						const newLocation = {
							lat: position.coords.latitude,
							lng: position.coords.longitude,
						};
						
						try {
							await fetch('/api/emergency', {
								method: 'PUT',
								headers: {
									'Content-Type': 'application/json',
								},
								body: JSON.stringify({
									deviceId,
									location: newLocation,
								}),
							});
						} catch (error) {
							// Continue updating even if one fails
						}
					},
					() => {
						// Location update failed, continue trying
					}
				);
			}
		}, 30000);

		// Clean up interval when component unmounts
		return () => clearInterval(interval);
	};

	const isSwimmer = !!session?.user;

	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
			<div className="max-w-4xl mx-auto">
				{/* Header */}
				<div className="text-center mb-8">
					<h1 className="text-4xl font-bold text-gray-900 mb-4">
						Need Help?
					</h1>
					<p className="text-lg text-gray-600 max-w-2xl mx-auto">
						{isSwimmer 
							? "If you're experiencing an emergency during your swim, our support team is here to help."
							: "If you're near a water body or swim race and need emergency assistance, we can help connect you with volunteers."
						}
					</p>
				</div>

				{/* Emergency SOS Section */}
				<div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
					<div className="text-center mb-6">
						<div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
							<AlertTriangle className="w-10 h-10 text-red-600" />
						</div>
						<h2 className="text-2xl font-bold text-gray-900 mb-2">
							Emergency SOS
						</h2>
						<p className="text-gray-600">
							{isSwimmer 
								? "Click the button below to alert our support team of your emergency situation."
								: "Click the button below to request emergency volunteer support."
							}
						</p>
					</div>

					{/* Location Status */}
					<div className="mb-6 p-4 bg-gray-50 rounded-lg">
						<div className="flex items-center justify-center space-x-2">
							<MapPin className="w-5 h-5 text-gray-500" />
							<span className="text-sm text-gray-600">
								{location 
									? `Location: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
									: 'Getting your location...'
								}
							</span>
						</div>
						{locationError && (
							<p className="text-red-500 text-sm text-center mt-2">{locationError}</p>
						)}
					</div>

					{/* SOS Button */}
					<div className="text-center">
						{!sosSent ? (
							<Button
								onClick={handleSOS}
								disabled={isLoading || !location}
								className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 text-lg font-semibold rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200"
							>
								{isLoading ? 'Sending SOS...' : '🚨 SEND SOS 🚨'}
							</Button>
						) : (
							<div className="bg-green-50 border border-green-200 rounded-lg p-6">
								<div className="text-green-800 text-center">
									<h3 className="text-xl font-semibold mb-2">SOS Sent Successfully!</h3>
									<p className="mb-4">
										{isSwimmer 
											? "Our support team has been alerted and is responding to your emergency."
											: "Volunteer support has been requested and is on the way."
										}
									</p>
									{deviceId && (
										<p className="text-sm text-green-600">
											Reference ID: {deviceId}
										</p>
									)}
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Help Information */}
				<div className="grid md:grid-cols-2 gap-6 mb-8">
					{/* Swimmer Help */}
					{isSwimmer && (
						<div className="bg-white rounded-xl shadow-lg p-6">
							<div className="flex items-center mb-4">
								<User className="w-6 h-6 text-blue-600 mr-2" />
								<h3 className="text-xl font-semibold text-gray-900">For Swimmers</h3>
							</div>
							<ul className="space-y-3 text-gray-700">
								<li>• Stay calm and try to stay afloat</li>
								<li>• Signal for help if possible</li>
								<li>• Our support team will respond immediately</li>
								<li>• Keep your location updated for faster response</li>
								<li>• If possible, move to shallow water or shore</li>
							</ul>
						</div>
					)}

					{/* Visitor Help */}
					{!isSwimmer && (
						<div className="bg-white rounded-xl shadow-lg p-6">
							<div className="flex items-center mb-4">
								<Users className="w-6 h-6 text-green-600 mr-2" />
								<h3 className="text-xl font-semibold text-gray-900">For Visitors</h3>
							</div>
							<ul className="space-y-3 text-gray-700">
								<li>• Stay away from the water if possible</li>
								<li>• Signal for help from a safe location</li>
								<li>• Volunteer support will be dispatched</li>
								<li>• Keep your location updated</li>
								<li>• Follow any instructions from volunteers</li>
							</ul>
						</div>
					)}

					{/* General Emergency Info */}
					<div className="bg-white rounded-xl shadow-lg p-6">
						<div className="flex items-center mb-4">
							<Phone className="w-6 h-6 text-red-600 mr-2" />
							<h3 className="text-xl font-semibold text-gray-900">Emergency Contacts</h3>
						</div>
						<div className="space-y-3 text-gray-700">
							<div>
								<p className="font-semibold">Emergency Services:</p>
								<p className="text-lg font-bold text-red-600 cursor-pointer" onClick={() => window.open('tel:112', '_blank')}>112</p>
							</div>
							<div>
								<p className="font-semibold">Race Support:</p>
								<p className="text-lg font-bold text-green-600">Available via SOS</p>
							</div>
						</div>
					</div>
				</div>

				{/* Additional Safety Information */}
				<div className="bg-white rounded-xl shadow-lg p-6">
					<h3 className="text-xl font-semibold text-gray-900 mb-4 text-center">
						Safety First
					</h3>
					<div className="grid md:grid-cols-3 gap-4 text-sm text-gray-600">
						<div className="text-center">
							<Clock className="w-8 h-8 text-blue-500 mx-auto mb-2" />
							<p>Response time: 2-5 minutes</p>
						</div>
						<div className="text-center">
							<MapPin className="w-8 h-8 text-green-500 mx-auto mb-2" />
							<p>GPS tracking enabled</p>
						</div>
						<div className="text-center">
							<AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
							<p>24/7 emergency support</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
