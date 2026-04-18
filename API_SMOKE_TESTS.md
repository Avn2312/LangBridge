# LangBridge Backend API Smoke Tests

## Setup
- **Base URL**: `http://localhost:3000`
- **Auth**: JWT in `httpOnly` cookie (set automatically after login/signup)
- All user endpoints require authentication (protectRoute middleware)

---

## 1. Authentication Flow

### Signup
```http
POST /api/auth/signup
Content-Type: application/json

{
  "email": "user1@example.com",
  "password": "password123",
  "fullName": "User One"
}
```

**Success Response (201)**
```json
{
  "success": true,
  "message": "Signup successful.",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user1@example.com",
    "fullName": "User One",
    "profilePic": "https://avatar.iran.liara.run/public/42.png",
    "nativeLanguage": "",
    "learningLanguage": ""
  }
}
```
✅ JWT cookie is set automatically. No password in response.

---

### Onboarding (Complete Profile)
After signup, user runs onboarding before friend actions.

```http
POST /api/auth/onboarding
Content-Type: application/json
Cookie: jwt=<token_from_signup>

{
  "fullName": "User One",
  "bio": "Learning Spanish",
  "nativeLanguage": "English",
  "learningLanguage": "Spanish",
  "location": "New York"
}
```

**Success Response (200)**
```json
{
  "success": true,
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "fullName": "User One",
    "email": "user1@example.com",
    "bio": "Learning Spanish",
    "nativeLanguage": "English",
    "learningLanguage": "Spanish",
    "location": "New York",
    "isOnboarded": true,
    "profilePic": "https://avatar.iran.liara.run/public/42.png",
    "friends": [],
    "createdAt": "2026-04-03T10:00:00.000Z",
    "updatedAt": "2026-04-03T10:05:00.000Z"
  }
}
```

---

## 2. Get Recommendations

```http
GET /api/users/
Cookie: jwt=<token_from_user1>
```

**Success Response (200)**
```json
[
  {
    "_id": "507f1f77bcf86cd799439012",
    "fullName": "User Two",
    "email": "user2@example.com",
    "bio": "Teaching Spanish",
    "nativeLanguage": "Spanish",
    "learningLanguage": "English",
    "location": "Madrid",
    "isOnboarded": true,
    "profilePic": "https://avatar.iran.liara.run/public/15.png",
    "friends": [],
    "createdAt": "2026-04-03T09:00:00.000Z",
    "updatedAt": "2026-04-03T09:30:00.000Z"
  }
  // ... more users
]
```
✅ Returns only onboarded, non-friend users.

---

## 3. Friend Request Flow (Smoke Test Sequence)

### Test Scenario
- **User 1 ID**: `507f1f77bcf86cd799439011`
- **User 2 ID**: `507f1f77bcf86cd799439012`

---

### Step 1: User 1 Sends Follow Request to User 2

```http
POST /api/users/follow/507f1f77bcf86cd799439012
Cookie: jwt=<token_from_user1>
```

**Success Response (201)**
```json
{
  "_id": "607f1f77bcf86cd799439001",
  "sender": "507f1f77bcf86cd799439011",
  "recipient": "507f1f77bcf86cd799439012",
  "status": "pending",
  "createdAt": "2026-04-03T10:10:00.000Z",
  "updatedAt": "2026-04-03T10:10:00.000Z"
}
```

**Error: Sending to self (400)**
```http
POST /api/users/follow/507f1f77bcf86cd799439011
Cookie: jwt=<token_from_user1>
```
```json
{
  "message": "Can't send friend request to self."
}
```

**Error: Invalid ID format (400)**
```http
POST /api/users/follow/invalid-id
Cookie: jwt=<token_from_user1>
```
```json
{
  "message": "Invalid recipient id."
}
```

**Error: Recipient not found (404)**
```http
POST /api/users/follow/507f1f77bcf86cd799999999
Cookie: jwt=<token_from_user1>
```
```json
{
  "message": "Recipient not found."
}
```

