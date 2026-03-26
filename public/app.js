// --- STATE MANAGEMENT ---
let user = localStorage.getItem('fittrack_user');
let mainQuest = null;
let habits = [];
let playerStats = { exp: 0, level: 1, str: 10, agi: 10 };

// --- DOM ELEMENTS ---
const screens = {
    login: document.getElementById('screen-login'),
    setup: document.getElementById('screen-setup'),
    dashboard: document.getElementById('screen-dashboard')
};

const elements = {
    loginUsername: document.getElementById('login-username'),
    btnAwaken: document.getElementById('btn-awaken'),
    setupCals: document.getElementById('setup-cals'),
    setupProtein: document.getElementById('setup-protein'),
    setupWorkout: document.getElementById('setup-workout'),
    btnAcceptQuest: document.getElementById('btn-accept-quest'),
    btnLogout: document.getElementById('btn-logout'),
    dispPlayerName: document.getElementById('display-player-name'),
    dispCals: document.getElementById('disp-cals'),
    dispProtein: document.getElementById('disp-protein'),
    dispWorkout: document.getElementById('disp-workout'),
    daysLeft: document.getElementById('days-left'),
    habitList: document.getElementById('habit-list'),
    expBar: document.getElementById('exp-bar'),
    expText: document.getElementById('exp-text'),
    playerLevel: document.getElementById('player-level'),
    playerStr: document.getElementById('player-str'),
    playerAgi: document.getElementById('player-agi'),
    rankBadge: document.getElementById('rank-badge'),
    addFabBtn: document.getElementById('add-fab-btn'),
    addModal: document.getElementById('add-modal'),
    habitInput: document.getElementById('habit-input'),
    cancelBtn: document.getElementById('cancel-btn'),
    saveBtn: document.getElementById('save-btn'),
    levelUpOverlay: document.getElementById('level-up-overlay')
};

// --- DATA CONNECTION (BACKEND API) ---
async function apiCall(endpoint, method = 'GET', body = null) {
    try {
        const options = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) options.body = JSON.stringify(body);
        const response = await fetch(endpoint, options);
        if (!response.ok) throw new Error('Network response non-200');
        return await response.json();
    } catch (e) {
        console.error('[SYSTEM ERROR] API failed attached to:', endpoint, e);
        return null;
    }
}

// --- ROUTING / SPA FLOW ---
async function navigate() {
    Object.values(screens).forEach(s => s.classList.remove('active'));

    if (!user) {
        screens.login.classList.add('active');
        elements.btnAwaken.textContent = 'AWAKEN';
    } else {
        // Fetch or Sync local stat data with DB
        const data = await apiCall('/api/player', 'POST', { userId: user });
        if (data) {
            playerStats = { exp: data.exp, level: data.level, str: data.str, agi: data.agi };
            mainQuest = data.mainQuest && data.mainQuest.startDate ? data.mainQuest : null;
            const dbHabits = await apiCall(`/api/habits/${user}`);
            habits = dbHabits || [];

            if (!mainQuest) {
                screens.setup.classList.add('active');
                elements.btnAcceptQuest.textContent = 'ACCEPT QUEST';
            } else {
                screens.dashboard.classList.add('active');
                initDashboard();
            }
        } else {
            // DB fail fallback
            alert('[SYSTEM] Connection to Central Database failed. Please try again.');
            localStorage.removeItem('fittrack_user');
            user = null;
            screens.login.classList.add('active');
            elements.btnAwaken.textContent = 'AWAKEN';
        }
    }
}

elements.btnAwaken.addEventListener('click', () => {
    const name = elements.loginUsername.value.trim();
    if (name) {
        elements.btnAwaken.textContent = 'CONNECTING...';
        user = name;
        localStorage.setItem('fittrack_user', user);
        navigate();
    } else {
        alert("[SYSTEM ALERT] Player ID cannot be empty.");
    }
});

