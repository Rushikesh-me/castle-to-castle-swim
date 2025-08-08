"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
	children: ReactNode;
	fallback?: ReactNode;
}

interface State {
	hasError: boolean;
	error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
	public state: State = {
		hasError: false
	};

	public static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		console.error("Uncaught error:", error, errorInfo);
	}

	private handleRetry = () => {
		this.setState({ hasError: false, error: undefined });
	};

	public render() {
		if (this.state.hasError) {
			if (this.props.fallback) {
				return this.props.fallback;
			}

			return (
				<div className="flex items-center justify-center h-full w-full p-8">
					<Card className="max-w-md w-full">
						<CardContent className="p-6 text-center">
							<AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
							<h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
							<p className="text-gray-600 mb-4">
								{this.state.error?.message || "An unexpected error occurred while loading the map."}
							</p>
							<Button onClick={this.handleRetry} className="w-full">
								<RefreshCw className="w-4 h-4 mr-2" />
								Try Again
							</Button>
						</CardContent>
					</Card>
				</div>
			);
		}

		return this.props.children;
	}
}