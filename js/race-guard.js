/* ============================================
   SPORTIFY — Race Condition Guards
   Centralized locking & debounce utilities.
   Prevents duplicate clicks, double bookings,
   and simultaneous like/join actions.
   ============================================ */

const RaceGuard = {
    _locks: new Set(),
    _debounceTimers: {},

    /**
     * Acquire a named lock. Returns true if acquired, false if already held.
     * Auto-releases after timeoutMs to prevent deadlocks.
     */
    acquire(key, timeoutMs = 2000) {
        if (this._locks.has(key)) return false;
        this._locks.add(key);
        setTimeout(() => this._locks.delete(key), timeoutMs);
        return true;
    },

    /** Release a lock explicitly. */
    release(key) {
        this._locks.delete(key);
    },

    /** Check if a lock is currently held. */
    isLocked(key) {
        return this._locks.has(key);
    },

    /**
     * Debounced action — only fires after delay if no new calls arrive.
     * Great for search inputs and filter changes.
     */
    debounce(key, fn, delayMs = 300) {
        clearTimeout(this._debounceTimers[key]);
        this._debounceTimers[key] = setTimeout(fn, delayMs);
    },

    /**
     * One-time action guard — prevents repeat execution within cooldown.
     * Returns true if the action ran, false if blocked.
     * Usage: RaceGuard.oneTimeAction('like_v1_u2', () => { ... });
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
    },

    /**
     * Check if user already performed a persistent action (stored in localStorage).
     * Used for like-once-only across page reloads.
     */
    hasPerformed(storageKey, actionKey) {
        try {
            const data = JSON.parse(localStorage.getItem(storageKey) || '{}');
            return !!data[actionKey];
        } catch { return false; }
    },

    /** Record that a user performed a persistent action. */
    recordAction(storageKey, actionKey) {
        try {
            const data = JSON.parse(localStorage.getItem(storageKey) || '{}');
            data[actionKey] = Date.now();
            localStorage.setItem(storageKey, JSON.stringify(data));
        } catch { /* fail silently */ }
    },

    /** Remove a recorded persistent action. */
    removeAction(storageKey, actionKey) {
        try {
            const data = JSON.parse(localStorage.getItem(storageKey) || '{}');
            delete data[actionKey];
            localStorage.setItem(storageKey, JSON.stringify(data));
        } catch { /* fail silently */ }
    }
};
