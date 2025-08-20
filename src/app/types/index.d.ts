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

/** Team member information for relay teams */
export interface TeamMember {
	avatar: string;
	bio: string;
	first_name: string;
	last_name: string;
}

/** Team captain information for relay teams */
export interface TeamCaptain {
	first_name: string;
	last_name: string;
}

/** A swimmer (or relay team) and all recorded points */
export interface SwimmerTrack {
	team_name: string;
	username: string;
	swim_type: string;
	locations: LocationPoint[];
	idonate_url?: string;
	donations_total?: number | null;
	start_time?: string; // Stringified epoch timestamp (e.g., "1724013023")
	finish_time?: string; // Stringified epoch timestamp (e.g., "1724016623")
	is_disqualified?: boolean;
	bio?: string;
	avatar?: string;
	// Solo swimmer specific fields
	first_name?: string;
	last_name?: string;
	email?: string;
	location?: string;
	// Relay team specific fields
	members?: TeamMember[];
	team_captain?: TeamCaptain;
}

/** Normalized track ready for drawing */
export interface DrawTrack {
	id: string;
	label: string;
	points: google.maps.LatLngLiteral[];
	current: LocationPoint;
}

export interface SwimmerUser {
	pk?: string; // partition key: "USER#username" or "TEAM#username"
	sk?: string; // sort key: username
	username: string; // unique username
	email?: string;
	password?: string; // hashed password
	team_name?: string;
	swim_type: string;
	is_admin?: boolean;
	is_active: boolean;
	avatar?: string;
	idonate_url?: string;
	start_time?: string; // Stringified epoch timestamp (e.g., "1724013023")
	finish_time?: string; // Stringified epoch timestamp (e.g., "1724016623")
	is_disqualified?: boolean;
	bio?: string;
	created_at: string;
	updated_at: string;
	// Solo swimmer specific fields
	first_name?: string;
	last_name?: string;
	location?: string;
	last_login?: string;
	password_updated?: boolean;
	// Relay team specific fields
	members?: TeamMember[];
	team_captain?: TeamCaptain;
}

// NextAuth type extensions
declare module "next-auth" {
	interface User {
		is_admin: boolean;
		is_active: boolean;
		team_name?: string;
		swim_type: string;
		avatar: string;
		bio?: string;
		start_time?: string; // Stringified epoch timestamp (e.g., "1724013023")
		finish_time?: string; // Stringified epoch timestamp (e.g., "1724016623")
		is_disqualified?: boolean;
		first_name?: string;
		last_name?: string;
		location?: string;
		members?: TeamMember[];
		team_captain?: TeamCaptain;
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
			bio?: string;
			start_time?: string; // Stringified epoch timestamp (e.g., "1724013023")
			finish_time?: string; // Stringified epoch timestamp (e.g., "1724016623")
			is_disqualified?: boolean;
			first_name?: string;
			last_name?: string;
			location?: string;
			members?: TeamMember[];
			team_captain?: TeamCaptain;
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
		bio?: string;
		start_time?: string; // Stringified epoch timestamp (e.g., "1724013023")
		finish_time?: string; // Stringified epoch timestamp (e.g., "1724016623")
		is_disqualified?: boolean;
		first_name?: string;
		last_name?: string;
		location?: string;
		members?: TeamMember[];
		team_captain?: TeamCaptain;
	}
}
