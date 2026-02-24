# SPORTIFY — Multi-Sport Player Profile Architecture

## Data Model Structure

### 1. Global Profile (existing `UsersStore`)
```
User {
  id, name, email, phone, avatar,
  role (legacy), roles[] (multi-role),
  createdAt
}
```
No changes to this store. It remains the universal identity layer.

### 2. Sport Profile Model (`SportProfilesStore`)
```
SportProfile {
  id,
  userId        → links to User
  sportId       → 'football' | 'padel' | 'basketball' (future)
  position      → 'ST', 'CM', 'GK', etc.
  skillLevel    → auto-computed from rating
  goals, assists, matchesPlayed, matchesCompleted,
  noShows, currentStreak,
  rating        → 1.0 - 5.0 (dynamic)
  ratingHistory → [{ type, change, oldRating, newRating, matchId, raterUserId, timestamp }]
  reliability   → computed: completionRate - (noShows * 5)
  badges[]      → earned badge IDs
  createdAt
}
```

**Key Design Decision:** Sport profiles are **separate from user accounts**. One user can have multiple sport profiles (one per sport). Currently only `football` is implemented — but the architecture supports adding `padel`, `basketball`, etc. by simply:
1. Adding a config in `sports-config.js`
2. Creating sport-specific position/badge constants in `player-profile.js`
3. Adding a new tab in the profile UI

---

## Route Structure

| Route                | Purpose                            | Auth Required |
|---------------------|------------------------------------|---------------|
| `profile.html`       | Full player dashboard              | ✅ Yes         |
| `leaderboard.html`   | Rankings, comparison, podium       | ❌ No (public) |
| `matchmaking.html`   | Join/create matches (Quick Action) | ✅ Yes         |
| `coaches.html`       | Request training (Quick Action)    | ❌ No          |
| `tournaments.html`   | Join tournaments (Quick Action)    | ❌ No          |

---

## Dynamic Rating System (Upgrade 2)

### Rating Weights
| Event                  | Change | Description                        |
|-----------------------|--------|------------------------------------|
| `MATCH_PARTICIPATION` | +0.10  | Playing a match                    |
| `ATTENDANCE_CONFIRM`  | +0.05  | Confirming attendance early        |
| `POSITIVE_FEEDBACK`   | +0.15  | Positive feedback from another player |
| `NEGATIVE_FEEDBACK`   | -0.10  | Negative feedback from another player |
| `NO_SHOW`             | -0.30  | Not showing up to a match          |
| `WIN`                 | +0.10  | Winning a match                    |

### Bounds
- Min rating: **1.0**
- Max rating: **5.0**
- Default new player: **3.0**

### Skill Level Auto-Computation
| Rating Range | Skill Level    |
|-------------|---------------|
| 0.0 - 2.99  | 🟢 Beginner    |
| 3.0 - 3.99  | 🔵 Intermediate|
| 4.0 - 4.49  | 🟠 Advanced    |
| 4.5 - 5.0   | 🔴 Elite       |

---

## Anti Race-Condition Logic

### Layer 1: In-Memory Lock (`RaceGuard.acquire`)
- Prevents rapid double-clicks on the same rating action.
- Lock key: `rating_{userId}_{matchId}_{changeType}_{raterUserId}`
- Auto-releases after 2000ms to prevent deadlocks.

### Layer 2: Persistent Dedup (`RaceGuard.hasPerformed`)
- localStorage key: `sportify_rating_dedup`
- Action key: `{userId}_{matchId}_{changeType}_{raterUserId}`
- Survives page reloads — prevents re-rating across sessions.
- Cannot rate yourself (`targetUserId === raterUserId` check).
- One rating per rater per match per target enforced at both layers.

### Flow:
```
ratePlayer(targetId, raterId, matchId, isPositive)
  → acquire lock key
  → check persistent dedup
  → if either fails → return error
  → apply rating change
  → record dedup
  → release lock
```

---

## Reliability Score (Upgrade 3)

### Formula
```
score = completionRate% - (noShows × 5%)
```

### Grades
| Score Range | Grade | Label       | Color   |
|------------|-------|-------------|---------|
| 95-100     | A+    | Elite       | #00E676 |
| 85-94      | A     | Excellent   | #00E676 |
| 75-84      | B     | Good        | #00B0FF |
| 60-74      | C     | Average     | #FFD740 |
| 40-59      | D     | Unreliable  | #FF5252 |
| 0-39       | F     | Banned Risk | #FF1744 |

---

## Files Modified/Created

| File                        | Action   | Purpose                                        |
|----------------------------|----------|-------------------------------------------------|
| `js/player-profile.js`    | ✅ Created | Core module: positions, badges, rating, reliability, leaderboard |
| `js/data.js`              | ✏️ Updated | New stores + seed data for sport profiles       |
| `js/app.js`               | ✏️ Updated | Nav links, footer, reset function               |
| `profile.html`            | ✏️ Updated | Full redesign with sport tabs + football dashboard |
| `leaderboard.html`        | ✅ Created | Rankings page with podium + comparison           |

### No Breaking Changes
- Existing `UsersStore`, `BookingsStore`, etc. — untouched
- Existing auth flow — untouched
- Existing coach/pitch_owner profile sections — preserved inside profile.html
- All new stores use safe-upgrade seeding (only seed if count === 0)