**Error: Duplicate request (400)**
```http
POST /api/users/follow/507f1f77bcf86cd799439012
Cookie: jwt=<token_from_user1>
```
```json
{
  "message": "Friend request already sent."
}
```

---

### Step 2: User 2 Views Received Requests

```http
GET /api/users/received/requests
Cookie: jwt=<token_from_user2>
```

**Success Response (200)**
```json
{
  "incomingReqs": [
    {
      "_id": "607f1f77bcf86cd799439001",
      "sender": {
        "_id": "507f1f77bcf86cd799439011",
        "fullName": "User One",
        "profilePic": "https://avatar.iran.liara.run/public/42.png",
        "nativeLanguage": "English",
        "learningLanguage": "Spanish"
      },
      "recipient": "507f1f77bcf86cd799439012",
      "status": "pending",
      "createdAt": "2026-04-03T10:10:00.000Z"
    }
  ],
  "acceptedReqs": []
}
```

---

### Step 3: User 2 Accepts Request

```http
PATCH /api/users/follow/accept/607f1f77bcf86cd799439001
Cookie: jwt=<token_from_user2>
```

**Success Response (200)**
```json
{
  "message": "Friend Request Accepted."
}
```

**Error: Invalid request ID (400)**
```http
PATCH /api/users/follow/accept/invalid-id
Cookie: jwt=<token_from_user2>
```
```json
{
  "message": "Invalid request id."
}
```

**Error: Request not found (404)**
```http
PATCH /api/users/follow/accept/607f1f77bcf86cd799999999
Cookie: jwt=<token_from_user2>
```
```json
{
  "message": "Friend request not found."
}
```

**Error: Not authorized (403)**
```http
PATCH /api/users/follow/accept/607f1f77bcf86cd799439001
Cookie: jwt=<token_from_user1>
```
```json
{
  "message": "You are not authorized to accept this request."
}
```

**Error: Already processed (400)**
```http
PATCH /api/users/follow/accept/607f1f77bcf86cd799439001
Cookie: jwt=<token_from_user2>
```
```json
{
  "message": "Cannot accept a accepted request."
}
```

---

### Step 4: Both Users Can Now See Friends

**User 1 View Friends**
```http
GET /api/users/friends
Cookie: jwt=<token_from_user1>
```

**Success Response (200)**
```json
[
  {
    "_id": "507f1f77bcf86cd799439012",
    "fullName": "User Two",
    "profilePic": "https://avatar.iran.liara.run/public/15.png",
    "nativeLanguage": "Spanish",
    "learningLanguage": "English"
  }
]
```

---

## 4. Rejection Flow (Alternative)

### User 1 Sends Another Request to User 3

```http
POST /api/users/follow/507f1f77bcf86cd799439013
Cookie: jwt=<token_from_user1>
```

```json
{
  "_id": "607f1f77bcf86cd799439002",
  "sender": "507f1f77bcf86cd799439011",
  "recipient": "507f1f77bcf86cd799439013",
  "status": "pending",
  "createdAt": "2026-04-03T10:15:00.000Z"
}
```

### User 3 Rejects Request

```http
PATCH /api/users/follow/reject/607f1f77bcf86cd799439002
Cookie: jwt=<token_from_user3>
```

**Success Response (200)**
```json
{
  "message": "Friend Request Rejected."
}
```

**Error: Already rejected (400)**
```http
PATCH /api/users/follow/reject/607f1f77bcf86cd799439002
Cookie: jwt=<token_from_user3>
```
```json
{
  "message": "Friend request is already processed."
}
```

---

## 5. Unfollow (Remove Friend)

After User 1 and User 2 are friends:

```http
POST /api/users/unfollow/507f1f77bcf86cd799439012
Cookie: jwt=<token_from_user1>
```

**Success Response (200)**
```json
{
  "message": "Unfollowed successfully."
}
```

**Error: Not friends (400)**
```http
POST /api/users/unfollow/507f1f77bcf86cd799439012
Cookie: jwt=<token_from_user1>
```
```json
{
  "message": "Not friends."
}
```

