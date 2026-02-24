/* ============================================
   SPORTIFY — Role & Permission System
   Centralized role definitions, permissions,
   and route protection logic.
   ============================================ */

// ---- Role Definitions ----
const ROLES = {
    player: {
        label: 'Player',
        icon: '⚽',
        badge: 'badge-primary',
        description: 'Browse & book pitches, join tournaments',
        dashboardUrl: 'profile.html'
    },
    pitch_owner: {
        label: 'Pitch Owner',
        icon: '🏟️',
        badge: 'badge-warning',
        description: 'List your pitches & manage bookings',
        dashboardUrl: 'pitch-owner-dashboard.html'
    },
    coach: {
        label: 'Coach',
        icon: '🧑‍🏫',
        badge: 'badge-info',
        description: 'Offer coaching & get hired for sessions',
        dashboardUrl: 'coach-dashboard.html'
    },
    admin: {
        label: 'Admin',
        icon: '⚙️',
        badge: 'badge-danger',
        description: 'Manage users, content & platform settings',
        dashboardUrl: 'admin.html'
    }
};

// ---- Permission Matrix ----
// Each role has a set of allowed actions.
const PERMISSIONS = {
    player: [
        'book_pitch',
        'book_coach',
        'join_tournament',
        'join_match',
        'create_match_request',
        'upload_video',
        'view_pitches',
        'view_academies',
        'enroll_academy',
        'rate_academy',
        'view_profile',
        'view_feed',
        'create_feed_post',
        'like_feed',
        'comment_feed'
    ],
    pitch_owner: [
        'create_pitch',
        'manage_pitches',
        'control_availability',
        'accept_reject_bookings',
        'view_pitch_bookings',
        'create_tournament',
        'manage_subscription',
        'view_profile',
        'view_feed',
        'create_feed_post',
        'like_feed',
        'comment_feed'
    ],
    coach: [
        'create_coach_profile',
        'offer_training_sessions',
        'view_session_requests',
        'accept_reject_sessions',
        'manage_subscription',
        'view_profile',
        'view_feed',
        'create_feed_post',
        'like_feed',
        'comment_feed'
    ],
    admin: [
        'manage_users',
        'manage_content',
        'manage_platform',
        'view_profile',
        'view_all_data',
        'view_feed',
        'create_feed_post',
        'like_feed',
        'comment_feed',
        'reset_data'
    ]
};

// ---- Academy Extension (Coach + Academy) ----
// These permissions are granted ONLY when a coach has created at least one academy.
const ACADEMY_PERMISSIONS = [
    'create_academy',
    'manage_academy',
    'manage_academy_players',
    'track_attendance',
    'track_progress',
    'award_points'
];

