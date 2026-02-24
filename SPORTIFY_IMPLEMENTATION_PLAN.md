# 🏟️ SPORTIFY — Implementation Plan

## Architect's Analysis Summary

> **Current State:** Mal3abak is a well-structured, modular, client-side web application using vanilla HTML/CSS/JS with localStorage. It has 17 HTML pages, 4 JS modules (`data.js`, `auth.js`, `roles.js`, `app.js`), 1 CSS design system, and covers pitch booking, coach booking, academies, tournaments, and video competitions.
>
> **Strategy:** All changes below are **SAFE EXTENSIONS** — no rewrites, no breaking changes. We add new files, new stores, and new modules. Existing pages receive minimal, surgical updates.

---

## TABLE OF CONTENTS

1. [Phase 0 — Rebranding & Sport Module Tagging](#phase-0)
2. [Phase 1 — Business Model: Subscription System](#phase-1)
3. [Phase 2 — Booking Logic Hardening](#phase-2)
4. [Phase 3 — Tournament Rules Enforcement](#phase-3)
5. [Phase 4 — Academy Owner Restrictions](#phase-4)
6. [Phase 5 — Social Feed Module](#phase-5)
7. [Phase 6 — Smart Matchmaking](#phase-6)
8. [Phase 7 — UI/UX Premium Overhaul](#phase-7)
9. [Database Additions Summary](#database)
10. [New Files / Route Structure](#routes)
11. [Anti Race Condition Logic](#race-condition)
12. [Role Permission Matrix](#roles)
13. [Implementation Priority & Order](#priority)

---

<a name="phase-0"></a>
## Phase 0 — Rebranding & Sport Module Tagging

### 0.1 Rebrand Mal3abak → SPORTIFY

**Goal:** Update branding strings across the codebase without altering logic.

**Files to touch (surgical string replacements only):**

| File | Change |
|------|--------|
| `app.js` → `buildNavbar()` | `⚽ Mal3abak` → `⚽ SPORTIFY` |
| `app.js` → `buildFooter()` | `⚽ Mal3abak` → `⚽ SPORTIFY`, copyright text |
| All HTML `<title>` tags | `Mal3abak` → `SPORTIFY` |
| All HTML `<meta>` descriptions | `Mal3abak` → `SPORTIFY` |
| `README.md` | Full rebrand |
| `css/style.css` | Comment header update only |

**Safe approach:** Use find-and-replace restricted to display strings. No variable/key changes (localStorage keys like `mal3abak_users` stay — backward compatible).

### 0.2 Sport Module Tagging

**New file:** `js/sports-config.js`

```javascript
/* ============================================
   SPORTIFY — Sports Module Configuration
   Multi-sport architecture preparation
   ============================================ */

const SPORTS_MODULES = {
    football: {
        id: 'football',
        name: 'Football',
        icon: '⚽',
        color: '#10B981',
        active: true,
        features: [
            'pitch_booking', 'coach_booking', 'academy',
            'tournament', 'video_competition', 'social_feed',
            'matchmaking'
        ]
    }
    // Future: padel, basketball, etc.
};

const CURRENT_SPORT = 'football';

function getSportConfig(sportId = CURRENT_SPORT) {
    return SPORTS_MODULES[sportId] || SPORTS_MODULES.football;
}

function getSportIcon(sportId = CURRENT_SPORT) {
    return getSportConfig(sportId).icon;
}
```

**Integration:** Include this script in all HTML pages before `data.js`. This is **purely additive** — no existing code changes.

---

<a name="phase-1"></a>
## Phase 1 — Business Model: Subscription System

### 1.1 New Store & Data Model

**In `data.js`, ADD (do not modify existing code):**

```javascript
// ---- Subscription Store (SPORTIFY Business Model) ----
const SubscriptionsStore = createStore('sportify_subscriptions');

const SUBSCRIPTION_PLANS = {
    pitch_owner_basic: {
        id: 'pitch_owner_basic',
        name: 'Pitch Owner Basic',
        price: 200, // EGP
        currency: 'EGP',
        period: 'monthly',
        features: ['list_pitches', 'manage_bookings', 'create_tournaments'],
        maxPitches: 5,
        sportModule: 'football'
    },
    coach_basic: {
        id: 'coach_basic',
        name: 'Coach Basic',
        price: 200, // EGP
        currency: 'EGP',
        period: 'monthly',
        features: ['coaching_profile', 'accept_bookings', 'create_academy'],
        maxAcademies: 2,
        sportModule: 'football'
    },
    coach_premium: {
        id: 'coach_premium',
        name: 'Coach Premium',
        price: 500, // EGP
        currency: 'EGP',
        period: 'monthly',
        features: ['coaching_profile', 'accept_bookings', 'create_academy', 'unlimited_academies'],
        maxAcademies: 10,
        sportModule: 'football'
    }
};
```

**Subscription record shape:**
```javascript
{
    id: 'sub1',
    userId: 'u4',
    planId: 'pitch_owner_basic',
    status: 'active',        // active | expired | cancelled
    startDate: '2026-02-01',
    endDate: '2026-03-01',
    autoRenew: true,
    sportModule: 'football'
}
```

### 1.2 New Page: `subscription.html`

**Purpose:** Shows subscription status and allows Pitch Owners & Coaches to view/manage their plan.

**Access:** Only visible to `pitch_owner` and `coach` roles.

**UI Elements:**
- Current plan card with status badge
- Plan comparison grid (Basic vs Premium for coaches)
- Subscription history table
- "Contact admin to subscribe" CTA (no payment processing — MVP)

### 1.3 Subscription Check Logic

**New file:** `js/subscription.js`

```javascript
const SubscriptionManager = {
    getUserSubscription(userId) {
        return SubscriptionsStore.filter(s => s.userId === userId && s.status === 'active')[0] || null;
    },

    isSubscribed(userId) {
        return this.getUserSubscription(userId) !== null;
    },

    getMaxAcademies(userId) {
        const sub = this.getUserSubscription(userId);
        if (!sub) return 0;
        const plan = SUBSCRIPTION_PLANS[sub.planId];
        return plan ? plan.maxAcademies || 0 : 0;
    },

    canCreateAcademy(userId) {
        const max = this.getMaxAcademies(userId);
        const current = AcademiesStore.filter(a => a.coachUserId === userId).length;
        return current < max;
    }
};
```

### 1.4 Integration Points (Minimal Edits)

| Existing File | Change |
|---------------|--------|
| `academy-create.html` | Add subscription check before allowing creation |
| `coach-dashboard.html` | Show subscription status badge |
| `pitch-owner-dashboard.html` | Show subscription status badge |
| `profile.html` | Add subscription info section |
| `app.js` → `buildNavbar()` | Add "Subscription" link for owner/coach roles |

---

<a name="phase-2"></a>
## Phase 2 — Booking Logic Hardening

### 2.1 Anti-Duplicate Booking (Pitch Booking)

**In `booking.html`, MODIFY the `confirmBooking()` function:**

```javascript
function confirmBooking() {
    if (!Auth.isLoggedIn()) {
        showToast('Please log in to book', 'error');
        setTimeout(() => window.location.href = 'login.html', 1500);
        return;
    }

    const user = Auth.getCurrentUser();
    const date = document.getElementById('bookingDate').value;

    // ---- ANTI RACE CONDITION: Check for existing active booking ----
    const existingBooking = BookingsStore.filter(b =>
        b.playerId === user.id &&
        b.date === date &&
        b.timeSlot === selectedSlot &&
        (b.status === 'pending' || b.status === 'confirmed')
    );

    if (existingBooking.length > 0) {
        showToast('You already have a booking for this time slot!', 'error');
        return;
    }

    // ---- ANTI RACE CONDITION: Check pitch availability for this slot ----
    const slotConflict = BookingsStore.filter(b =>
        b.pitchId === pitch.id &&
        b.date === date &&
        b.timeSlot === selectedSlot &&
        b.status === 'confirmed'
    );

    if (slotConflict.length > 0) {
        showToast('This slot is already booked!', 'error');
        return;
    }

    // ---- ANTI RACE CONDITION: Locking flag ----
    if (window._bookingInProgress) return;
    window._bookingInProgress = true;

    BookingsStore.add({
        pitchId: pitch.id,
        playerId: user.id,
        date: date,
        timeSlot: selectedSlot,
        status: 'pending',
        totalPrice: pitch.pricePerHour,
        sportModule: 'football'
    });

    window._bookingInProgress = false;
    showToast('Booking request sent! The pitch owner will review it. ⚽', 'success');
    setTimeout(() => window.location.href = 'profile.html', 2000);
}
```

### 2.2 Admin Removed from Booking Flow

**Current state:** Admin does NOT confirm bookings — ✅ already correct.

The existing `pitch-owner-dashboard.html` shows bookings go directly to the pitch owner with accept/reject. This is already aligned with the spec.

### 2.3 Coach Booking: No Pitch Required

**Current state:** `coach-booking.html` already operates independently from pitch booking — ✅ already correct.

**Enhancement:** Add the same anti-duplicate protection to `coach-booking.html`:

```javascript
// Before creating coach booking:
const existing = CoachBookingsStore.filter(b =>
    b.playerId === user.id &&
    b.date === date &&
    b.timeSlot === selectedSlot &&
    (b.status === 'pending' || b.status === 'confirmed')
);
if (existing.length > 0) {
    showToast('You already have a booking for this time slot!', 'error');
    return;
}
```

### 2.4 Visual Slot Availability

**In `booking.html`, enhance time slot rendering:**

```javascript
// Mark booked slots visually
const bookedSlots = BookingsStore.filter(b =>
    b.pitchId === pitch.id &&
    b.date === document.getElementById('bookingDate').value &&
    b.status === 'confirmed'
).map(b => b.timeSlot);

document.getElementById('timeSlots').innerHTML = slots.map(s => {
    const isBooked = bookedSlots.includes(s);
    return `<div class="time-slot ${isBooked ? 'disabled' : ''}"
                onclick="${isBooked ? '' : `selectSlot(this,'${s}')`}"
                ${isBooked ? 'title="Already booked"' : ''}>
                ${s} ${isBooked ? '🔒' : ''}
            </div>`;
}).join('');
```

---

<a name="phase-3"></a>
## Phase 3 — Tournament Rules Enforcement

### 3.1 Only Pitch Owners Can Create Tournaments

**In `tournaments.html`, MODIFY:**

```javascript
// Replace the generic "+ Create Tournament" button with role-gated version:
const canCreate = Auth.isLoggedIn() && Auth.hasRole('pitch_owner');

// In the section header:
`${canCreate
    ? '<button class="btn btn-primary" onclick="toggleCreate()">+ Create Tournament</button>'
    : ''}`
```

**In `createTournament()` function, ADD check:**

```javascript
function createTournament(e) {
    e.preventDefault();
    if (!Auth.isLoggedIn()) { showToast('Please log in first', 'error'); return; }

    // ---- ROLE CHECK: Only pitch owners can create ----
    if (!Auth.hasRole('pitch_owner')) {
        showToast('Only Pitch Owners can create tournaments', 'error');
        return;
    }
    // ... rest unchanged
}
```

### 3.2 Player Can Join With ONE Team Only

**In `joinTournament()` function, ADD check:**

```javascript
function joinTournament(id) {
    if (!Auth.isLoggedIn()) { showToast('Please log in first', 'error'); return; }

    const user = Auth.getCurrentUser();

    // ---- ONE TEAM PER PLAYER PER TOURNAMENT ----
    const tournament = TournamentsStore.getById(id);
    if (tournament.playerTeams && tournament.playerTeams[user.id]) {
        showToast('You already joined this tournament!', 'error');
        return;
    }

    const teamName = prompt('Enter your team name:');
    if (!teamName) return;

    if (tournament.teams.length >= tournament.maxTeams) {
        showToast('Tournament is full', 'error'); return;
    }
    if (tournament.teams.includes(teamName)) {
        showToast('Team name taken', 'error'); return;
    }

    tournament.teams.push(teamName);
    const playerTeams = tournament.playerTeams || {};
    playerTeams[user.id] = teamName;
    TournamentsStore.update(id, { teams: tournament.teams, playerTeams });

    showToast(`"${teamName}" registered!`, 'success');
    renderTournaments();
}
```

---

<a name="phase-4"></a>
## Phase 4 — Academy Owner Restrictions

### 4.1 Academy Isolation (Cannot View Other Academies' Dashboard)

**Current state:** `academy-dashboard.html` already filters by `coachUserId === user.id` — ✅ already correct.

### 4.2 Maximum 2 Academies (Basic Plan)

**In `academy-create.html`, ADD check at the top of create logic:**

```javascript
// ---- ACADEMY LIMIT CHECK ----
const myAcademies = AcademiesStore.filter(a => a.coachUserId === user.id);
const maxAllowed = SubscriptionManager.getMaxAcademies(user.id) || 2; // Default 2

if (myAcademies.length >= maxAllowed) {
    showToast(`You've reached the maximum of ${maxAllowed} academies. Upgrade your subscription for more.`, 'error');
    return;
}
```

### 4.3 Academy Chat System (NEW)

**New file:** `js/chat.js`
**New page:** `academy-chat.html`

**Store:**
```javascript
const AcademyChatStore = createStore('sportify_academy_chat');
```

**Message shape:**
```javascript
{
    id: 'msg1',
    academyId: 'ac1',
    senderId: 'u5',
    senderName: 'Karim Benzema',
    senderRole: 'coach',     // 'coach' or 'player'
    message: 'Great training today everyone!',
    timestamp: '2026-02-24T14:00:00Z'
}
```

**Access control:** Only enrolled players + academy coach can access.

---

<a name="phase-5"></a>
## Phase 5 — Smart Sports Social Feed

### 5.1 New Page: `feed.html`

**New file:** `feed.html`
**New store in `data.js`:**

```javascript
// ---- Social Feed Stores ----
const FeedPostsStore = createStore('sportify_feed_posts');
const FeedLikesStore = createStore('sportify_feed_likes');
const FeedCommentsStore = createStore('sportify_feed_comments');
```

**Post shape:**
```javascript
{
    id: 'fp1',
    userId: 'u2',
    type: 'goal_video',       // goal_video | training_highlight | academy_achievement | tournament_moment
    title: 'Insane Bicycle Kick!',
    description: 'Match-winning goal in the Cairo Cup quarter-final',
    mediaUrl: '#',
    likes: 0,                 // Cached count (source of truth is FeedLikesStore)
    commentsCount: 0,
    location: 'Nasr City, Cairo',
    academyId: null,          // If from an academy
    tournamentId: null,       // If tournament-related
    tags: ['goal', 'bicycle-kick'],
    sportModule: 'football',
    createdAt: '2026-02-24T12:00:00Z'
}
```

### 5.2 Like-Once-Only + Anti Race Condition

```javascript
const FeedInteractions = {
    _likeLocks: new Set(), // In-memory lock set

    hasLiked(postId, userId) {
        return FeedLikesStore.filter(l =>
            l.postId === postId && l.userId === userId
        ).length > 0;
    },

    toggleLike(postId, userId) {
        // ---- ANTI RACE CONDITION: Prevent double-click ----
        const lockKey = `${postId}_${userId}`;
        if (this._likeLocks.has(lockKey)) return false;
        this._likeLocks.add(lockKey);

        try {
            if (this.hasLiked(postId, userId)) {
                // Unlike
                const like = FeedLikesStore.filter(l =>
                    l.postId === postId && l.userId === userId
                )[0];
                if (like) FeedLikesStore.delete(like.id);
                const post = FeedPostsStore.getById(postId);
                if (post) FeedPostsStore.update(postId, { likes: Math.max(0, post.likes - 1) });
                return false; // unliked
            } else {
                // Like
                FeedLikesStore.add({ postId, userId, createdAt: new Date().toISOString() });
                const post = FeedPostsStore.getById(postId);
                if (post) FeedPostsStore.update(postId, { likes: post.likes + 1 });
                return true; // liked
            }
        } finally {
            // Release lock after small delay (debounce)
            setTimeout(() => this._likeLocks.delete(lockKey), 500);
        }
    },

    addComment(postId, userId, userName, text) {
        FeedCommentsStore.add({
            postId, userId, userName, text,
            createdAt: new Date().toISOString()
        });
        const post = FeedPostsStore.getById(postId);
        if (post) FeedPostsStore.update(postId, { commentsCount: (post.commentsCount || 0) + 1 });
    }
};
```

### 5.3 Trending Algorithm

```javascript
function calculateTrendingScore(post) {
    const ageHours = (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);
    const decay = Math.pow(0.95, ageHours / 24); // Decay factor per day
    const engagement = (post.likes * 2) + (post.commentsCount * 3);
    return engagement * decay;
}
```

### 5.4 Filters

```
- Nearby    → Filter by post.location containing user's area
- Academy   → Filter by post.academyId !== null
- Popular   → Sort by likes descending
- Default   → Sort by trendingScore descending
```

### 5.5 Update Existing Competition Page

**In `competition.html`, MODIFY `likeVideo()` for like-once protection:**

```javascript
function likeVideo(id, btn) {
    if (!Auth.isLoggedIn()) { showToast('Log in to like', 'error'); return; }
    const user = Auth.getCurrentUser();

    // ---- LIKE ONCE ONLY ----
    const likedKey = 'sportify_video_likes';
    const liked = JSON.parse(localStorage.getItem(likedKey) || '{}');
    const key = `${id}_${user.id}`;

    if (liked[key]) {
        showToast('You already liked this video', 'info');
        return;
    }

    // ---- ANTI RACE CONDITION ----
    if (window._likingVideo) return;
    window._likingVideo = true;

    liked[key] = true;
    localStorage.setItem(likedKey, JSON.stringify(liked));

    const v = VideosStore.getById(id);
    VideosStore.update(id, { likes: v.likes + 1 });
    btn.classList.add('liked');
    btn.disabled = true;

    window._likingVideo = false;
    render();
}
```

---

<a name="phase-6"></a>
## Phase 6 — Smart Matchmaking

### 6.1 New Page: `matchmaking.html`

**New store:**
```javascript
const MatchRequestsStore = createStore('sportify_match_requests');
```

**Match Request shape:**
```javascript
{
    id: 'mr1',
    creatorId: 'u2',
    creatorName: 'Ahmed Hassan',
    location: 'Nasr City, Cairo',
    date: '2026-03-01',
    timeSlot: '18:00-19:00',
    skillLevel: 'intermediate',   // beginner | intermediate | advanced
    playersNeeded: 4,
    playersJoined: [
        { userId: 'u2', name: 'Ahmed Hassan' }
    ],
    maxPlayers: 10,               // Total including creator
    status: 'open',               // open | full | cancelled | completed
    pitchType: '5-a-side',
    notes: 'Looking for friendly match near Nasr City',
    sportModule: 'football',
    createdAt: '2026-02-24T14:00:00Z'
}
```

### 6.2 Matchmaking Logic

```javascript
const MatchmakingManager = {
    createRequest(data) {
        const user = Auth.getCurrentUser();
        if (!user) return null;

        return MatchRequestsStore.add({
            ...data,
            creatorId: user.id,
            creatorName: user.name,
            playersJoined: [{ userId: user.id, name: user.name }],
            status: 'open',
            sportModule: 'football',
            createdAt: new Date().toISOString()
        });
    },

    joinMatch(matchId) {
        const user = Auth.getCurrentUser();
        if (!user) return { success: false, message: 'Login required' };

        const match = MatchRequestsStore.getById(matchId);
        if (!match) return { success: false, message: 'Match not found' };

        // Already joined?
        if (match.playersJoined.some(p => p.userId === user.id)) {
            return { success: false, message: 'You already joined!' };
        }

        // Full?
        if (match.playersJoined.length >= match.maxPlayers) {
            return { success: false, message: 'Match is full' };
        }

        match.playersJoined.push({ userId: user.id, name: user.name });
        const newStatus = match.playersJoined.length >= match.maxPlayers ? 'full' : 'open';
        MatchRequestsStore.update(matchId, {
            playersJoined: match.playersJoined,
            status: newStatus
        });

        return { success: true };
    },

    filterNearby(location) {
        return MatchRequestsStore.filter(m =>
            m.status === 'open' &&
            m.location.toLowerCase().includes(location.toLowerCase())
        );
    },

    filterBySkill(level) {
        return MatchRequestsStore.filter(m =>
            m.status === 'open' && m.skillLevel === level
        );
    }
};
```

### 6.3 UI Layout

```
┌─────────────────────────────────────────────┐
│  🤝 Find Teammates                          │
│  ┌──────────────────────────────────┐       │
│  │ Filters: Location | Date | Skill │       │
│  └──────────────────────────────────┘       │
│                                              │
│  ┌─────────────────────┐ ┌──────────────┐   │
│  │ Match Request Card  │ │ Create Match │   │
│  │ Location: Nasr City │ │              │   │
│  │ Time: 18:00–19:00   │ │ [Form]       │   │
│  │ Skill: Intermediate │ │              │   │
│  │ 3/10 players joined │ │              │   │
│  │ [Join Match]        │ │              │   │
│  └─────────────────────┘ └──────────────┘   │
└─────────────────────────────────────────────┘
```

---

<a name="phase-7"></a>
## Phase 7 — UI/UX Premium Overhaul

### 7.1 CSS Additions (Append to `style.css`)

**NO existing CSS is modified. Only additions.**

```css
/* ============================================
   SPORTIFY — Sports Design Extensions
   Athletic Modern Theme
   ============================================ */

/* -- Sports Accent Colors -- */
:root {
    --sport-football: #10B981;
    --sport-gradient: linear-gradient(135deg, #6366F1 0%, #10B981 50%, #F59E0B 100%);
    --glass-bg: rgba(26, 32, 53, 0.85);
    --glass-border: rgba(255, 255, 255, 0.08);
}

/* -- Hero Sports Identity -- */
.hero-sports {
    position: relative;
    overflow: hidden;
    background: radial-gradient(ellipse at 30% 50%, rgba(99, 102, 241, 0.15) 0%, transparent 60%),
                radial-gradient(ellipse at 70% 80%, rgba(16, 185, 129, 0.1) 0%, transparent 50%);
}

.hero-sports::before {
    content: '';
    position: absolute;
    inset: 0;
    background: url("data:image/svg+xml,..."); /* Football pattern */
    opacity: 0.03;
    pointer-events: none;
}

/* -- Service Blocks (Home) -- */
.service-block {
    text-align: center;
    padding: var(--s-8) var(--s-6);
    border-radius: var(--r-xl);
    background: var(--glass-bg);
    backdrop-filter: blur(12px);
    border: 1px solid var(--glass-border);
    transition: all var(--t-base);
    cursor: pointer;
}

.service-block:hover {
    transform: translateY(-4px);
    border-color: var(--primary-border);
    box-shadow: 0 12px 40px rgba(99, 102, 241, 0.15);
}

.service-block .service-icon {
    width: 64px;
    height: 64px;
    border-radius: var(--r-lg);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 1.8rem;
    margin-bottom: var(--s-4);
}

/* -- Coach Profile Sports Theme -- */
.coach-profile-card {
    position: relative;
    overflow: hidden;
    border-radius: var(--r-xl);
}

.coach-profile-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 120px;
    background: linear-gradient(135deg, var(--primary), var(--accent));
    opacity: 0.15;
}

/* -- Rating Display -- */
.rating-display {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: var(--r-full);
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning);
    font-weight: 700;
    font-size: 0.85rem;
}

/* -- Photo Gallery Grid -- */
.photo-gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: var(--s-2);
    border-radius: var(--r-md);
    overflow: hidden;
}

.photo-gallery img {
    width: 100%;
    height: 120px;
    object-fit: cover;
    border-radius: var(--r-sm);
    transition: transform var(--t-base);
    cursor: pointer;
}

.photo-gallery img:hover {
    transform: scale(1.05);
}

/* -- Feed Card -- */
.feed-card {
    border-radius: var(--r-xl);
    overflow: hidden;
    transition: all var(--t-base);
}

.feed-card:hover {
    border-color: var(--primary-border);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.feed-card-media {
    width: 100%;
    height: 240px;
    background: var(--bg-elevated);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
}

.feed-card-actions {
    display: flex;
    gap: var(--s-4);
    padding: var(--s-3) 0;
    border-top: 1px solid var(--border);
    margin-top: var(--s-3);
}

.feed-action-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: var(--text-faint);
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 500;
    padding: 4px 8px;
    border-radius: var(--r-sm);
    transition: all var(--t-fast);
}

.feed-action-btn:hover {
    color: var(--text-h);
    background: var(--bg-elevated);
}

.feed-action-btn.liked {
    color: var(--danger);
}

/* -- Matchmaking Card -- */
.match-card {
    border-left: 3px solid var(--accent);
}

.match-card .players-bar {
    display: flex;
    gap: -4px;
    margin-top: var(--s-3);
}

.match-card .player-dot {
    width: 28px;
    height: 28px;
    border-radius: var(--r-full);
    background: var(--primary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.65rem;
    color: white;
    font-weight: 700;
    border: 2px solid var(--bg-card);
    margin-left: -6px;
}

.match-card .player-dot:first-child {
    margin-left: 0;
}

/* -- Skill Level Badge -- */
.skill-beginner { background: var(--accent-subtle); color: var(--accent); }
.skill-intermediate { background: var(--info-subtle); color: var(--info); }
.skill-advanced { background: var(--warning-subtle); color: var(--warning); }

/* -- Filter Pills -- */
.filter-pills {
    display: flex;
    gap: var(--s-2);
    flex-wrap: wrap;
    margin-bottom: var(--s-6);
}

.filter-pill {
    padding: 6px 16px;
    border-radius: var(--r-full);
    border: 1px solid var(--border-strong);
    background: var(--bg-surface);
    color: var(--text-faint);
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--t-fast);
}

.filter-pill:hover {
    border-color: var(--primary-border);
    color: var(--text-p);
}

.filter-pill.active {
    background: var(--primary-subtle);
    border-color: var(--primary);
    color: var(--primary);
}

/* -- Subscription Card -- */
.sub-card {
    position: relative;
    border-radius: var(--r-xl);
    padding: var(--s-8);
    text-align: center;
}

.sub-card.recommended {
    border-color: var(--primary);
    box-shadow: 0 0 0 1px var(--primary), 0 8px 32px rgba(99, 102, 241, 0.15);
}

.sub-card .sub-price {
    font-size: 2rem;
    font-weight: 800;
    color: var(--text-h);
    margin: var(--s-4) 0;
}

.sub-card .sub-price span {
    font-size: 0.85rem;
    font-weight: 400;
    color: var(--text-faint);
}
```

### 7.2 Home Page Update (`index.html`)

Replace the features section with **clear service blocks:**

```
┌──────────────────────────────────────────────────────┐
│              ⚽ SPORTIFY                              │
│     Your Digital Sports Community                     │
│                                                      │
│  [Browse Pitches]  [Create Account]                  │
│                                                      │
│  50+ Pitches · 1,200 Players · 15 Coaches · 30+ ..  │
└──────────────────────────────────────────────────────┘

┌────────┐ ┌────────┐ ┌──────────┐ ┌────────────┐ ┌──────────┐
│ ⚽      │ │ 🧑‍🏫    │ │ 🎓       │ │ 🏆          │ │ 📱       │
│ Play   │ │ Train  │ │Academies │ │ Tournaments│ │ Social   │
│Football│ │  ing   │ │          │ │            │ │  Feed    │
└────────┘ └────────┘ └──────────┘ └────────────┘ └──────────┘
```

### 7.3 Navbar Update

Add new nav links for Social Feed and Matchmaking:

```javascript
// In app.js buildNavbar(), add to navLinks array:
{ href: 'feed.html', label: 'Feed', page: 'feed' },
{ href: 'matchmaking.html', label: 'Find Players', page: 'matchmaking' },
```

---

<a name="database"></a>
## Database Additions Summary

### New Stores (Added to `data.js`)

| Store | Key | Purpose |
|-------|-----|---------|
| `SubscriptionsStore` | `sportify_subscriptions` | Platform subscriptions |
| `FeedPostsStore` | `sportify_feed_posts` | Social feed posts |
| `FeedLikesStore` | `sportify_feed_likes` | Like tracking (1 per user) |
| `FeedCommentsStore` | `sportify_feed_comments` | Post comments |
| `AcademyChatStore` | `sportify_academy_chat` | Academy internal chat |
| `MatchRequestsStore` | `sportify_match_requests` | Matchmaking requests |

### Existing Store Modifications

| Store | Field Added | Purpose |
|-------|-------------|---------|
| `BookingsStore` | `sportModule: 'football'` | Sport tagging |
| `TournamentsStore` | `playerTeams: {}` | Track which player joined with which team |
| `VideosStore` | (none — use separate `sportify_video_likes` key) | Like-once tracking |

---

<a name="routes"></a>
## New Files / Route Structure

### New HTML Pages

| File | Purpose | Access |
|------|---------|--------|
| `feed.html` | Smart Social Feed | All users |
| `matchmaking.html` | Smart Matchmaking | Players (logged in) |
| `subscription.html` | Subscription management | Pitch Owner, Coach |
| `academy-chat.html` | Academy internal chat | Enrolled players + Coach |

### New JS Modules

| File | Purpose |
|------|---------|
| `js/sports-config.js` | Sport module configuration |
| `js/subscription.js` | Subscription management logic |
| `js/feed.js` | Social feed interactions (like, comment, trending) |
| `js/matchmaking.js` | Matchmaking logic |
| `js/chat.js` | Academy chat logic |
| `js/race-guard.js` | Centralized anti-race-condition utilities |

### Script Include Order (All Pages)

```html
<script src="js/sports-config.js"></script>
<script src="js/data.js"></script>
<script src="js/roles.js"></script>
<script src="js/auth.js"></script>
<script src="js/subscription.js"></script>
<script src="js/race-guard.js"></script>
<script src="js/app.js"></script>
<!-- Page-specific modules as needed -->
```

### Updated Route Map

```
SPORTIFY Route Map
==================

PUBLIC (No Login):
  /index.html           — Home (Sports Landing)
  /pitches.html         — Browse Pitches
  /coaches.html         — Find Coaches
  /academies.html       — Browse Academies
  /tournaments.html     — View Tournaments
  /feed.html            — Social Feed (read-only)
  /login.html           — Login
  /register.html        — Register

PLAYER (Logged In):
  /booking.html         — Book Pitch
  /coach-booking.html   — Book Coach Training
  /matchmaking.html     — Find Teammates
  /competition.html     — Video Competition
  /feed.html            — Social Feed (interact)
  /profile.html         — Player Profile

PITCH OWNER:
  /pitch-owner-dashboard.html  — Manage Pitches & Bookings
  /subscription.html           — Manage Subscription
  /tournaments.html            — Create Tournaments

COACH / ACADEMY OWNER:
  /coach-dashboard.html        — Coaching Profile & Sessions
  /academy-dashboard.html      — Academy Management
  /academy-create.html         — Create Academy
  /academy-chat.html           — Chat with Students
  /subscription.html           — Manage Subscription

ADMIN:
  /admin.html                  — Admin Panel
```

---

<a name="race-condition"></a>
## Anti Race Condition Logic

### Centralized Guard (`js/race-guard.js`)

```javascript
/* ============================================
   SPORTIFY — Race Condition Guards
   Centralized locking & debounce utilities
   ============================================ */

const RaceGuard = {
    _locks: new Set(),
    _debounceTimers: {},

    /**
     * Acquire a lock. Returns true if acquired, false if already locked.
     * Auto-releases after timeoutMs.
     */
    acquire(key, timeoutMs = 2000) {
        if (this._locks.has(key)) return false;
        this._locks.add(key);
        setTimeout(() => this._locks.delete(key), timeoutMs);
        return true;
    },

    /**
     * Release a lock explicitly.
     */
    release(key) {
        this._locks.delete(key);
    },

    /**
     * Check if a lock is held.
     */
    isLocked(key) {
        return this._locks.has(key);
    },

    /**
     * Debounced action — only executes after delay if no new calls.
     */
    debounce(key, fn, delayMs = 300) {
        clearTimeout(this._debounceTimers[key]);
        this._debounceTimers[key] = setTimeout(fn, delayMs);
    },

    /**
     * One-time action guard — prevents repeat within cooldown.
     * Used for: like buttons, booking submissions, join actions.
     */
    oneTimeAction(key, fn, cooldownMs = 1000) {
        if (!this.acquire(key, cooldownMs)) {
            return false;
        }
        try {
            fn();
            return true;
        } catch (e) {
            this.release(key);
            throw e;
        }
    }
};
```

### Where Applied

| Feature | Lock Key Pattern | Protection |
|---------|-----------------|------------|
| Pitch Booking | `book_${pitchId}_${userId}_${date}_${slot}` | Prevent duplicate booking submission |
| Coach Booking | `coach_book_${coachId}_${userId}_${date}_${slot}` | Prevent duplicate coach booking |
| Video Like | `like_video_${videoId}_${userId}` | Like once only + prevent rapid clicks |
| Feed Like | `like_feed_${postId}_${userId}` | Like once only + prevent rapid clicks |
| Tournament Join | `join_${tournamentId}_${userId}` | One team per player |
| Matchmaking Join | `match_join_${matchId}_${userId}` | Prevent double-joining |
| Feed Comment | `comment_${postId}_${userId}` | Debounce rapid comments |

---

<a name="roles"></a>
## Role Permission Matrix

### Complete SPORTIFY Permission Matrix

| Action | Player | Pitch Owner | Coach | Admin |
|--------|--------|-------------|-------|-------|
| **Pitch Booking** |
| Browse pitches | ✅ | ✅ | ✅ | ✅ |
| Send booking request | ✅ | ❌ | ❌ | ❌ |
| Confirm/reject booking | ❌ | ✅ (own pitches) | ❌ | ✅ |
| **Pitch Management** |
| Add/edit/delete pitch | ❌ | ✅ | ❌ | ✅ |
| Toggle availability | ❌ | ✅ | ❌ | ✅ |
| **Coach / Training** |
| Book coach session | ✅ | ❌ | ❌ | ❌ |
| Accept training request | ❌ | ❌ | ✅ | ✅ |
| Edit coach profile | ❌ | ❌ | ✅ | ✅ |
| **Academy** |
| Browse academies | ✅ | ✅ | ✅ | ✅ |
| Enroll in academy | ✅ | ❌ | ❌ | ❌ |
| Create academy | ❌ | ❌ | ✅ (max 2, or ∞ premium) | ✅ |
| Manage academy | ❌ | ❌ | ✅ (own only) | ✅ |
| Academy chat | ✅ (enrolled) | ❌ | ✅ (own academy) | ✅ |
| Award points | ❌ | ❌ | ✅ (own academy) | ✅ |
| **Tournaments** |
| View tournaments | ✅ | ✅ | ✅ | ✅ |
| Create tournament | ❌ | ✅ | ❌ | ✅ |
| Join tournament | ✅ (1 team only) | ❌ | ❌ | ❌ |
| Internal academy tournament | ❌ | ❌ | ✅ (own academy) | ✅ |
| **Social Feed** |
| View feed | ✅ | ✅ | ✅ | ✅ |
| Create post | ✅ | ✅ | ✅ | ✅ |
| Like post (once) | ✅ | ✅ | ✅ | ✅ |
| Comment | ✅ | ✅ | ✅ | ✅ |
| **Video Competition** |
| Upload video | ✅ | ✅ | ✅ | ✅ |
| Like video (once) | ✅ | ✅ | ✅ | ✅ |
| **Matchmaking** |
| Create match request | ✅ | ❌ | ❌ | ❌ |
| Join match | ✅ | ❌ | ❌ | ❌ |
| **Subscription** |
| View subscription | ❌ | ✅ | ✅ | ✅ |
| Players pay | ❌ (FREE) | — | — | — |
| **Admin** |
| User management | ❌ | ❌ | ❌ | ✅ |
| Content moderation | ❌ | ❌ | ❌ | ✅ |
| View all data | ❌ | ❌ | ❌ | ✅ |

### Permission Updates for `roles.js`

Add to the PERMISSIONS object:

```javascript
const PERMISSIONS = {
    player: [
        'book_pitch', 'book_coach', 'join_tournament', 'join_match',
        'create_match_request', 'upload_video', 'view_pitches',
        'view_academies', 'enroll_academy', 'rate_academy',
        'view_profile', 'view_feed', 'create_feed_post',
        'like_feed', 'comment_feed'
    ],
    pitch_owner: [
        'manage_pitches', 'manage_bookings', 'create_tournament',
        'view_pitches', 'view_profile', 'manage_subscription',
        'view_feed', 'create_feed_post', 'like_feed', 'comment_feed'
    ],
    coach: [
        'manage_coaching', 'manage_bookings', 'view_pitches',
        'view_profile', 'manage_subscription',
        'view_feed', 'create_feed_post', 'like_feed', 'comment_feed'
    ],
    admin: ['*'] // All permissions
};
```

---

<a name="priority"></a>
## Implementation Priority & Order

### Recommended Implementation Sequence

| Priority | Phase | Effort | Description |
|----------|-------|--------|-------------|
| 🔴 P0 | Phase 0 | 1 hour | Rebranding + sport tagging (foundational) |
| 🔴 P0 | Phase 2 | 2 hours | Booking hardening + anti-race-condition (critical fix) |
| 🟠 P1 | Phase 3 | 1 hour | Tournament rules (business rule enforcement) |
| 🟠 P1 | Phase 4 | 1.5 hours | Academy restrictions (business rules) |
| 🟡 P2 | Phase 1 | 3 hours | Subscription system (business model) |
| 🟡 P2 | Phase 5 | 4 hours | Social Feed (major new feature) |
| 🟢 P3 | Phase 6 | 3 hours | Smart Matchmaking (new feature) |
| 🟢 P3 | Phase 7 | 3 hours | UI/UX Premium Overhaul (polish) |

### Total Estimated Effort: ~18.5 hours

---

## ⚠️ Safety Checklist

Before each phase:
- [ ] All changes are **additive** (new files, new functions, new CSS)
- [ ] No existing localStorage keys are renamed
- [ ] No existing function signatures are changed
- [ ] New script includes are appended **before** existing scripts where needed
- [ ] Seed data upgrades use safe "if missing" patterns
- [ ] Mobile responsiveness tested
- [ ] All new pages include full script stack

---

## 🎯 Summary

This plan transforms **Mal3abak** into **SPORTIFY** through **8 incremental phases**, adding:
- **6 new localStorage stores** (no schema migrations needed)
- **4 new HTML pages** (feed, matchmaking, subscription, academy-chat)
- **5 new JS modules** (sports-config, subscription, feed, matchmaking, race-guard, chat)
- **Premium UI extensions** (CSS-only additions)
- **Comprehensive anti-race-condition protection**
- **Role-based access enforcement** across all features

All without touching the existing working core logic. 🚀
