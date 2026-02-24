/* ============================================
   SPORTIFY — Player Profile Module
   Multi-sport architecture (Football-first).
   Dynamic Rating, Reliability, Leaderboard.
   ============================================ */

// ============ 1. FOOTBALL PROFILE CONFIG ============

const FOOTBALL_POSITIONS = [
    { id: 'GK', label: 'Goalkeeper', icon: '🧤', color: '#FFD740' },
    { id: 'CB', label: 'Center Back', icon: '🛡️', color: '#448AFF' },
    { id: 'LB', label: 'Left Back', icon: '🛡️', color: '#448AFF' },
    { id: 'RB', label: 'Right Back', icon: '🛡️', color: '#448AFF' },
    { id: 'CDM', label: 'Defensive Mid', icon: '⚙️', color: '#00B0FF' },
    { id: 'CM', label: 'Central Mid', icon: '🎯', color: '#00B0FF' },
    { id: 'CAM', label: 'Attacking Mid', icon: '✨', color: '#00E676' },
    { id: 'LW', label: 'Left Wing', icon: '⚡', color: '#00E676' },
    { id: 'RW', label: 'Right Wing', icon: '⚡', color: '#00E676' },
    { id: 'ST', label: 'Striker', icon: '🔥', color: '#FF5252' },
    { id: 'CF', label: 'Center Forward', icon: '🔥', color: '#FF5252' }
];

const SKILL_LEVELS = [
    { id: 'beginner', label: 'Beginner', icon: '🟢', color: '#00E676', min: 0 },
    { id: 'intermediate', label: 'Intermediate', icon: '🔵', color: '#00B0FF', min: 3.0 },
    { id: 'advanced', label: 'Advanced', icon: '🟠', color: '#FFD740', min: 4.0 },
    { id: 'elite', label: 'Elite', icon: '🔴', color: '#FF5252', min: 4.5 }
];

const FOOTBALL_BADGES = [
    { id: 'first_match', label: '1st Match', icon: '⚽', description: 'Played your first match', condition: (stats) => stats.matchesPlayed >= 1 },
    { id: 'five_matches', label: '5 Matches', icon: '🏃', description: 'Played 5 matches', condition: (stats) => stats.matchesPlayed >= 5 },
    { id: 'ten_matches', label: '10 Matches', icon: '🏟️', description: 'Played 10 matches', condition: (stats) => stats.matchesPlayed >= 10 },
    { id: 'first_goal', label: 'First Goal!', icon: '🥅', description: 'Scored your first goal', condition: (stats) => stats.goals >= 1 },
    { id: 'five_goals', label: 'Goal Machine', icon: '🔥', description: 'Scored 5 goals', condition: (stats) => stats.goals >= 5 },
    { id: 'first_assist', label: 'Playmaker', icon: '🎯', description: 'Made your first assist', condition: (stats) => stats.assists >= 1 },
    { id: 'reliable', label: 'Reliable', icon: '✅', description: 'Reliability score > 80%', condition: (stats) => stats.reliability >= 80 },
    { id: 'top_rated', label: 'Top Rated', icon: '⭐', description: 'Rating above 4.5', condition: (stats) => stats.rating >= 4.5 },
    { id: 'team_player', label: 'Team Player', icon: '🤝', description: 'Completed 10 matches without no-show', condition: (stats) => stats.matchesCompleted >= 10 && stats.noShows === 0 },
    { id: 'streak_5', label: '5-Game Streak', icon: '🔥', description: '5 matches in a row', condition: (stats) => stats.currentStreak >= 5 }
];

// Rating change weights
const RATING_WEIGHTS = {
    MATCH_PARTICIPATION: 0.1,    // +0.1 for playing
    ATTENDANCE_CONFIRM: 0.05,    // +0.05 for confirming attendance
    POSITIVE_FEEDBACK: 0.15,     // +0.15 for positive feedback  
    NEGATIVE_FEEDBACK: -0.1,     // -0.1 for negative feedback
    NO_SHOW: -0.3,               // -0.3 penalty for no-show
    WIN: 0.1,                    // +0.1 for winning a match
    MIN_RATING: 1.0,
    MAX_RATING: 5.0,
    DEFAULT_RATING: 3.0
};

// ============ 2. SPORT PROFILE MANAGER ============

