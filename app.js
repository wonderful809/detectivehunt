/* =============================================
   ETRONS 2K26 — Player App Logic
   ============================================= */

// ── Supabase Config ──
const SUPABASE_URL = 'https://deumynymzuxtwvzbbbwi.supabase.co';
const SUPABASE_KEY = 'sb_publishable__l2gVno_pyfZrT7v5fAJbw_I1gP0dEE';

let sb = null;
try {
  if (window.supabase && window.supabase.createClient) {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
} catch (e) { console.error('Supabase init error:', e); }

// ── App State ──
let currentTeam = null;
let currentClue = null;
let allClues = [];
let gameState = null;
let html5QrCode = null;
let scannerActive = false;
let timerInterval = null;
let gameStartTime = null;

// ── Initialize ──
document.addEventListener('DOMContentLoaded', async () => {
  const savedTeamId = localStorage.getItem('etrons_team_id');
  if (savedTeamId) {
    await restoreSession(savedTeamId);
  }
});

// ── Toggle Login Mode (Create vs Login) ──
function toggleLoginMode() {
  const loginMode = document.getElementById('login-mode');
  loginMode.style.display = loginMode.style.display === 'none' ? 'block' : 'none';
}

// ── Create Team ──
async function handleCreateTeam() {
  if (!sb) { showLoginError('⚠️ Still connecting... Please wait a moment and try again.'); return; }
  const teamName = document.getElementById('team-name-input').value.trim();
  const memberCount = parseInt(document.getElementById('member-count').value);
  const password = document.getElementById('team-password').value.trim();
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('create-btn');

  errorEl.style.display = 'none';

  if (!teamName) { showLoginError('Please enter a team name'); return; }
  if (teamName.length < 2) { showLoginError('Team name must be at least 2 characters'); return; }
  if (!password) { showLoginError('Please create a password'); return; }
  if (password.length < 3) { showLoginError('Password must be at least 3 characters'); return; }

  btn.disabled = true;
  btn.textContent = '⏳ Creating...';

  try {
    // Check if team name exists
    const { data: existing } = await sb
      .from('teams')
      .select('id')
      .eq('name', teamName)
      .maybeSingle();

    if (existing) {
      showLoginError('Team name already taken! Pick another.');
      btn.disabled = false;
      btn.textContent = '🚀 Create Team & Enter';
      return;
    }

    // Create the team (try with points, fallback without)
    let newTeam = null;
    let createError = null;

    const teamData = { name: teamName, password: password, member_count: memberCount, progress: 0, disqualified: false };

    // Try with points column first
    let result = await sb.from('teams').insert({ ...teamData, points: 0 }).select().single();
    if (result.error) {
      // Retry without points column (in case it doesn't exist)
      result = await sb.from('teams').insert(teamData).select().single();
    }

    newTeam = result.data;
    createError = result.error;

    if (createError) {
      showLoginError('Error creating team: ' + createError.message);
      btn.disabled = false;
      btn.textContent = '🚀 Create Team & Enter';
      return;
    }

    // Log in
    currentTeam = newTeam;
    localStorage.setItem('etrons_team_id', newTeam.id);
    await enterGame();

  } catch (err) {
    console.error('Create team error:', err);
    showLoginError('Connection error. Please try again.');
  }

  btn.disabled = false;
  btn.textContent = '🚀 Create Team & Enter';
}

// ── Login to Existing Team ──
async function handleLogin() {
  const teamName = document.getElementById('login-team-name').value.trim();
  const password = document.getElementById('login-password').value.trim();
  const errorEl = document.getElementById('login-error');

  errorEl.style.display = 'none';

  if (!teamName) { showLoginError('Enter your team name'); return; }
  if (!password) { showLoginError('Enter your password'); return; }

  try {
    const { data: team, error } = await sb
      .from('teams')
      .select('*')
      .eq('name', teamName)
      .eq('password', password)
      .single();

    if (error || !team) {
      showLoginError('❌ Incorrect team name or password');
      return;
    }
    if (team.disqualified) {
      showLoginError('⛔ This team has been disqualified.');
      return;
    }

    currentTeam = team;
    localStorage.setItem('etrons_team_id', team.id);
    await enterGame();

  } catch (err) {
    showLoginError('Connection error. Try again.');
  }
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.style.display = 'block';
}

// ── Restore Saved Session ──
async function restoreSession(teamId) {
  try {
    const { data: team, error } = await sb
      .from('teams').select('*').eq('id', teamId).single();

    if (error || !team) {
      localStorage.removeItem('etrons_team_id');
      return;
    }
    currentTeam = team;
    await enterGame();
  } catch (err) {
    localStorage.removeItem('etrons_team_id');
  }
}

// ── Enter Game ──
async function enterGame() {
  const { data: gs } = await sb.from('game_state').select('*').eq('id', 1).single();
  gameState = gs;

  const { data: cluesData } = await sb.from('clues').select('*').order('clue_number');
  allClues = cluesData || [];

  // Refresh team
  const { data: teamData } = await sb.from('teams').select('*').eq('id', currentTeam.id).single();
  if (teamData) currentTeam = teamData;

  if (!gameState || !gameState.is_running) {
    showView('wait-view');
    document.getElementById('wait-team-name').textContent = `Team: ${currentTeam.name}`;
    document.getElementById('wait-team-members').textContent = `${currentTeam.member_count} members`;
    document.getElementById('bottom-nav').style.display = 'none';
    subscribeToGameState();
    return;
  }

  // Game is running
  if (currentTeam.progress >= 10) {
    showFinishView();
    return;
  }

  showView('game-view');
  document.getElementById('bottom-nav').style.display = 'flex';
  document.getElementById('game-team-name').textContent = currentTeam.name;
  updateScoreUI();
  loadCurrentClue();
  startTimer();
  subscribeToGameState();
  subscribeToTeamUpdates();
}

// ── Views ──
function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(viewId);
  if (target) target.classList.add('active');
}

