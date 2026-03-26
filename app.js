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
    btnEditQuest: document.getElementById('btn-edit-quest'),

    // AI Elements
    aiWeight: document.getElementById('ai-weight'),
    aiHeight: document.getElementById('ai-height'),
    aiGoal: document.getElementById('ai-goal'),
    aiDifficulty: document.getElementById('ai-difficulty'),
    btnAutoGen: document.getElementById('btn-auto-gen'),

    // Dashboard
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
    levelUpOverlay: document.getElementById('level-up-overlay'),

    // Tutorial
    tutorialModal: document.getElementById('tutorial-modal'),
    btnCloseTutorial: document.getElementById('btn-close-tutorial')
};

// --- DATA CONNECTION (BACKEND API) ---
async function apiCall(endpoint, method = 'GET', body = null) {
    try {
        const options = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) options.body = JSON.stringify(body);
        const response = await fetch(endpoint, options);
        if (!response.ok) throw new Error('API Error');
        return await response.json();
    } catch (e) {
        console.error('[SYSTEM ERROR]', e);
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

                if (playerStats.level === 1 && playerStats.exp === 0 && !localStorage.getItem('tutorial_seen_' + user)) {
                    elements.tutorialModal.classList.add('active');
                }
            }
        } else {
            alert('[SYSTEM ERROR] Make sure your server is running and database is connected!');
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
    }
});

// --- AI GENERATOR SYSTEM ---
elements.btnAutoGen.addEventListener('click', () => {
    const w = parseFloat(elements.aiWeight.value);
    const h = parseFloat(elements.aiHeight.value);
    const goal = elements.aiGoal.value;

    if (!w || !h) {
        alert('[SYSTEM] Please input valid Weight and Height for Assessment.');
        return;
    }

    let bmr = (10 * w) + (6.25 * h) - (5 * 25) + 5;
    let tdee = bmr * 1.55;

    let targetCals = 0;
    let targetProtein = Math.round(w * 2.2);
    let workoutPlan = "";

    if (goal === 'cut') {
        targetCals = Math.round(tdee - 500);
        workoutPlan = `Mon: Push (Chest, Shoulders, Triceps) + Cardio\nTue: Pull (Back, Biceps) + Core\nWed: Active Rest / Walk\nThu: Legs (Quads, Hams, Calves)\nFri: Upper Body Power + Cardio\nSat: Lower Body Volume\nSun: Complete Rest`;
    } else {
        targetCals = Math.round(tdee + 350);
        workoutPlan = `Mon: Heavy Chest & Triceps (Hypertrophy)\nTue: Heavy Back & Biceps\nWed: Rest & Recover\nThu: Heavy Legs (Squat focus)\nFri: Shoulders, Arms, & Core\nSat: Full Body Weakpoints focus\nSun: Eat & Recover`;
    }

    elements.setupCals.value = targetCals;
    elements.setupProtein.value = targetProtein;
    elements.setupWorkout.value = workoutPlan;

    const panel = document.getElementById('ai-panel');
    panel.style.boxShadow = "inset 0 0 20px var(--sys-gold)";
    setTimeout(() => panel.style.boxShadow = "none", 500);
});

elements.btnAcceptQuest.addEventListener('click', async () => {
    const cals = elements.setupCals.value.trim();
    const protein = elements.setupProtein.value.trim();
    const workout = elements.setupWorkout.value.trim();

    if (cals && protein && workout) {
        elements.btnAcceptQuest.textContent = 'SYNCING...';
        const sDate = (mainQuest && mainQuest.startDate) ? mainQuest.startDate : getTodayString();

        mainQuest = {
            startDate: sDate,
            cals,
            protein,
            workout,
            goal: elements.aiGoal.value,
            difficulty: elements.aiDifficulty ? elements.aiDifficulty.value : 'e'
        };

        await apiCall('/api/player/quest', 'POST', { userId: user, ...mainQuest });
        navigate();
    } else {
        alert("[SYSTEM] Parameters missing.");
    }
});

