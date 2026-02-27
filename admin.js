/* =============================================
   ETRONS 2K26 — Admin Dashboard Logic
   ============================================= */

const SUPABASE_URL = 'https://deumynymzuxtwvzbbbwi.supabase.co';
const SUPABASE_KEY = 'sb_publishable__l2gVno_pyfZrT7v5fAJbw_I1gP0dEE';

let sb = null;
try {
    if (window.supabase && window.supabase.createClient) {
        sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
} catch (e) { console.error('Supabase init error:', e); }

const ADMIN_PASSWORD = 'admin123';
let gameState = null;
let adminTimerInterval = null;

// ── Admin Login ──
function adminLogin() {
    const pw = document.getElementById('admin-password').value;
    if (pw === ADMIN_PASSWORD) {
        document.getElementById('admin-login').style.display = 'none';
        document.getElementById('admin-dashboard').style.display = 'block';
        initDashboard();
    } else {
        const err = document.getElementById('admin-error');
        err.textContent = '❌ Wrong password';
        err.style.display = 'block';
    }
}

function adminLogout() { location.reload(); }

// ── Init ──
async function initDashboard() {
    await loadGameState();
    await loadStats();
    await loadTeamsTable();
    subscribeToChanges();
    startAdminTimer();
}

// ── Game State ──
async function loadGameState() {
    const { data } = await sb.from('game_state').select('*').eq('id', 1).single();
    gameState = data;
    updateGameStatusUI();
}

function updateGameStatusUI() {
    const badge = document.getElementById('game-status-badge');
    if (gameState && gameState.is_running) {
        badge.className = 'game-status running';
        badge.innerHTML = '<div class="status-dot"></div> Running';
    } else {
        badge.className = 'game-status stopped';
        badge.innerHTML = '<div class="status-dot"></div> Stopped';
    }
}

// ── Admin Timer ──
function startAdminTimer() {
    if (adminTimerInterval) clearInterval(adminTimerInterval);
    updateAdminTimerDisplay();
    adminTimerInterval = setInterval(updateAdminTimerDisplay, 1000);
}

function updateAdminTimerDisplay() {
    const el = document.getElementById('admin-timer');
    if (!gameState || !gameState.is_running || !gameState.start_time) {
        el.textContent = '00:00';
        return;
    }
    const diff = new Date() - new Date(gameState.start_time);
    const totalSec = Math.floor(diff / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    el.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ── Game Controls ──
async function startGame() {
    const { error } = await sb.from('game_state').update({
        is_running: true,
        start_time: new Date().toISOString(),
        end_time: null,
        updated_at: new Date().toISOString()
    }).eq('id', 1);

    if (!error) {
        gameState.is_running = true;
        gameState.start_time = new Date().toISOString();
        updateGameStatusUI();
        showToast('🎮 Game started!', 'success');
    }
}

async function endGame() {
    const { error } = await sb.from('game_state').update({
        is_running: false,
        end_time: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }).eq('id', 1);

    if (!error) {
        gameState.is_running = false;
        updateGameStatusUI();
        showToast('🏁 Game stopped!', 'info');
    }
}

function confirmReset() { document.getElementById('reset-modal').classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

async function resetGame() {
    closeModal('reset-modal');
    // Stop game
    await sb.from('game_state').update({
        is_running: false, start_time: null, end_time: null, updated_at: new Date().toISOString()
    }).eq('id', 1);

    // Reset all teams
    await sb.from('teams').update({
        progress: 0, points: 0, start_time: null, finish_time: null, disqualified: false, updated_at: new Date().toISOString()
    }).neq('id', '00000000-0000-0000-0000-000000000000'); // match all

    // Clear scan logs
    await sb.from('scan_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    gameState = { id: 1, is_running: false, start_time: null };
    updateGameStatusUI();
    await loadStats();
    await loadTeamsTable();
    showToast('🔄 Everything reset!', 'success');
}

// ── Stats ──
async function loadStats() {
    const { data: teams } = await sb.from('teams').select('*');
    const { count: scanCount } = await sb.from('scan_logs').select('*', { count: 'exact', head: true });

    const totalTeams = teams ? teams.length : 0;
    const totalPlayers = teams ? teams.reduce((sum, t) => sum + (t.member_count || 3), 0) : 0;
    const completed = teams ? teams.filter(t => t.progress >= 10).length : 0;

    document.getElementById('stat-teams').textContent = totalTeams;
    document.getElementById('stat-players').textContent = totalPlayers;
    document.getElementById('stat-scans').textContent = scanCount || 0;
    document.getElementById('stat-completed').textContent = completed;
}

// ── Teams Table ──
async function loadTeamsTable() {
    const { data: teams } = await sb.from('teams').select('*').order('points', { ascending: false });
    const tbody = document.getElementById('teams-table');

    if (!teams || teams.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:var(--space-xl);">No teams yet. Players create teams from the app.</td></tr>';
        return;
    }

    tbody.innerHTML = teams.map((team, idx) => {
        const statusBadge = team.disqualified
            ? '<span class="badge badge-danger">DQ</span>'
            : team.progress >= 10
                ? '<span class="badge badge-success">Done</span>'
                : '<span class="badge badge-info">Active</span>';

        return `<tr>
      <td>${idx + 1}</td>
      <td><strong>${team.name}</strong></td>
      <td>${team.member_count}</td>
      <td style="color:var(--success);font-family:'Orbitron',monospace;font-weight:700;">${team.points || 0}</td>
      <td>${team.progress}/10</td>
      <td>${statusBadge}</td>
      <td>
        <div class="action-group">
          ${!team.disqualified ? `<button class="btn btn-sm btn-danger" onclick="disqualifyTeam('${team.id}')">DQ</button>` : `<button class="btn btn-sm btn-success" onclick="requalifyTeam('${team.id}')">Restore</button>`}
          <button class="btn btn-sm btn-secondary" onclick="deleteTeam('${team.id}', '${team.name}')">🗑</button>
        </div>
      </td>
    </tr>`;
    }).join('');
}

// ── Leaderboard Table ──
async function loadLeaderboardTable() {
    const { data: teams } = await sb.from('teams').select('*').eq('disqualified', false).order('points', { ascending: false });
    const tbody = document.getElementById('leaderboard-table');

    if (!teams || teams.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">No teams</td></tr>';
        return;
    }

    const sorted = teams.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const af = a.progress >= 10, bf = b.progress >= 10;
        if (af && bf) return (new Date(a.finish_time) - new Date(a.start_time)) - (new Date(b.finish_time) - new Date(b.start_time));
        if (af) return -1;
        if (bf) return 1;
        return 0;
    });

    tbody.innerHTML = sorted.map((team, idx) => {
        const rank = idx + 1;
        const trophies = { 1: '🥇', 2: '🥈', 3: '🥉' };
        let timeStr = '--';
        if (team.start_time && team.finish_time) {
            const d = new Date(team.finish_time) - new Date(team.start_time);
            const m = Math.floor(d / 60000), s = Math.floor((d % 60000) / 1000);
            timeStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        } else if (team.start_time) {
            timeStr = 'In progress';
        }

        return `<tr>
      <td>${trophies[rank] || rank}</td>
      <td><strong>${team.name}</strong></td>
      <td style="color:var(--success);font-family:'Orbitron',monospace;font-weight:700;">${team.points || 0}</td>
      <td>${team.progress}/10</td>
      <td class="mono">${timeStr}</td>
    </tr>`;
    }).join('');
}

// ── Scan Logs ──
async function loadScanLogs() {
    const { data: logs } = await sb.from('scan_logs').select('*, teams(name)').order('scanned_at', { ascending: false }).limit(100);
    const tbody = document.getElementById('scanlogs-table');

    if (!logs || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">No scans yet</td></tr>';
        return;
    }

    tbody.innerHTML = logs.map(log => {
        const resultBadge = {
            success: '<span class="badge badge-success">✅ Correct</span>',
            fake: '<span class="badge badge-warning">🎭 Fake</span>',
            wrong: '<span class="badge badge-danger">❌ Wrong</span>',
            already_scanned: '<span class="badge badge-info">🔁 Repeat</span>',
        }[log.result] || log.result;

        const time = new Date(log.scanned_at).toLocaleTimeString();

        return `<tr>
      <td class="mono">${time}</td>
      <td>${log.teams?.name || '—'}</td>
      <td class="mono">${log.qr_value}</td>
      <td>${resultBadge}</td>
    </tr>`;
    }).join('');
}

// ── Team Actions ──
async function disqualifyTeam(teamId) {
    await sb.from('teams').update({ disqualified: true }).eq('id', teamId);
    showToast('⛔ Team disqualified', 'error');
    await loadTeamsTable();
    await loadStats();
}

async function requalifyTeam(teamId) {
    await sb.from('teams').update({ disqualified: false }).eq('id', teamId);
    showToast('✅ Team restored', 'success');
    await loadTeamsTable();
    await loadStats();
}

async function deleteTeam(teamId, teamName) {
    if (!confirm(`Delete team "${teamName}"? This cannot be undone.`)) return;
    await sb.from('teams').delete().eq('id', teamId);
    showToast(`🗑 Team "${teamName}" deleted`, 'info');
    await loadTeamsTable();
    await loadStats();
}

// ── Tab Navigation ──
function switchTab(tabName, btnEl) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    btnEl.classList.add('active');
    document.getElementById(`tab-${tabName}`).style.display = 'block';

    if (tabName === 'leaderboard') loadLeaderboardTable();
    if (tabName === 'scanlogs') loadScanLogs();
    if (tabName === 'teams') loadTeamsTable();
}

// ── Realtime ──
function subscribeToChanges() {
    sb.channel('admin-feed')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state' }, (payload) => {
            gameState = payload.new;
            updateGameStatusUI();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => {
            loadTeamsTable();
            loadStats();
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scan_logs' }, () => {
            loadStats();
        })
        .subscribe();
}

// ── Toast ──
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
