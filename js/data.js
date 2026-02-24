/* ============================================
   SPORTIFY — Data Layer
   Models, Mock Data & localStorage Helpers
   (Football Module — Multi-sport ready)
   ============================================ */

// ---- Storage Helpers ----
const DB = {
    get(key) { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } },
    set(key, data) { localStorage.setItem(key, JSON.stringify(data)); },
    getOne(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
    setOne(key, val) { localStorage.setItem(key, JSON.stringify(val)); },
    remove(key) { localStorage.removeItem(key); },
    generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }
};

// ---- CRUD Factory ----
function createStore(collectionKey) {
    return {
        getAll() { return DB.get(collectionKey); },
        getById(id) { return this.getAll().find(item => item.id === id) || null; },
        add(item) { const all = this.getAll(); item.id = item.id || DB.generateId(); all.push(item); DB.set(collectionKey, all); return item; },
        update(id, updates) {
            const all = this.getAll();
            const idx = all.findIndex(i => i.id === id);
            if (idx === -1) return null;
            all[idx] = { ...all[idx], ...updates };
            DB.set(collectionKey, all);
            return all[idx];
        },
        delete(id) { const all = this.getAll().filter(i => i.id !== id); DB.set(collectionKey, all); },
        filter(fn) { return this.getAll().filter(fn); },
        count() { return this.getAll().length; }
    };
}

// ---- Stores ----
const UsersStore = createStore('mal3abak_users');
const PitchesStore = createStore('mal3abak_pitches');
const BookingsStore = createStore('mal3abak_bookings');
const CoachesStore = createStore('mal3abak_coaches');
const VideosStore = createStore('mal3abak_videos');
const TournamentsStore = createStore('mal3abak_tournaments');

// ---- Academy Stores (NEW — Coach Academy System) ----
const AcademiesStore = createStore('mal3abak_academies');
const EnrollmentsStore = createStore('mal3abak_enrollments');
const AcademyRatingsStore = createStore('mal3abak_academy_ratings');
const AcademyPointsStore = createStore('mal3abak_academy_points');

// ---- Coach Booking Store (Independent from Pitch Booking) ----
// ---- SPORTIFY Extension Stores ----
const SubscriptionsStore = createStore('sportify_subscriptions');
const FeedPostsStore = createStore('sportify_feed_posts');
const FeedCommentsStore = createStore('sportify_feed_comments');
const FeedReactionsStore = createStore('sportify_feed_reactions');
const AcademyChatStore = createStore('sportify_academy_chat');
const MatchRequestsStore = createStore('sportify_match_requests');
const TournamentMatchesStore = createStore('sportify_tournament_matches');

// ---- Multi-Sport Profile Stores (NEW) ----
const SportProfilesStore = createStore('sportify_sport_profiles');
const PlayerRatingsStore = createStore('sportify_player_ratings');

const CoachBookingsStore = createStore('mal3abak_coach_bookings');

// ---- Academy Rating Helper ----
function getAcademyRating(academyId) {
    const ratings = AcademyRatingsStore.filter(r => r.academyId === academyId);
    if (ratings.length === 0) return { avg: 0, count: 0, ratings: [] };
    const avg = Math.round((ratings.reduce((s, r) => s + r.rating, 0) / ratings.length) * 10) / 10;
    return { avg, count: ratings.length, ratings };
}

// ---- Academy Points & Levels System ----
const ACADEMY_POINTS = {
    ATTENDANCE: 10,
    PROGRAM_COMPLETE: 50,
    COMPETITION_WIN: 30
};

const ACADEMY_LEVELS = [
    { name: 'Rookie', icon: '🥉', min: 0, color: '#94a3b8' },
    { name: 'Rising Star', icon: '⭐', min: 50, color: '#f59e0b' },
    { name: 'Skilled', icon: '🔥', min: 150, color: '#f97316' },
    { name: 'Elite', icon: '💎', min: 300, color: '#8b5cf6' },
    { name: 'Legend', icon: '👑', min: 500, color: '#eab308' }
];

