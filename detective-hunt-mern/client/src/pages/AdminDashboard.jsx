import { useState, useEffect, useRef } from 'react';
import AnimatedBackground from '../components/AnimatedBackground';
import ToastContainer, { useToast } from '../components/Toast';

function formatDuration(ms) {
    const totalSec = Math.floor(ms / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function AdminDashboard() {
    const [loggedIn, setLoggedIn] = useState(false);
    const [loginError, setLoginError] = useState('');
    const [gameState, setGameState] = useState(null);
    const [stats, setStats] = useState({ totalTeams: 0, totalPlayers: 0, scanCount: 0, completed: 0 });
    const [teams, setTeams] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [scanLogs, setScanLogs] = useState([]);
    const [activeTab, setActiveTab] = useState('teams');
    const [timerDisplay, setTimerDisplay] = useState('00:00');
    const [showResetModal, setShowResetModal] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);

    const timerRef = useRef(null);
    const pollRef = useRef(null);
    const { toasts, showToast } = useToast();

    const adminLogin = async () => {
        const pw = document.getElementById('admin-password').value;
        try {
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pw }),
            });
            if (res.ok) {
                setLoggedIn(true);
                initDashboard();
            } else {
                setLoginError('❌ Wrong password');
            }
        } catch {
            setLoginError('Connection error');
        }
    };

    const initDashboard = async () => {
        await Promise.all([loadGameState(), loadStats(), loadTeams()]);
        startPolling();
    };

    const loadGameState = async () => {
        const res = await fetch('/api/gamestate');
        const gs = await res.json();
        setGameState(gs);
        updateTimer(gs);
    };

    const loadStats = async () => {
        const res = await fetch('/api/admin/stats');
        const data = await res.json();
        setStats(data);
    };

    const loadTeams = async () => {
        const res = await fetch('/api/teams');
        const data = await res.json();
        setTeams(data);
    };

    const loadLeaderboard = async () => {
        const res = await fetch('/api/teams');
        let data = await res.json();
        data = data.filter(t => !t.disqualified);
        data.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            const af = a.progress >= 10, bf = b.progress >= 10;
            if (af && bf) return (new Date(a.finishTime) - new Date(a.startTime)) - (new Date(b.finishTime) - new Date(b.startTime));
            if (af) return -1;
            if (bf) return 1;
            return 0;
        });
        setLeaderboard(data);
    };

    const loadScanLogs = async () => {
        const res = await fetch('/api/scanlogs');
        const data = await res.json();
        setScanLogs(data);
    };

    const updateTimer = (gs) => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (!gs || !gs.isRunning || !gs.startTime) { setTimerDisplay('00:00'); return; }
        const startTime = new Date(gs.startTime);
        const update = () => setTimerDisplay(formatDuration(new Date() - startTime));
        update();
        timerRef.current = setInterval(update, 1000);
    };

    const startPolling = () => {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
            try {
                await Promise.all([loadGameState(), loadStats(), loadTeams()]);
            } catch { }
        }, 5000);
    };

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    const startGame = async () => {
        await fetch('/api/gamestate', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isRunning: true, startTime: new Date().toISOString(), endTime: null }),
        });
        showToast('🎮 Game started!', 'success');
        await loadGameState();
    };

    const endGame = async () => {
        await fetch('/api/gamestate', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isRunning: false, endTime: new Date().toISOString() }),
        });
        showToast('🏁 Game stopped!', 'info');
        await loadGameState();
    };

    const resetGame = async () => {
        setShowResetModal(false);
        await fetch('/api/admin/reset', { method: 'POST' });
        showToast('🔄 Everything reset!', 'success');
        await Promise.all([loadGameState(), loadStats(), loadTeams()]);
    };

    const disqualifyTeam = async (id) => {
        await fetch(`/api/teams/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ disqualified: true }),
        });
        showToast('⛔ Team disqualified', 'error');
        await Promise.all([loadTeams(), loadStats()]);
    };

    const requalifyTeam = async (id) => {
        await fetch(`/api/teams/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ disqualified: false }),
        });
        showToast('✅ Team restored', 'success');
        await Promise.all([loadTeams(), loadStats()]);
    };

    const confirmDeleteTeam = (id, name) => {
        setDeleteTarget({ id, name });
    };

    const deleteTeam = async () => {
        if (!deleteTarget) return;
        const { id, name } = deleteTarget;
        setDeleteTarget(null);
        try {
            await fetch(`/api/teams/${id}`, { method: 'DELETE' });
            showToast(`🗑 Team "${name}" deleted`, 'info');
            await Promise.all([loadTeams(), loadStats()]);
        } catch {
            showToast('Failed to delete team', 'error');
        }
    };

    const switchTab = (tab) => {
        setActiveTab(tab);
        if (tab === 'leaderboard') loadLeaderboard();
        if (tab === 'scanlogs') loadScanLogs();
        if (tab === 'teams') loadTeams();
    };

    if (!loggedIn) {
        return (
            <>
                <AnimatedBackground />
                <div className="admin-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                    <div className="glass-card" style={{ maxWidth: 400, width: '100%' }}>
                        <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
                            <span style={{ fontSize: '2.5rem' }}>🛡️</span>
                            <h2 style={{ marginTop: 'var(--space-sm)' }}>Admin Panel</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>ETRONS 2K26</p>
                        </div>
                        <div className="form-group">
                            <label>Admin Password</label>
                            <input type="password" id="admin-password" className="form-input" placeholder="Enter admin password"
                                onKeyDown={e => e.key === 'Enter' && adminLogin()} />
                        </div>
                        <button className="btn btn-primary btn-block" onClick={adminLogin}>🔓 Access Dashboard</button>
                        {loginError && <p style={{ color: 'var(--error)', textAlign: 'center', marginTop: 'var(--space-md)' }}>{loginError}</p>}
                    </div>
                </div>
                <ToastContainer toasts={toasts} />
            </>
        );
    }

    return (
        <>
            <AnimatedBackground />
            <div className="admin-container">
                <div className="admin-header">
                    <h1>🛡️ ETRONS 2K26 — Admin</h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                        <div className={`game-status ${gameState?.isRunning ? 'running' : 'stopped'}`}>
                            <div className="status-dot"></div> {gameState?.isRunning ? 'Running' : 'Stopped'}
                        </div>
                        <button className="btn btn-sm btn-outline" onClick={() => { if (pollRef.current) clearInterval(pollRef.current); if (timerRef.current) clearInterval(timerRef.current); setLoggedIn(false); }}>Logout</button>
                    </div>
                </div>

                {/* Stats */}
                <div className="admin-stats">
                    <div className="stat-card"><div className="stat-value">{stats.totalTeams}</div><div className="stat-label">Teams</div></div>
                    <div className="stat-card"><div className="stat-value">{stats.totalPlayers}</div><div className="stat-label">Players</div></div>
                    <div className="stat-card"><div className="stat-value">{stats.scanCount}</div><div className="stat-label">Total Scans</div></div>
                    <div className="stat-card"><div className="stat-value">{stats.completed}</div><div className="stat-label">Completed</div></div>
                </div>

                {/* Timer */}
                <div className="glass-card glass-card-sm" style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Game Timer</p>
                    <div style={{ fontFamily: "'Orbitron', monospace", fontSize: '2.5rem', fontWeight: 800, color: 'var(--amber)' }}>{timerDisplay}</div>
                </div>

                {/* Controls */}
                <div className="admin-controls">
                    <button className="btn btn-success" onClick={startGame}>▶️ Start Game</button>
                    <button className="btn btn-danger" onClick={endGame}>⏹ Stop Game</button>
                    <button className="btn btn-warning" onClick={() => setShowResetModal(true)}>🔄 Reset All</button>
                </div>

                {/* Tabs */}
                <div className="tab-nav">
                    <button className={`tab-btn ${activeTab === 'teams' ? 'active' : ''}`} onClick={() => switchTab('teams')}>👥 Teams</button>
                    <button className={`tab-btn ${activeTab === 'leaderboard' ? 'active' : ''}`} onClick={() => switchTab('leaderboard')}>🏆 Ranks</button>
                    <button className={`tab-btn ${activeTab === 'scanlogs' ? 'active' : ''}`} onClick={() => switchTab('scanlogs')}>📋 Logs</button>
                </div>

                {/* Teams Tab */}
                {activeTab === 'teams' && (
                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead><tr><th>S.No</th><th>Team Name</th><th>Members</th><th>Points</th><th>Progress</th><th>Status</th><th>Actions</th></tr></thead>
                            <tbody>
                                {teams.length === 0 ? (
                                    <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 'var(--space-xl)' }}>No teams yet.</td></tr>
                                ) : teams.map((t, idx) => (
                                    <tr key={t._id}>
                                        <td>{idx + 1}</td>
                                        <td><strong>{t.name}</strong></td>
                                        <td>{t.memberCount}</td>
                                        <td style={{ color: 'var(--success)', fontFamily: "'Orbitron', monospace", fontWeight: 700 }}>{t.points || 0}</td>
                                        <td>{t.progress}/10</td>
                                        <td>{t.disqualified ? <span className="badge badge-danger">DQ</span> : t.progress >= 10 ? <span className="badge badge-success">Done</span> : <span className="badge badge-info">Active</span>}</td>
                                        <td>
                                            <div className="action-group">
                                                {!t.disqualified
                                                    ? <button className="btn btn-sm btn-danger" onClick={() => disqualifyTeam(t._id)}>DQ</button>
                                                    : <button className="btn btn-sm btn-success" onClick={() => requalifyTeam(t._id)}>Restore</button>
                                                }
                                                <button className="btn btn-sm btn-secondary" onClick={() => confirmDeleteTeam(t._id, t.name)}>🗑</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Leaderboard Tab */}
                {activeTab === 'leaderboard' && (
                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead><tr><th>Rank</th><th>Team</th><th>Points</th><th>Clues</th><th>Time</th></tr></thead>
                            <tbody>
                                {leaderboard.length === 0 ? (
                                    <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No teams</td></tr>
                                ) : leaderboard.map((t, idx) => {
                                    const rank = idx + 1;
                                    const trophies = { 1: '🥇', 2: '🥈', 3: '🥉' };
                                    let timeStr = '--';
                                    if (t.startTime && t.finishTime) timeStr = formatDuration(new Date(t.finishTime) - new Date(t.startTime));
                                    else if (t.startTime) timeStr = 'In progress';
                                    return (
                                        <tr key={t._id}>
                                            <td>{trophies[rank] || rank}</td>
                                            <td><strong>{t.name}</strong></td>
                                            <td style={{ color: 'var(--success)', fontFamily: "'Orbitron', monospace", fontWeight: 700 }}>{t.points || 0}</td>
                                            <td>{t.progress}/10</td>
                                            <td className="mono">{timeStr}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Scan Logs Tab */}
                {activeTab === 'scanlogs' && (
                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead><tr><th>Time</th><th>Team</th><th>QR Code</th><th>Result</th></tr></thead>
                            <tbody>
                                {scanLogs.length === 0 ? (
                                    <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No scans yet</td></tr>
                                ) : scanLogs.map((log, idx) => {
                                    const resultBadge = { success: '✅ Correct', fake: '🎭 Fake', wrong: '❌ Wrong', already_scanned: '🔁 Repeat' }[log.result] || log.result;
                                    const badgeClass = { success: 'badge-success', fake: 'badge-warning', wrong: 'badge-danger', already_scanned: 'badge-info' }[log.result] || '';
                                    return (
                                        <tr key={log._id || idx}>
                                            <td className="mono">{new Date(log.scannedAt).toLocaleTimeString()}</td>
                                            <td>{log.teamId?.name || '—'}</td>
                                            <td className="mono">{log.qrValue}</td>
                                            <td><span className={`badge ${badgeClass}`}>{resultBadge}</span></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Reset Modal */}
            {showResetModal && (
                <div className="modal-overlay active">
                    <div className="modal">
                        <h3>⚠️ Reset Everything?</h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>This will reset all teams' progress, points, and times. Game will stop.</p>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowResetModal(false)}>Cancel</button>
                            <button className="btn btn-danger" onClick={resetGame}>🔄 Reset All</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteTarget && (
                <div className="modal-overlay active">
                    <div className="modal">
                        <h3>🗑 Delete Team?</h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>Delete <strong>{deleteTarget.name}</strong>? This cannot be undone.</p>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
                            <button className="btn btn-danger" onClick={deleteTeam}>🗑 Delete</button>
                        </div>
                    </div>
                </div>
            )}

            <ToastContainer toasts={toasts} />
        </>
    );
}
