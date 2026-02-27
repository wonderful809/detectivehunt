const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const ScanLog = require('../models/ScanLog');

// GET /api/teams — list all (for leaderboard)
router.get('/', async (req, res) => {
    try {
        const teams = await Team.find().sort({ points: -1 });
        res.json(teams);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/teams/:id
router.get('/:id', async (req, res) => {
    try {
        const team = await Team.findById(req.params.id);
        if (!team) return res.status(404).json({ error: 'Team not found' });
        res.json(team);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/teams — create team
router.post('/', async (req, res) => {
    try {
        const { name, password, memberCount } = req.body;
        if (!name || !password) return res.status(400).json({ error: 'Name and password are required' });
        if (name.trim().length < 2) return res.status(400).json({ error: 'Team name must be at least 2 characters' });
        if (password.trim().length < 3) return res.status(400).json({ error: 'Password must be at least 3 characters' });

        const existing = await Team.findOne({ name: name.trim() });
        if (existing) return res.status(409).json({ error: 'Team name already taken!' });

        const team = await Team.create({
            name: name.trim(),
            password: password.trim(),
            memberCount: memberCount || 3,
        });
        res.status(201).json(team);
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ error: 'Team name already taken!' });
        res.status(500).json({ error: err.message });
    }
});

// POST /api/teams/login
router.post('/login', async (req, res) => {
    try {
        const { name, password } = req.body;
        if (!name || !password) return res.status(400).json({ error: 'Name and password are required' });

        const team = await Team.findOne({ name: name.trim(), password: password.trim() });
        if (!team) return res.status(401).json({ error: 'Incorrect team name or password' });
        if (team.disqualified) return res.status(403).json({ error: 'This team has been disqualified.' });

        res.json(team);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/teams/:id
router.patch('/:id', async (req, res) => {
    try {
        const team = await Team.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!team) return res.status(404).json({ error: 'Team not found' });
        res.json(team);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/teams/:id
router.delete('/:id', async (req, res) => {
    try {
        const team = await Team.findByIdAndDelete(req.params.id);
        if (!team) return res.status(404).json({ error: 'Team not found' });
        // Also clean up scan logs for this team
        await ScanLog.deleteMany({ teamId: req.params.id });
        res.json({ message: 'Team deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