function getPlayerAcademyLevel(academyId, playerId) {
    const record = AcademyPointsStore.filter(r => r.academyId === academyId && r.playerId === playerId)[0];
    const points = record ? record.points : 0;
    let level = ACADEMY_LEVELS[0];
    let nextLevel = ACADEMY_LEVELS[1];
    for (let i = ACADEMY_LEVELS.length - 1; i >= 0; i--) {
        if (points >= ACADEMY_LEVELS[i].min) { level = ACADEMY_LEVELS[i]; nextLevel = ACADEMY_LEVELS[i + 1] || null; break; }
    }
    const progress = nextLevel ? Math.min(100, Math.round(((points - level.min) / (nextLevel.min - level.min)) * 100)) : 100;
    return { points, level, nextLevel, progress, record };
}

function awardAcademyPoints(academyId, playerId, playerName, type, customNote) {
    const pts = ACADEMY_POINTS[type] || 0;
    if (pts === 0) return null;
    const notes = { ATTENDANCE: 'Session attended', PROGRAM_COMPLETE: 'Program completed', COMPETITION_WIN: 'Won internal competition' };
    let record = AcademyPointsStore.filter(r => r.academyId === academyId && r.playerId === playerId)[0];
    const entry = { type, points: pts, date: new Date().toISOString().split('T')[0], note: customNote || notes[type] };
    if (record) {
        const history = record.history || [];
        history.push(entry);
        AcademyPointsStore.update(record.id, { points: record.points + pts, history });
    } else {
        AcademyPointsStore.add({ academyId, playerId, playerName, points: pts, history: [entry] });
    }
    return pts;
}

// ---- Ranking & Match Results System (NEW) ----
// This manager handles automatic stat propagation to prevent manual manipulation.
const RankingManager = {
    /** 
     * Applies match results to player profiles. 
     * Prevents double-processing via the 'processed' flag.
     */
    processMatchResult(matchId, result, type = 'tournament') {
        const store = type === 'tournament' ? TournamentMatchesStore : MatchRequestsStore;
        const match = store.getById(matchId);
        if (!match || (type === 'tournament' && match.processed)) return false;

        // For open matches, we check status
        if (type === 'open' && match.resultStatus !== 'confirmed') return false;

        // Extract all players and scorers
        const scorers = [...(result.team1.scorers || []), ...(result.team2.scorers || [])];
        const allPlayerIds = result.allPlayerIds || []; // For open matches

        // If tournament, extract players from team names if not provided
        // In this MVP, we assume result object carries the necessary player IDs

        allPlayerIds.forEach(pid => {
            const goals = scorers.filter(id => id === pid).length;
            this.updatePlayerStats(pid, goals, 1);
        });

        if (type === 'tournament') {
            TournamentMatchesStore.update(matchId, { processed: true });
        }
        return true;
    },

    updatePlayerStats(userId, goals, matches) {
        let profile = SportProfilesStore.filter(p => p.userId === userId && p.sportId === 'football')[0];
        if (!profile) {
            // Create profile if missing
            profile = SportProfilesStore.add({
                userId, sportId: 'football',
                goals: 0, assists: 0, matchesPlayed: 0, rating: 3.0,
                ratingHistory: []
            });
        }

        const newGoals = (profile.goals || 0) + goals;
        const newMatches = (profile.matchesPlayed || 0) + matches;

        // Dynamic rating adjustment based on performance
        const oldRating = profile.rating || 3.0;
        let change = 0.05; // Base participation
        if (goals > 0) change += (goals * 0.05); // Performance bonus

        const newRating = Math.min(5.0, Math.round((oldRating + change) * 100) / 100);

        SportProfilesStore.update(profile.id, {
            goals: newGoals,
            matchesPlayed: newMatches,
            rating: newRating,
            ratingHistory: [
                ...(profile.ratingHistory || []),
                { type: 'MATCH_RESULT', change, oldRating, newRating, timestamp: new Date().toISOString() }
            ]
        });
    }
};

