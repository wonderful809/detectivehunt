const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const ScanLog = require('../models/ScanLog');
const GameState = require('../models/GameState');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// POST /api/admin/login
router.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Wrong password' });
    }
});

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
    try {
        const teams = await Team.find();
        const scanCount = await ScanLog.countDocuments();
        const totalTeams = teams.length;
        const totalPlayers = teams.reduce((sum, t) => sum + (t.memberCount || 3), 0);
        const completed = teams.filter(t => t.progress >= 10).length;

        res.json({ totalTeams, totalPlayers, scanCount, completed });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/admin/reset
router.post('/reset', async (req, res) => {
    try {
        // Stop game
        await GameState.findOneAndUpdate(
            { key: 'main' },
            { isRunning: false, startTime: null, endTime: null },
            { upsert: true }
        );
        // Reset all teams
        await Team.updateMany({}, {
            progress: 0,
            points: 0,
            startTime: null,
            finishTime: null,
            disqualified: false,
        });
        // Clear scan logs
        await ScanLog.deleteMany({});

        res.json({ message: 'Everything reset!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
