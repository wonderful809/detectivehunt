const mongoose = require('mongoose');

const gameStateSchema = new mongoose.Schema({
    key: { type: String, default: 'main', unique: true },
    isRunning: { type: Boolean, default: false },
    startTime: { type: Date, default: null },
    endTime: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('GameState', gameStateSchema);
