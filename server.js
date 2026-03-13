require('dotenv').config();
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

// --- ADJUSTED LIMITS FOR STABLE UPLOADS ---
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from the root directory and the uploads folder
app.use(express.static(path.join(__dirname))); 
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- PAYSTACK CONFIGURATION ---
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET;

// PAYSTACK INITIALIZE ROUTE
app.get('/api/paystack/initialize', async (req, res) => {
    try {
        const { email, amount, courseId, title } = req.query;
        const response = await axios.post('https://api.paystack.co/transaction/initialize', {
            email: email,
            amount: Number(amount) * 100,
            metadata: { courseId, courseTitle: title },
            callback_url: `${process.env.BASE_URL}/verify-payment.html`
        }, {
            headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' }
        });
        res.redirect(response.data.data.authorization_url);
    } catch (err) {
        res.status(500).send("Payment Initialization Failed");
    }
});

// --- EMAIL TRANSPORTER ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// --- BRANDED EMAIL TEMPLATE ---
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
        if (userExists.rows.length > 0) return res.status(400).json({ success: false, message: "Registered already." });

        const hashedPassword = await bcrypt.hash(pass, 10);
        await db.query('INSERT INTO users (name, email, password) VALUES ($1, $2, $3)', [name, cleanEmail, hashedPassword]);

        const activationLink = `${process.env.BASE_URL}/api/activate?email=${encodeURIComponent(cleanEmail)}`;
        await transporter.sendMail({
            from: `"NATER HUB ACADEMY" <${process.env.EMAIL_USER}>`,
            to: cleanEmail,
            subject: "Activate Your Academy Account",
            html: brandedEmail(`<h2>Hello ${name},</h2><p>Click below to verify your account:</p><a href="${activationLink}">ACTIVATE</a>`),
            attachments: emailAttachments
        });
        res.json({ success: true, message: "Check email to activate." });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.get('/api/activate', async (req, res) => {
    const { email } = req.query;
    try {
        const cleanEmail = decodeURIComponent(email).replace(/\s+/g, '').toLowerCase();
        await db.query('UPDATE users SET is_activated = TRUE WHERE email = $1', [cleanEmail]);
        res.sendFile(path.resolve(__dirname, 'success.html'));
    } catch (err) { res.status(500).send("Activation failed."); }
});

