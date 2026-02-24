/* ============================================
   SPORTIFY — Smart Matchmaking
   Help players find missing teammates.
   Match by location, time, and skill level.
   ============================================ */

const MatchmakingManager = {
    /** Create a new match request. */
    createRequest(data) {
        const user = Auth.getCurrentUser();
        if (!user) return { success: false, message: 'Login required' };

        return {
            success: true,
            match: MatchRequestsStore.add({
                creatorId: user.id,
                creatorName: user.name,
                location: data.location || '',
                date: data.date || '',
                timeSlot: data.timeSlot || '',
                skillLevel: data.skillLevel || 'intermediate',
                playersNeeded: parseInt(data.playersNeeded) || 4,
                playersJoined: [{ userId: user.id, name: user.name }],
                maxPlayers: parseInt(data.maxPlayers) || 10,
                pitchType: data.pitchType || '5-a-side',
                notes: data.notes || '',
                status: 'open',
                sportModule: 'football',
                createdAt: new Date().toISOString()
            })
        };
    },

    /** Join an existing match request. */
    joinMatch(matchId) {
        const user = Auth.getCurrentUser();
        if (!user) return { success: false, message: 'Login required' };

        // Race guard
        const lockKey = `match_join_${matchId}_${user.id}`;
        if (!RaceGuard.acquire(lockKey, 1000)) {
            return { success: false, message: 'Please wait...' };
        }

        const match = MatchRequestsStore.getById(matchId);
        if (!match) return { success: false, message: 'Match not found' };
        if (match.status !== 'open') return { success: false, message: 'Match is no longer open' };

        // Already joined?
        if (match.playersJoined.some(p => p.userId === user.id)) {
            return { success: false, message: 'You already joined this match!' };
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

        return { success: true, isFull: newStatus === 'full' };
    },

    /** Leave a match request. */
    leaveMatch(matchId) {
        const user = Auth.getCurrentUser();
        if (!user) return { success: false, message: 'Login required' };

        const match = MatchRequestsStore.getById(matchId);
        if (!match) return { success: false, message: 'Match not found' };

        // Can't leave your own match
        if (match.creatorId === user.id) {
            return { success: false, message: 'Creators cannot leave. Cancel the match instead.' };
        }

        match.playersJoined = match.playersJoined.filter(p => p.userId !== user.id);
        MatchRequestsStore.update(matchId, {
            playersJoined: match.playersJoined,
            status: 'open'
        });

        return { success: true };
    },

    /** Cancel a match (creator only). */
    cancelMatch(matchId) {
        const user = Auth.getCurrentUser();
        if (!user) return { success: false, message: 'Login required' };

        const match = MatchRequestsStore.getById(matchId);
        if (!match) return { success: false, message: 'Match not found' };
        if (match.creatorId !== user.id) return { success: false, message: 'Only the creator can cancel' };

        MatchRequestsStore.update(matchId, { status: 'cancelled' });
        return { success: true };
    },

    /** Get open matches, optionally filtered. */
    getOpenMatches(filters = {}) {
        let matches = MatchRequestsStore.filter(m => m.status === 'open');

        if (filters.location) {
            matches = matches.filter(m =>
                m.location.toLowerCase().includes(filters.location.toLowerCase())
            );
        }
        if (filters.skillLevel) {
            matches = matches.filter(m => m.skillLevel === filters.skillLevel);
        }
        if (filters.date) {
            matches = matches.filter(m => m.date === filters.date);
        }
        if (filters.pitchType) {
            matches = matches.filter(m => m.pitchType === filters.pitchType);
        }

        return matches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    /** Submit a result (Creator only). */
    submitResult(matchId, score1, score2) {
        const user = Auth.getCurrentUser();
        const match = MatchRequestsStore.getById(matchId);
        if (!match || match.creatorId !== user.id) return { success: false, message: 'Unauthorized' };

        const result = {
            score1, score2,
            submittedBy: user.id,
            confirmations: [user.id],
            status: 'pending_confirmation'
        };

        MatchRequestsStore.update(matchId, {
            result,
            resultStatus: 'pending'
        });
        return { success: true };
    },

    /** Confirm a result (Participants only). */
    confirmResult(matchId) {
        const user = Auth.getCurrentUser();
        const match = MatchRequestsStore.getById(matchId);
        if (!match || !match.result) return { success: false, message: 'Result not found' };

        // Must be a participant
        if (!match.playersJoined.some(p => p.userId === user.id)) return { success: false, message: 'Unauthorized' };

        if (match.result.confirmations.includes(user.id)) return { success: false, message: 'Already confirmed' };

        match.result.confirmations.push(user.id);

        // Anti-abuse: Need at least creator + 1 other confirmation
        if (match.result.confirmations.length >= 2) {
            match.resultStatus = 'confirmed';

            // Trigger Ranking Update
            RankingManager.processMatchResult(matchId, {
                team1: { scorers: [] },
                team2: { scorers: [] },
                allPlayerIds: match.playersJoined.map(p => p.userId)
            }, 'open');
        }

        MatchRequestsStore.update(matchId, {
            result: match.result,
            resultStatus: match.resultStatus
        });
        return { success: true, confirmed: match.resultStatus === 'confirmed' };
    }
};
