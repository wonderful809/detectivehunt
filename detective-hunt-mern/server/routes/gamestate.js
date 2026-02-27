const express = require('express');
const router = express.Router();
const GameState = require('../models/GameState');

// GET /api/gamestate
router.get('/', async (req, res) => {
    try {
        let gs = await GameState.findOne({ key: 'main' });
        if (!gs) {
            gs = await GameState.create({ key: 'main', isRunning: false });
        }
        res.json(gs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/gamestate
router.patch('/', async (req, res) => {
    try {
        const gs = await GameState.findOneAndUpdate(
            { key: 'main' },
            req.body,
            { new: true, upsert: true }
        );
        res.json(gs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
