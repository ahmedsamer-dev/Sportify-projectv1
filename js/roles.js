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
        description: 'Browse venues, join matches, and enroll in elite academies.',
        dashboardUrl: 'profile.html'
    },
    pitch_owner: {
        label: 'Pitch Owner',
        icon: '🏟️',
        badge: 'badge-warning',
        description: 'Manage your sports facilities and host prestigious tournaments.',
        dashboardUrl: 'pitch-owner-dashboard.html'
    },
    coach: {
        label: 'Coach / Academy Owner',
        icon: '🧑‍🏫',
        badge: 'badge-info',
        description: 'Build your academy, mentor athletes, and manage enrollments.',
        dashboardUrl: 'coach-dashboard.html'
    },
    admin: {
        label: 'Admin',
        icon: '⚙️',
        badge: 'badge-danger',
        description: 'Global system administration and data integrity.',
        dashboardUrl: 'admin.html'
    }
};

// ---- Permission Matrix (Strict Enforcement) ----
const PERMISSIONS = {
    player: [
        'view_pitches',
        'book_pitch',            // Send booking request
        'view_match',
        'join_match',
        'create_match',
        'use_find_teammates',
        'join_tournament',
        'view_coaches',
        'enroll_academy',
        'access_academy_chat',   // Only if enrolled
        'view_feed',
        'create_feed_post'
    ],
    pitch_owner: [
        'add_pitch',
        'manage_pitches',
        'manage_availability',
        'accept_reject_booking',
        'create_tournament',
        'view_linked_academies',
        'view_feed',
        'create_feed_post'
    ],
    coach: [
        'create_academy',
        'manage_academy',
        'accept_enrollment',
        'manage_sessions',
        'chat_with_students',
        'view_feed',
        'create_feed_post'
    ],
    admin: [
        'manage_users',
        'manage_content',
        'manage_platform',
        'view_all_data',
        'reset_data'
    ]
};

// ---- Academy Extension Permissions (Dynamic) ----
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
    },

    /**
     * ADMIN ONLY: Change the role of a user.
     * Enforces single role assignment and permission validation.
     */
    async changeUserRole(adminUser, targetUserId, newRole) {
        // Validation: ONLY Admin can change roles
        if (!adminUser || adminUser.role !== 'admin') {
            console.error('Unauthorized: Only ADMIN can change user roles.');
            return { success: false, message: 'Unauthorized' };
        }

        // Simulate API delay
        await new Promise(r => setTimeout(r, 500));

        const users = UsersStore.getAll();
        const userIdx = users.findIndex(u => u.id === targetUserId);

        if (userIdx === -1) {
            return { success: false, message: 'User not found' };
        }

        // Update role (Single role assignment)
        users[userIdx].role = newRole;
        users[userIdx].roles = [newRole]; // Keep roles array in sync

        // Save to DB
        localStorage.setItem('mal3abak_users', JSON.stringify(users));

        return { success: true, message: 'Role updated successfully' };
    }
};
