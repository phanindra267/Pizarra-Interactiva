require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const passport = require('passport');
require('./config/passport');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const connectDB = require('./config/db');
const setupSockets = require('./sockets');

// Routes
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const fileRoutes = require('./routes/files');
const analyticsRoutes = require('./routes/analytics');

const app = express();
const server = http.createServer(app);

// Socket.io
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Request Logger
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Middleware
const allowedOrigin = process.env.CLIENT_URL;
if (!allowedOrigin && process.env.NODE_ENV === 'production') {
    console.warn('⚠️  WARNING: CLIENT_URL is not set in production. Defaulting to http://localhost:3000');
}

app.use(cors({
    origin: allowedOrigin || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
}));

// Hardened Helmet configuration
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://apis.google.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
            connectSrc: ["'self'", "wss:", "ws:", "https://stun.l.google.com", "https://stun1.l.google.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'", "blob:"],
            frameSrc: ["'self'", "https://accounts.google.com"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'development' ? 10000 : 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);

app.use(xss());
app.use(mongoSanitize());
app.use(hpp());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

// Ensure uploads dir
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/analytics', analyticsRoutes);

app.get('/auth/google/callback', passport.authenticate('google', { session: false, failureRedirect: '/login' }), require('./controllers/authController').googleCallback);

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
    const frontendDist = path.join(__dirname, '../frontend/dist');
    if (fs.existsSync(frontendDist)) {
        app.use(express.static(frontendDist));
        app.get('*', (req, res) => {
            if (!req.url.startsWith('/api')) {
                res.sendFile(path.resolve(frontendDist, 'index.html'));
            }
        });
    }
}

// Error Handling
const errorMiddleware = require('./middleware/errorMiddleware');
app.use(errorMiddleware);

// Socket setup
setupSockets(io);

// Connect to DB and start server
const PORT = process.env.PORT || 5000;
connectDB().then(() => {
    const serverInstance = server.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📡 Socket.io ready`);
        console.log(`🌐 Client URL: ${process.env.CLIENT_URL || 'http://localhost:3000'}`);
    });

    // Handle unhandled rejections
    process.on('unhandledRejection', (err) => {
        console.error('Unhandled Rejection! Shutting down...', err.name, err.message);
        serverInstance.close(() => { process.exit(1); });
    });
}).catch(err => {
    console.error('Failed to connect to DB:', err.message);
    // Start server anyway for development without MongoDB
    server.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT} (without DB)`);
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception! Shutting down...', err.name, err.message);
    process.exit(1);
});

// Export getIO for use in controllers (e.g., cascading delete)
function getIO() { return io; }
module.exports = { app, server, io, getIO };