const SportProfileManager = {
    /**
     * Get or create a sport profile for a user.
     * Returns { profile, isNew }.
     */
    getProfile(userId, sportId = 'football') {
        const existing = SportProfilesStore.filter(
            p => p.userId === userId && p.sportId === sportId
        )[0];

        if (existing) return { profile: existing, isNew: false };

        // Auto-create on first access (lazy init)
        const user = UsersStore.getById(userId);
        if (!user) return { profile: null, isNew: false };

        const newProfile = SportProfilesStore.add({
            userId,
            sportId,
            position: 'CM',
            skillLevel: 'beginner',
            goals: 0,
            assists: 0,
            matchesPlayed: 0,
            matchesCompleted: 0,
            noShows: 0,
            currentStreak: 0,
            rating: RATING_WEIGHTS.DEFAULT_RATING,
            ratingHistory: [],
            reliability: 100,
            badges: [],
            createdAt: new Date().toISOString()
        });

        return { profile: newProfile, isNew: true };
    },

    /**
     * Update a sport-specific field.
     */
    updateProfile(userId, sportId, updates) {
        const { profile } = this.getProfile(userId, sportId);
        if (!profile) return null;
        return SportProfilesStore.update(profile.id, updates);
    },

    /**
     * Get position config by ID.
     */
    getPositionConfig(posId) {
        return FOOTBALL_POSITIONS.find(p => p.id === posId) || FOOTBALL_POSITIONS[0];
    },

    /**
     * Compute skill level from rating.
     */
    getSkillLevel(rating) {
        let level = SKILL_LEVELS[0];
        for (let i = SKILL_LEVELS.length - 1; i >= 0; i--) {
            if (rating >= SKILL_LEVELS[i].min) {
                level = SKILL_LEVELS[i];
                break;
            }
        }
        return level;
    },

    /**
     * Compute earned badges.
     */
    getEarnedBadges(profile) {
        const stats = {
            matchesPlayed: profile.matchesPlayed || 0,
            matchesCompleted: profile.matchesCompleted || 0,
            goals: profile.goals || 0,
            assists: profile.assists || 0,
            rating: profile.rating || 0,
            reliability: this.computeReliability(profile),
            noShows: profile.noShows || 0,
            currentStreak: profile.currentStreak || 0
        };

        return FOOTBALL_BADGES.filter(b => b.condition(stats));
    }
};

// ============ 3. DYNAMIC RATING SYSTEM ============

const PlayerRatingSystem = {
    /**
     * Apply a rating change for a user.
     * Race-condition safe via RaceGuard.
     * @param userId - player
     * @param changeType - 'MATCH_PARTICIPATION' | 'ATTENDANCE_CONFIRM' | 'POSITIVE_FEEDBACK' | 'NEGATIVE_FEEDBACK' | 'NO_SHOW' | 'WIN'
     * @param matchId - the match/event tied to this change (for dedup)
     * @param raterUserId - who rated (for feedback), null for system events
     */
    applyRatingChange(userId, changeType, matchId, raterUserId = null) {
        // Race guard: one rating per match per rater
        const lockKey = `rating_${userId}_${matchId}_${changeType}_${raterUserId || 'sys'}`;

        if (!RaceGuard.acquire(lockKey, 2000)) {
            return { success: false, message: 'Rating already processing...' };
        }

        // Persistent duplicate check
        const dedupKey = `sportify_rating_dedup`;
        const actionKey = `${userId}_${matchId}_${changeType}_${raterUserId || 'sys'}`;

        if (RaceGuard.hasPerformed(dedupKey, actionKey)) {
            RaceGuard.release(lockKey);
            return { success: false, message: 'Rating already applied for this match' };
        }

        try {
            const { profile } = SportProfileManager.getProfile(userId);
            if (!profile) return { success: false, message: 'Profile not found' };

            const weight = RATING_WEIGHTS[changeType] || 0;
            const oldRating = profile.rating || RATING_WEIGHTS.DEFAULT_RATING;
            let newRating = Math.max(RATING_WEIGHTS.MIN_RATING,
                Math.min(RATING_WEIGHTS.MAX_RATING, oldRating + weight));

            // Round to 2 decimal
            newRating = Math.round(newRating * 100) / 100;

            const historyEntry = {
                type: changeType,
                change: weight,
                oldRating,
                newRating,
                matchId,
                raterUserId,
                timestamp: new Date().toISOString()
            };

            const ratingHistory = profile.ratingHistory || [];
            ratingHistory.push(historyEntry);

            // Update match stats based on type
            const updates = { rating: newRating, ratingHistory };

            if (changeType === 'MATCH_PARTICIPATION') {
                updates.matchesPlayed = (profile.matchesPlayed || 0) + 1;
                updates.matchesCompleted = (profile.matchesCompleted || 0) + 1;
                updates.currentStreak = (profile.currentStreak || 0) + 1;
            }
            if (changeType === 'NO_SHOW') {
                updates.noShows = (profile.noShows || 0) + 1;
                updates.currentStreak = 0;
            }

            // Update skill level based on new rating
            updates.skillLevel = SportProfileManager.getSkillLevel(newRating).id;

            SportProfilesStore.update(profile.id, updates);

            // Record dedup
            RaceGuard.recordAction(dedupKey, actionKey);

            return {
                success: true,
                oldRating,
                newRating,
                change: weight,
                changeType
            };
        } finally {
            RaceGuard.release(lockKey);
        }
    },

    /**
     * Rate a player after a match.
     * Validates: one rating per rater per match.
     */
    ratePlayer(targetUserId, raterUserId, matchId, isPositive) {
        if (targetUserId === raterUserId) {
            return { success: false, message: 'Cannot rate yourself' };
        }

        const changeType = isPositive ? 'POSITIVE_FEEDBACK' : 'NEGATIVE_FEEDBACK';
        return this.applyRatingChange(targetUserId, changeType, matchId, raterUserId);
    },

    /**
     * Record a goal for a player.
     */
    recordGoal(userId, matchId) {
        const { profile } = SportProfileManager.getProfile(userId);
        if (!profile) return;
        SportProfilesStore.update(profile.id, { goals: (profile.goals || 0) + 1 });
    },

    /**
     * Record an assist for a player.
     */
    recordAssist(userId, matchId) {
        const { profile } = SportProfileManager.getProfile(userId);
        if (!profile) return;
        SportProfilesStore.update(profile.id, { assists: (profile.assists || 0) + 1 });
    }
};