// ---- Roles Manager ----
const RolesManager = {

    /**
     * Get all roles for a user.
     * Supports both legacy single-role and new multi-role format.
     * @param {Object} user - user object from session
     * @returns {string[]} array of role strings
     */
    getUserRoles(user) {
        if (!user) return [];
        // New multi-role format
        if (Array.isArray(user.roles) && user.roles.length > 0) {
            return user.roles;
        }
        // Legacy single-role format — backward compatible
        if (user.role) {
            return [user.role];
        }
        return [];
    },

    /**
     * Get the primary role (first role, or legacy role field).
     */
    getPrimaryRole(user) {
        const roles = this.getUserRoles(user);
        return roles[0] || 'player';
    },

    /**
     * Check if user has a specific role.
     */
    hasRole(user, role) {
        return this.getUserRoles(user).includes(role);
    },

    /**
     * Check if user has ANY of the given roles.
     */
    hasAnyRole(user, rolesArray) {
        const userRoles = this.getUserRoles(user);
        return rolesArray.some(r => userRoles.includes(r));
    },

    /**
     * Check if user has a specific permission.
     * Aggregates permissions from ALL user roles.
     */
    hasPermission(user, permission) {
        const userRoles = this.getUserRoles(user);
        // Aggregate all permissions from all roles
        const allPerms = new Set();
        userRoles.forEach(role => {
            (PERMISSIONS[role] || []).forEach(p => allPerms.add(p));
        });

        // Check academy extension permissions for coaches
        if (userRoles.includes('coach')) {
            // All coaches can create academies
            allPerms.add('create_academy');
            // If user has an academy, grant academy management permissions
            if (this._userHasAcademy(user)) {
                ACADEMY_PERMISSIONS.forEach(p => allPerms.add(p));
            }
        }

        return allPerms.has(permission);
    },

    /**
     * Get all permissions for a user (aggregated from all roles).
     */
    getAllPermissions(user) {
        const userRoles = this.getUserRoles(user);
        const allPerms = new Set();
        userRoles.forEach(role => {
            (PERMISSIONS[role] || []).forEach(p => allPerms.add(p));
        });
        if (userRoles.includes('coach')) {
            allPerms.add('create_academy');
            if (this._userHasAcademy(user)) {
                ACADEMY_PERMISSIONS.forEach(p => allPerms.add(p));
            }
        }
        return [...allPerms];
    },

    /**
     * Check if the user has created any academy.
     */
    _userHasAcademy(user) {
        if (!user) return false;
        try {
            return AcademiesStore.filter(a => a.coachUserId === user.id).length > 0;
        } catch { return false; }
    },

    /**
     * Check if user is a "Coach with Academy" (extended coach role).
     */
    isCoachWithAcademy(user) {
        return this.hasRole(user, 'coach') && this._userHasAcademy(user);
    },

    /**
     * Get role display info (label, icon, badge class).
     */
    getRoleInfo(role) {
        return ROLES[role] || { label: role, icon: '👤', badge: 'badge-neutral', description: '', dashboardUrl: 'profile.html' };
    },

    /**
     * Get the dashboard URL for a user (primary role dashboard).
     */
    getDashboardUrl(user) {
        const primaryRole = this.getPrimaryRole(user);
        return this.getRoleInfo(primaryRole).dashboardUrl;
    },

    /**
     * Get all role labels for display (e.g., "Coach · Pitch Owner").
     */
    getRoleLabels(user) {
        return this.getUserRoles(user).map(r => this.getRoleInfo(r).label);
    },

    /**
     * Get all role badges HTML for a user.
     */
    getRoleBadgesHTML(user) {
        return this.getUserRoles(user).map(r => {
            const info = this.getRoleInfo(r);
            return `<span class="badge ${info.badge}">${info.label}</span>`;
        }).join(' ');
    },

    // ---- Route Protection ----

    /**
     * Require that user has at least one of the given roles.
     * Shows access denied UI if not.
     * @param {string[]} allowedRoles - array of allowed role strings
     * @param {string} containerId - optional element ID to show access denied in
     * @returns {boolean} true if access granted
     */
    requireRoles(allowedRoles, containerId) {
        const user = Auth.getCurrentUser();
        if (!user) {
            window.location.href = 'login.html';
            return false;
        }
        if (!this.hasAnyRole(user, allowedRoles)) {
            if (containerId) {
                const el = document.getElementById(containerId);
                if (el) {
                    const roleNames = allowedRoles.map(r => this.getRoleInfo(r).label).join(' or ');
                    el.innerHTML = `
                        <div class="card text-center" style="padding:var(--s-16);">
                            <h3>🔒 Access Denied</h3>
                            <p class="text-faint mt-1">This page is for <strong>${roleNames}</strong> only.</p>
                            <a href="profile.html" class="btn btn-primary mt-3">Go to Profile</a>
                        </div>`;
                }
            } else {
                showToast('Access denied. Insufficient permissions.', 'error');
            }
            return false;
        }
        return true;
    },

    /**
     * Require a specific permission (more granular than role check).
     */
    requirePermission(permission) {
        const user = Auth.getCurrentUser();
        if (!user) {
            window.location.href = 'login.html';
            return false;
        }
        if (!this.hasPermission(user, permission)) {
            showToast('You do not have permission to perform this action.', 'error');
            return false;
        }
        return true;
    }
};