elements.btnAcceptQuest.addEventListener('click', async () => {
    const cals = elements.setupCals.value.trim();
    const protein = elements.setupProtein.value.trim();
    const workout = elements.setupWorkout.value.trim();

    if (cals && protein && workout) {
        elements.btnAcceptQuest.textContent = 'SYNCING...';
        mainQuest = { startDate: getTodayString(), cals, protein, workout };
        await apiCall('/api/player/quest', 'POST', { userId: user, ...mainQuest });
        navigate();
    } else {
        alert("[SYSTEM ALERT] Complete all required parameters to accept quest.");
    }
});

elements.btnLogout.addEventListener('click', () => {
    if (confirm("[SYSTEM CONTEXT] Logout and sleep? This will clear local cache.")) {
        localStorage.clear();
        location.reload();
    }
});

// --- CORE UTILS ---
function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDaysDifference(d1Str, d2Str) {
    const d1 = new Date(d1Str); d1.setHours(0, 0, 0, 0);
    const d2 = new Date(d2Str); d2.setHours(0, 0, 0, 0);
    return Math.floor(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24));
}

function calculateMaxExp(level) { return level * 100; }
function getRank(level) {
    if (level < 5) return { name: 'E-Rank', class: 'rank-e' };
    if (level < 10) return { name: 'D-Rank', class: 'rank-d' };
    if (level < 20) return { name: 'C-Rank', class: 'rank-c' };
    if (level < 35) return { name: 'B-Rank', class: 'rank-b' };
    if (level < 50) return { name: 'A-Rank', class: 'rank-a' };
    return { name: 'S-Rank', class: 'rank-s' };
}

// --- GAME LOGIC ---
function processHabitStreaks() {
    const today = getTodayString();
    let hasChanges = false;
    habits = habits.map(h => {
        if (h.lastCompletedDate) {
            const diff = getDaysDifference(h.lastCompletedDate, today);
            if (diff === 1 && h.completedToday) {
                h.completedToday = false; hasChanges = true;
            } else if (diff > 1) {
                if (h.streak > 0 || h.completedToday) { h.streak = 0; h.completedToday = false; hasChanges = true; }
            }
        } else if (h.completedToday) {
            h.completedToday = false; hasChanges = true;
        }
        return h;
    });
    if (hasChanges) {
        apiCall('/api/habits/sync', 'POST', { habits });
        renderHabits();
    }
}

function saveStats(leveledUp = false) {
    apiCall('/api/player/stats', 'POST', { userId: user, ...playerStats });
    updateStatsUI();
    if (leveledUp) triggerLevelUp();
}

function gainExp(amount) {
    playerStats.exp += amount;
    let leveledUp = false;
    let maxExp = calculateMaxExp(playerStats.level);
    while (playerStats.exp >= maxExp) {
        playerStats.exp -= maxExp;
        playerStats.level += 1;
        playerStats.str += Math.floor(Math.random() * 3) + 1;
        playerStats.agi += Math.floor(Math.random() * 3) + 1;
        leveledUp = true;
        maxExp = calculateMaxExp(playerStats.level);
    }
    saveStats(leveledUp);
}

function loseExp(amount) {
    playerStats.exp = Math.max(0, playerStats.exp - amount);
    saveStats(false);
}

function triggerLevelUp() {
    elements.levelUpOverlay.classList.add('active');
    setTimeout(() => elements.levelUpOverlay.classList.remove('active'), 2500);
}

