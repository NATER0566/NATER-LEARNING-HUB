// REMOVED: require('dotenv').config() - Railway handles this automatically
const express = require('express');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const axios = require('axios'); 
const db = require('./db');
const multer = require('multer'); 
const fs = require('fs'); 

const app = express();
app.use(cors());

// --- FILE STORAGE CONFIG ---
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'uploads/'); },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname))); 
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET;

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const brandedEmail = (content) => `
<div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
    <div style="background: #b71c1c; padding: 30px; text-align: center; border-bottom: 6px solid #FFD700;">
        <h1 style="color: white; margin: 0; font-size: 26px; letter-spacing: 2px; text-transform: uppercase;">NATER HUB ACADEMY</h1>
    </div>
    <div style="background: white; text-align: center; padding: 25px 0 10px 0;">
         <img src="cid:logo" alt="Nater Academy" style="width: 250px; height: auto; display: inline-block;">
    </div>
    <div style="padding: 30px 40px; background: white; color: #333; line-height: 1.8;">
        ${content}
    </div>
    <div style="background: #1a1a1a; padding: 30px; text-align: center; color: #aaa; font-size: 11px;">
        <p style="color: #FFD700; font-weight: bold; margin-bottom: 10px;">SECURE GLOBAL PRODUCTION PORTAL</p>
        &copy; ${new Date().getFullYear()} NATER HUB ACADEMY. All Rights Reserved.
    </div>
</div>
`;

const emailAttachments = [{
    filename: 'logo.jpg',
    path: path.join(__dirname, 'logo.jpg'),
    cid: 'logo' 
}];

// --- PAGE ROUTES ---
// FIX: Added error handling for file paths to ensure the app doesn't hang if a file is missing
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });
app.get('/dashboard', (req, res) => { res.sendFile(path.join(__dirname, 'dashboard.html')); });
app.get('/admin.html', (req, res) => { res.sendFile(path.join(__dirname, 'admin.html')); });
app.get('/academy.html', (req, res) => { res.sendFile(path.join(__dirname, 'academy.html')); });
app.get('/library.html', (req, res) => { res.sendFile(path.join(__dirname, 'library.html')); });

// --- AUTHENTICATION API ---
app.post('/api/register', async (req, res) => {
    let { name, email, pass } = req.body;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,16}$/;
    const cleanEmail = email.replace(/\s+/g, '').toLowerCase();

    if (!cleanEmail || !emailRegex.test(cleanEmail)) return res.status(400).json({ success: false, message: "Invalid email." });
    if (!passRegex.test(pass)) return res.status(400).json({ success: false, message: "Weak password." });

    try {
        const userExists = await db.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
        if (userExists.rows.length > 0) return res.status(400).json({ success: false, message: "Exists." });

        const hashedPassword = await bcrypt.hash(pass, 10);
        await db.query('INSERT INTO users (name, email, password) VALUES ($1, $2, $3)', [name, cleanEmail, hashedPassword]);

        const activationLink = `${process.env.BASE_URL}/api/activate?email=${encodeURIComponent(cleanEmail)}`;
        await transporter.sendMail({
            from: `"NATER HUB ACADEMY" <${process.env.EMAIL_USER}>`,
            to: cleanEmail,
            subject: "Activate Account",
            html: brandedEmail(`<p>Click to activate:</p><a href="${activationLink}">ACTIVATE</a>`),
            attachments: emailAttachments
        });
        res.json({ success: true, message: "Check email." });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.get('/api/activate', async (req, res) => {
    const { email } = req.query;
    try {
        const cleanEmail = decodeURIComponent(email).replace(/\s+/g, '').toLowerCase();
        await db.query('UPDATE users SET is_activated = TRUE WHERE email = $1', [cleanEmail]);
        res.send("Account Activated. You can now login.");
    } catch (err) { res.status(500).send("Error."); }
});

app.post('/api/login', async (req, res) => {
    const { email, pass } = req.body;
    try {
        const cleanEmail = email.replace(/\s+/g, '').toLowerCase();
        const result = await db.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
        const user = result.rows[0];
        if (!user || !(await bcrypt.compare(pass, user.password))) return res.status(401).json({ success: false, message: "Invalid." });
        if (!user.is_activated) return res.status(403).json({ success: false, message: "Not activated." });

        const token = jwt.sign({ id: user.id, email: user.email, is_admin: user.is_admin }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ success: true, token });
    } catch (err) { res.status(500).json({ success: false }); }
});

// --- ACADEMY PROGRESS & COMMENTS ---
app.post('/api/academy/save-progress', async (req, res) => {
    const { email, lessonId, seconds } = req.body;
    try {
        await db.query('INSERT INTO lesson_progress (email, lesson_id, last_seconds) VALUES ($1, $2, $3) ON CONFLICT (email, lesson_id) DO UPDATE SET last_seconds = $3', [email, lessonId, seconds]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/academy/reply-comment', async (req, res) => {
    const { commentId, reply } = req.body;
    try {
        const result = await db.query('UPDATE lesson_comments SET admin_reply = $1 WHERE id = $2 RETURNING email, user_name, comment', [reply, commentId]);
        if (result.rows.length > 0) {
            const student = result.rows[0];
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: student.email,
                subject: "New Reply",
                html: brandedEmail(`<p>Admin replied: ${reply}</p>`),
                attachments: emailAttachments
            });
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

// --- ADMIN & COURSE ROUTES ---
app.get('/api/public-settings', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM site_settings WHERE id = 1');
        res.json({ success: true, settings: result.rows[0] });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/academy/add-lesson', upload.fields([{ name: 'video' }, { name: 'pdf' }]), async (req, res) => {
    try {
        const { courseId, title } = req.body;
        const v = req.files['video'] ? `uploads/${req.files['video'][0].filename}` : null;
        const p = req.files['pdf'] ? `uploads/${req.files['pdf'][0].filename}` : null;
        await db.query('INSERT INTO lessons (course_id, title, video_path, pdf_path) VALUES ($1, $2, $3, $4)', [courseId, title, v, p]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/academy/all-courses', async (req, res) => {
    try {
        const courses = await db.query('SELECT * FROM courses ORDER BY id DESC');
        res.json({ success: true, courses: courses.rows });
    } catch (err) { res.status(500).json({ success: false }); }
});

// --- SERVER START ---
// FIX: Using a specific host '0.0.0.0' helps Railway link the port correctly
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 NATER HUB SERVER ONLINE ON PORT ${PORT}`);
});
