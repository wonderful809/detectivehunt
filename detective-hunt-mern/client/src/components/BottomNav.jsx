export default function BottomNav({ activeView, onSwitch }) {
    return (
        <nav className="bottom-nav">
            <button
                className={`nav-btn ${activeView === 'game' ? 'active' : ''}`}
                onClick={() => onSwitch('game')}
            >
                <span className="nav-icon">🔍</span> Hunt
            </button>
            <button
                className={`nav-btn ${activeView === 'leaderboard' ? 'active' : ''}`}
                onClick={() => onSwitch('leaderboard')}
            >
                <span className="nav-icon">🏆</span> Ranks
            </button>
        </nav>
    );
}
