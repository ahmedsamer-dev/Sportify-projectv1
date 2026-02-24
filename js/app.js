/* ============================================
   SPORTIFY — App Utilities v5
   Sports-Tech Navigation, Toasts, Common Helpers
   Athletic Identity & Micro-Interactions
   ============================================ */

// ---- Navigation ----
function buildNavbar(activePage = '') {
  const user = Auth.getCurrentUser();
  const isLogged = Auth.isLoggedIn();

  const navLinks = [
    { href: 'index.html', label: 'Home', icon: '⚡', page: 'home' },
    { href: 'pitches.html', label: 'Pitches', icon: '🏟️', page: 'pitches' },
    { href: 'coaches.html', label: 'Coaches', icon: '🧑‍🏫', page: 'coaches' },
    { href: 'academies.html', label: 'Academies', icon: '🎓', page: 'academies' },
    { href: 'tournaments.html', label: 'Tournaments', icon: '🏆', page: 'tournaments' },
    { href: 'feed.html', label: 'Feed', icon: '📱', page: 'feed' },
  ];

  if (isLogged) {
    const roles = RolesManager.getUserRoles(user);
    navLinks.push({ href: 'matchmaking.html', label: 'Find Players', icon: '🤝', page: 'matchmaking' });
    navLinks.push({ href: 'leaderboard.html', label: 'Leaderboard', icon: '🏆', page: 'leaderboard' });
    if (roles.includes('pitch_owner')) {
      navLinks.push({ href: 'pitch-owner-dashboard.html', label: 'My Pitches', icon: '📋', page: 'pitch-owner-dashboard' });
    }
    if (roles.includes('coach')) {
      navLinks.push({ href: 'coach-dashboard.html', label: 'Coach Panel', icon: '📊', page: 'coach-dashboard' });
      if (RolesManager.isCoachWithAcademy(user)) {
        navLinks.push({ href: 'academy-dashboard.html', label: 'Academy', icon: '🎓', page: 'academy-dashboard' });
      }
    }
    if (roles.includes('admin')) {
      navLinks.push({ href: 'admin.html', label: 'Admin', icon: '⚙️', page: 'admin' });
    }
  }

  const primaryCount = 6;
  const primaryLinks = navLinks.slice(0, primaryCount);
  const overflowLinks = navLinks.slice(primaryCount);

  let linksHTML = primaryLinks.map(l =>
    `<a href="${l.href}" class="${activePage === l.page ? 'active' : ''}">${l.label}</a>`
  ).join('');

  if (overflowLinks.length > 0) {
    const overflowItems = overflowLinks.map(l =>
      `<a href="${l.href}" class="dropdown-item ${activePage === l.page ? 'active' : ''}">${l.icon} ${l.label}</a>`
    ).join('');
    linksHTML += `
      <div class="nav-more-wrap" style="position:relative;">
        <button class="btn btn-ghost btn-sm" onclick="toggleNavMore(event)" style="font-size:0.82rem;border-radius:var(--r-full);">More ▾</button>
        <div class="nav-more-dropdown" id="navMoreDropdown" style="display:none;position:absolute;top:calc(100% + 8px);right:0;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-lg);box-shadow:var(--shadow-lg);z-index:200;min-width:180px;padding:var(--s-2);overflow:hidden;">
          ${overflowItems}
        </div>
      </div>`;
  }

  const userHTML = isLogged
    ? `<div class="nav-user">
         <a href="profile.html" class="nav-avatar" title="${user.name}">${user.name.charAt(0).toUpperCase()}</a>
         <button class="btn btn-sm btn-ghost" onclick="Auth.logout()" style="border-radius:var(--r-full);">Log out</button>
       </div>`
    : `<div class="nav-user">
         <a href="login.html" class="btn btn-sm btn-ghost" style="border-radius:var(--r-full);">Log in</a>
         <a href="register.html" class="btn btn-sm btn-primary">Sign up</a>
       </div>`;

  return `
  <nav class="navbar">
    <div class="container flex-between">
      <a href="index.html" class="nav-logo">⚽ SPORTIFY</a>
      <button class="hamburger" onclick="toggleMobileNav()" aria-label="Toggle menu">
        <span></span><span></span><span></span>
      </button>
      <div class="nav-links" id="navLinks">${linksHTML}</div>
      ${userHTML}
    </div>
  </nav>`;
}

