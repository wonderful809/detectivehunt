require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:5000',
        /\.vercel\.app$/,
    ],
    credentials: true,
}));
app.use(express.json());

// Health check (for uptime bots like UptimeRobot / Kuma)
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/teams', require('./routes/teams'));
app.use('/api/clues', require('./routes/clues'));
app.use('/api/qrcodes', require('./routes/qrcodes'));
app.use('/api/scanlogs', require('./routes/scanlogs'));
app.use('/api/gamestate', require('./routes/gamestate'));
app.use('/api/admin', require('./routes/admin'));

// Serve React static build in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

// SPA fallback — serve index.html for all non-API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
});

// Connect to MongoDB & start server
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('✅ Connected to MongoDB');
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('❌ MongoDB connection error:', err.message);
        process.exit(1);
    });
