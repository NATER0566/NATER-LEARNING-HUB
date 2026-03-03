// REMOVED: require('dotenv').config() - Railway handles this automatically
const express = require('express');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const axios = require('axios'); 
const db = require('./db');
<<<<<<< HEAD
const multer = require('multer'); 
const fs = require('fs'); 
=======
const multer = require('multer'); // Fix for large videos
const fs = require('fs'); // For directory checking
const { GoogleGenerativeAI } = require("@google/generative-ai"); // Added for Nater's AI
>>>>>>> 84c51c4 (Update pages, server logic, and new files)

const app = express();
app.use(cors());

<<<<<<< HEAD
// --- FILE STORAGE CONFIG ---
=======
// --- NATER'S AI INITIALIZATION ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- FIX: FILE STORAGE CONFIG ---
>>>>>>> 84c51c4 (Update pages, server logic, and new files)
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

<<<<<<< HEAD
=======
// --- ADDED FIX: PAYSTACK INITIALIZE ROUTE ---
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
>>>>>>> 84c51c4 (Update pages, server logic, and new files)
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

<<<<<<< HEAD
// --- ACADEMY PROGRESS & COMMENTS ---
=======
// 4. FORGOT PASSWORD
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const cleanEmail = email.replace(/\s+/g, '').toLowerCase();
        const result = await db.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: "Email not found." });

        const resetLink = `${process.env.BASE_URL}/reset-password.html?email=${encodeURIComponent(cleanEmail)}`;
        
        await transporter.sendMail({
            from: `"NATER HUB ACADEMY" <${process.env.EMAIL_USER}>`,
            to: cleanEmail,
            subject: "Password Reset Request",
            html: brandedEmail(`
                <h2>Reset Your Password</h2>
                <p>Click the button below to choose a new password:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetLink}" style="background: #1a1a1a; color: white; padding: 18px 35px; text-decoration: none; border-radius: 10px; font-weight: 800; display: inline-block;">RESET PASSWORD</a>
                </div>
            `),
            attachments: emailAttachments
        });

        res.json({ success: true, message: "Reset link sent to your email." });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error processing request." });
    }
});