// ---- Nav More Dropdown Toggle ----
function toggleNavMore(e) {
  e && e.stopPropagation();
  const dd = document.getElementById('navMoreDropdown');
  if (dd) {
    const isVisible = dd.style.display !== 'none';
    dd.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
      dd.style.animation = 'fadeUp 0.2s var(--ease-bounce)';
    }
  }
}

document.addEventListener('click', () => {
  const dd = document.getElementById('navMoreDropdown');
  if (dd) dd.style.display = 'none';
});

// ---- Footer ----
function buildFooter() {
  return `
  <footer class="footer">
    <div class="container">
      <div class="footer-content">
        <div class="footer-brand">
          <div class="nav-logo" style="font-size:1.2rem;margin-bottom:var(--s-2);">⚽ SPORTIFY</div>
          <p>The ultimate digital sports community. Book pitches, find coaches, compete in tournaments, and connect with athletes.</p>
        </div>
        <div>
          <h4>Platform</h4>
          <ul>
            <li><a href="pitches.html">Browse Pitches</a></li>
            <li><a href="coaches.html">Find Coaches</a></li>
            <li><a href="academies.html">Academies</a></li>
            <li><a href="tournaments.html">Tournaments</a></li>
            <li><a href="feed.html">Social Feed</a></li>
            <li><a href="matchmaking.html">Find Players</a></li>
            <li><a href="leaderboard.html">Leaderboard</a></li>
          </ul>
        </div>
        <div>
          <h4>Account</h4>
          <ul>
            <li><a href="login.html">Log in</a></li>
            <li><a href="register.html">Register</a></li>
            <li><a href="profile.html">Profile</a></li>
            <li><a href="competition.html">Competition</a></li>
            <li><a href="subscription.html">Subscription</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">&copy; 2026 SPORTIFY &middot; The Game Starts Here</div>
    </div>
  </footer>`;
}

// ---- Toast ----
function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<strong>${icons[type] || 'ℹ'}</strong> ${message}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ---- Mobile Nav ----
function toggleMobileNav() {
  document.getElementById('navLinks')?.classList.toggle('open');
}

// ---- Helpers ----
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}

function getStarRating(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}

function getUserById(id) { return UsersStore.getById(id); }
function getCoachByUserId(userId) { return CoachesStore.filter(c => c.userId === userId)[0] || null; }

// ---- Animated Counter ----
function animateCounter(el, target, duration = 1200) {
  let start = 0;
  const increment = target / (duration / 16);
  const suffix = el.dataset.suffix || '';
  const prefix = el.dataset.prefix || '';

  function update() {
    start += increment;
    if (start >= target) {
      el.textContent = prefix + Math.round(target).toLocaleString() + suffix;
      return;
    }
    el.textContent = prefix + Math.round(start).toLocaleString() + suffix;
    requestAnimationFrame(update);
  }
  update();
}

// Auto-animate counters on scroll
function initCounters() {
  const counters = document.querySelectorAll('[data-count]');
  if (!counters.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.dataset.counted) {
        entry.target.dataset.counted = 'true';
        const target = parseInt(entry.target.dataset.count);
        animateCounter(entry.target, target);
      }
    });
  }, { threshold: 0.3 });

  counters.forEach(c => observer.observe(c));
}

