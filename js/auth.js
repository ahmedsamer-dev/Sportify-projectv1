/* ============================================
   SPORTIFY — Authentication Module
   Login, Register, Session Management
   (Updated for multi-role support)
   ============================================ */

const Auth = {
    SESSION_KEY: 'mal3abak_session',

    // Get current logged-in user
    getCurrentUser() {
        return DB.getOne(this.SESSION_KEY);
    },

    // Check if user is logged in
    isLoggedIn() {
        return this.getCurrentUser() !== null;
    },

    // Login
    login(email, password) {
        const users = UsersStore.getAll();
        const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
        if (!user) return { success: false, message: 'Invalid email or password' };
        const session = { ...user };
        delete session.password;
        // Ensure roles array is present in session
        if (!session.roles) {
            session.roles = [session.role];
        }
        DB.setOne(this.SESSION_KEY, session);
        return { success: true, user: session };
    },

    // Register (supports multi-role via roles array)
    register(name, email, password, role, phone = '', additionalRoles = []) {
        const users = UsersStore.getAll();
        if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
            return { success: false, message: 'Email already registered' };
        }

        // Build roles array: primary role + any additional roles
        const roles = [role];
        if (additionalRoles && additionalRoles.length > 0) {
            additionalRoles.forEach(r => {
                if (!roles.includes(r)) roles.push(r);
            });
        }

        const newUser = {
            id: DB.generateId(),
            name, email, password,
            role,                 // legacy single role (primary)
            roles,                // new multi-role array
            phone, avatar: '',
            createdAt: new Date().toISOString().split('T')[0]
        };
        UsersStore.add(newUser);

        // If coach (any role combination), create coach profile
        if (roles.includes('coach')) {
            CoachesStore.add({
                userId: newUser.id, specialty: 'General',
                experience: 0, hourlyRate: 100, rating: 0,
                bio: 'New coach on SPORTIFY'
            });
        }

        const session = { ...newUser };
        delete session.password;
        DB.setOne(this.SESSION_KEY, session);
        return { success: true, user: session };
    },

    // Logout
    logout() {
        DB.remove(this.SESSION_KEY);
        window.location.href = 'index.html';
    },

    // Check role — backward compatible, also checks roles array
    hasRole(role) {
        const user = this.getCurrentUser();
        if (!user) return false;
        // Check new multi-role array first
        if (Array.isArray(user.roles) && user.roles.includes(role)) return true;
        // Fallback to legacy single role
        return user.role === role;
    },

    // Check if user has ANY of the given roles
    hasAnyRole(rolesArray) {
        const user = this.getCurrentUser();
        if (!user) return false;
        return RolesManager.hasAnyRole(user, rolesArray);
    },

    // Require login — redirect if not authenticated
    requireAuth() {
        if (!this.isLoggedIn()) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    },

    // Require specific role (backward compatible)
    requireRole(role) {
        if (!this.requireAuth()) return false;
        if (!this.hasRole(role)) {
            showToast('Access denied. Insufficient permissions.', 'error');
            return false;
        }
        return true;
    },

    // Add a role to the current user (for multi-role)
    addRole(role) {
        const user = this.getCurrentUser();
        if (!user) return false;
        const roles = RolesManager.getUserRoles(user);
        if (roles.includes(role)) return true; // already has role

        roles.push(role);
        // Update stored user
        const fullUser = UsersStore.getById(user.id);
        if (fullUser) {
            UsersStore.update(user.id, { roles });
        }
        // Update session
        user.roles = roles;
        DB.setOne(this.SESSION_KEY, user);
        return true;
    },

    // Refresh session data from store (call after external updates)
    refreshSession() {
        const user = this.getCurrentUser();
        if (!user) return;
        const fullUser = UsersStore.getById(user.id);
        if (fullUser) {
            const session = { ...fullUser };
            delete session.password;
            if (!session.roles) session.roles = [session.role];
            DB.setOne(this.SESSION_KEY, session);
        }
    }
};