// ============ 4. RELIABILITY SCORE ============

SportProfileManager.computeReliability = function (profile) {
    const total = (profile.matchesPlayed || 0);
    if (total === 0) return 100; // new player, no history

    const completed = profile.matchesCompleted || 0;
    const noShows = profile.noShows || 0;
    const attended = completed - noShows;

    // Base: completion rate (0-100)
    const completionRate = total > 0 ? (attended / total) * 100 : 100;

    // Penalty scaling: heavy penalties for repeated no-shows
    const noShowPenalty = noShows * 5; // 5% per no-show

    const score = Math.max(0, Math.min(100, Math.round(completionRate - noShowPenalty)));
    return score;
};

SportProfileManager.getReliabilityGrade = function (score) {
    if (score >= 95) return { grade: 'A+', label: 'Elite', color: '#00E676', icon: '🌟' };
    if (score >= 85) return { grade: 'A', label: 'Excellent', color: '#00E676', icon: '✅' };
    if (score >= 75) return { grade: 'B', label: 'Good', color: '#00B0FF', icon: '👍' };
    if (score >= 60) return { grade: 'C', label: 'Average', color: '#FFD740', icon: '⚠️' };
    if (score >= 40) return { grade: 'D', label: 'Unreliable', color: '#FF5252', icon: '❌' };
    return { grade: 'F', label: 'Banned Risk', color: '#FF1744', icon: '🚫' };
};

// ============ 5. LEADERBOARD ============

const PlayerLeaderboard = {
    /**
     * Get top players by a metric.
     * @param metric - 'rating' | 'goals' | 'assists' | 'matchesPlayed' | 'reliability'
     * @param limit - max results
     * @param sportId - sport filter
     */
    getTopPlayers(metric = 'rating', limit = 10, sportId = 'football') {
        const profiles = SportProfilesStore.filter(p => p.sportId === sportId);

        // Enrich with reliability if needed
        const enriched = profiles.map(p => {
            const user = UsersStore.getById(p.userId);
            return {
                ...p,
                userName: user ? user.name : 'Unknown',
                userEmail: user ? user.email : '',
                reliability: SportProfileManager.computeReliability(p),
                positionConfig: SportProfileManager.getPositionConfig(p.position),
                skillLevelConfig: SportProfileManager.getSkillLevel(p.rating || 0)
            };
        });

        // Sort by metric
        if (metric === 'reliability') {
            enriched.sort((a, b) => b.reliability - a.reliability);
        } else {
            enriched.sort((a, b) => (b[metric] || 0) - (a[metric] || 0));
        }

        // Add rank
        return enriched.slice(0, limit).map((p, i) => ({ ...p, rank: i + 1 }));
    },

    /**
     * Compare two players.
     */
    comparePlayers(userId1, userId2, sportId = 'football') {
        const p1 = SportProfileManager.getProfile(userId1, sportId).profile;
        const p2 = SportProfileManager.getProfile(userId2, sportId).profile;

        if (!p1 || !p2) return null;

        const user1 = UsersStore.getById(userId1);
        const user2 = UsersStore.getById(userId2);

        const metrics = ['rating', 'goals', 'assists', 'matchesPlayed'];
        const comparison = {};

        metrics.forEach(m => {
            const v1 = p1[m] || 0;
            const v2 = p2[m] || 0;
            comparison[m] = {
                player1: v1,
                player2: v2,
                winner: v1 > v2 ? 1 : v2 > v1 ? 2 : 0
            };
        });

        // Add reliability
        const r1 = SportProfileManager.computeReliability(p1);
        const r2 = SportProfileManager.computeReliability(p2);
        comparison.reliability = {
            player1: r1,
            player2: r2,
            winner: r1 > r2 ? 1 : r2 > r1 ? 2 : 0
        };

        return {
            player1: { ...p1, name: user1?.name, reliability: r1 },
            player2: { ...p2, name: user2?.name, reliability: r2 },
            comparison,
            overallWinner: Object.values(comparison).reduce((sum, c) => sum + (c.winner === 1 ? 1 : c.winner === 2 ? -1 : 0), 0) > 0 ? 1 : 2
        };
    },

    /**
     * Get a player's rank in a given metric.
     */
    getPlayerRank(userId, metric = 'rating', sportId = 'football') {
        const sorted = this.getTopPlayers(metric, 999, sportId);
        const idx = sorted.findIndex(p => p.userId === userId);
        return idx >= 0 ? idx + 1 : null;
    }
};