function switchView(viewId, btnEl) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  if (viewId === 'leaderboard-view') loadLeaderboard();
  if (viewId === 'game-view' && currentTeam && currentTeam.progress >= 10) {
    showView('finish-view');
  } else {
    showView(viewId);
  }
}

// ── Score & Progress UI ──
function updateScoreUI() {
  if (!currentTeam) return;
  const points = currentTeam.points || (currentTeam.progress * 2);
  const cluesSolved = currentTeam.progress;
  const percent = Math.round((cluesSolved / 10) * 100);

  document.getElementById('points-display').textContent = points;
  document.getElementById('clue-display').textContent = `${cluesSolved}/10`;
  document.getElementById('progress-bar').style.width = `${percent}%`;
}

// ── Live Timer ──
function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  if (!gameState || !gameState.start_time) return;

  gameStartTime = new Date(gameState.start_time);
  updateTimerDisplay();
  timerInterval = setInterval(updateTimerDisplay, 1000);
}

function updateTimerDisplay() {
  if (!gameStartTime) return;
  const now = new Date();
  const diff = now - gameStartTime;
  const totalSeconds = Math.floor(diff / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  document.getElementById('timer-display').textContent =
    `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ── Load Current Clue ──
function loadCurrentClue() {
  if (!currentTeam || !allClues.length) return;
  const clueNum = currentTeam.progress;
  if (clueNum >= 10) { showFinishView(); return; }

  currentClue = allClues.find(c => c.clue_number === clueNum);
  if (currentClue) {
    document.getElementById('clue-number-badge').textContent = clueNum + 1;
    document.getElementById('clue-text').textContent = currentClue.clue_text;
    const hintEl = document.getElementById('clue-hint');
    if (currentClue.hint) {
      hintEl.textContent = `💡 Hint: ${currentClue.hint}`;
      hintEl.style.display = 'block';
    } else {
      hintEl.style.display = 'none';
    }
  }
}

// ── Finish View ──
function showFinishView() {
  showView('finish-view');
  document.getElementById('bottom-nav').style.display = 'flex';
  document.getElementById('finish-points').textContent = currentTeam.points || (currentTeam.progress * 2);

  if (currentTeam.start_time && currentTeam.finish_time) {
    const diff = new Date(currentTeam.finish_time) - new Date(currentTeam.start_time);
    document.getElementById('finish-time').textContent = formatDuration(diff);
  }
  if (timerInterval) clearInterval(timerInterval);
}

// ── QR Scanner ──
function openScanner() {
  const overlay = document.getElementById('scanner-overlay');
  overlay.classList.add('active');
  if (!html5QrCode) html5QrCode = new Html5Qrcode("qr-reader");
  if (scannerActive) return;
  scannerActive = true;

  html5QrCode.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
    onQrCodeScanned,
    () => { }
  ).catch(err => {
    console.error('Camera error:', err);
    scannerActive = false;
    showToast('Could not access camera. Allow camera permissions.', 'error');
    closeScanner();
  });
}

function closeScanner() {
  document.getElementById('scanner-overlay').classList.remove('active');
  if (html5QrCode && scannerActive) {
    html5QrCode.stop().then(() => { scannerActive = false; }).catch(() => { scannerActive = false; });
  }
}

// ── QR Scanned Handler ──
async function onQrCodeScanned(decodedText) {
  closeScanner();
  const qrValue = decodedText.trim();

  try {
    // Look up QR code
    const { data: qrCode, error } = await sb
      .from('qr_codes')
      .select('*')
      .eq('qr_value', qrValue)
      .single();

    // Refresh team data
    const { data: freshTeam } = await sb.from('teams').select('*').eq('id', currentTeam.id).single();
    if (freshTeam) currentTeam = freshTeam;

    // ── NOT IN DATABASE or FAKE QR → Show "Scan another QR" ──
    if (error || !qrCode || qrCode.qr_type === 'fake') {
      await logScan(qrValue, qrCode ? 'fake' : 'wrong', null);
      showWrongFeedback(qrCode?.fake_message || 'This is not the right QR. Scan another QR code!');
      return;
    }

    // ── CORRECT QR ──
    if (qrCode.qr_type === 'correct') {
      // Determine the clue number from DB or parse from QR value
      let clueNum = qrCode.clue_number;
      if (clueNum == null) {
        // Parse from QR value like HUNT-CLUE-10-CORRECT
        const match = qrValue.match(/HUNT-CLUE-(\d+)-CORRECT/i);
        if (match) clueNum = parseInt(match[1]);
      }

      const expectedClue = currentTeam.progress + 1;

      // Already scanned
      if (clueNum != null && clueNum <= currentTeam.progress) {
        await logScan(qrValue, 'already_scanned', clueNum);
        showWrongFeedback('You already solved this clue! Scan another QR code.');
        return;
      }

      // Skip prevention — must be the correct next one
      if (clueNum !== expectedClue) {
        await logScan(qrValue, 'wrong', clueNum);
        showWrongFeedback(`Wrong order! Find clue ${expectedClue} first. Scan another QR code!`);
        return;
      }

      // ✅ CORRECT! +2 points
      const newProgress = expectedClue;
      const newPoints = (currentTeam.points || 0) + 2;
      const updateData = {
        progress: newProgress,
        points: newPoints,
        updated_at: new Date().toISOString()
      };

      if (!currentTeam.start_time) {
        updateData.start_time = new Date().toISOString();
      }
      if (newProgress >= 10) {
        updateData.finish_time = new Date().toISOString();
      }

      const { error: updateError } = await sb
        .from('teams')
        .update(updateData)
        .eq('id', currentTeam.id);

      if (updateError) {
        showToast('Error updating progress. Try again.', 'error');
        return;
      }

      await logScan(qrValue, 'success', clueNum);

      currentTeam.progress = newProgress;
      currentTeam.points = newPoints;
      if (updateData.start_time) currentTeam.start_time = updateData.start_time;
      if (updateData.finish_time) currentTeam.finish_time = updateData.finish_time;

      if (newProgress >= 10) {
        showSuccessFeedback('🎉 ALL 10 CLUES SOLVED! You cracked the case!');
      } else {
        showSuccessFeedback(`Clue ${clueNum} solved! You earned +2 points!`);
      }

      updateScoreUI();
      loadCurrentClue();
    }

  } catch (err) {
    console.error('Scan error:', err);
    showToast('Error processing scan. Try again.', 'error');
  }
}

// ── Log Scan ──
async function logScan(qrValue, result, clueNumber) {
  try {
    await sb.from('scan_logs').insert({
      team_id: currentTeam.id,
      qr_value: qrValue,
      result: result,
      clue_number: clueNumber,
      scanned_at: new Date().toISOString()
    });
  } catch (err) { console.error('Log error:', err); }
}

// ── Feedback ──
function showSuccessFeedback(message) {
  document.getElementById('success-message').textContent = message;
  document.getElementById('feedback-success').classList.add('active');
  spawnConfetti();
}

function showWrongFeedback(message) {
  document.getElementById('wrong-message').textContent = message;
  document.getElementById('feedback-wrong').classList.add('active');
}

function closeFeedback(type) {
  document.getElementById(`feedback-${type}`).classList.remove('active');
  if (type === 'success' && currentTeam.progress >= 10) showFinishView();
}

// ── Confetti ──
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

// ── Leaderboard ──
async function loadLeaderboard() {
  const list = document.getElementById('leaderboard-list');
  list.innerHTML = '<div class="spinner"></div>';

  try {
    const { data: teams, error } = await sb
      .from('teams')
      .select('*')
      .eq('disqualified', false)
      .order('points', { ascending: false });

    if (error) throw error;
    if (!teams || teams.length === 0) {
      list.innerHTML = '<li class="empty-state"><div class="empty-icon">📊</div><p>No teams yet</p></li>';
      return;
    }

    // Sort: by points desc, then by time (faster = better)
    const sorted = teams.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const aFinished = a.progress >= 10;
      const bFinished = b.progress >= 10;
      if (aFinished && bFinished) {
        return (new Date(a.finish_time) - new Date(a.start_time)) - (new Date(b.finish_time) - new Date(b.start_time));
      }
      if (aFinished) return -1;
      if (bFinished) return 1;
      return 0;
    });

    list.innerHTML = sorted.map((team, idx) => {
      const rank = idx + 1;
      const topClass = rank === 1 ? 'top-1' : rank === 2 ? 'top-2' : rank === 3 ? 'top-3' : '';
      const trophyIcons = { 1: '🥇', 2: '🥈', 3: '🥉' };
      const rankDisplay = trophyIcons[rank] || rank;
      const isMe = currentTeam && team.id === currentTeam.id;

      let timeDisplay = '';
      if (team.start_time && team.finish_time) {
        timeDisplay = formatDuration(new Date(team.finish_time) - new Date(team.start_time));
      } else if (team.start_time) {
        timeDisplay = 'In progress';
      } else {
        timeDisplay = 'Waiting';
      }

      return `
        <li class="leaderboard-item ${topClass}" style="${isMe ? 'border-color:var(--amber);' : ''}">
          <div class="rank-badge">${rankDisplay}</div>
          <div class="team-info">
            <div class="team-name">${team.name} ${isMe ? '← You' : ''}</div>
            <div class="team-status">${team.member_count} members · ${timeDisplay}</div>
          </div>
          <div class="team-points-badge" style="color:var(--success);">${team.points || 0} pts</div>
        </li>`;
    }).join('');

  } catch (err) {
    list.innerHTML = '<li class="empty-state"><div class="empty-icon">⚠️</div><p>Error loading</p></li>';
  }
}

// ── Realtime ──
function subscribeToGameState() {
  sb.channel('game-changes-player')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state' }, async (payload) => {
      gameState = payload.new;
      if (gameState.is_running) {
        if (currentTeam) {
          const { data: ft } = await sb.from('teams').select('*').eq('id', currentTeam.id).single();
          if (ft) currentTeam = ft;
          if (currentTeam.progress >= 10) { showFinishView(); }
          else {
            showView('game-view');
            document.getElementById('bottom-nav').style.display = 'flex';
            document.getElementById('game-team-name').textContent = currentTeam.name;
            updateScoreUI();
            loadCurrentClue();
            startTimer();
          }
          showToast('🎮 The hunt has begun!', 'success');
        }
      } else {
        showToast('🏁 The game has ended!', 'info');
        if (timerInterval) clearInterval(timerInterval);
      }
    }).subscribe();
}

function subscribeToTeamUpdates() {
  sb.channel('team-updates-player')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'teams', filter: `id=eq.${currentTeam.id}` }, (payload) => {
      currentTeam = payload.new;
      updateScoreUI();
      loadCurrentClue();
      if (currentTeam.disqualified) showToast('⛔ Your team has been disqualified.', 'error');
      if (currentTeam.progress >= 10) showFinishView();
    }).subscribe();
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

// ── Utility ──
function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function logout() {
  localStorage.removeItem('etrons_team_id');
  currentTeam = null;
  if (timerInterval) clearInterval(timerInterval);
  location.reload();
}
