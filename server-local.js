/**
 * ============================================================
 * NATER LEARNING HUB - LOCAL TEST SERVER v4.0
 * ============================================================
 * Version: 4.0.0 (Local Testing Without MongoDB)
 * Framework: Express.js | Database: Mock (for testing)
 * ============================================================
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

// --- APP INITIALIZATION ---
const app = express();
const PORT = process.env.PORT || 3000;

// --- MIDDLEWARE & FILE HANDLING ---
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Serve all static files from the root directory
app.use(express.static(path.join(__dirname)));

// --- MOCK DATABASE (for testing) ---
const mockUsers = [];
const mockCourses = [
    { id: '1', title: 'Introduction to Web Development', price: 49.99, category: 'Programming' },
    { id: '2', title: 'Advanced JavaScript', price: 79.99, category: 'Programming' },
    { id: '3', title: 'Database Design Fundamentals', price: 59.99, category: 'Database' }
];

// --- API ENDPOINTS (Mock Responses) ---

app.post('/api/register', async (req, res) => {
    try {
        const { name, email, pass } = req.body;
        
        if (!name || !email || !pass) {
            return res.status(400).json({ success: false, message: "Missing required fields." });
        }
        
        // Check if email already exists (mock)
        if (mockUsers.find(user => user.email === email.toLowerCase())) {
            return res.status(400).json({ success: false, message: "Email already registered." });
        }
        
        // Add user to mock database
        mockUsers.push({
            name,
            email: email.toLowerCase(),
            password: pass, // In real app, this would be hashed
            is_activated: false,
            joined_at: new Date()
        });
        
        console.log(`✅ New user registered: ${name} (${email})`);
        
        res.json({ 
            success: true, 
            message: "Registration successful! Please check your email for verification." 
        });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ success: false, message: "Server error during registration." });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, pass } = req.body;
        
        const user = mockUsers.find(u => u.email === email.toLowerCase());
        
        if (!user) {
            return res.status(404).json({ success: false, message: "Account does not exist." });
        }
        
        if (!user.is_activated) {
            return res.status(403).json({ success: false, message: "Account not activated." });
        }
        
        if (user.password !== pass) { // In real app, use bcrypt.compare()
            return res.status(401).json({ success: false, message: "Invalid credentials." });
        }
        
        console.log(`✅ User logged in: ${user.name} (${user.email})`);
        
        res.json({ 
            success: true, 
            token: "mock-jwt-token-" + Date.now(),
            user: { 
                name: user.name, 
                email: user.email, 
                is_admin: user.is_admin || false 
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false });
    }
});

app.get('/api/activate', async (req, res) => {
    try {
        const cleanEmail = decodeURIComponent(req.query.email).trim().toLowerCase();
        const user = mockUsers.find(u => u.email === cleanEmail);
        
        if (user) {
            user.is_activated = true;
            console.log(`✅ Account activated: ${user.name} (${user.email})`);
        }
        
        res.sendFile(path.resolve(__dirname, 'success.html'));
    } catch (err) {
        res.status(500).send("Activation failed.");
    }
});

app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = mockUsers.find(u => u.email === email.toLowerCase());
        
        if (!user) {
            return res.status(404).json({ success: false, message: "No account found." });
        }
        
        console.log(`📧 Password reset requested for: ${email}`);
        res.json({ 
            success: true, 
            message: "Reset instructions sent to your email (mock - check console)." 
        });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/complete-reset', async (req, res) => {
    try {
        const { email, pass } = req.body;
        const user = mockUsers.find(u => u.email === email.toLowerCase());
        
        if (user) {
            user.password = pass; // In real app, this would be hashed
            console.log(`🔑 Password reset completed for: ${email}`);
        }
        
        res.json({ success: true, message: "Password updated successfully." });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/academy/all-courses', async (req, res) => {
    try {
        res.json({ 
            success: true, 
            courses: mockCourses.map(c => ({ ...c, isOwned: false })),
            stats: {
                totalCourses: mockCourses.length,
                totalStudents: mockUsers.length,
                totalSales: 0,
                totalScholarships: 0
            },
            ownedIds: []
        });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.get('/api/public-settings', async (req, res) => {
    try {
        res.json({ 
            success: true, 
            siteName: "NATER LEARNING HUB",
            tagline: "Empowering Excellence through Digital Innovation",
            logo: "/logo.jpg"
        });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'NATER LEARNING HUB Local Test Server Running',
        timestamp: new Date().toISOString(),
        version: '4.0.0-LOCAL',
        mode: 'TESTING (Mock Database)'
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
    console.log(`
    ================================================
    🚀 NATER HUB LOCAL TEST SERVER v4.0 ACTIVATED
    📡 PORT: ${PORT}
    🌐 BASE URL: http://localhost:${PORT}
    📁 Static Files: SERVED FROM ROOT DIRECTORY
    🖼️  Logo.jpg: PROPERLY SERVED
    💾 Database: MOCK MODE (for testing)
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
    
    🎯 Registration and Login are now working!
    📝 Check console for user activity logs
    `);
});
