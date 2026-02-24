/* ============================================
   SPORTIFY — Subscription Management
   Business Model: Platform as connector.
   Players: FREE (never pay).
   Revenue: Pitch Owner + Coach subscriptions.
   ============================================ */

const SUBSCRIPTION_PLANS = {
    pitch_owner_basic: {
        id: 'pitch_owner_basic',
        name: 'Pitch Owner Basic',
        price: 200,
        currency: 'EGP',
        period: 'monthly',
        role: 'pitch_owner',
        features: ['list_pitches', 'manage_bookings', 'create_tournaments'],
        limits: { maxPitches: 5 },
        sportModule: 'football'
    },
    coach_basic: {
        id: 'coach_basic',
        name: 'Coach Basic',
        price: 200,
        currency: 'EGP',
        period: 'monthly',
        role: 'coach',
        features: ['coaching_profile', 'accept_bookings', 'create_academy'],
        limits: { maxAcademies: 2 },
        sportModule: 'football'
    },
    coach_premium: {
        id: 'coach_premium',
        name: 'Coach Premium',
        price: 500,
        currency: 'EGP',
        period: 'monthly',
        role: 'coach',
        features: ['coaching_profile', 'accept_bookings', 'create_academy', 'unlimited_academies', 'priority_listing'],
        limits: { maxAcademies: 10 },
        sportModule: 'football'
    }
};

const SubscriptionManager = {
    /** Get active subscription for a user. */
    getUserSubscription(userId) {
        return SubscriptionsStore.filter(s =>
            s.userId === userId && s.status === 'active'
        )[0] || null;
    },

    /** Check if user has an active subscription. */
    isSubscribed(userId) {
        return this.getUserSubscription(userId) !== null;
    },

    /** Get subscription plan details. */
    getPlan(planId) {
        return SUBSCRIPTION_PLANS[planId] || null;
    },

    /** Get max academies allowed for a coach user. */
    getMaxAcademies(userId) {
        const sub = this.getUserSubscription(userId);
        if (!sub) return 2; // Default free tier allows 2
        const plan = SUBSCRIPTION_PLANS[sub.planId];
        return plan ? (plan.limits.maxAcademies || 2) : 2;
    },

    /** Check if coach can create another academy. */
    canCreateAcademy(userId) {
        const max = this.getMaxAcademies(userId);
        const current = AcademiesStore.filter(a => a.coachUserId === userId).length;
        return current < max;
    },

    /** Get current academy count for a user. */
    getAcademyCount(userId) {
        return AcademiesStore.filter(a => a.coachUserId === userId).length;
    },

    /** Get subscription status badge HTML. */
    getStatusBadgeHTML(userId) {
        const sub = this.getUserSubscription(userId);
        if (!sub) {
            return '<span class="badge badge-neutral">No Subscription</span>';
        }
        const plan = SUBSCRIPTION_PLANS[sub.planId];
        const statusClass = sub.status === 'active' ? 'badge-accent' : 'badge-warning';
        return `<span class="badge ${statusClass}">${plan ? plan.name : sub.planId} — ${sub.status}</span>`;
    },

    /** Get subscription info card HTML for dashboards. */
    getInfoCardHTML(userId) {
        const sub = this.getUserSubscription(userId);
        const plan = sub ? SUBSCRIPTION_PLANS[sub.planId] : null;

        if (!sub || !plan) {
            return `
            <div class="card" style="border-color:var(--warning);background:var(--warning-subtle);padding:var(--s-4) var(--s-5);">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--s-3);">
                    <div>
                        <div style="font-weight:700;color:var(--text-h);font-size:0.9rem;">💳 No Active Subscription</div>
                        <div class="text-sm text-faint">Subscribe to unlock all features — starting at 200 EGP/month</div>
                    </div>
                    <a href="subscription.html" class="btn btn-primary btn-sm">View Plans</a>
                </div>
            </div>`;
        }

        return `
        <div class="card" style="border-color:var(--accent);padding:var(--s-4) var(--s-5);">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--s-3);">
                <div>
                    <div style="font-weight:700;color:var(--text-h);font-size:0.9rem;">💳 ${plan.name}</div>
                    <div class="text-sm text-faint">${plan.price} ${plan.currency}/${plan.period} · Expires ${sub.endDate || 'N/A'}</div>
                </div>
                <span class="badge badge-accent">${sub.status}</span>
            </div>
        </div>`;
    }
};
