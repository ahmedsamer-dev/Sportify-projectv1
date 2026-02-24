/* ============================================
   SPORTIFY — Academy Chat System
   Internal chat between coach and academy members.
   Access: enrolled players + academy coach only.
   ============================================ */

const AcademyChat = {
    /** Check if a user has access to an academy's chat. */
    hasAccess(academyId, userId) {
        const academy = AcademiesStore.getById(academyId);
        if (!academy) return false;

        // Coach of this academy
        if (academy.coachUserId === userId) return true;

        // Enrolled active player
        const enrollment = EnrollmentsStore.filter(e =>
            e.academyId === academyId &&
            e.playerId === userId &&
            e.status === 'active'
        );
        return enrollment.length > 0;
    },

    /** Send a message. */
    sendMessage(academyId, userId, userName, role, text) {
        if (!text || !text.trim()) return null;
        if (!this.hasAccess(academyId, userId)) return null;

        return AcademyChatStore.add({
            academyId,
            senderId: userId,
            senderName: userName,
            senderRole: role, // 'coach' or 'player'
            message: text.trim(),
            timestamp: new Date().toISOString()
        });
    },

    /** Get messages for an academy, newest last. */
    getMessages(academyId, limit = 50) {
        return AcademyChatStore.filter(m => m.academyId === academyId)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
            .slice(-limit);
    },

    /** Get unread count (simple: messages after last visit). */
    getUnreadCount(academyId, userId) {
        const lastVisitKey = `sportify_chat_last_visit_${academyId}_${userId}`;
        const lastVisit = localStorage.getItem(lastVisitKey);
        if (!lastVisit) return this.getMessages(academyId).length;
        return AcademyChatStore.filter(m =>
            m.academyId === academyId &&
            m.senderId !== userId &&
            new Date(m.timestamp) > new Date(lastVisit)
        ).length;
    },

    /** Mark chat as read. */
    markAsRead(academyId, userId) {
        const key = `sportify_chat_last_visit_${academyId}_${userId}`;
        localStorage.setItem(key, new Date().toISOString());
    },

    /** Get chat members list. */
    getMembers(academyId) {
        const academy = AcademiesStore.getById(academyId);
        if (!academy) return [];

        const coach = getUserById(academy.coachUserId);
        const members = [{ userId: academy.coachUserId, name: coach ? coach.name : 'Coach', role: 'coach' }];

        const enrollments = EnrollmentsStore.filter(e => e.academyId === academyId && e.status === 'active');
        enrollments.forEach(e => {
            members.push({ userId: e.playerId, name: e.playerName, role: 'player' });
        });

        return members;
    }
};
