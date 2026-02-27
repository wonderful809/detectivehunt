const express = require('express');
const router = express.Router();
const ScanLog = require('../models/ScanLog');

// GET /api/scanlogs
router.get('/', async (req, res) => {
    try {
        const logs = await ScanLog.find()
            .populate('teamId', 'name')
            .sort({ scannedAt: -1 })
            .limit(100);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