app.post('/api/login', async (req, res) => {
    const { email, pass } = req.body;
    try {
        const cleanEmail = email.replace(/\s+/g, '').toLowerCase();
        const result = await db.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
        const user = result.rows[0];
        if (!user || !(await bcrypt.compare(pass, user.password))) return res.status(401).json({ success: false, message: "Invalid credentials." });
        if (!user.is_activated) return res.status(403).json({ success: false, message: "Activate your account." });

        const token = jwt.sign({ id: user.id, email: user.email, name: user.name, is_admin: Boolean(user.is_admin) }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ success: true, token });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const cleanEmail = email.replace(/\s+/g, '').toLowerCase();
        const resetLink = `${process.env.BASE_URL}/reset-password.html?email=${encodeURIComponent(cleanEmail)}`;
        await transporter.sendMail({
            from: `"NATER HUB ACADEMY"`, to: cleanEmail, subject: "Reset Password",
            html: brandedEmail(`<p>Click below to reset:</p><a href="${resetLink}">RESET</a>`),
            attachments: emailAttachments
        });
        res.json({ success: true, message: "Reset link sent." });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/complete-reset', async (req, res) => {
    const { email, pass } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(pass, 10);
        await db.query('UPDATE users SET password = $1 WHERE email = $2', [hashedPassword, email.toLowerCase()]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

// --- PROGRESS TRACKING ---

app.post('/api/academy/save-progress', async (req, res) => {
    const { email, lessonId, seconds } = req.body;
    try {
        await db.query(`INSERT INTO lesson_progress (email, lesson_id, last_seconds) VALUES ($1, $2, $3) ON CONFLICT (email, lesson_id) DO UPDATE SET last_seconds = $3`, [email, lessonId, seconds]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/academy/mark-watched', async (req, res) => {
    const { email, lessonId } = req.body;
    try {
        await db.query(`INSERT INTO lesson_progress (email, lesson_id, watched) VALUES ($1, $2, TRUE) ON CONFLICT (email, lesson_id) DO UPDATE SET watched = TRUE`, [email, lessonId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

// --- DISCUSSION SYSTEM ---

app.post('/api/academy/get-comments', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM lesson_comments WHERE lesson_id = $1 ORDER BY created_at DESC', [req.body.lessonId]);
        res.json({ success: true, comments: result.rows });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/academy/post-comment', async (req, res) => {
    const { lessonId, email, name, comment } = req.body;
    try {
        await db.query('INSERT INTO lesson_comments (lesson_id, email, user_name, comment) VALUES ($1, $2, $3, $4)', [lessonId, email, name, comment]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/academy/reply-comment', async (req, res) => {
    const { commentId, reply } = req.body;
    try {
        const result = await db.query('UPDATE lesson_comments SET admin_reply = $1 WHERE id = $2 RETURNING email, user_name', [reply, commentId]);
        const user = result.rows[0];
        if (user) {
            await transporter.sendMail({
                from: `"NATER HUB ACADEMY"`, to: user.email, subject: "Instructor Replied",
                html: brandedEmail(`<p><b>Reply:</b> ${reply}</p>`),
                attachments: emailAttachments
            });
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

// --- CERTIFICATE VERIFICATION ---
app.post('/api/verify-certificate', async (req, res) => {
    const { certId, email, courseId } = req.body; 
    try {
        if (certId === "ADMIN-AUTH" || certId === "SCHOLAR-AUTH") {
            const userRes = await db.query('SELECT name FROM users WHERE email = $1', [email]);
            const courseRes = await db.query(courseId ? 'SELECT title FROM courses WHERE id = $1' : 'SELECT title FROM courses LIMIT 1', [courseId]);
            return res.json({ success: true, studentName: userRes.rows[0].name, courseName: courseRes.rows[0].title });
        }
        const result = await db.query(`SELECT u.name, c.title FROM course_access ca JOIN users u ON ca.email = u.email JOIN courses c ON ca.course_id = c.id WHERE ca.payment_reference = $1 AND u.email = $2`, [certId, email]);
        if (result.rows.length > 0) res.json({ success: true, studentName: result.rows[0].name, courseName: result.rows[0].title });
        else res.status(404).json({ success: false });
    } catch (err) { res.status(500).json({ success: false }); }
});

// --- ADMIN SETTINGS ---

app.get('/api/public-settings', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM site_settings WHERE id = 1');
        res.json({ success: true, ...result.rows[0] });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/update-settings', async (req, res) => {
    const { siteName, tagline, avatar } = req.body;
    try {
        await db.query(`INSERT INTO site_settings (id, site_name, tagline, avatar) VALUES (1, $1, $2, $3) ON CONFLICT (id) DO UPDATE SET site_name = $1, tagline = $2, avatar = $3`, [siteName, tagline, avatar]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/update-public-box', async (req, res) => {
    const { contentType, contentValue } = req.body;
    try {
        await db.query(`UPDATE site_settings SET content_type = $1, content_value = $2 WHERE id = 1`, [contentType, contentValue]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/update-news', async (req, res) => {
    const { news } = req.body;
    try {
        await db.query(`UPDATE site_settings SET announcement = $1 WHERE id = 1`, [news]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/update-orb', async (req, res) => {
    const { active, title, url, message } = req.body;
    try {
        const orbData = JSON.stringify({ active, title, url, message });
        await db.query(`UPDATE site_settings SET orb_data = $1 WHERE id = 1`, [orbData]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

// --- ACADEMY OPERATIONS ---

app.post('/api/academy/add-course', async (req, res) => {
    const { title, price, category, thumbnail } = req.body;
    try {
        await db.query('INSERT INTO courses (title, price, category, thumbnail) VALUES ($1, $2, $3, $4)', [title, price, category, thumbnail]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/academy/add-lesson', upload.fields([{ name: 'video' }, { name: 'pdf' }]), async (req, res) => {
    try {
        const { courseId, title } = req.body;
        const video = req.files['video'] ? `uploads/${req.files['video'][0].filename}` : null;
        const pdf = req.files['pdf'] ? `uploads/${req.files['pdf'][0].filename}` : null;
        await db.query('INSERT INTO lessons (course_id, title, video_path, pdf_path) VALUES ($1, $2, $3, $4)', [courseId, title, video, pdf]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/academy/all-courses', async (req, res) => {
    try {
        const stats = await db.query(`SELECT (SELECT COUNT(*) FROM courses) as c, (SELECT COUNT(*) FROM users) as u`);
        const courses = await db.query('SELECT * FROM courses ORDER BY id DESC');
        const owned = await db.query('SELECT course_id FROM course_access WHERE email = $1', [req.body.email]);
        res.json({ success: true, courses: courses.rows, ownedIds: owned.rows.map(r => r.course_id), courseCount: stats.rows[0].c, registeredCount: stats.rows[0].u });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/academy/lessons', async (req, res) => {
    const { email, courseId } = req.body;
    try {
        const access = await db.query('SELECT payment_reference FROM course_access WHERE email = $1 AND course_id = $2', [email, courseId]);
        const lessons = await db.query(`SELECT l.*, p.watched FROM lessons l LEFT JOIN lesson_progress p ON l.id = p.lesson_id AND p.email = $1 WHERE l.course_id = $2`, [email, courseId]);
        res.json({ success: true, lessons: lessons.rows, enrollment: access.rows[0] });
    } catch (err) { res.status(500).json({ success: false }); }
});

// --- PAYSTACK VERIFICATION ---
app.post('/api/paystack/verify', async (req, res) => {
    const { reference, email, courseId } = req.body;
    try {
        const payRes = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } });
        if (payRes.data.data.status === 'success') {
            await db.query('INSERT INTO course_access (email, course_id, payment_reference) VALUES ($1, $2, $3)', [email, courseId, reference]);
            res.json({ success: true });
        } else res.status(400).json({ success: false });
    } catch (err) { res.status(500).json({ success: false }); }
});

// --- LIBRARY SYSTEM ---
app.post('/api/library/add', upload.single('file'), async (req, res) => {
    try {
        const { title, courseCode, level, semester, type } = req.body;
        const url = req.file ? `uploads/${req.file.filename}` : null;
        await db.query(`INSERT INTO library_materials (title, course_code, level, semester, type, file_url) VALUES ($1, $2, $3, $4, $5, $6)`, [title, courseCode, level, semester, type, url]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.get('/api/library/all', async (req, res) => {
    try {
        const result = await db.query('SELECT *, course_code as "courseCode", file_url as "fileURL" FROM library_materials ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/academy/delete-course', async (req, res) => {
    await db.query('DELETE FROM lessons WHERE course_id = $1', [req.body.id]);
    await db.query('DELETE FROM courses WHERE id = $1', [req.body.id]);
    res.json({ success: true });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 HUB SERVER ONLINE ON PORT ${PORT}`));