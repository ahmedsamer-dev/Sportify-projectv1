/* ============================================
   SPORTIFY — Sports Module Configuration
   Multi-sport architecture preparation.
   Current scope: FOOTBALL MODULE only.
   Future: Padel, Basketball, etc.
   ============================================ */

const SPORTS_MODULES = {
    football: {
        id: 'football',
        name: 'Football',
        icon: '⚽',
        color: '#10B981',
        active: true,
        features: [
            'pitch_booking', 'coach_booking', 'academy',
            'tournament', 'video_competition', 'social_feed',
            'matchmaking'
        ]
    }
    // Future modules:
    // padel:      { id: 'padel',      name: 'Padel',      icon: '🎾', color: '#6366F1', active: false, features: [] },
    // basketball: { id: 'basketball', name: 'Basketball', icon: '🏀', color: '#F59E0B', active: false, features: [] }
};

const CURRENT_SPORT = 'football';

function getSportConfig(sportId) {
    return SPORTS_MODULES[sportId || CURRENT_SPORT] || SPORTS_MODULES.football;
}

function getSportIcon(sportId) {
    return getSportConfig(sportId).icon;
}

function getSportName(sportId) {
    return getSportConfig(sportId).name;
}

function isSportFeatureEnabled(feature, sportId) {
    const config = getSportConfig(sportId);
    return config.active && config.features.includes(feature);
}