// ---- Mock / Seed Data ----
// ⚠️ MVP: Passwords are stored in plain text. In production, use bcrypt hashing + server-side auth.
const SEED_DATA = {
    users: [
        { id: 'u_admin', name: 'Global Admin', email: 'admin@sportify.com', password: '123456', role: 'admin', roles: ['admin'], phone: '+20 100 000 0001', avatar: '', createdAt: '2026-01-01' },
        { id: 'u_player', name: 'Demo Player', email: 'player@sportify.com', password: '123456', role: 'player', roles: ['player'], phone: '+20 100 000 0002', avatar: '', createdAt: '2026-01-05' },
        { id: 'u_owner', name: 'Demo Owner', email: 'owner@sportify.com', password: '123456', role: 'pitch_owner', roles: ['pitch_owner'], phone: '+20 100 000 0004', avatar: '', createdAt: '2026-01-10' },
        { id: 'u_coach', name: 'Demo Coach', email: 'coach@sportify.com', password: '123456', role: 'coach', roles: ['coach'], phone: '+20 100 000 0005', avatar: '', createdAt: '2026-01-12' },
        { id: 'u1', name: 'Admin', email: 'admin@admin.com', password: 'admin123', role: 'admin', roles: ['admin'], phone: '+20 100 000 0001', avatar: '', createdAt: '2026-01-01' },
        { id: 'u2', name: 'Ahmed Hassan', email: 'ahmed@mail.com', password: 'pass123', role: 'player', roles: ['player'], phone: '+20 100 000 0002', avatar: '', createdAt: '2026-01-05' },
        { id: 'u3', name: 'Sara El-Masry', email: 'sara@mail.com', password: 'pass123', role: 'player', roles: ['player'], phone: '+20 100 000 0003', avatar: '', createdAt: '2026-01-08' },
        { id: 'u4', name: 'Mohamed Ali', email: 'moh@pitch.com', password: 'pass123', role: 'pitch_owner', roles: ['pitch_owner'], phone: '+20 100 000 0004', avatar: '', createdAt: '2026-01-10' },
        { id: 'u5', name: 'Karim Benzema', email: 'karim@coach.com', password: 'pass123', role: 'coach', roles: ['coach'], phone: '+20 100 000 0005', avatar: '', createdAt: '2026-01-12' }
    ],
    pitches: [
        { id: 'p1', name: 'Green Arena', location: 'Nasr City, Cairo', pricePerHour: 250, ownerId: 'u4', type: '5-a-side', capacity: 10, amenities: ['Lighting', 'Parking', 'Changing Room'], rating: 4.5, image: '' },
        { id: 'p2', name: 'Champions Field', location: '6th October, Giza', pricePerHour: 400, ownerId: 'u4', type: '7-a-side', capacity: 14, amenities: ['Lighting', 'Parking', 'Cafeteria', 'Showers'], rating: 4.8, image: '' },
        { id: 'p3', name: 'Goal Zone', location: 'Maadi, Cairo', pricePerHour: 300, ownerId: 'u6', type: '5-a-side', capacity: 10, amenities: ['Lighting', 'Parking'], rating: 4.2, image: '' },
        { id: 'p4', name: 'Stadium X', location: 'New Cairo', pricePerHour: 500, ownerId: 'u6', type: '11-a-side', capacity: 22, amenities: ['Lighting', 'Parking', 'VIP', 'Cafeteria'], rating: 4.9, image: '' },
        { id: 'p5', name: 'Urban Kick', location: 'Downtown, Cairo', pricePerHour: 200, ownerId: 'u4', type: '5-a-side', capacity: 10, amenities: ['Lighting'], rating: 3.9, image: '' },
        { id: 'p6', name: 'Pro Turf Arena', location: 'Heliopolis, Cairo', pricePerHour: 350, ownerId: 'u6', type: '7-a-side', capacity: 14, amenities: ['Lighting', 'Parking', 'Changing Room'], rating: 4.4, image: '' }
    ],
    coaches: [
        { id: 'c1', userId: 'u5', specialty: 'Attack & Finishing', experience: 12, hourlyRate: 150, rating: 4.7, bio: 'Former professional striker with 12 years of experience.' },
        { id: 'c2', userId: 'u7', specialty: 'Fitness & Conditioning', experience: 8, hourlyRate: 120, rating: 4.5, bio: 'Certified fitness coach specializing in football conditioning.' }
    ],
    bookings: [
        { id: 'b1', pitchId: 'p1', playerId: 'u2', date: '2026-02-25', timeSlot: '18:00-19:00', status: 'confirmed', totalPrice: 250 },
        { id: 'b2', pitchId: 'p2', playerId: 'u3', date: '2026-02-26', timeSlot: '20:00-21:00', status: 'pending', totalPrice: 400 },
        { id: 'b3', pitchId: 'p4', playerId: 'u2', date: '2026-02-27', timeSlot: '16:00-17:00', status: 'confirmed', totalPrice: 500 }
    ],
    // ---- Coach Bookings (Independent from Pitch Bookings) ----
    coachBookings: [
        { id: 'cb1', coachId: 'c1', coachUserId: 'u5', playerId: 'u2', playerName: 'Ahmed Hassan', date: '2026-02-28', timeSlot: '17:00-18:00', sessionType: 'private', focus: 'Finishing Drills', status: 'confirmed', price: 150, notes: '', createdAt: '2026-02-20' },
        { id: 'cb2', coachId: 'c2', coachUserId: 'u7', playerId: 'u3', playerName: 'Sara El-Masry', date: '2026-03-01', timeSlot: '18:00-19:00', sessionType: 'group', focus: 'Fitness & Speed', status: 'pending', price: 120, notes: 'Bring running shoes', createdAt: '2026-02-22' },
        { id: 'cb3', coachId: 'c1', coachUserId: 'u5', playerId: 'u3', playerName: 'Sara El-Masry', date: '2026-03-02', timeSlot: '16:00-17:00', sessionType: 'private', focus: 'Positioning & Movement', status: 'pending', price: 150, notes: '', createdAt: '2026-02-23' }
    ],
    videos: [
        { id: 'v1', userId: 'u2', title: 'Insane Bicycle Kick!', videoUrl: '#', likes: 42, createdAt: '2026-02-20', weekNumber: 8 },
        { id: 'v2', userId: 'u3', title: 'Free Kick Top Corner 🎯', videoUrl: '#', likes: 38, createdAt: '2026-02-21', weekNumber: 8 }
    ],
    tournaments: [
        { id: 't1', name: 'Cairo Cup 2026', organizerId: 'u4', startDate: '2026-03-15', maxTeams: 8, teams: ['Team Alpha', 'Team Beta', 'Team Gamma'], playerTeams: { 'u2': 'Team Alpha', 'u3': 'Team Beta' }, status: 'registration', prize: '5000 EGP', sportModule: 'football' },
        { id: 't2', name: 'Ramadan League', organizerId: 'u6', startDate: '2026-03-25', maxTeams: 16, teams: ['Falcons', 'Eagles'], playerTeams: { 'u2': 'Falcons' }, status: 'registration', prize: '10000 EGP', sportModule: 'football' }
    ],
    // ---- Academy Seed Data (NEW) ----
    academies: [
        { id: 'ac1', coachId: 'c1', coachUserId: 'u5', name: 'Benzema Striker Academy', description: 'Master the art of finishing, positioning, and clinical striking with former pro Karim Benzema. Sessions include 1-on-1 drills, match simulations, and video analysis.', category: 'Attack & Finishing', ageGroup: '16-25', level: 'Intermediate', location: 'Nasr City, Cairo', schedule: 'Sun, Tue, Thu — 5:00 PM to 7:00 PM', maxCapacity: 20, monthlyPrice: 800, rating: 4.8, status: 'active', createdAt: '2026-01-20' },
        { id: 'ac2', coachId: 'c2', coachUserId: 'u7', name: 'Elite Fitness Football Camp', description: 'Intensive football-specific conditioning program. Build stamina, speed, and agility to dominate the pitch. Includes nutrition guidance.', category: 'Fitness & Conditioning', ageGroup: '14-30', level: 'All Levels', location: 'Heliopolis, Cairo', schedule: 'Mon, Wed, Fri — 6:00 PM to 8:00 PM', maxCapacity: 25, monthlyPrice: 600, rating: 4.5, status: 'active', createdAt: '2026-02-05' }
    ],
    enrollments: [
        { id: 'en1', academyId: 'ac1', playerId: 'u2', playerName: 'Ahmed Hassan', enrolledAt: '2026-02-01', status: 'active', subscriptionEnd: '2026-03-01', attendance: [{ date: '2026-02-02', present: true }, { date: '2026-02-04', present: true }, { date: '2026-02-06', present: false }, { date: '2026-02-09', present: true }], notes: 'Great progress on finishing drills.' },
        { id: 'en2', academyId: 'ac1', playerId: 'u3', playerName: 'Sara El-Masry', enrolledAt: '2026-02-10', status: 'active', subscriptionEnd: '2026-03-10', attendance: [{ date: '2026-02-11', present: true }, { date: '2026-02-13', present: true }], notes: '' },
        { id: 'en3', academyId: 'ac2', playerId: 'u2', playerName: 'Ahmed Hassan', enrolledAt: '2026-02-05', status: 'active', subscriptionEnd: '2026-03-05', attendance: [{ date: '2026-02-05', present: true }, { date: '2026-02-07', present: true }, { date: '2026-02-10', present: true }], notes: 'Excellent stamina improvement.' }
    ],
    // ---- Academy Ratings Seed Data (NEW — Rating & Review System) ----
    academyRatings: [
        { id: 'ar1', academyId: 'ac1', playerId: 'u2', playerName: 'Ahmed Hassan', rating: 5, review: 'Incredible coaching! Karim really focuses on each player individually. My finishing has improved dramatically in just a few weeks.', createdAt: '2026-02-15' },
        { id: 'ar2', academyId: 'ac1', playerId: 'u3', playerName: 'Sara El-Masry', rating: 4, review: 'Great academy with structured drills. The video analysis sessions are very helpful. Would love more match simulation time.', createdAt: '2026-02-18' },
        { id: 'ar3', academyId: 'ac2', playerId: 'u2', playerName: 'Ahmed Hassan', rating: 5, review: 'Best fitness program I\'ve joined. Coach Youssef pushes you to your limits but keeps it fun. Highly recommended!', createdAt: '2026-02-12' }
    ],
    // ---- Academy Points Seed Data (NEW — Level & Points System) ----
    academyPoints: [
        {
            id: 'ap1', academyId: 'ac1', playerId: 'u2', playerName: 'Ahmed Hassan', points: 80, history: [
                { type: 'ATTENDANCE', points: 10, date: '2026-02-02', note: 'Session attended' },
                { type: 'ATTENDANCE', points: 10, date: '2026-02-04', note: 'Session attended' },
                { type: 'ATTENDANCE', points: 10, date: '2026-02-09', note: 'Session attended' },
                { type: 'COMPETITION_WIN', points: 30, date: '2026-02-10', note: 'Won finishing drill competition' },
                { type: 'ATTENDANCE', points: 10, date: '2026-02-16', note: 'Session attended' },
                { type: 'ATTENDANCE', points: 10, date: '2026-02-18', note: 'Session attended' }
            ]
        },
        {
            id: 'ap2', academyId: 'ac1', playerId: 'u3', playerName: 'Sara El-Masry', points: 20, history: [
                { type: 'ATTENDANCE', points: 10, date: '2026-02-11', note: 'Session attended' },
                { type: 'ATTENDANCE', points: 10, date: '2026-02-13', note: 'Session attended' }
            ]
        },
        {
            id: 'ap3', academyId: 'ac2', playerId: 'u2', playerName: 'Ahmed Hassan', points: 80, history: [
                { type: 'ATTENDANCE', points: 10, date: '2026-02-05', note: 'Session attended' },
                { type: 'ATTENDANCE', points: 10, date: '2026-02-07', note: 'Session attended' },
                { type: 'ATTENDANCE', points: 10, date: '2026-02-10', note: 'Session attended' },
                { type: 'PROGRAM_COMPLETE', points: 50, date: '2026-02-14', note: 'Week 1 conditioning program completed' }
            ]
        }
    ],
    // ---- SPORTIFY Extension Seed Data ----
    subscriptions: [
        { id: 'sub1', userId: 'u4', planId: 'pitch_owner_basic', status: 'active', startDate: '2026-02-01', endDate: '2026-03-01', autoRenew: true, sportModule: 'football' },
        { id: 'sub2', userId: 'u5', planId: 'coach_basic', status: 'active', startDate: '2026-02-01', endDate: '2026-03-01', autoRenew: true, sportModule: 'football' },
        { id: 'sub3', userId: 'u6', planId: 'pitch_owner_basic', status: 'active', startDate: '2026-02-01', endDate: '2026-03-01', autoRenew: true, sportModule: 'football' },
        { id: 'sub4', userId: 'u7', planId: 'coach_basic', status: 'active', startDate: '2026-02-01', endDate: '2026-03-01', autoRenew: false, sportModule: 'football' }
    ],
    feedPosts: [
        { id: 'fp1', userId: 'u2', type: 'goal_video', title: 'Insane Bicycle Kick at Cairo Cup! 🔥', description: 'Match-winning goal in the quarter-final. Best moment of the season!', mediaUrl: '#', likes: 24, commentsCount: 3, location: 'Nasr City, Cairo', academyId: null, tournamentId: 't1', tags: ['goal', 'bicycle-kick', 'cairo-cup'], sportModule: 'football', createdAt: '2026-02-22T18:00:00Z' },
        { id: 'fp2', userId: 'u5', type: 'training_highlight', title: 'Academy Finishing Drill — 95% Accuracy 🎯', description: 'Our striker academy students are leveling up! Check out this finishing drill from today.', mediaUrl: '#', likes: 18, commentsCount: 2, location: 'Nasr City, Cairo', academyId: 'ac1', tournamentId: null, tags: ['training', 'academy', 'finishing'], sportModule: 'football', createdAt: '2026-02-23T14:30:00Z' },
        { id: 'fp3', userId: 'u3', type: 'tournament_moment', title: 'Ramadan League Opening Ceremony 🏆', description: 'What an atmosphere! 16 teams ready to compete.', mediaUrl: '#', likes: 31, commentsCount: 5, location: '6th October, Giza', academyId: null, tournamentId: 't2', tags: ['tournament', 'ramadan-league'], sportModule: 'football', createdAt: '2026-02-24T10:00:00Z' },
        { id: 'fp4', userId: 'u7', type: 'academy_achievement', title: 'Elite Fitness Camp — Week 4 Results 💪', description: 'Average stamina improved by 30% across all players this month.', mediaUrl: '#', likes: 12, commentsCount: 1, location: 'Heliopolis, Cairo', academyId: 'ac2', tournamentId: null, tags: ['fitness', 'academy', 'results'], sportModule: 'football', createdAt: '2026-02-24T08:00:00Z' }
    ],
    feedComments: [
        { id: 'fc1', postId: 'fp1', userId: 'u3', userName: 'Sara El-Masry', text: 'What a goal! 🤩', createdAt: '2026-02-22T18:30:00Z' },
        { id: 'fc2', postId: 'fp1', userId: 'u5', userName: 'Karim Benzema', text: 'Great technique! That\'s what we train for at the academy.', createdAt: '2026-02-22T19:00:00Z' },
        { id: 'fc3', postId: 'fp1', userId: 'u7', userName: 'Youssef Nabil', text: 'The fitness work is paying off! 💪', createdAt: '2026-02-22T20:00:00Z' },
        { id: 'fc4', postId: 'fp2', userId: 'u2', userName: 'Ahmed Hassan', text: 'Best academy I\'ve trained at! Coach Karim is amazing.', createdAt: '2026-02-23T15:00:00Z' },
        { id: 'fc5', postId: 'fp2', userId: 'u3', userName: 'Sara El-Masry', text: 'Can I join the next session?', createdAt: '2026-02-23T16:00:00Z' },
        { id: 'fc6', postId: 'fp3', userId: 'u2', userName: 'Ahmed Hassan', text: 'Let\'s gooo! Falcons are taking this 🦅', createdAt: '2026-02-24T10:30:00Z' }
    ],
    matchRequests: [
        { id: 'mr1', creatorId: 'u2', creatorName: 'Ahmed Hassan', location: 'Nasr City, Cairo', date: '2026-03-01', timeSlot: '18:00-19:00', skillLevel: 'intermediate', playersNeeded: 4, playersJoined: [{ userId: 'u2', name: 'Ahmed Hassan' }, { userId: 'u3', name: 'Sara El-Masry' }], maxPlayers: 10, pitchType: '5-a-side', notes: 'Friendly match near Green Arena. All welcome!', status: 'open', sportModule: 'football', createdAt: '2026-02-24T12:00:00Z' },
        { id: 'mr2', creatorId: 'u3', creatorName: 'Sara El-Masry', location: 'Maadi, Cairo', date: '2026-03-02', timeSlot: '20:00-21:00', skillLevel: 'beginner', playersNeeded: 6, playersJoined: [{ userId: 'u3', name: 'Sara El-Masry' }], maxPlayers: 14, pitchType: '7-a-side', notes: 'Looking for beginners to practice together', status: 'open', sportModule: 'football', createdAt: '2026-02-24T13:00:00Z' }
    ],
    // ---- Sport Profiles (NEW — Multi-Sport Player Profiles) ----
    sportProfiles: [
        {
            id: 'sp1', userId: 'u2', sportId: 'football',
            position: 'ST', skillLevel: 'intermediate',
            goals: 8, assists: 3, matchesPlayed: 12, matchesCompleted: 11, noShows: 1,
            currentStreak: 4, rating: 3.85,
            ratingHistory: [
                { type: 'MATCH_PARTICIPATION', change: 0.1, oldRating: 3.0, newRating: 3.1, matchId: 'mr_demo1', timestamp: '2026-02-05T18:00:00Z' },
                { type: 'POSITIVE_FEEDBACK', change: 0.15, oldRating: 3.1, newRating: 3.25, matchId: 'mr_demo1', raterUserId: 'u3', timestamp: '2026-02-05T20:00:00Z' },
                { type: 'MATCH_PARTICIPATION', change: 0.1, oldRating: 3.25, newRating: 3.35, matchId: 'mr_demo2', timestamp: '2026-02-08T18:00:00Z' },
                { type: 'WIN', change: 0.1, oldRating: 3.35, newRating: 3.45, matchId: 'mr_demo2', timestamp: '2026-02-08T19:00:00Z' },
                { type: 'MATCH_PARTICIPATION', change: 0.1, oldRating: 3.45, newRating: 3.55, matchId: 'mr_demo3', timestamp: '2026-02-12T18:00:00Z' },
                { type: 'POSITIVE_FEEDBACK', change: 0.15, oldRating: 3.55, newRating: 3.70, matchId: 'mr_demo3', raterUserId: 'u7', timestamp: '2026-02-12T20:00:00Z' },
                { type: 'MATCH_PARTICIPATION', change: 0.1, oldRating: 3.70, newRating: 3.80, matchId: 'mr_demo4', timestamp: '2026-02-18T18:00:00Z' },
                { type: 'ATTENDANCE_CONFIRM', change: 0.05, oldRating: 3.80, newRating: 3.85, matchId: 'mr_demo4', timestamp: '2026-02-18T17:00:00Z' }
            ],
            reliability: 92,
            badges: ['first_match', 'five_matches', 'ten_matches', 'first_goal', 'five_goals', 'first_assist'],
            createdAt: '2026-01-05T00:00:00Z'
        },
        {
            id: 'sp2', userId: 'u3', sportId: 'football',
            position: 'CM', skillLevel: 'beginner',
            goals: 2, assists: 5, matchesPlayed: 6, matchesCompleted: 6, noShows: 0,
            currentStreak: 6, rating: 3.40,
            ratingHistory: [
                { type: 'MATCH_PARTICIPATION', change: 0.1, oldRating: 3.0, newRating: 3.1, matchId: 'mr_demo1', timestamp: '2026-02-06T18:00:00Z' },
                { type: 'MATCH_PARTICIPATION', change: 0.1, oldRating: 3.1, newRating: 3.2, matchId: 'mr_demo5', timestamp: '2026-02-10T18:00:00Z' },
                { type: 'POSITIVE_FEEDBACK', change: 0.15, oldRating: 3.2, newRating: 3.35, matchId: 'mr_demo5', raterUserId: 'u2', timestamp: '2026-02-10T20:00:00Z' },
                { type: 'ATTENDANCE_CONFIRM', change: 0.05, oldRating: 3.35, newRating: 3.40, matchId: 'mr_demo6', timestamp: '2026-02-15T17:00:00Z' }
            ],
            reliability: 100,
            badges: ['first_match', 'five_matches', 'first_goal', 'first_assist', 'reliable', 'team_player'],
            createdAt: '2026-01-08T00:00:00Z'
        }
    ]
};