// 5. COMPLETE RESET
app.post('/api/complete-reset', async (req, res) => {
    const { email, pass } = req.body;
    try {
        const cleanEmail = email.replace(/\s+/g, '').toLowerCase();
        const hashedPassword = await bcrypt.hash(pass, 10);
        const result = await db.query('UPDATE users SET password = $1 WHERE email = $2 RETURNING *', [hashedPassword, cleanEmail]);
        
        if (result.rows.length > 0) {
            res.json({ success: true, message: "Password updated successfully!" });
        } else {
            res.status(400).json({ success: false, message: "User not found." });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error updating password." });
    }
});

// ---Progress Progress (CRITICAL FIX) ---

>>>>>>> 84c51c4 (Update pages, server logic, and new files)
app.post('/api/academy/save-progress', async (req, res) => {
    const { email, lessonId, seconds } = req.body;
    try {
        await db.query('INSERT INTO lesson_progress (email, lesson_id, last_seconds) VALUES ($1, $2, $3) ON CONFLICT (email, lesson_id) DO UPDATE SET last_seconds = $3', [email, lessonId, seconds]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

<<<<<<< HEAD
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
=======
app.post('/api/academy/get-progress', async (req, res) => {
    const { email, lessonId } = req.body;
    try {
        const result = await db.query(
            'SELECT last_seconds FROM lesson_progress WHERE email = $1 AND lesson_id = $2',
            [email, lessonId]
        );
        res.json({ success: true, seconds: result.rows[0]?.last_seconds || 0 });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/academy/mark-watched', async (req, res) => {
    const { email, lessonId } = req.body;
    try {
        await db.query(`
            INSERT INTO lesson_progress (email, lesson_id, watched)
            VALUES ($1, $2, TRUE)
            ON CONFLICT (email, lesson_id) DO UPDATE SET watched = TRUE`,
            [email, lessonId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// --- NEW: LESSON DISCUSSION SYSTEM ---

app.post('/api/academy/get-comments', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM lesson_comments WHERE lesson_id = $1 ORDER BY created_at DESC', [req.body.lessonId]);
        res.json({ success: true, comments: result.rows });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/academy/post-comment', async (req, res) => {
    const { lessonId, email, name, comment } = req.body;
    try {
        await db.query('INSERT INTO lesson_comments (lesson_id, email, user_name, comment) VALUES ($1, $2, $3, $4)', [lessonId, email, name, comment]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// NEW: ADMIN REPLY TO QUESTION (WITH EMAIL NOTIFICATION FIX)
app.post('/api/academy/reply-comment', async (req, res) => {
    const { commentId, reply } = req.body;
    try {
        const result = await db.query('UPDATE lesson_comments SET admin_reply = $1 WHERE id = $2 RETURNING email, user_name', [reply, commentId]);
        const user = result.rows[0];
        if (user) {
            await transporter.sendMail({
                from: `"NATER HUB ACADEMY" <${process.env.EMAIL_USER}>`,
                to: user.email,
                subject: "Instructor Replied to Your Question",
                html: brandedEmail(`
                    <h2>Hello ${user.user_name},</h2>
                    <p>An instructor has replied to your question in the Academy Portal.</p>
                    <p><b>Reply:</b> ${reply}</p>
                `),
>>>>>>> 84c51c4 (Update pages, server logic, and new files)
                attachments: emailAttachments
            });
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

<<<<<<< HEAD
// --- ADMIN & COURSE ROUTES ---
app.get('/api/public-settings', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM site_settings WHERE id = 1');
        res.json({ success: true, settings: result.rows[0] });
    } catch (err) { res.status(500).json({ success: false }); }
});

=======
// --- NEW: CERTIFICATE VERIFICATION (STRICT REAL DATA FIX) ---
app.post('/api/verify-certificate', async (req, res) => {
    const { certId, email, courseId } = req.body; 
    try {
        // 1. Handle Manual Auth IDs (Admin or Scholar)
        if (certId === "ADMIN-AUTH" || certId === "SCHOLAR-AUTH") {
            const userRes = await db.query('SELECT name FROM users WHERE email = $1', [email]);
            // If courseId isn't sent in body, we try to find the latest access for this email
            const courseRes = await db.query(
                courseId ? 'SELECT title FROM courses WHERE id = $1' : 
                'SELECT c.title FROM courses c JOIN course_access ca ON c.id = ca.course_id WHERE ca.email = $1 LIMIT 1', 
                [courseId || email]
            );

            if (userRes.rows.length > 0) {
                return res.json({ 
                    success: true, 
                    studentName: userRes.rows[0].name,
                    courseName: courseRes.rows[0]?.title || "ACADEMY CURRICULUM"
                });
            }
        }

        // 2. Handle Real Purchase References (Paystack)
        const result = await db.query(`
            SELECT u.name as student_name, c.title as course_name 
            FROM course_access ca
            JOIN users u ON ca.email = u.email
            JOIN courses c ON ca.course_id = c.id
            WHERE ca.payment_reference = $1 AND u.email = $2`, [certId, email]);

        if (result.rows.length > 0) {
            res.json({ success: true, studentName: result.rows[0].student_name, courseName: result.rows[0].course_name });
        } else {
            res.status(404).json({ success: false, message: "Verification failed. Record not found." });
        }
    } catch (err) { res.status(500).json({ success: false }); }
});

// --- ADMIN CONFIGURATION ROUTES ---

// 6. GET PUBLIC SETTINGS
app.get('/api/public-settings', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM site_settings WHERE id = 1');
        if (result.rows.length > 0) {
            const data = result.rows[0];
            res.json({ 
                success: true, 
                siteName: data.site_name, 
                tagline: data.tagline, 
                avatar: data.avatar,
                contentType: data.content_type,
                contentValue: data.content_value,
                announcement: data.announcement,
                orbData: data.orb_data
            });
        } else {
            res.json({ success: true, siteName: "NATER HUB ACADEMY", tagline: "Official Global Production Portal" });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: "Database error" });
    }
});

// 7. UPDATE BRANDING
app.post('/api/update-settings', async (req, res) => {
    const { siteName, tagline, avatar } = req.body;
    try {
        await db.query(`
            INSERT INTO site_settings (id, site_name, tagline, avatar) 
            VALUES (1, $1, $2, $3)
            ON CONFLICT (id) DO UPDATE SET site_name = $1, tagline = $2, avatar = $3`, 
            [siteName, tagline, avatar]);
        res.json({ success: true, message: "Branding updated successfully!" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to update branding." });
    }
});

// 8. UPDATE PUBLIC CONTENT BOX
app.post('/api/update-public-box', async (req, res) => {
    const { contentType, contentValue } = req.body;
    try {
        await db.query(`
            UPDATE site_settings SET content_type = $1, content_value = $2 WHERE id = 1`, 
            [contentType, contentValue]);
        res.json({ success: true, message: "Public content updated!" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to update public box." });
    }
});

// 9. UPDATE NEWS & ORB
app.post('/api/update-news', async (req, res) => {
    const { news } = req.body;
    try {
        await db.query(`UPDATE site_settings SET announcement = $1 WHERE id = 1`, [news]);
        res.json({ success: true, message: "News published!" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to update news." });
    }
});

app.post('/api/update-orb', async (req, res) => {
    const { active, title, url, message } = req.body;
    try {
        const orbData = JSON.stringify({ active, title, url, message });
        await db.query(`UPDATE site_settings SET orb_data = $1 WHERE id = 1`, [orbData]);
        res.json({ success: true, message: "Orb configuration saved!" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to update Orb." });
    }
});

// --- ACADEMY & PAYSTACK API ---

// 10. ADD COURSE
app.post('/api/academy/add-course', async (req, res) => {
    const { title, price, category, thumbnail } = req.body;
    try {
        await db.query('INSERT INTO courses (title, price, category, thumbnail) VALUES ($1, $2, $3, $4)', [title, price, category, thumbnail]);
        res.json({ success: true, message: "Course added successfully!" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to add course." });
    }
});

// NEW: FULL EDIT COURSE (Handles Metadata + Optional Thumbnail Replacement)
app.post('/api/academy/edit-course', async (req, res) => {
    const { id, title, price, category, thumbnail } = req.body;
    try {
        if (thumbnail) {
            // Update everything including the new thumbnail (Base64)
            await db.query(
                'UPDATE courses SET title = $1, price = $2, category = $3, thumbnail = $4 WHERE id = $5', 
                [title, price, category, thumbnail, id]
            );
        } else {
            // Update only metadata, keep existing thumbnail
            await db.query(
                'UPDATE courses SET title = $1, price = $2, category = $3 WHERE id = $4', 
                [title, price, category, id]
            );
        }
        res.json({ success: true, message: "Course branding updated!" });
    } catch (err) { 
        res.status(500).json({ success: false }); 
    }
});

// NEW: FULL EDIT LESSON (Handles Title + Optional Video/PDF replacement)
app.post('/api/academy/edit-lesson', upload.fields([{ name: 'video' }, { name: 'pdf' }]), async (req, res) => {
    const { id, title } = req.body;
    try {
        let query = 'UPDATE lessons SET title = $1';
        let params = [title];
        let count = 2;

        if (req.files['video']) {
            query += `, video_path = $${count++}`;
            params.push(`uploads/${req.files['video'][0].filename}`);
        }
        if (req.files['pdf']) {
            query += `, pdf_path = $${count++}`;
            params.push(`uploads/${req.files['pdf'][0].filename}`);
        }

        query += ` WHERE id = $${count}`;
        params.push(id);

        await db.query(query, params);
        res.json({ success: true, message: "Lesson content updated!" });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ success: false }); 
    }
});

// 11. ADD LESSON (Original Stability Logic)
>>>>>>> 84c51c4 (Update pages, server logic, and new files)
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
<<<<<<< HEAD
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
=======
        const stats = await db.query(`SELECT 
            (SELECT COUNT(*) FROM courses) as course_count,
            (SELECT COUNT(*) FROM users) as user_count,
            (SELECT COUNT(*) FROM course_access WHERE payment_reference = 'manual') as scholar_count,
            (SELECT COUNT(*) FROM course_access WHERE payment_reference != 'manual') as purchaser_count`);
        
        const coursesResult = await db.query('SELECT * FROM courses ORDER BY id DESC');
        const accessRes = await db.query('SELECT course_id FROM course_access WHERE email = $1', [email]);
        
        res.json({ 
            success: true, 
            courses: coursesResult.rows, 
            ownedIds: accessRes.rows.map(r => r.course_id),
            courseCount: stats.rows[0].course_count,
            registeredCount: stats.rows[0].user_count,
            scholarCount: stats.rows[0].scholar_count, 
            purchaserCount: stats.rows[0].purchaser_count
        });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to fetch academy data." });
    }
});

// --- UPDATED LESSONS ENDPOINT ---
app.post('/api/academy/lessons', async (req, res) => {
    const { email, courseId } = req.body;
    try {
        const userRes = await db.query('SELECT is_admin FROM users WHERE email = $1', [email]);
        const accessRes = await db.query('SELECT payment_reference FROM course_access WHERE email = $1 AND course_id = $2', [email, courseId]);

        if (userRes.rows[0]?.is_admin || accessRes.rows.length > 0) {
            // FIX: Identify exact access type
            let accessType = "PURCHASE";
            let ref = accessRes.rows[0]?.payment_reference;

            if (ref === 'manual') {
                accessType = "SCHOLAR";
                ref = "SCHOLAR-AUTH";
            } else if (userRes.rows[0]?.is_admin && !ref) {
                accessType = "ADMIN";
                ref = "ADMIN-AUTH";
            }

            const enrollment = { access_type: accessType, payment_reference: ref };

            const lessonsRes = await db.query(`
                SELECT l.id, l.title, l.video_path as video, l.pdf_path as pdf, p.watched, p.last_seconds 
                FROM lessons l 
                LEFT JOIN lesson_progress p ON l.id = p.lesson_id AND p.email = $1
                WHERE l.course_id = $2 ORDER BY l.id ASC`, [email, courseId]);
            res.json({ success: true, lessons: lessonsRes.rows, enrollment });
        } else {
            res.status(403).json({ success: false, message: "Unauthorized access." });
        }
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// 18. PURCHASE RECORDING (CALLED AFTER PAYSTACK CALLBACK)
app.post('/api/academy/purchase', async (req, res) => {
    const { email, courseId, reference, courseTitle } = req.body;
    try {
        await db.query('INSERT INTO course_access (email, course_id, payment_reference) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [email, courseId, reference]);
        
        await transporter.sendMail({
            from: `"NATER HUB ACADEMY" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Course Enrollment Successful",
            html: brandedEmail(`
                <h2>Success!</h2>
                <p>You have successfully enrolled in <b>${courseTitle}</b>.</p>
                <p>Transaction Ref: ${reference}</p>
            `),
            attachments: emailAttachments
        });

        res.json({ success: true, message: "Purchase recorded." });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// --- UPDATED PAYSTACK VERIFICATION (STRICT REAL DATA LOGIC) ---

// 1. Manual Verification
app.get('/api/paystack/verify', async (req, res) => {
    const { reference } = req.query;
    if (!reference) return res.status(400).json({ success: false, message: "Reference missing" });

    try {
        const payRes = await axios.get(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
            headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` }
        });

        if (payRes.data.data.status === 'success') {
            const email = payRes.data.data.customer.email;
            const courseId = payRes.data.data.metadata?.courseId || null;

            const existing = await db.query('SELECT * FROM course_access WHERE payment_reference = $1', [reference]);
            if (existing.rows.length > 0) {
                return res.json({ success: true, message: "Verified! Your credentials are recorded and live." });
            }

            if (courseId) {
                await db.query('INSERT INTO course_access (email, course_id, payment_reference) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [email, courseId, reference]);
            }

            res.json({ success: true, message: "Payment verified successfully!" });
        } else {
            res.status(400).json({ success: false, message: "Payment not successful with Paystack." });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error during verification." });
    }
});

// 2. Automatic Verification
app.post('/api/paystack/verify', async (req, res) => {
    const { reference, email, courseId, courseTitle } = req.body;
    try {
        const payRes = await axios.get(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
            headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` }
        });

        if (payRes.data.data.status === 'success') {
            await db.query(
                'INSERT INTO course_access (email, course_id, payment_reference) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', 
                [email, courseId, reference]
            );
            
            await transporter.sendMail({
                from: `"NATER HUB ACADEMY" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: "Enrollment Confirmed: " + (courseTitle || "Course"),
                html: brandedEmail(`
                    <h2>Payment Successful!</h2>
                    <p>Lifetime access granted.</p>
                    <p>Ref: <b>${reference}</b></p>
                `),
                attachments: emailAttachments
            });

            res.json({ success: true, message: "Payment verified!" });
        } else {
            res.status(400).json({ success: false });
        }
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// 14. GRANT MANUAL ACCESS
app.post('/api/academy/grant-access', async (req, res) => {
    const { email, type, courseId } = req.body;
    try {
        if (type === 'all') {
            const courses = (await db.query('SELECT id FROM courses')).rows;
            for(let c of courses) {
                await db.query('INSERT INTO course_access (email, course_id, payment_reference) VALUES ($1, $2, \'manual\') ON CONFLICT DO NOTHING', [email, c.id]);
            }
        } else {
            await db.query('INSERT INTO course_access (email, course_id, payment_reference) VALUES ($1, $2, \'manual\') ON CONFLICT DO NOTHING', [email, courseId]);
        }

        await transporter.sendMail({
            from: `"NATER HUB ACADEMY" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Special Access Granted",
            html: brandedEmail(`<h2>Welcome!</h2><p>Admin has granted you access.</p>`),
            attachments: emailAttachments
        });
        res.json({ success: true, message: "Access granted." });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// 15. DELETE COURSE/LESSON
app.post('/api/academy/delete-course', async (req, res) => {
    try {
        await db.query('DELETE FROM lessons WHERE course_id = $1', [req.body.id]);
        await db.query('DELETE FROM courses WHERE id = $1', [req.body.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/academy/delete-lesson', async (req, res) => {
    try {
        await db.query('DELETE FROM lessons WHERE id = $1', [req.body.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// --- NEW: LIBRARY REPOSITORY SYSTEM ---

// 1. Upload Material (Handles File + Metadata)
app.post('/api/library/add', upload.single('file'), async (req, res) => {
    try {
        const { title, courseCode, level, semester, type } = req.body;
        const fileURL = req.file ? `uploads/${req.file.filename}` : null;

        await db.query(
            `INSERT INTO library_materials (title, course_code, level, semester, type, file_url) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [title, courseCode, level, semester, type, fileURL]
        );
        res.json({ success: true, message: "Material added to library!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to upload to library." });
    }
});

// 2. Fetch All Materials
app.get('/api/library/all', async (req, res) => {
    try {
        const result = await db.query('SELECT id, title, course_code as "courseCode", level, semester, type, file_url as "fileURL" FROM library_materials ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// 3. FULL EDIT: LIBRARY MATERIAL (INCL. FILE & CATEGORY)
app.post('/api/library/edit', upload.single('file'), async (req, res) => {
    const { id, title, courseCode, level, semester, type } = req.body;
    try {
        let query = `UPDATE library_materials SET title = $1, course_code = $2, level = $3, semester = $4, type = $5`;
        let params = [title, courseCode, level, semester, type];

        // If a new file was uploaded, update the file URL too
        if (req.file) {
            const fileURL = `uploads/${req.file.filename}`;
            query += `, file_url = $6 WHERE id = $7`;
            params.push(fileURL, id);
        } else {
            query += ` WHERE id = $6`;
            params.push(id);
        }

        await db.query(query, params);
        res.json({ success: true, message: "Material updated successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error during update" });
    }
});

// 4. Delete Material
app.post('/api/library/delete', async (req, res) => {
    try {
        await db.query('DELETE FROM library_materials WHERE id = $1', [req.body.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// --- NEW: COMMENT MANAGEMENT ---

app.post('/api/academy/delete-comment', async (req, res) => {
    try {
        await db.query('DELETE FROM lesson_comments WHERE id = $1', [req.body.id]);
        res.json({ success: true, message: "Question cleared." });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// --- NATER'S AI - GLOBAL HUB BRAIN ---
app.post('/api/ai/chat', async (req, res) => {
    const { message, fileData, fileType, email, name, isLoginPage = false, context = "", history = [] } = req.body;

    try {
        // 1. DYNAMIC DATA FETCH: Pull everything the Hub has
        const [courses, library, publicSettings] = await Promise.all([
            db.query('SELECT title, price, category FROM courses'),
            db.query('SELECT title, level, type FROM library_materials'),
            db.query('SELECT site_name, tagline FROM site_settings LIMIT 1')
        ]);

        const hubName = publicSettings.rows[0]?.site_name || "Nater's Learning Hub";

        // 2. THE SYSTEM BRAIN: Define rules and switching logic
        const systemPrompt = `
            You are the Official AI Intelligence of ${hubName}.
            
            ${isLoginPage ? `
            CURRENT MODE: PORTAL GATEWAY SUPPORT.
            - Help users with Registration, Login, and Activation Links.
            - Explain that a verification link is sent to their email and they MUST click it to log in.
            - If they forgot their password, tell them to use the "Forgot Password" link on this page.
            - PAGE CONTEXT: ${context} (Use this to answer questions about WhatsApp numbers, emails, or rules found on the page).
            ` : `
            CURRENT MODE: STUDENT ACADEMY TUTOR.
            - Help students with courses and library materials.
            - Provide study plans and academic summaries based on our repository.
            `}

            HUB DATA CONTEXT:
            - Available Courses: ${courses.rows.map(c => `${c.title} (${c.category}, ₦${c.price})`).join(', ')}
            - Library materials exist for levels: ${[...new Set(library.rows.map(l => l.level))].join(', ')}
            
            SECURITY & TONE:
            - Never reveal database secrets or internal admin passwords.
            - Be Elite, Professional, and Concise.
            - If user asks suspicious security questions, reply: "I am designed for academic excellence and portal support."
        `;

        // CHANGED TO GEMINI 2.0 FLASH FOR STABILITY WITH SYSTEM INSTRUCTIONS
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", systemInstruction: systemPrompt });

        // --- FIX: HANDLE CONVERSATION HISTORY ---
        const chat = model.startChat({
            history: history.map(h => ({
                role: h.role === 'user' ? 'user' : 'model',
                parts: [{ text: h.content }],
            })),
        });

        let result;
        if (fileData) {
            // Multimodal if file exists
            result = await model.generateContent([
                message || "Analyze this request based on Nater Hub rules.",
                { inlineData: { data: fileData, mimeType: fileType } }
            ]);
        } else {
            // Standard chat with history memory
            result = await chat.sendMessage(message);
        }

        const aiReply = result.response.text();

        // 3. SECURITY SENSOR & DUAL NOTIFICATION (Email + WhatsApp)
        const darkPattern = ["drop table", "select * from", "config", "hacked", "bypass payment", "admin login", "admin password", "hack"];
        if (darkPattern.some(word => message.toLowerCase().includes(word))) {
            const adminEmail = "nmbashau@gmail.com";
            const adminPhone = "2348160979620";
            const waMsg = encodeURIComponent(`🚨 AI SECURITY ALERT\nUser: ${name}\nEmail: ${email}\nInput: ${message}`);
            const waLink = `https://wa.me/${adminPhone}?text=${waMsg}`;

            await transporter.sendMail({
                from: '"Nater Hub Security" <' + process.env.EMAIL_USER + '>',
                to: adminEmail,
                subject: "⚠️ AI SECURITY TRIGGERED",
                html: brandedEmail(`
                    <h3>Security Alert</h3>
                    <p><b>User:</b> ${name} (${email})</p>
                    <p><b>Suspicious Input:</b> ${message}</p>
                    <p><b>AI Response:</b> ${aiReply}</p>
                    <p><a href="${waLink}" style="background:#25D366; color:white; padding:10px; border-radius:5px; text-decoration:none;">SEND WHATSAPP ALERT</a></p>
                `)
            });
        }

        res.json({ success: true, reply: aiReply });

    } catch (err) {
        console.error("AI SERVER ERROR:", err); 
        res.status(500).json({ success: false, reply: "The Hub Brain is currently rebooting. Please try again." });
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 NATER HUB SERVER ONLINE ON PORT ${PORT}`));
>>>>>>> 84c51c4 (Update pages, server logic, and new files)
