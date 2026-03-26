require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Check DB Connection String
if (!process.env.MONGO_URI) {
    console.warn("\n=======================================================");
    console.warn("⚠️  [SYSTEM WARNING] No MONGO_URI string found in .env.");
    console.warn("The server requires an active MongoDB Atlas cluster URL.");
    console.warn("Create a `.env` file and set MONGO_URI.");
    console.warn("Server shutting down...");
    console.warn("=======================================================\n");
    process.exit(1);
}

// Connect Database
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('[SYSTEM] connected to Main Database (MongoDB)'))
    .catch(err => console.error('[SYSTEM FAILURE] MongoDB connection error:', err));

// MongoDB Schemas
const habitSchema = new mongoose.Schema({
    userId: String,
    name: String,
    streak: { type: Number, default: 0 },
    completedToday: { type: Boolean, default: false },
    lastCompletedDate: String,
});

const playerSchema = new mongoose.Schema({
    userId: { type: String, unique: true },
    exp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    str: { type: Number, default: 10 },
    agi: { type: Number, default: 10 },
    mainQuest: {
        startDate: String,
        cals: String,
        protein: String,
        workout: String
    }
});

const Habit = mongoose.model('Habit', habitSchema);
const Player = mongoose.model('Player', playerSchema);

// REST API ROUTES
// GET/CREATE Player State
app.post('/api/player', async (req, res) => {
    try {
        const { userId } = req.body;
        let player = await Player.findOne({ userId });
        if (!player) {
            player = new Player({ userId });
            await player.save();
        }
        res.json(player);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Update 90-Day Main Quest params
app.post('/api/player/quest', async (req, res) => {
    try {
        const { userId, startDate, cals, protein, workout } = req.body;
        let player = await Player.findOneAndUpdate(
            { userId },
            { mainQuest: { startDate, cals, protein, workout } },
            { new: true, upsert: true }
        );
        res.json(player);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Sync Basic Player Stats
app.post('/api/player/stats', async (req, res) => {
    try {
        const { userId, exp, level, str, agi } = req.body;
        let player = await Player.findOneAndUpdate(
            { userId },
            { exp, level, str, agi },
            { new: true }
        );
        res.json(player);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get Habits dynamically
app.get('/api/habits/:userId', async (req, res) => {
    try {
        const habits = await Habit.find({ userId: req.params.userId });
        res.json(habits);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Create Daily Quest (Habit)
app.post('/api/habits', async (req, res) => {
    try {
        const { userId, name } = req.body;
        const newHabit = new Habit({ userId, name });
        await newHabit.save();
        res.json(newHabit);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Delete Habit
app.delete('/api/habits/:id', async (req, res) => {
    try {
        await Habit.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Bulk Sync Habits (Used for streak toggling across days)
app.post('/api/habits/sync', async (req, res) => {
    try {
        const { habits } = req.body;
        for (let h of habits) {
            if (h._id) {
                await Habit.findByIdAndUpdate(h._id, h);
            }
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Fallback all paths to index SPA
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start API Server
app.listen(PORT, () => {
    console.log(`\n================================`);
    console.log(`[SYSTEM INITIALIZED]`);
    console.log(`Gate open on port ${PORT}`);
    console.log(`================================\n`);
});
