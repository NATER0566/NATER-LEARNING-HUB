/**
 * ============================================================
 * NATER LEARNING HUB - LOCAL MONGODB VERSION v4.0
 * ============================================================
 * Version: 4.0.0 (Local MongoDB Support)
 * Framework: Express.js | Database: Local MongoDB
 * ============================================================
 */

require('dotenv').config();
const express = require('express');
const { Resend } = require('resend');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');

// --- APP INITIALIZATION ---
const app = express();
const PORT = process.env.PORT || 7000;
const resend = new Resend(process.env.RESEND_API_KEY);
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET;

// --- ENHANCED STATIC FILE SERVING ---
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- DATABASE CONNECTION ---
// Try MongoDB Atlas first, fallback to local MongoDB
const mongoUrl = process.env.DATABASE_URL || 'mongodb://localhost:27017/nater_learning_hub';

// Enhanced MongoDB connection with timeout options
const mongoOptions = {
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 5000,
    bufferCommands: false
};

console.log(`🔗 [DATABASE] Attempting to connect to: ${mongoUrl}`);

mongoose.connect(mongoUrl, mongoOptions)
    .then(() => {
        console.log("🚀 [HUB] DATABASE CONNECTION ESTABLISHED");
        console.log(`📊 [INFO] Connected to: ${mongoUrl.includes('localhost') ? 'Local MongoDB' : 'MongoDB Atlas'}`);
    })
    .catch(err => {
        console.error("❌ [CRITICAL] MongoDB Connection Failed:", err.message);
        
        if (mongoUrl.includes('mongodb+srv://')) {
            console.log("🔧 [TROUBLESHOOTING] MongoDB Atlas Issues:");
            console.log("   1. Check MongoDB Atlas IP Whitelist");
            console.log("   2. Verify connection string credentials");
            console.log("   3. Ensure cluster is active");
            console.log("   4. Check network connectivity");
        } else {
            console.log("🔧 [TROUBLESHOOTING] Local MongoDB Issues:");
            console.log("   1. Ensure MongoDB is installed and running");
            console.log("   2. Check if MongoDB service is started");
            console.log("   3. Verify port 27017 is available");
        }
        
        console.log("📊 [INFO] Server will continue running without database functionality");
    });

// --- MONGODB MODELS ---

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, unique: true, lowercase: true, required: true, trim: true },
    password: { type: String, required: true },
    is_activated: { type: Boolean, default: false },
    is_admin: { type: Boolean, default: false },
    joined_at: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

const courseSchema = new mongoose.Schema({
    title: { type: String, required: true },
    price: { type: Number, default: 0 },
    category: String,
    thumbnail: String,
    description: String,
    created_at: { type: Date, default: Date.now }
});
const Course = mongoose.model('Course', courseSchema);

// --- MIDDLEWARE ---
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(cors({
    origin: ['https://naterlearninghub.me', 'http://localhost:7000', 'http://127.0.0.1:7000'],
    credentials: true
}));

// --- API ENDPOINTS ---

app.post('/api/register', async (req, res) => {
    try {
        const { name, email, pass } = req.body;
        
        if (!name || !email || !pass) {
            return res.status(400).json({ success: false, message: "Missing required fields." });
        }
        
        // Check if email already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "Email already registered." });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(pass, 12);
        
        // Create user
        const user = new User({
            name: name.trim(),
            email: email.toLowerCase(),
            password: hashedPassword,
            is_activated: true // Auto-activate for local testing
        });
        
        await user.save();
        
        console.log(`✅ [REGISTRATION] New user: ${name} (${email})`);
        
        res.json({ 
            success: true, 
            message: "Registration successful! You can now login." 
        });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ success: false, message: "Server error during registration." });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, pass } = req.body;
        
        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (!user) {
            return res.status(404).json({ success: false, message: "Account does not exist." });
        }
        
        if (!user.is_activated) {
            return res.status(403).json({ success: false, message: "Account not activated." });
        }
        
        const isPasswordValid = await bcrypt.compare(pass, user.password);
        
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: "Invalid credentials." });
        }
        
        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: '7d' }
        );
        
        console.log(`✅ [LOGIN] User logged in: ${user.name} (${user.email})`);
        
        res.json({ 
            success: true, 
            token: token,
            user: { 
                name: user.name, 
                email: user.email, 
                is_admin: user.is_admin 
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
    res.json({ 
        status: 'OK', 
        message: 'NATER LEARNING HUB Server Running',
        timestamp: new Date().toISOString(),
        version: '4.0.0',
        database: dbStatus,
        port: PORT
    });
});

// --- COMPREHENSIVE STATIC PAGE ROUTES ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/dashboard.html', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/academy.html', (req, res) => res.sendFile(path.join(__dirname, 'academy.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/certificate.html', (req, res) => res.sendFile(path.join(__dirname, 'certificate.html')));
app.get('/library.html', (req, res) => res.sendFile(path.join(__dirname, 'library.html')));
app.get('/funder.html', (req, res) => res.sendFile(path.join(__dirname, 'funder.html')));
app.get('/reset-password.html', (req, res) => res.sendFile(path.join(__dirname, 'reset-password.html')));
app.get('/success.html', (req, res) => res.sendFile(path.join(__dirname, 'success.html')));
app.get('/verify.html', (req, res) => res.sendFile(path.join(__dirname, 'verify.html')));
app.get('/verify-certificate.html', (req, res) => res.sendFile(path.join(__dirname, 'verify-certificate.html')));
app.get('/verify-payment.html', (req, res) => res.sendFile(path.join(__dirname, 'verify-payment.html')));

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        message: 'Endpoint not found',
        path: req.path 
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
    });
});

// Start Server
app.listen(PORT, () => {
    const baseUrl = process.env.BASE_URL?.includes('localhost') ? `http://localhost:${PORT}` : process.env.BASE_URL;
    console.log(`
    ================================================
    🚀 NATER HUB LOCAL MONGODB ENGINE v4.0 ACTIVATED
    📡 PORT: ${PORT}
    🌐 BASE URL: ${baseUrl}
    📁 Static Files: SERVED FROM ROOT DIRECTORY
    🖼️  Logo.jpg: NOW PROPERLY SERVED
    ================================================
    
    ✅ Available Routes:
    - / (index.html)
    - /dashboard.html
    - /academy.html
    - /admin.html
    - /certificate.html
    - /library.html
    - /funder.html
    - /reset-password.html
    - /success.html
    - /verify.html
    - /verify-certificate.html
    - /verify-payment.html
    - /api/health (Server Status)
    - /api/register (User Registration)
    - /api/login (User Login)
    
    🎯 All static files (CSS, JS, images) now served correctly!
    🌍 Local Testing: http://localhost:${PORT}
    🗄️  Database: ${mongoUrl.includes('localhost') ? 'Local MongoDB' : 'MongoDB Atlas'}
    `);
});
