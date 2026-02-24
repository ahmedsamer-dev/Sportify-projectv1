# ⚽ SPORTIFY — Digital Sports Community Platform

## Project Overview

**SPORTIFY** (formerly Mal3abak) is a web-based digital sports community platform that connects **Players**, **Pitch Owners**, **Coaches**, and **Admins**. It provides football pitch booking, coach training sessions, academies, social feed, smart matchmaking, weekly goal competitions, and tournament management.

> **🎓 Project — MVP Version**
> **🏈 Multi-Sport Ready** — Currently running the Football module, architectured for Padel, Basketball, etc.

---

## 🗂️ Project Structure

```
mal3abak/
├── index.html                # Landing / Home page (SPORTIFY branded)
├── login.html                # Login page
├── register.html             # Registration page
├── pitches.html              # Browse available pitches
├── booking.html              # Book a pitch (hardened with race guards)
├── coaches.html              # Browse coaches
├── coach-booking.html        # Book a training session
├── coach-dashboard.html      # Coach dashboard (sessions, profile)
├── pitch-owner-dashboard.html# Pitch owner dashboard
├── profile.html              # User profile (role-specific)
├── tournaments.html          # View & create tournaments (role-enforced)
├── competition.html          # Weekly goal competition (like-once)
├── academies.html            # Browse academies
├── academy-create.html       # Create academy (coaches only)
├── academy-dashboard.html    # Academy management dashboard
├── academy-chat.html         # ★ NEW: Internal academy chat
├── feed.html                 # ★ NEW: Social feed (trending, filters)
├── matchmaking.html          # ★ NEW: Smart matchmaking
├── subscription.html         # ★ NEW: Subscription management
├── admin.html                # Admin dashboard (with reset demo data)
│
├── css/
│   └── style.css             # Complete design system & styles
│
├── js/
│   ├── data.js               # Data models, mock data, localStorage helpers
│   ├── auth.js               # Authentication & session management
│   ├── roles.js              # Role & permission system (RBAC)
│   ├── app.js                # Navigation, toasts, helpers
│   ├── sports-config.js      # ★ NEW: Multi-sport module architecture
│   ├── race-guard.js         # ★ NEW: Anti-race-condition utilities
│   ├── subscription.js       # ★ NEW: Business model & subscription manager
│   ├── feed.js               # ★ NEW: Social feed interactions
│   ├── matchmaking.js        # ★ NEW: Smart matchmaking manager
│   └── chat.js               # ★ NEW: Academy internal chat
│
└── README.md
```

---

## 👥 User Roles & Permissions

| Role | Key Permissions |
|------|----------------|
| **Player** (FREE) | Book pitches, book coaches, join tournaments, join matches, post on feed, like & comment, enroll in academies |
| **Pitch Owner** (Subscription) | All player perms + create pitches, manage bookings, create tournaments, manage subscription |
| **Coach** (Subscription) | All player perms + create training sessions, manage academies, academy chat, manage subscription |
| **Admin** | All permissions + user management, content moderation, reset demo data |

---

## 🏗️ Architecture Highlights

### Multi-Sport Design
- `sports-config.js` defines sport modules (currently Football only)
- All new records include `sportModule: 'football'` for future filtering
- Ready to add Padel, Basketball, etc. without breaking existing data

### Race Condition Prevention
- `RaceGuard` module provides centralized protection:
  - **Lock/Unlock** — prevents concurrent submissions (booking, matchmaking)
  - **Debounce** — rate-limits rapid clicks
  - **One-time actions** — persistent like-once tracking via localStorage
  - **Action tracking** — prevents duplicate actions in same session

### Business Model
- **Players**: Completely FREE — no subscription needed
- **Pitch Owners**: 200 EGP/month (Basic) — list pitches, manage bookings
- **Coaches**: 200 EGP/month (Basic), 500 EGP/month (Premium) — training + academies
- Revenue from platform subscriptions only (SPORTIFY as connector)

### Data Layer
- All data persisted in `localStorage` using the `createStore()` factory pattern
- Safe upgrade mechanism: new stores seed without affecting existing data
- Consistent CRUD API across all 12+ stores

---

## ✨ New Features (SPORTIFY Expansion)

### 📱 Social Feed (`feed.html`)
- Create posts (goal videos, training highlights, academy achievements, tournament moments)
- Like-once protection with race condition guards
- Comment system
- Trending algorithm (engagement × time decay)
- Filter: Trending, Popular, Academy, Nearby

### 🤝 Smart Matchmaking (`matchmaking.html`)
- Create match requests with location, time, skill level
- Join open matches (with race condition protection)
- Visual player dots and progress bar
- Filter by skill level (Beginner, Intermediate, Advanced)

### 💬 Academy Chat (`academy-chat.html`)
- Internal messaging between coach and enrolled players
- Access control (only academy members)
- Academy switching for multi-academy users
- Unread count tracking

### 💳 Subscription Management (`subscription.html`)
- Plan comparison cards
- Instant activation (MVP, no payment gateway)
- Status tracking and auto-renewal controls

---

## 🔒 Security Notes

> ⚠️ **MVP Limitations**:
> - Passwords are stored in **plain text** (in production: use bcrypt + server-side auth)
> - Cross-tab localStorage writes are **unprotected** (known MVP limitation)
> - No HTTPS enforcement (client-side only)

---

## 🛠️ Technology Stack

| Technology | Usage |
|------------|-------|
| HTML5 | Structure & semantic markup |
| CSS3 | Design system with custom properties |
| Vanilla JavaScript | All logic, state management, CRUD |
| localStorage | Client-side data persistence |
| No frameworks | Zero dependencies, fully portable |

---

## 🚀 Getting Started

1. Download or clone the project
2. Open `index.html` in any modern browser
3. Demo data auto-seeds on first load

### Demo Accounts
| Email | Password | Role |
|-------|----------|------|
| admin@sportify.com | admin123 | Admin |
| ahmed@mail.com | pass123 | Player |
| sara@mail.com | pass123 | Player |
| moh@pitch.com | pass123 | Pitch Owner |
| karim@coach.com | pass123 | Coach |
| omar@pitch.com | pass123 | Pitch Owner |
| youssef@coach.com | pass123 | Coach |

### Reset Demo Data
Log in as Admin → Admin Panel → Click "🔄 Reset Demo Data"

---

## 📊 Database Stores

| Store Key | Purpose |
|-----------|---------|
| `mal3abak_users` | User accounts |
| `mal3abak_pitches` | Football pitches |
| `mal3abak_bookings` | Pitch bookings |
| `mal3abak_coaches` | Coach profiles |
| `mal3abak_videos` | Competition videos |
| `mal3abak_tournaments` | Tournament data |
| `mal3abak_academies` | Academy profiles |
| `mal3abak_enrollments` | Academy enrollments |
| `mal3abak_academy_ratings` | Academy reviews |
| `mal3abak_academy_points` | Academy points/levels |
| `mal3abak_coach_bookings` | Coach session bookings |
| `sportify_subscriptions` | ★ Platform subscriptions |
| `sportify_feed_posts` | ★ Social feed posts |
| `sportify_feed_comments` | ★ Feed comments |
| `sportify_academy_chat` | ★ Academy chat messages |
| `sportify_match_requests` | ★ Matchmaking requests |
| `sportify_feed_likes_map` | ★ Like-once tracking (feed) |
| `sportify_video_likes` | ★ Like-once tracking (competition) |

---

> © 2026 SPORTIFY · Academic Graduation Project
