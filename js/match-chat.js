/* ============================================
   SPORTIFY — Match Chat System
   Internal chat between match participants.
   Access: approved match players ONLY.
   ============================================ */

const MatchChat = {
    /** Check if a user has access to a match's chat. */
    hasAccess(matchId, userId) {
        if (!userId) return false;
        const match = MatchRequestsStore.getById(matchId);
        if (!match) return false;

        // Must be player role
        const user = getUserById(userId);
        if (!user || user.role !== 'player') return false;

        // Must be host or approved player
        const isHost = match.hostId === userId;
        const isApprovedParticipant = match.playersJoined.some(p => p.userId === userId && p.status === 'approved');

        return isHost || isApprovedParticipant;
    },

    /** Send a message. */
    sendMessage(matchId, userId, userName, text) {
        if (!text || !text.trim()) return null;
        if (!this.hasAccess(matchId, userId)) return null;

        return MatchMessagesStore.add({
            matchId,
            senderId: userId,
            senderName: userName,
            message: text.trim(),
            timestamp: new Date().toISOString()
        });
    },

    /** Get messages for a match. */
    getMessages(matchId, limit = 50) {
        return MatchMessagesStore.filter(m => m.matchId === matchId)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
            .slice(-limit);
    }
};
