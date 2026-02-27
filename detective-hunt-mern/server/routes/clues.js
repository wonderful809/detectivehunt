const express = require('express');
const router = express.Router();
const Clue = require('../models/Clue');

// GET /api/clues
router.get('/', async (req, res) => {
    try {
        const clues = await Clue.find().sort({ clueNumber: 1 });
        res.json(clues);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
