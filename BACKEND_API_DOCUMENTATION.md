# Castle Swim Backend API Documentation

## Overview
This document describes the backend API implementation for the Castle Swim real-time tracking system. The backend has been updated to support enhanced swim tracking features including active swimmer fetching, category filtering, and location history management.

## Environment Variables Required

```
USERS_TABLE_NAME=castle-swim-users
LOCATIONS_TABLE_NAME=castle-swim-locations
DYNAMODB_REGION=eu-west-1
APP_AWS_ACCESS_KEY=your-aws-access-key
APP_AWS_SECRET_KEY=your-aws-secret-key
SECRET_KEY=your-secret-key-for-password-hashing
```

## Database Schema

### Users Table (`USERS_TABLE_NAME`)
- **Partition Key**: `pk` (String) - Always "USER"
- **Sort Key**: `sk` (String) - Username
- **Attributes**:
  - `username` (String) - Unique identifier
  - `email` (String) - User email
  - `password` (String) - Hashed password
  - `team_name` (String) - Team name (for relay)
  - `swim_type` (String) - "solo" or "relay"
  - `is_admin` (Boolean) - Admin privileges
  - `is_active` (Boolean) - Currently swimming status
  - `avatar` (String) - Profile picture URL
  - `created_at` (String) - ISO timestamp
  - `updated_at` (String) - ISO timestamp

### Locations Table (`LOCATIONS_TABLE_NAME`)
- **Partition Key**: `pk` (String) - Username
- **Sort Key**: `sk` (String) - "LOCATION#{timestamp}" or timestamp
- **Attributes**:
  - `acc` (Number) - GPS accuracy in meters
  - `conn` (String) - Connection type ("w" for WiFi, "m" for mobile)
  - `tst` (Number) - Unix timestamp
  - `lon` (Number) - Longitude
  - `lat` (Number) - Latitude
  - `alt` (Number) - Altitude (optional)
  - `batt` (Number) - Battery percentage
  - `tid` (String) - Tracker ID
  - `created_at` (String) - ISO timestamp

## API Endpoints

### 1. Swimmers API - `/api/swimmers`

#### GET `/api/swimmers`
Fetch swimmers with optional filtering.

**Query Parameters:**
- `active` (boolean) - Filter for active swimmers only
- `swim_type` (string) - Filter by "solo" or "relay"
- `location_limit` (number, 1-100) - Limit locations per swimmer (default: 20)

**Authentication:** Required (any authenticated user for active swimmers, admin for all)

**Examples:**
```
GET /api/swimmers?active=true&swim_type=solo&location_limit=20
GET /api/swimmers (admin only - returns all swimmers)
```

**Response:**
```json
[
  {
    "username": "swimmer1",
    "team_name": "Team Alpha",
    "swim_type": "solo",
    "locations": [
      {
        "acc": 5,
        "conn": "w",
        "tst": 1699123456,
        "lon": -7.9045,
        "lat": 53.4125,
        "alt": 0,
        "batt": 85,
        "pk": "swimmer1",
        "tid": "tracker1"
      }
    ]
  }
]
```

### 2. Swimmer History API - `/api/swimmers/[username]/history`

#### GET `/api/swimmers/[username]/history`
Fetch complete location history for a specific swimmer.

**Authentication:** Required (own history or admin)

**Response:**
```json
[
  {
    "acc": 5,
    "conn": "w",
    "tst": 1699123456,
    "lon": -7.9045,
    "lat": 53.4125,
    "alt": 0,
    "batt": 85,
    "pk": "swimmer1",
    "tid": "tracker1"
  }
]
```

### 3. Location API - `/api/location`

#### POST `/api/location`
Store location data (for OwnTracks integration).

**Authentication:** Optional (username via header or body)

**Headers:**
- `x-username` (string) - Username for location data

**Request Body:**
```json
{
  "_type": "location",
  "acc": 5,
  "conn": "w",
  "tst": 1699123456,
  "lon": -7.9045,
  "lat": 53.4125,
  "alt": 0,
  "batt": 85,
  "tid": "tracker1",
  "pk": "swimmer1"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Location stored successfully"
}
```

### 4. Backend Test API - `/api/test/backend`

#### GET `/api/test/backend`
Comprehensive backend functionality testing.

**Authentication:** Admin required

**Response:**
```json
{
  "summary": {
    "total": 6,
    "success": 6,
    "errors": 0,
    "status": "all_tests_passed"
  },
  "results": [
    {
      "endpoint": "getAllSwimmers",
      "status": "success",
      "message": "Found 5 swimmers",
      "data": { "count": 5 }
    }
  ],
  "timestamp": "2024-01-01T12:00:00.000Z",
  "environment": {
    "usersTable": "castle-swim-users",
    "locationsTable": "castle-swim-locations",
    "region": "eu-west-1"
  }
}
```

## Database Helper Functions

### `getAllSwimmers()`
Returns all swimmers from the users table.

### `getActiveSwimmersWithLocations(swimType?, locationLimit)`
Returns active swimmers with their recent locations.
- `swimType` - Optional filter ("solo" or "relay")
- `locationLimit` - Number of recent locations (1-100, default: 20)

### `getSwimmerCompleteHistory(username)`
Returns complete location history for a specific swimmer.

### `updateSwimmerStatus(username, is_active)`
Updates the active status of a swimmer.

### `updateSwimmerProfile(username, updates)`
Updates swimmer profile information.

### `createUser(userData)`
Creates a new user with hashed password.

## Error Handling

All endpoints implement comprehensive error handling:

- **400 Bad Request** - Invalid input parameters
- **401 Unauthorized** - Authentication required
- **403 Forbidden** - Insufficient permissions
- **404 Not Found** - Resource not found
- **500 Internal Server Error** - Server-side errors

## Performance Optimizations

1. **Query vs Scan**: Uses DynamoDB Query operations instead of Scan for better performance
2. **Pagination**: Location limits prevent overwhelming responses
3. **Validation**: Input validation prevents invalid database operations
4. **Caching**: Frontend implements history caching to reduce API calls
5. **Error Boundaries**: Comprehensive error handling at all levels

## Security Features

1. **Authentication**: All sensitive endpoints require authentication
2. **Authorization**: Role-based access control (admin vs regular users)
3. **Input Validation**: All inputs are validated before processing
4. **Password Hashing**: Uses HMAC-SHA256 for password security
5. **Rate Limiting**: Location limit prevents abuse

## Integration Notes

### OwnTracks Integration
- Use the `/api/location` POST endpoint for location updates
- Include username in the `x-username` header or `pk` field
- Ensure `_type: "location"` in the request body

### Frontend Integration
- Use `/api/swimmers?active=true` for real-time tracking
- Implement category filtering with `swim_type` parameter
- Use `/api/swimmers/[username]/history` for detailed swimmer views
- Implement caching for better performance

## Testing

Use the `/api/test/backend` endpoint to verify:
- Database connectivity
- Function implementations
- Data integrity
- Error handling
- Environment configuration

## Migration Notes

The new implementation is backward compatible with existing:
- User authentication system
- Database structure
- Existing location data

No data migration is required for the enhanced features.