// ---- Admin Reset (Demo Safety) ----
function resetAllDemoData() {
  if (confirm('⚠️ Reset ALL data to demo state? This will log you out and clear everything.')) {
    localStorage.removeItem('sportify_subscriptions');
    localStorage.removeItem('sportify_feed_posts');
    localStorage.removeItem('sportify_feed_comments');
    localStorage.removeItem('sportify_feed_reactions');
    localStorage.removeItem('sportify_academy_chat');
    localStorage.removeItem('sportify_match_requests');
    localStorage.removeItem('sportify_feed_likes_map');
    localStorage.removeItem('sportify_video_likes');
    localStorage.removeItem('sportify_sport_profiles');
    localStorage.removeItem('sportify_player_ratings');
    localStorage.removeItem('sportify_rating_dedup');
    localStorage.removeItem('mal3abak_users');
    localStorage.removeItem('mal3abak_pitches');
    localStorage.removeItem('mal3abak_bookings');
    localStorage.removeItem('mal3abak_coaches');
    localStorage.removeItem('mal3abak_videos');
    localStorage.removeItem('mal3abak_tournaments');
    localStorage.removeItem('mal3abak_academies');
    localStorage.removeItem('mal3abak_enrollments');
    localStorage.removeItem('mal3abak_academy_ratings');
    localStorage.removeItem('mal3abak_academy_points');
    localStorage.removeItem('mal3abak_coach_bookings');
    seedDatabase(true);
    Auth.logout();
    showToast('All data reset to demo state! 🔄', 'success');
    setTimeout(() => window.location.href = 'index.html', 1500);
  }
}

// ---- Init ----
function initPage(pageName) {
  try {
    const navTarget = document.getElementById('navbar');
    const footerTarget = document.getElementById('footer');
    if (navTarget) navTarget.outerHTML = buildNavbar(pageName);
    if (footerTarget) footerTarget.outerHTML = buildFooter();

    // Stagger animations
    document.querySelectorAll('.animate-in').forEach((el, i) => {
      el.style.animationDelay = `${i * 0.06}s`;
    });

    // Init animated counters
    initCounters();

    // Add dropdown item styles dynamically
    const dropdownStyle = document.createElement('style');
    dropdownStyle.textContent = `
      .dropdown-item {
        display: block;
        padding: 10px 16px;
        white-space: nowrap;
        color: var(--text-faint);
        font-size: 0.85rem;
        border-radius: var(--r-md);
        transition: all 0.15s ease;
        text-decoration: none;
      }
      .dropdown-item:hover {
        color: var(--text-h);
        background: rgba(255,255,255,0.04);
      }
      .dropdown-item.active {
        color: var(--primary);
        background: var(--primary-subtle);
      }
    `;
    document.head.appendChild(dropdownStyle);

    // Initialize Premium UI System
    PremiumUI.init();

  } catch (e) {
    console.error('SPORTIFY page init error:', e);
    const fallback = document.createElement('div');
    fallback.style.cssText = 'position:fixed;top:0;left:0;right:0;padding:14px 24px;background:linear-gradient(90deg,var(--danger),#FF1744);color:white;z-index:9999;text-align:center;font-size:0.9rem;font-family:var(--font-display);';
    fallback.innerHTML = '⚠️ Something went wrong loading this page. <a href="index.html" style="color:white;text-decoration:underline;font-weight:700;">Go Home</a>';
    document.body.prepend(fallback);
  }
}

/**
 * SPORTIFY PREMIUM UI SYSTEM
 * Automatically polishes hierarchy, spacing, and depth.
 */
const PremiumUI = {
  init() {
    this.stabilizeSpacing();
    this.applyAtmosphericGlows();
    this.enhanceIconMotion();
  },

  stabilizeSpacing() {
    // Reset individual section padding-top overrides to allow global CSS system to take over
    document.querySelectorAll('section[style*="padding-top:0"]').forEach(sec => {
      sec.style.setProperty('padding-top', '', 'important');
    });
  },

  applyAtmosphericGlows() {
    // Apply modern depth layer to major content sections
    document.querySelectorAll('section.main-content, section.hero, section.cta-banner').forEach(sec => {
      sec.classList.add('section-glow');
    });
  },

  enhanceIconMotion() {
    // Apply dynamic kinetic motion to all identifying icons and avatars
    document.querySelectorAll('.pillar-icon, .card-icon, .stat-icon, .coach-card-avatar, .feed-avatar, .nav-avatar').forEach(icon => {
      icon.classList.add('icon-dynamic');
    });
  }
};
