/* Global TS declarations */

/** One GPS sample from the tracker */
export interface LocationPoint {
	acc: number; // Accuracy (m)
	conn: "w" | "m" | string;
	tst: number; // Epoch-seconds
	lon: number;
	lat: number;
	alt: number | null;
	batt: number;
	pk: string; // Swimmer slug
	tid: string; // Tracker ID
}

/** A swimmer (or relay team) and all recorded points */
export interface SwimmerTrack {
	team_name: string;
	username: string;
	swim_type: string;
	locations: LocationPoint[];
}

/** Normalized track ready for drawing */
export interface DrawTrack {
	id: string;
	label: string;
	points: google.maps.LatLngLiteral[];
	current: LocationPoint;
}

export interface SwimmerUser {
	pk?: string; // partition key: "USER#username"
	sk?: string; // sort key: "PROFILE"
	username: string; // unique username
	email?: string;
	password?: string; // hashed password
	team_name?: string;
	swim_type: string;
	is_admin?: boolean;
	is_active: boolean;
	avatar?: string;
	created_at: string;
	updated_at: string;
}

// NextAuth type extensions
declare module "next-auth" {
	interface User {
		is_admin: boolean;
		is_active: boolean;
		team_name?: string;
		swim_type: string;
		avatar: string;
	}

	interface Session {
		user: {
			id: string;
			name?: string | null;
			email?: string | null;
			image?: string | null;
			is_admin: boolean;
			is_active: boolean;
			team_name?: string;
			swim_type: string;
			avatar: string;
		};
	}
}

declare module "next-auth/jwt" {
	interface JWT {
		is_admin: boolean;
		is_active: boolean;
		team_name?: string;
		swim_type: string;
		avatar: string;
	}
}