**Error: Invalid ID (400)**
```http
POST /api/users/unfollow/invalid-id
Cookie: jwt=<token_from_user1>
```
```json
{
  "message": "Invalid recipient id."
}
```

---

## 6. View Sent Requests

User can see all pending requests they've sent:

```http
GET /api/users/sent/requests
Cookie: jwt=<token_from_user1>
```

**Success Response (200)**
```json
[
  {
    "_id": "607f1f77bcf86cd799439003",
    "sender": "507f1f77bcf86cd799439011",
    "recipient": {
      "_id": "507f1f77bcf86cd799439014",
      "fullName": "User Four",
      "profilePic": "https://avatar.iran.liara.run/public/22.png",
      "nativeLanguage": "French",
      "learningLanguage": "English"
    },
    "status": "pending",
    "createdAt": "2026-04-03T10:20:00.000Z"
  }
]
```

---

## Test Summary

| Operation | Method | Endpoint | Auth | Expected Status |
|-----------|--------|----------|------|-----------------|
| Signup | POST | `/api/auth/signup` | ❌ | 201 |
| Onboarding | POST | `/api/auth/onboarding` | ✅ | 200 |
| Get Recommendations | GET | `/api/users/` | ✅ | 200 |
| Send Friend Request | POST | `/api/users/follow/:id` | ✅ | 201 |
| Accept Request | PATCH | `/api/users/follow/accept/:id` | ✅ | 200 |
| Reject Request | PATCH | `/api/users/follow/reject/:id` | ✅ | 200 |
| Get Friends | GET | `/api/users/friends` | ✅ | 200 |
| Unfollow Friend | POST | `/api/users/unfollow/:id` | ✅ | 200 |
| View Received Requests | GET | `/api/users/received/requests` | ✅ | 200 |
| View Sent Requests | GET | `/api/users/sent/requests` | ✅ | 200 |

---

## Fixed Logic Verification

✅ **ObjectId Validation**: Invalid IDs now return 400, not 500  
✅ **Friendship Checks**: Correct ObjectId comparison (`.toString()` used)  
✅ **Status Guards**: Cannot accept/reject already-processed requests  
✅ **Password Safety**: No password in auth responses  
✅ **Authorization**: Only request recipient can accept/reject  

---

## Quick Manual Test

```bash
# 1. Create two users (terminals or Postman)
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"user1@test.com","password":"password123","fullName":"User One"}'

curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"user2@test.com","password":"password123","fullName":"User Two"}'

# 2. Onboard both (will get separate tokens)
curl -X POST http://localhost:3000/api/auth/onboarding \
  -H "Content-Type: application/json" \
  -b "jwt=<USER1_TOKEN>" \
  -d '{"fullName":"User One","bio":"Learning Spanish","nativeLanguage":"English","learningLanguage":"Spanish","location":"NY"}'

# 3. Get recommendations (User 1)
curl -X GET http://localhost:3000/api/users/ \
  -H "Cookie: jwt=<USER1_TOKEN>"

# 4. Send follow (User 1 → User 2's ID)
curl -X POST http://localhost:3000/api/users/follow/<USER2_ID> \
  -H "Cookie: jwt=<USER1_TOKEN>"

# 5. View received (User 2)
curl -X GET http://localhost:3000/api/users/received/requests \
  -H "Cookie: jwt=<USER2_TOKEN>"

# 6. Accept (User 2)
curl -X PATCH http://localhost:3000/api/users/follow/accept/<REQUEST_ID> \
  -H "Cookie: jwt=<USER2_TOKEN>"

# 7. Check friends (User 1)
curl -X GET http://localhost:3000/api/users/friends \
  -H "Cookie: jwt=<USER1_TOKEN>"
```

---

## Notes

- All JWT tokens are in **httpOnly cookies** (automatically handled by browser/Postman)
- Timestamps are ISO 8601 format
- All ObjectIds are MongoDB 24-char hex strings
- CORS allows `localhost:5173` (frontend) and `localhost:3000` (backend)
- Duplicate friend requests are blocked (both directions checked)
