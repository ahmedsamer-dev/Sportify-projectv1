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
        if (!Auth.hasRole('player')) return { success: false, message: 'Only players can create matches' };

        return {
            success: true,
            match: MatchRequestsStore.add({
                hostId: user.id, // Architect requirement: Assign hostId
                creatorId: user.id,
                creatorName: user.name,
                location: data.location || '',
                date: data.date || '',
                timeSlot: data.timeSlot || '',
                skillLevel: data.skillLevel || 'intermediate',
                playersNeeded: parseInt(data.playersNeeded) || 4,
                playersJoined: [{ userId: user.id, name: user.name, status: 'approved' }],
                requests: [], // Architect Requirement: Part 3 approval logic
                maxPlayers: parseInt(data.maxPlayers) || 10,
                pitchType: data.pitchType || '5-a-side',
                notes: data.notes || '',
                status: 'open',
                sportModule: 'football',
                createdAt: new Date().toISOString()
            })
        };
    },

    /** Request to join a match (Players only). */
    joinMatch(matchId) {
        const user = Auth.getCurrentUser();
        if (!user) return { success: false, message: 'Login required' };
        if (!Auth.hasRole('player')) return { success: false, message: 'Only players can join matches' };

        const match = MatchRequestsStore.getById(matchId);
        if (!match) return { success: false, message: 'Match not found' };
        if (match.status !== 'open') return { success: false, message: 'Match is no longer open' };

        // Already joined or pending?
        if (match.playersJoined.some(p => p.userId === user.id)) {
            return { success: false, message: 'You already joined this match!' };
        }
        if (match.requests && match.requests.some(r => r.userId === user.id)) {
            return { success: false, message: 'Your request is pending' };
        }

        // Full?
        if (match.playersJoined.length >= match.maxPlayers) {
            return { success: false, message: 'Match is full' };
        }

        const requests = match.requests || [];
        requests.push({ userId: user.id, name: user.name, status: 'pending', requestedAt: new Date().toISOString() });

        MatchRequestsStore.update(matchId, { requests });
        return { success: true, message: 'Request sent to host' };
    },

    /** Handle Join Request (Host only). */
    handleRequest(matchId, playerId, newStatus) {
        const user = Auth.getCurrentUser();
        const match = MatchRequestsStore.getById(matchId);
        if (!match || match.hostId !== user.id) return { success: false, message: 'Unauthorized' };

        const requests = (match.requests || []).filter(r => r.userId !== playerId);
        const playerReq = (match.requests || []).find(r => r.userId === playerId);

        if (!playerReq) return { success: false, message: 'Player request not found' };

        if (newStatus === 'approved') {
            if (match.playersJoined.length >= match.maxPlayers) return { success: false, message: 'Match is full' };
            match.playersJoined.push({ userId: playerReq.userId, name: playerReq.name, status: 'approved' });
        }

        const newMatchStatus = match.playersJoined.length >= match.maxPlayers ? 'full' : 'open';

        MatchRequestsStore.update(matchId, {
            requests,
            playersJoined: match.playersJoined,
            status: newMatchStatus
        });

        return { success: true };
    },

    /** Remove Player (Host only). */
    removePlayer(matchId, playerId) {
        const user = Auth.getCurrentUser();
        const match = MatchRequestsStore.getById(matchId);
        if (!match || match.hostId !== user.id) return { success: false, message: 'Unauthorized' };
        if (playerId === match.hostId) return { success: false, message: 'Cannot remove yourself' };

        const playersJoined = match.playersJoined.filter(p => p.userId !== playerId);
        MatchRequestsStore.update(matchId, {
            playersJoined,
            status: 'open'
        });

        return { success: true };
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

    /** Get match by ID. */
    getById(id) {
        return MatchRequestsStore.getById(id);
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