function toggleHabit(idStr) {
    const today = getTodayString();
    const habit = habits.find(h => h._id === idStr);
    if (!habit) return;

    if (!habit.completedToday) {
        habit.completedToday = true;
        if (habit.lastCompletedDate !== today) {
            if (habit.lastCompletedDate && getDaysDifference(habit.lastCompletedDate, today) === 1) habit.streak += 1;
            else habit.streak = 1;
        }
        habit.lastCompletedDate = today;
        gainExp(30 + (habit.streak * 10));
    } else {
        habit.completedToday = false;
        loseExp(30 + (habit.streak * 10));
        habit.streak = Math.max(0, habit.streak - 1);
        if (habit.streak <= 0) habit.lastCompletedDate = null;
        else {
            const d = new Date(); d.setDate(d.getDate() - 1);
            habit.lastCompletedDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
    }
    apiCall('/api/habits/sync', 'POST', { habits: [habit] });
    renderHabits();
}

async function fetchAddHabit(name) {
    const dbHabit = await apiCall('/api/habits', 'POST', { userId: user, name });
    if (dbHabit && dbHabit._id) {
        habits.push(dbHabit);
        renderHabits();
    }
}

async function fetchDeleteHabit(idStr) {
    habits = habits.filter(h => h._id !== idStr);
    renderHabits();
    await apiCall(`/api/habits/${idStr}`, 'DELETE');
}

// --- RENDERING ---
function updateStatsUI() {
    elements.playerLevel.textContent = playerStats.level;
    elements.playerStr.textContent = playerStats.str;
    elements.playerAgi.textContent = playerStats.agi;

    const rankInfo = getRank(playerStats.level);
    elements.rankBadge.textContent = rankInfo.name;
    elements.rankBadge.className = `rank-badge ${rankInfo.class}`;

    const maxExp = calculateMaxExp(playerStats.level);
    elements.expBar.style.width = `${Math.min(100, Math.max(0, (playerStats.exp / maxExp) * 100))}%`;
    elements.expText.textContent = `${playerStats.exp} / ${maxExp}`;
}

function renderHabits() {
    elements.habitList.innerHTML = '';
    if (habits.length === 0) {
        elements.habitList.innerHTML = `<div style="text-align:center; color:#4B5563; padding:2rem 0; letter-spacing:2px;">NO ACTIVE QUESTS</div>`;
        return;
    }
    habits.forEach(habit => {
        const li = document.createElement('li');
        li.className = `quest-item ${habit.completedToday ? 'completed' : ''}`;

        const streakClass = habit.streak >= 3 ? 'high' : '';
        const streakText = habit.streak > 0
            ? `<div class="quest-streak ${streakClass}"><i class="fas fa-angle-double-up"></i> ${habit.streak} DAY COMBO</div>`
            : `<div class="quest-streak" style="opacity:0.5;">INCOMPLETE</div>`;

        li.innerHTML = `
            <div class="checkbox-container" role="button"><div class="custom-checkbox"><i class="fas fa-check"></i></div></div>
            <div class="quest-content" role="button"><div class="quest-name">${escapeHTML(habit.name)}</div>${streakText}</div>
            <button class="delete-btn"><i class="fas fa-times"></i></button>
        `;

        li.querySelector('.checkbox-container').addEventListener('click', () => toggleHabit(habit._id));
        li.querySelector('.quest-content').addEventListener('click', () => toggleHabit(habit._id));
        li.querySelector('.delete-btn').addEventListener('click', (e) => { e.stopPropagation(); fetchDeleteHabit(habit._id); });
        elements.habitList.appendChild(li);
    });
}

function escapeHTML(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }

// --- DASHBOARD INIT ---
function initDashboard() {
    elements.dispPlayerName.textContent = user.toUpperCase();
    if (mainQuest) {
        elements.dispCals.textContent = mainQuest.cals;
        elements.dispProtein.textContent = mainQuest.protein;
        elements.dispWorkout.textContent = mainQuest.workout;
        const diff = getDaysDifference(mainQuest.startDate, getTodayString());
        elements.daysLeft.textContent = Math.max(0, 90 - diff);
    }
    processHabitStreaks();
    updateStatsUI();
    renderHabits();
}

// --- MODALS ---
function hideModal() { elements.addModal.classList.remove('active'); elements.habitInput.value = ''; }
elements.addFabBtn.addEventListener('click', () => { elements.addModal.classList.add('active'); setTimeout(() => elements.habitInput.focus(), 100); });
elements.cancelBtn.addEventListener('click', hideModal);
elements.saveBtn.addEventListener('click', () => {
    const name = elements.habitInput.value.trim();
    if (name) { fetchAddHabit(name); hideModal(); }
    else {
        elements.habitInput.style.transform = 'translateX(-10px)'; setTimeout(() => elements.habitInput.style.transform = 'translateX(10px)', 100); setTimeout(() => elements.habitInput.style.transform = 'translateX(0)', 200);
    }
});
elements.habitInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') elements.saveBtn.click(); });
elements.addModal.addEventListener('click', (e) => { if (e.target === elements.addModal) hideModal(); });

// APP START
navigate();
