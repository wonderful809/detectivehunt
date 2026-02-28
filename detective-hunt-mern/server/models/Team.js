const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    memberCount: { type: Number, required: true, min: 2, max: 4, default: 3 },
    progress: { type: Number, default: 0, min: 0, max: 10 },
    points: { type: Number, default: 0 },
    startTime: { type: Date, default: null },
    finishTime: { type: Date, default: null },
    disqualified: { type: Boolean, default: false },
}, { timestamps: true });

// Index for leaderboard sort performance
teamSchema.index({ points: -1 });

// Strip password and __v from all JSON responses
teamSchema.set('toJSON', {
    transform: (doc, ret) => {
        delete ret.password;
        delete ret.__v;
        return ret;
    }
});

module.exports = mongoose.model('Team', teamSchema);
