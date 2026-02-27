import { useState, useEffect, useRef, useCallback } from 'react';
import AnimatedBackground from '../components/AnimatedBackground';
import BottomNav from '../components/BottomNav';
import ToastContainer, { useToast } from '../components/Toast';

function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function spawnConfetti() {
    const emojis = ['🎉', '✨', '🌟', '🏆', '⭐', '💫', '🎊', '🔥'];
    for (let i = 0; i < 20; i++) {
        setTimeout(() => {
            const el = document.createElement('div');
            el.className = 'confetti-particle';
            el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            el.style.left = Math.random() * 100 + 'vw';
            el.style.fontSize = (1 + Math.random() * 1.5) + 'rem';
            el.style.animationDuration = (2 + Math.random() * 2) + 's';
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 4000);
        }, i * 80);
    }
}

export default function PlayerApp() {
    const [view, setView] = useState('login'); // login | wait | game | finish | leaderboard
    const [activeNav, setActiveNav] = useState('game');
    const [showLoginMode, setShowLoginMode] = useState(false);
    const [team, setTeam] = useState(null);
    const [gameState, setGameState] = useState(null);
    const [allClues, setAllClues] = useState([]);
    const [currentClue, setCurrentClue] = useState(null);
    const [timerDisplay, setTimerDisplay] = useState('00:00');
    const [leaderboard, setLeaderboard] = useState([]);
    const [loginError, setLoginError] = useState('');
    const [creating, setCreating] = useState(false);
    const [scannerOpen, setScannerOpen] = useState(false);
    const [feedback, setFeedback] = useState(null); // { type: 'success'|'wrong', message }

    const timerRef = useRef(null);
    const scannerRef = useRef(null);
    const pollRef = useRef(null);
    const { toasts, showToast } = useToast();

    // Restore session on mount
    useEffect(() => {
        const savedId = localStorage.getItem('etrons_team_id');
        if (savedId) restoreSession(savedId);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    const restoreSession = async (teamId) => {
        try {
            const res = await fetch(`/api/teams/${teamId}`);
            if (!res.ok) { localStorage.removeItem('etrons_team_id'); return; }
            const t = await res.json();
            setTeam(t);
            await enterGame(t);
        } catch { localStorage.removeItem('etrons_team_id'); }
    };

    const enterGame = async (t) => {
        const [gsRes, cluesRes, teamRes] = await Promise.all([
            fetch('/api/gamestate'),
            fetch('/api/clues'),
            fetch(`/api/teams/${t._id}`),
        ]);
        const gs = await gsRes.json();
        const clues = await cluesRes.json();
        const freshTeam = await teamRes.json();

        setGameState(gs);
        setAllClues(clues);
        setTeam(freshTeam);

        if (!gs || !gs.isRunning) {
            setView('wait');
            startPolling(freshTeam);
            return;
        }

        if (freshTeam.progress >= 10) {
            setView('finish');
            startPolling(freshTeam);
            return;
        }

        setView('game');
        loadCurrentClue(freshTeam, clues);
        startTimer(gs);
        startPolling(freshTeam);
    };

    const startPolling = (t) => {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
            try {
                const [gsRes, teamRes] = await Promise.all([
                    fetch('/api/gamestate'),
                    fetch(`/api/teams/${t._id}`),
                ]);
                const gs = await gsRes.json();
                const freshTeam = await teamRes.json();
                setGameState(gs);
                setTeam(freshTeam);

                if (gs.isRunning && freshTeam.progress >= 10) {
                    setView('finish');
                } else if (gs.isRunning && freshTeam.progress < 10) {
                    setView(prev => prev === 'leaderboard' ? prev : 'game');
                    startTimer(gs);
                } else if (!gs.isRunning) {
                    if (view !== 'leaderboard') setView('wait');
                }

                if (freshTeam.disqualified) showToast('⛔ Your team has been disqualified.', 'error');
            } catch (e) { /* ignore polling errors */ }
        }, 5000);
    };

    const loadCurrentClue = (t, clues) => {
        const arr = clues || allClues;
        if (!t || !arr.length) return;
        if (t.progress >= 10) return;
        const clue = arr.find(c => c.clueNumber === t.progress);
        setCurrentClue(clue || null);
    };

    const startTimer = (gs) => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (!gs || !gs.startTime) return;
        const startTime = new Date(gs.startTime);
        const update = () => {
            const diff = new Date() - startTime;
            setTimerDisplay(formatDuration(diff));
        };
        update();
        timerRef.current = setInterval(update, 1000);
    };

    // ── Create Team ──
    const handleCreateTeam = async () => {
        const name = document.getElementById('team-name-input').value.trim();
        const memberCount = parseInt(document.getElementById('member-count').value);
        const password = document.getElementById('team-password').value.trim();

        setLoginError('');
        if (!name) return setLoginError('Please enter a team name');
        if (name.length < 2) return setLoginError('Team name must be at least 2 characters');
        if (!password) return setLoginError('Please create a password');
        if (password.length < 3) return setLoginError('Password must be at least 3 characters');

        setCreating(true);
        try {
            const res = await fetch('/api/teams', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, password, memberCount }),
            });
            const data = await res.json();
            if (!res.ok) { setLoginError(data.error); setCreating(false); return; }
            setTeam(data);
            localStorage.setItem('etrons_team_id', data._id);
            await enterGame(data);
        } catch {
            setLoginError('Connection error. Please try again.');
        }
        setCreating(false);
    };

    // ── Login ──
    const handleLogin = async () => {
        const name = document.getElementById('login-team-name').value.trim();
        const password = document.getElementById('login-password').value.trim();
        setLoginError('');
        if (!name) return setLoginError('Enter your team name');
        if (!password) return setLoginError('Enter your password');

        try {
            const res = await fetch('/api/teams/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, password }),
            });
            const data = await res.json();
            if (!res.ok) { setLoginError(data.error); return; }
            setTeam(data);
            localStorage.setItem('etrons_team_id', data._id);
            await enterGame(data);
        } catch {
            setLoginError('Connection error. Try again.');
        }
    };

    // ── QR Scanner ──
    const openScanner = async () => {
        setScannerOpen(true);
        try {
            const { Html5Qrcode } = await import('html5-qrcode');
            const scanner = new Html5Qrcode('qr-reader');
            scannerRef.current = scanner;
            await scanner.start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
                onQrScanned,
                () => { }
            );
        } catch {
            showToast('Could not access camera. Allow camera permissions.', 'error');
            setScannerOpen(false);
        }
    };

    const closeScanner = async () => {
        setScannerOpen(false);
        if (scannerRef.current) {
            try { await scannerRef.current.stop(); } catch { }
            scannerRef.current = null;
        }
    };

    const onQrScanned = async (decodedText) => {
        await closeScanner();
        try {
            const res = await fetch('/api/qrcodes/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamId: team._id, qrValue: decodedText.trim() }),
            });
            const data = await res.json();
            setTeam(data.team);

            if (data.success) {
                setFeedback({ type: 'success', message: data.message });
                spawnConfetti();
                loadCurrentClue(data.team, allClues);
            } else {
                setFeedback({ type: 'wrong', message: data.message });
            }
        } catch {
            showToast('Error processing scan. Try again.', 'error');
        }
    };

    const closeFeedback = () => {
        const fb = feedback;
        setFeedback(null);
        if (fb?.type === 'success' && team?.progress >= 10) setView('finish');
    };

    // ── Logout ──
    const handleLogout = () => {
        localStorage.removeItem('etrons_team_id');
        if (timerRef.current) clearInterval(timerRef.current);
        if (pollRef.current) clearInterval(pollRef.current);
        setTeam(null);
        setGameState(null);
        setAllClues([]);
        setCurrentClue(null);
        setTimerDisplay('00:00');
        setLeaderboard([]);
        setActiveNav('game');
        setView('login');
    };

    // ── Leaderboard ──
    const loadLeaderboard = async () => {
        try {
            const res = await fetch('/api/teams');
            let teams = await res.json();
            teams = teams.filter(t => !t.disqualified);
            teams.sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                const af = a.progress >= 10, bf = b.progress >= 10;
                if (af && bf) return (new Date(a.finishTime) - new Date(a.startTime)) - (new Date(b.finishTime) - new Date(b.startTime));
                if (af) return -1;
                if (bf) return 1;
                return 0;
            });
            setLeaderboard(teams);
        } catch {
            setLeaderboard([]);
        }
    };

    const switchNav = (navView) => {
        setActiveNav(navView);
        if (navView === 'leaderboard') {
            setView('leaderboard');
            loadLeaderboard();
        } else {
            if (team && team.progress >= 10) setView('finish');
            else setView('game');
        }
    };

    const points = team ? (team.points || 0) : 0;
    const cluesSolved = team ? team.progress : 0;
    const percent = Math.round((cluesSolved / 10) * 100);
    const showNav = view !== 'login' && view !== 'wait';

    useEffect(() => {
        if (view === 'game' && team && allClues.length) loadCurrentClue(team, allClues);
    }, [view, team?.progress]);

    return (
        <>
            <AnimatedBackground />
            <div className="app-container">

                {/* ═══ LOGIN VIEW ═══ */}
                {view === 'login' && (
                    <div className="view active" style={{ animation: 'fadeSlideIn 0.5s ease' }}>
                        <div className="login-screen">
                            <div className="brand-logo">
                                <span className="brand-icon">🕵️</span>
                                <h1 className="brand-title">ETRONS <span className="brand-year">2K26</span></h1>
                                <div className="brand-tagline">DETECTIVE HUNT</div>
                            </div>
                            <div className="login-form glass-card">
                                <h3 style={{ textAlign: 'center', marginBottom: 'var(--space-lg)', color: 'var(--amber)' }}>🔍 Create Your Team</h3>
                                <div className="form-group">
                                    <label>Team Name</label>
                                    <input type="text" id="team-name-input" className="form-input" placeholder="Enter a unique team name" maxLength={30} />
                                </div>
                                <div className="form-group">
                                    <label>Number of Members</label>
                                    <select id="member-count" className="form-select">
                                        <option value="3">👥 3 Members</option>
                                        <option value="4">👥 4 Members</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Team Password</label>
                                    <input type="password" id="team-password" className="form-input" placeholder="Create a team password" />
                                </div>
                                <button id="create-btn" className="btn btn-primary btn-block btn-lg" onClick={handleCreateTeam} disabled={creating}>
                                    {creating ? '⏳ Creating...' : '🚀 Create Team & Enter'}
                                </button>
                                <div className="divider" style={{ margin: 'var(--space-lg) 0' }}></div>
                                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem', marginBottom: 'var(--space-sm)' }}>Already have a team?</p>
                                <button className="btn btn-outline btn-block" onClick={() => setShowLoginMode(!showLoginMode)}>🔑 Login to Existing Team</button>

                                {showLoginMode && (
                                    <div style={{ marginTop: 'var(--space-lg)' }}>
                                        <div className="form-group">
                                            <label>Team Name</label>
                                            <input type="text" id="login-team-name" className="form-input" placeholder="Your team name" />
                                        </div>
                                        <div className="form-group">
                                            <label>Password</label>
                                            <input type="password" id="login-password" className="form-input" placeholder="Team password" />
                                        </div>
                                        <button className="btn btn-primary btn-block" onClick={handleLogin}>🕵️ Enter the Hunt</button>
                                    </div>
                                )}

                                {loginError && (
                                    <p style={{ color: 'var(--error)', textAlign: 'center', marginTop: 'var(--space-md)', fontSize: '0.875rem' }}>{loginError}</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ WAIT VIEW ═══ */}
                {view === 'wait' && (
                    <div className="view active" style={{ animation: 'fadeSlideIn 0.5s ease' }}>
                        <div className="brand-logo" style={{ paddingTop: 'var(--space-xl)' }}>
                            <span className="brand-icon" style={{ fontSize: '2.5rem' }}>🕵️</span>
                            <h1 className="brand-title" style={{ fontSize: '1.5rem' }}>ETRONS <span className="brand-year">2K26</span></h1>
                        </div>
                        <div className="wait-screen glass-card">
                            <div className="wait-icon">⏳</div>
                            <h2>Waiting for Game Start</h2>
                            <p>The hunt hasn't begun yet. Stand by, detective...</p>
                            {team && (
                                <>
                                    <p style={{ marginTop: 'var(--space-md)', color: 'var(--amber)', fontWeight: 700 }}>Team: {team.name}</p>
                                    <p style={{ marginTop: 'var(--space-sm)', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{team.memberCount} members</p>
                                    <button className="btn btn-sm btn-outline" onClick={handleLogout} style={{ marginTop: 'var(--space-lg)' }}>↪ Switch Team / Logout</button>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* ═══ GAME VIEW ═══ */}
                {view === 'game' && (
                    <div className="view active" style={{ animation: 'fadeSlideIn 0.5s ease' }}>
                        <div className="game-header">
                            <div className="game-header-left">
                                <span style={{ fontSize: '1.25rem' }}>🕵️</span>
                                <div>
                                    <div className="brand-mini">ETRONS 2K26</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{team?.name}</div>
                                </div>
                            </div>
                            <div className="game-header-right" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                <div className="live-timer">
                                    <span className="timer-icon">⏱️</span>
                                    <span className="timer-value">{timerDisplay}</span>
                                </div>
                                <button className="btn btn-sm btn-outline" onClick={handleLogout} style={{ padding: '6px 12px', fontSize: '0.7rem' }}>↪ Logout</button>
                            </div>
                        </div>

                        <div className="score-bar glass-card glass-card-sm">
                            <div className="score-item">
                                <div className="score-value text-amber">{points}</div>
                                <div className="score-label">Points</div>
                            </div>
                            <div className="score-divider"></div>
                            <div className="score-item">
                                <div className="score-value">{cluesSolved}/10</div>
                                <div className="score-label">Clues Solved</div>
                            </div>
                            <div className="score-divider"></div>
                            <div className="score-item">
                                <div className="score-value" style={{ color: 'var(--success)' }}>20</div>
                                <div className="score-label">Max Points</div>
                            </div>
                        </div>

                        <div className="progress-section">
                            <div className="progress-bar-track">
                                <div className="progress-bar-fill" style={{ width: `${percent}%` }}></div>
                            </div>
                        </div>

                        <div className="clue-card">
                            <div className="clue-badge">📋 Clue {currentClue ? currentClue.clueNumber + 1 : '?'}</div>
                            <p className="clue-text">{currentClue ? currentClue.clueText : 'Waiting for clue...'}</p>
                            {currentClue?.hint && (
                                <div className="clue-hint">💡 Hint: {currentClue.hint}</div>
                            )}
                        </div>

                        <div className="scan-btn-wrapper">
                            <button className="scan-btn" onClick={openScanner}>
                                <span className="scan-icon">📷</span>
                                SCAN QR
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══ FINISH VIEW ═══ */}
                {view === 'finish' && (
                    <div className="view active" style={{ animation: 'fadeSlideIn 0.5s ease' }}>
                        <div className="brand-logo" style={{ paddingTop: 'var(--space-xl)' }}>
                            <span className="brand-icon" style={{ fontSize: '2.5rem' }}>🕵️</span>
                            <h1 className="brand-title" style={{ fontSize: '1.5rem' }}>ETRONS <span className="brand-year">2K26</span></h1>
                        </div>
                        <div className="finish-banner glass-card">
                            <div className="trophy">🏆</div>
                            <h2>Case Solved!</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)' }}>All 10 clues cracked!</p>
                            <div className="finish-stats">
                                <div className="finish-stat">
                                    <span className="finish-stat-value text-amber">{points}</span>
                                    <span className="finish-stat-label">Points</span>
                                </div>
                                <div className="finish-stat">
                                    <span className="finish-stat-value" style={{ color: 'var(--success)' }}>
                                        {team?.startTime && team?.finishTime ? formatDuration(new Date(team.finishTime) - new Date(team.startTime)) : '--'}
                                    </span>
                                    <span className="finish-stat-label">Time</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ LEADERBOARD VIEW ═══ */}
                {view === 'leaderboard' && (
                    <div className="view active" style={{ animation: 'fadeSlideIn 0.5s ease' }}>
                        <div className="section-header">
                            <h3>🏆 Live Leaderboard</h3>
                            <button className="btn btn-sm btn-outline" onClick={loadLeaderboard}>↻</button>
                        </div>
                        <ul className="leaderboard-list">
                            {leaderboard.length === 0 ? (
                                <li className="empty-state">
                                    <div className="empty-icon">📊</div>
                                    <p>Loading...</p>
                                </li>
                            ) : leaderboard.map((t, idx) => {
                                const rank = idx + 1;
                                const trophyIcons = { 1: '🥇', 2: '🥈', 3: '🥉' };
                                const topClass = rank === 1 ? 'top-1' : rank === 2 ? 'top-2' : rank === 3 ? 'top-3' : '';
                                const isMe = team && t._id === team._id;
                                let timeDisplay = '';
                                if (t.startTime && t.finishTime) timeDisplay = formatDuration(new Date(t.finishTime) - new Date(t.startTime));
                                else if (t.startTime) timeDisplay = 'In progress';
                                else timeDisplay = 'Waiting';

                                return (
                                    <li key={t._id} className={`leaderboard-item ${topClass}`} style={isMe ? { borderColor: 'var(--amber)' } : {}}>
                                        <div className="rank-badge">{trophyIcons[rank] || rank}</div>
                                        <div className="team-info">
                                            <div className="team-name">{t.name} {isMe ? '← You' : ''}</div>
                                            <div className="team-status">{t.memberCount} members · {timeDisplay}</div>
                                        </div>
                                        <div className="team-points-badge" style={{ color: 'var(--success)' }}>{t.points || 0} pts</div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
            </div>

            {/* Bottom Nav */}
            {showNav && <BottomNav activeView={activeNav} onSwitch={switchNav} />}

            {/* QR Scanner Overlay */}
            {scannerOpen && (
                <div className="scanner-overlay active">
                    <div className="scanner-header">
                        <span className="scanner-title">📷 Scan QR Code</span>
                        <button className="scanner-close" onClick={closeScanner}>✕</button>
                    </div>
                    <div id="qr-reader"></div>
                    <p className="scanner-hint">Point your back camera at a QR code</p>
                </div>
            )}

            {/* Feedback: Success */}
            {feedback?.type === 'success' && (
                <div className="feedback-overlay feedback-success active">
                    <div className="feedback-icon">🎉</div>
                    <h2 className="feedback-title">Congratulations!</h2>
                    <p className="feedback-points">+2 Points</p>
                    <p className="feedback-message">{feedback.message}</p>
                    <button className="btn btn-success btn-lg" onClick={closeFeedback}>Next Clue →</button>
                </div>
            )}

            {/* Feedback: Wrong */}
            {feedback?.type === 'wrong' && (
                <div className="feedback-overlay feedback-wrong active">
                    <div className="feedback-icon">🚫</div>
                    <h2 className="feedback-title">Wrong QR!</h2>
                    <p className="feedback-message">{feedback.message}</p>
                    <button className="btn btn-danger btn-lg" onClick={closeFeedback}>Try Again</button>
                </div>
            )}

            <ToastContainer toasts={toasts} />
        </>
    );
}
