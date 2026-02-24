/* ============================================
   SPORTIFY — Authentication Module
   Login, Register, Session Management
   (Updated for multi-role support)
   ============================================ */

const Auth = {
    SESSION_KEY: 'mal3abak_session',
    TOKEN_KEY: 'sportify_auth_token',

    // Get current logged-in user
    getCurrentUser() {
        return DB.getOne(this.SESSION_KEY);
    },

    // Check if user is logged in
    isLoggedIn() {
        return this.getCurrentUser() !== null;
    },

    // Simulated API call for Login
    async login(email, password) {
        // Validation
        if (!email || !password) return { success: false, message: 'Please enter all fields.' };

        // Simulate network delay
        await new Promise(r => setTimeout(r, 800));

        const users = UsersStore.getAll();
        const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);

        if (!user) return { success: false, message: 'Invalid email or password. Please try again.' };

        const session = { ...user };
        delete session.password;

        // Ensure roles array is present for compatibility
        if (!session.roles) session.roles = [session.role];

        // Store Token & Session
        const token = 'jwt_' + DB.generateId();
        DB.setOne(this.TOKEN_KEY, token);
        DB.setOne(this.SESSION_KEY, session);

        return { success: true, user: session, token };
    },

    // Registration (Extended payload)
    async register(payload) {
        const { name, email, password, role, age, governorate, city, preferredSport, phone } = payload;

        // Validation
        if (!name || !email || !password || !role) return { success: false, message: 'Missing required account info.' };
        if (password.length < 6) return { success: false, message: 'Password must be at least 6 characters.' };
        if (age && parseInt(age) < 12) return { success: false, message: 'Minimum age required is 12 years.' };

        // Simulate network delay
        await new Promise(r => setTimeout(r, 1000));

        const users = UsersStore.getAll();
        if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
            return { success: false, message: 'This email is already registered.' };
        }

        const newUser = {
            id: DB.generateId(),
            name,
            email,
            password,
            role,                 // Legacy primary role
            roles: [role],        // Multi-role array
            age: parseInt(age) || null,
            governorate: governorate || '',
            city: city || '',
            preferredSport: preferredSport || 'football',
            phone: phone || '',
            avatar: '',
            createdAt: new Date().toISOString().split('T')[0]
        };

        UsersStore.add(newUser);

        // If coach, initialize profile
        if (role === 'coach') {
            CoachesStore.add({
                userId: newUser.id,
                specialty: 'General',
                experience: 0,
                hourlyRate: 100,
                rating: 0,
                bio: 'Professional coach on SPORTIFY'
            });
        }

        const session = { ...newUser };
        delete session.password;

        // Auto-login after register
        const token = 'jwt_' + DB.generateId();
        DB.setOne(this.TOKEN_KEY, token);
        DB.setOne(this.SESSION_KEY, session);

        return { success: true, user: session, token };
    },

    // Logout
    logout() {
        DB.remove(this.SESSION_KEY);
        DB.remove(this.TOKEN_KEY);
        window.location.href = 'index.html';
    },

    // Role-based Access Control
    hasRole(role) {
        const user = this.getCurrentUser();
        if (!user) return false;
        return (user.roles || [user.role]).includes(role);
    },

    // Redirect to proper dashboard
    getRedirectUrl(user) {
        if (!user) return 'login.html';
        if (user.role === 'admin') return 'admin.html';
        if (user.role === 'coach') return 'coach-dashboard.html';
        if (user.role === 'pitch_owner') return 'pitch-owner-dashboard.html';
        return 'profile.html';
    },

    // Protected Route Guard
    requireAuth() {
        if (!this.isLoggedIn()) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    },

    requireRole(role) {
        if (!this.requireAuth()) return false;
        if (!this.hasRole(role)) {
            window.location.href = 'profile.html';
            return false;
        }
        return true;
    }
};
