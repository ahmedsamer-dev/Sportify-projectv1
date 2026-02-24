/* ============================================
   SPORTIFY — Smart Sports Social Feed
   Like / Dislike reaction system.
   Comments, trending algorithm.
   Anti race condition protected.
   ============================================ */

const FeedInteractions = {
    LIKE_STORAGE_KEY: 'sportify_feed_likes_map',    // legacy compat
    REACTION_TYPES: { LIKE: 'LIKE', DISLIKE: 'DISLIKE' },

    // ============ REACTION SYSTEM (NEW) ============

    /**
     * Get a user's current reaction on a post.
     * Returns the Reaction record or null.
     */
    getUserReaction(postId, userId) {
        return FeedReactionsStore.filter(
            r => r.postId === postId && r.userId === userId
        )[0] || null;
    },

    /**
     * Toggle a reaction (LIKE or DISLIKE) on a post.
     * Rules:
     *  - Same type clicked again → remove reaction
     *  - Different type clicked → switch to new type
     *  - No reaction → add new reaction
     *
     * Race-condition safe via RaceGuard lock.
     * Returns { reaction: 'LIKE'|'DISLIKE'|null, likes, dislikes }
     */
    toggleReaction(postId, userId, reactionType) {
        // Layer 1: In-memory lock (prevents rapid double-click)
        const lockKey = `feed_reaction_${postId}_${userId}`;
        if (!RaceGuard.acquire(lockKey, 800)) {
            return null; // Blocked — still processing
        }

        try {
            const post = FeedPostsStore.getById(postId);
            if (!post) return null;

            const existing = this.getUserReaction(postId, userId);
            let likes = post.likes || 0;
            let dislikes = post.dislikes || 0;
            let finalReaction = null;

            if (existing) {
                if (existing.type === reactionType) {
                    // Same type → remove reaction (toggle off)
                    FeedReactionsStore.delete(existing.id);
                    if (reactionType === 'LIKE') likes = Math.max(0, likes - 1);
                    else dislikes = Math.max(0, dislikes - 1);
                    finalReaction = null;

                    // Legacy compat: sync old likes map
                    RaceGuard.removeAction(this.LIKE_STORAGE_KEY, `${postId}_${userId}`);
                } else {
                    // Different type → switch reaction
                    FeedReactionsStore.update(existing.id, {
                        type: reactionType,
                        createdAt: new Date().toISOString()
                    });

                    // Decrement old, increment new
                    if (existing.type === 'LIKE') {
                        likes = Math.max(0, likes - 1);
                        dislikes += 1;
                    } else {
                        dislikes = Math.max(0, dislikes - 1);
                        likes += 1;
                    }
                    finalReaction = reactionType;

                    // Legacy compat
                    if (reactionType === 'LIKE') {
                        RaceGuard.recordAction(this.LIKE_STORAGE_KEY, `${postId}_${userId}`);
                    } else {
                        RaceGuard.removeAction(this.LIKE_STORAGE_KEY, `${postId}_${userId}`);
                    }
                }
            } else {
                // No existing reaction → add new
                FeedReactionsStore.add({
                    userId,
                    postId,
                    type: reactionType,
                    createdAt: new Date().toISOString()
                });

                if (reactionType === 'LIKE') likes += 1;
                else dislikes += 1;
                finalReaction = reactionType;

                // Legacy compat
                if (reactionType === 'LIKE') {
                    RaceGuard.recordAction(this.LIKE_STORAGE_KEY, `${postId}_${userId}`);
                }
            }

            // Atomic counter update
            FeedPostsStore.update(postId, { likes, dislikes });

            return { reaction: finalReaction, likes, dislikes };
        } finally {
            RaceGuard.release(lockKey);
        }
    },

    /**
     * Get reaction counts for a post.
     */
    getReactionCounts(postId) {
        const post = FeedPostsStore.getById(postId);
        return {
            likes: post?.likes || 0,
            dislikes: post?.dislikes || 0
        };
    },

    // ============ LEGACY COMPAT ============

    /** Check if a user already liked a post (backward compatible). */
    hasLiked(postId, userId) {
        const r = this.getUserReaction(postId, userId);
        return r && r.type === 'LIKE';
    },

    /** Check if a user already disliked a post. */
    hasDisliked(postId, userId) {
        const r = this.getUserReaction(postId, userId);
        return r && r.type === 'DISLIKE';
    },

    /**
     * Legacy toggleLike — now routes through toggleReaction.
     * Preserved for any external callers.
     */
    toggleLike(postId, userId) {
        const result = this.toggleReaction(postId, userId, 'LIKE');
        if (!result) return null;
        return { liked: result.reaction === 'LIKE', newCount: result.likes };
    },

    // ============ COMMENTS ============

    /** Add a comment to a post. */
    addComment(postId, userId, userName, text) {
        if (!text || !text.trim()) return null;
        const comment = FeedCommentsStore.add({
            postId, userId, userName,
            text: text.trim(),
            createdAt: new Date().toISOString()
        });
        // Update cached count
        const post = FeedPostsStore.getById(postId);
        if (post) {
            FeedPostsStore.update(postId, { commentsCount: (post.commentsCount || 0) + 1 });
        }
        return comment;
    },

    /** Get comments for a post, newest first. */
    getComments(postId) {
        return FeedCommentsStore.filter(c => c.postId === postId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    // ============ TRENDING ============

    /** Calculate trending score (engagement × time decay). Dislikes reduce score. */
    getTrendingScore(post) {
        const ageHours = (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);
        const decay = Math.pow(0.95, ageHours / 24);
        const engagement = ((post.likes || 0) * 2) - ((post.dislikes || 0) * 1) + ((post.commentsCount || 0) * 3);
        return Math.max(0, engagement) * decay;
    },

    /** Get feed posts sorted by trending score. */
    getTrending() {
        return FeedPostsStore.getAll()
            .map(p => ({ ...p, _score: this.getTrendingScore(p) }))
            .sort((a, b) => b._score - a._score);
    },

    /** Get feed posts filtered by type. */
    getByFilter(filter) {
        const all = FeedPostsStore.getAll();
        switch (filter) {
            case 'popular':
                return all.sort((a, b) => (b.likes || 0) - (a.likes || 0));
            case 'academy':
                return all.filter(p => p.academyId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            case 'nearby':
                return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            default:
                return this.getTrending();
        }
    },

    // ============ CREATE POST ============

    /** Create a new feed post. */
    createPost(userId, data) {
        return FeedPostsStore.add({
            userId,
            type: data.type || 'training_highlight',
            title: data.title,
            description: data.description || '',
            mediaUrl: data.mediaUrl || '#',
            likes: 0,
            dislikes: 0,
            commentsCount: 0,
            location: data.location || '',
            academyId: data.academyId || null,
            tournamentId: data.tournamentId || null,
            tags: data.tags || [],
            sportModule: 'football',
            createdAt: new Date().toISOString()
        });
    }
};