// ---- Initialize DB ----
function seedDatabase(force = false) {
    if (force || UsersStore.count() === 0) {
        DB.set('mal3abak_users', SEED_DATA.users);
        DB.set('mal3abak_pitches', SEED_DATA.pitches);
        DB.set('mal3abak_coaches', SEED_DATA.coaches);
        DB.set('mal3abak_bookings', SEED_DATA.bookings);
        DB.set('mal3abak_videos', SEED_DATA.videos);
        DB.set('mal3abak_tournaments', SEED_DATA.tournaments);
        DB.set('mal3abak_academies', SEED_DATA.academies);
        DB.set('mal3abak_enrollments', SEED_DATA.enrollments);
        DB.set('mal3abak_academy_ratings', SEED_DATA.academyRatings);
        DB.set('mal3abak_academy_points', SEED_DATA.academyPoints);
        DB.set('mal3abak_coach_bookings', SEED_DATA.coachBookings);
        // SPORTIFY extension stores
        DB.set('sportify_subscriptions', SEED_DATA.subscriptions);
        DB.set('sportify_feed_posts', SEED_DATA.feedPosts);
        DB.set('sportify_feed_comments', SEED_DATA.feedComments);
        DB.set('sportify_match_requests', SEED_DATA.matchRequests);
        DB.set('sportify_sport_profiles', SEED_DATA.sportProfiles);
        console.log('✅ SPORTIFY database seeded');
    }
    // Seed academy data if missing (safe upgrade for existing users)
    if (AcademiesStore.count() === 0 && SEED_DATA.academies) {
        DB.set('mal3abak_academies', SEED_DATA.academies);
        DB.set('mal3abak_enrollments', SEED_DATA.enrollments);
        console.log('✅ Academy data seeded (upgrade)');
    }
    // Seed ratings data if missing (safe upgrade)
    if (AcademyRatingsStore.count() === 0 && SEED_DATA.academyRatings) {
        DB.set('mal3abak_academy_ratings', SEED_DATA.academyRatings);
        console.log('✅ Academy ratings seeded (upgrade)');
    }
    // Seed points data if missing (safe upgrade)
    if (AcademyPointsStore.count() === 0 && SEED_DATA.academyPoints) {
        DB.set('mal3abak_academy_points', SEED_DATA.academyPoints);
        console.log('✅ Academy points seeded (upgrade)');
    }
    // Seed coach bookings if missing (safe upgrade)
    if (CoachBookingsStore.count() === 0 && SEED_DATA.coachBookings) {
        DB.set('mal3abak_coach_bookings', SEED_DATA.coachBookings);
        console.log('✅ Coach bookings seeded (upgrade)');
    }
    // SPORTIFY safe upgrades
    if (SubscriptionsStore.count() === 0 && SEED_DATA.subscriptions) {
        DB.set('sportify_subscriptions', SEED_DATA.subscriptions);
        console.log('✅ Subscriptions seeded (upgrade)');
    }
    if (FeedPostsStore.count() === 0 && SEED_DATA.feedPosts) {
        DB.set('sportify_feed_posts', SEED_DATA.feedPosts);
        DB.set('sportify_feed_comments', SEED_DATA.feedComments);
        console.log('✅ Social feed seeded (upgrade)');
    }
    if (MatchRequestsStore.count() === 0 && SEED_DATA.matchRequests) {
        DB.set('sportify_match_requests', SEED_DATA.matchRequests);
        console.log('✅ Matchmaking seeded (upgrade)');
    }
    // Sport profiles safe upgrade
    if (SportProfilesStore.count() === 0 && SEED_DATA.sportProfiles) {
        DB.set('sportify_sport_profiles', SEED_DATA.sportProfiles);
        console.log('✅ Sport profiles seeded (upgrade)');
    }
    // Ensure NEW demo accounts always exist (safe upgrade for existing users)
    const currentUsers = UsersStore.getAll();
    const demoEmails = ['admin@sportify.com', 'player@sportify.com', 'owner@sportify.com', 'coach@sportify.com'];
    demoEmails.forEach((email, idx) => {
        if (!currentUsers.some(u => u.email.toLowerCase() === email.toLowerCase())) {
            const roles = [['admin'], ['player'], ['pitch_owner'], ['coach']];
            UsersStore.add({
                id: `demo_u_${idx}`,
                name: `Demo ${email.split('@')[0].toUpperCase()}`,
                email: email,
                password: '123456',
                role: roles[idx][0],
                roles: roles[idx],
                phone: '+20 123 456 789',
                createdAt: new Date().toISOString().split('T')[0]
            });
            console.log(`✅ Demo account injected: ${email}`);
        }
    });

    // Ensure legacy admin account exists
    const hasAdmin = currentUsers.some(u => (u.roles && u.roles.includes('admin')) || u.role === 'admin');
    if (!hasAdmin) {
        UsersStore.add({ id: 'u1', name: 'Admin', email: 'admin@admin.com', password: 'admin123', role: 'admin', roles: ['admin'], phone: '+20 100 000 0001', avatar: '', createdAt: '2026-01-01' });
        console.log('✅ Admin account injected (safe upgrade)');
    }
}

// Auto-seed on first load
seedDatabase();