// Edit Button override
elements.btnEditQuest.addEventListener('click', () => {
    if (mainQuest) {
        elements.setupCals.value = mainQuest.cals;
        elements.setupProtein.value = mainQuest.protein;
        elements.setupWorkout.value = mainQuest.workout;
    }
    screens.dashboard.classList.remove('active');
    screens.setup.classList.add('active');
    elements.btnAcceptQuest.textContent = 'UPDATE SYSTEM';
});

elements.btnLogout.addEventListener('click', () => {
    localStorage.clear();
    location.reload();
});

elements.btnCloseTutorial.addEventListener('click', () => {
    elements.tutorialModal.classList.remove('active');
    localStorage.setItem('tutorial_seen_' + user, 'true');
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
function generateDailySystemQuests() {
    const today = getTodayString();
    if (localStorage.getItem('last_quest_gen_date_' + user) === today) return;

    // System Assignment Algorithm
    const dayOfWeek = new Date().getDay(); // 0 = Sun, 1 = Mon, etc
    const diff = mainQuest.difficulty || 'e';
    const goal = mainQuest.goal || 'cut';

    const mult = diff === 'e' ? 1 : (diff === 'c' ? 2 : 4);
    let newQuests = [];

    newQuests.push(`[SYSTEM] Consume exactly ${mainQuest.cals} kcal`);
    newQuests.push(`[SYSTEM] Hit ${mainQuest.protein}g Protein Target`);

    if (goal === 'cut') {
        if (dayOfWeek === 1 || dayOfWeek === 5) newQuests.push(`[SYSTEM] Complete ${30 * mult} Pushups & ${15 * mult}m Cardio`);
        else if (dayOfWeek === 2) newQuests.push(`[SYSTEM] Complete ${15 * mult} Pull-Ups or Rows`);
        else if (dayOfWeek === 4 || dayOfWeek === 6) newQuests.push(`[SYSTEM] Complete ${50 * mult} Squats`);
        else newQuests.push(`[SYSTEM] Active Recovery: ${4000 * mult} Steps`);
    } else {
        if (dayOfWeek === 1) newQuests.push(`[SYSTEM] Heavy Chest: Bench Press limits`);
        else if (dayOfWeek === 2) newQuests.push(`[SYSTEM] Heavy Back: Deadlifts or Barbell Rows`);
        else if (dayOfWeek === 4) newQuests.push(`[SYSTEM] Heavy Legs: Squats 4x6`);
        else if (dayOfWeek === 5) newQuests.push(`[SYSTEM] Heavy Shoulders: OHP limits`);
        else if (dayOfWeek === 6) newQuests.push(`[SYSTEM] Full Body Weakpoint isolation`);
        else newQuests.push(`[SYSTEM] Rest & Eat heavily`);
    }

    newQuests.forEach(async (qName) => {
        await fetchAddHabit(qName);
    });

    localStorage.setItem('last_quest_gen_date_' + user, today);
}

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
        habits.unshift(dbHabit); // Add to top usually, pushing to array updates UI.
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
        const isSystem = habit.name.includes('[SYSTEM]');
        li.className = `quest-item ${habit.completedToday ? 'completed' : ''} ${isSystem ? 'system-quest' : ''}`;

        const streakClass = habit.streak >= 3 ? 'high' : '';
        const streakText = habit.streak > 0
            ? `<div class="quest-streak ${streakClass}"><i class="fas fa-angle-double-up"></i> ${habit.streak} DAY COMBO</div>`
            : `<div class="quest-streak" style="opacity:0.5;">INCOMPLETE</div>`;

        // Highlight system quest text slightly differently
        let displayName = escapeHTML(habit.name);
        if (isSystem) {
            displayName = displayName.replace('[SYSTEM]', '<span style="color:var(--sys-gold); font-size:0.8rem; vertical-align:middle; margin-right:5px;">[AI QUEST]</span>');
        }

        li.innerHTML = `
            <div class="checkbox-container" role="button"><div class="custom-checkbox"><i class="fas fa-check"></i></div></div>
            <div class="quest-content" role="button"><div class="quest-name">${displayName}</div>${streakText}</div>
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
    generateDailySystemQuests(); // Automatically assign quests
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
});
elements.habitInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') elements.saveBtn.click(); });
elements.addModal.addEventListener('click', (e) => { if (e.target === elements.addModal) hideModal(); });

// APP START
navigate();
