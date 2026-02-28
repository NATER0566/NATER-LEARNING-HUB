require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const axios = require('axios'); // Added for Paystack verification
const db = require('./db');
const multer = require('multer'); // Fix for large videos
const fs = require('fs'); // For directory checking

const app = express();
app.use(cors());

// --- FIX: FILE STORAGE CONFIG ---
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

// 1. REGISTER
app.post('/api/register', async (req, res) => {
    let { name, email, pass } = req.body;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,16}$/;

    const cleanEmail = email.replace(/\s+/g, '').toLowerCase();

    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
        return res.status(400).json({ success: false, message: "Invalid email format." });
    }
    if (!passRegex.test(pass)) {
        return res.status(400).json({ success: false, message: "Password does not meet security requirements." });
    }

    try {
        const userExists = await db.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ success: false, message: "Email already registered." });
        }

        const hashedPassword = await bcrypt.hash(pass, 10);
        await db.query('INSERT INTO users (name, email, password) VALUES ($1, $2, $3)', [name, cleanEmail, hashedPassword]);

        const activationLink = `${process.env.BASE_URL}/api/activate?email=${encodeURIComponent(cleanEmail)}`;
        
        await transporter.sendMail({
            from: `"NATER HUB ACADEMY" <${process.env.EMAIL_USER}>`,
            to: cleanEmail,
            subject: "Action Required: Activate Your Academy Account",
            html: brandedEmail(`
                <h2>Hello ${name},</h2>
                <p>Welcome to the official portal. Click below to verify your account:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${activationLink}" style="background: #b71c1c; color: white; padding: 18px 35px; text-decoration: none; border-radius: 10px; font-weight: 800; display: inline-block;">ACTIVATE MY ACCOUNT</a>
                </div>
            `),
            attachments: emailAttachments
        });

        res.json({ success: true, message: "Registration successful! Check your email to activate." });
    } catch (err) {
        res.status(500).json({ success: false, message: "Internal server error." });
    }
});

// 2. ACTIVATION LINK
app.get('/api/activate', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).send("Activation parameters missing.");
    try {
        const cleanEmail = decodeURIComponent(email).replace(/\s+/g, '').toLowerCase();
        const result = await db.query('UPDATE users SET is_activated = TRUE WHERE email = $1 RETURNING *', [cleanEmail]);
        if (result.rows.length > 0) {
            res.sendFile(path.resolve(__dirname, 'success.html'));
        } else {
            res.status(400).send("Activation failed. User not found or already active.");
        }
    } catch (err) {
        res.status(500).send("Error activating account.");
    }
});

// 3. LOGIN
app.post('/api/login', async (req, res) => {
    const { email, pass } = req.body;
    try {
        const cleanEmail = email.replace(/\s+/g, '').toLowerCase();
        const result = await db.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
        const user = result.rows[0];

        if (!user) return res.status(404).json({ success: false, message: "Email not found." });
        
        const passMatch = await bcrypt.compare(pass, user.password);
        if (!passMatch) return res.status(401).json({ success: false, message: "Invalid credentials." });

        if (!user.is_activated) {
            return res.status(403).json({ success: false, message: "Account not activated. Check your email." });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name, is_admin: Boolean(user.is_admin) }, 
            process.env.JWT_SECRET, 
            { expiresIn: '24h' }
        );

        res.json({ success: true, message: "Login Successful", token });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error." });
    }
});

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

// --- NEW: COMPULSORY WATCH HISTORY & PROGRESS (CRITICAL FIX) ---

app.post('/api/academy/save-progress', async (req, res) => {
    const { email, lessonId, seconds } = req.body;
    try {
        await db.query(`
            INSERT INTO lesson_progress (email, lesson_id, last_seconds, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (email, lesson_id) 
            DO UPDATE SET last_seconds = $3, updated_at = NOW()`,
            [email, lessonId, seconds]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

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

// NEW: ADMIN REPLY TO QUESTION (WITH EMAIL NOTIFICATION)
app.post('/api/academy/reply-comment', async (req, res) => {
    const { commentId, reply } = req.body;
    try {
        // Update the reply and return the student's details
        const result = await db.query(
            'UPDATE lesson_comments SET admin_reply = $1 WHERE id = $2 RETURNING email, user_name, comment', 
            [reply, commentId]
        );

        if (result.rows.length > 0) {
            const student = result.rows[0];
            
            // Send notification email to the student
            await transporter.sendMail({
                from: `"NATER HUB ACADEMY" <${process.env.EMAIL_USER}>`,
                to: student.email,
                subject: "New Instructor Reply to Your Question",
                html: brandedEmail(`
                    <h2>Hello ${student.user_name},</h2>
                    <p>An instructor has replied to your question in the academy:</p>
                    <div style="background: #f9f9f9; padding: 15px; border-left: 4px solid #b71c1c; margin: 20px 0;">
                        <p style="margin: 0; font-style: italic; color: #666;">" ${student.comment} "</p>
                    </div>
                    <p><b>Admin Response:</b></p>
                    <p>${reply}</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.BASE_URL}/academy.html" style="background: #b71c1c; color: white; padding: 18px 35px; text-decoration: none; border-radius: 10px; font-weight: 800; display: inline-block;">VIEW LESSON</a>
                    </div>
                `),
                attachments: emailAttachments
            });
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
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

// NEW: FULL EDIT COURSE
app.post('/api/academy/edit-course', async (req, res) => {
    const { id, title, price, category } = req.body;
    try {
        await db.query('UPDATE courses SET title = $1, price = $2, category = $3 WHERE id = $4', [title, price, category, id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

// NEW: FULL EDIT LESSON
app.post('/api/academy/edit-lesson', async (req, res) => {
    const { id, title } = req.body;
    try {
        await db.query('UPDATE lessons SET title = $1 WHERE id = $2', [title, id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

// 11. ADD LESSON (FIXED TO USE MULTER FOR STABILITY)
app.post('/api/academy/add-lesson', upload.fields([{ name: 'video' }, { name: 'pdf' }]), async (req, res) => {
    try {
        const { courseId, title } = req.body;
        const videoPath = req.files['video'] ? `uploads/${req.files['video'][0].filename}` : null;
        const pdfPath = req.files['pdf'] ? `uploads/${req.files['pdf'][0].filename}` : null;

        await db.query(
            'INSERT INTO lessons (course_id, title, video_path, pdf_path) VALUES ($1, $2, $3, $4)', 
            [courseId, title, videoPath, pdfPath]
        );
        res.json({ success: true, message: "Lesson added!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to add lesson." });
    }
});

// 12. GET ALL CONTENT (Admin/Detailed View)
app.post('/api/academy/all-content-detailed', async (req, res) => {
    try {
        const coursesResult = await db.query('SELECT * FROM courses ORDER BY id DESC');
        const courses = coursesResult.rows;
        for (let course of courses) {
            const lessonsResult = await db.query('SELECT * FROM lessons WHERE course_id = $1', [course.id]);
            course.lessons = lessonsResult.rows;
        }
        res.json({ success: true, courses });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to fetch content." });
    }
});

// --- UPDATED ENDPOINTS FOR ACADEMY.HTML ---

// 16. GET ALL COURSES & STATS FOR ACADEMY GRID
app.post('/api/academy/all-courses', async (req, res) => {
    const { email } = req.body;
    try {
        const courseRes = await db.query('SELECT COUNT(*) FROM courses');
        const studentRes = await db.query('SELECT COUNT(*) FROM users');
        const scholarRes = await db.query('SELECT COUNT(DISTINCT email) FROM course_access WHERE payment_reference IS NULL OR payment_reference = \'manual\'');
        const purchaserRes = await db.query('SELECT COUNT(DISTINCT email) FROM course_access WHERE payment_reference IS NOT NULL AND payment_reference != \'manual\'');
        
        const coursesResult = await db.query('SELECT * FROM courses ORDER BY id DESC');
        const accessRes = await db.query('SELECT course_id FROM course_access WHERE email = $1', [email]);
        const ownedIds = accessRes.rows.map(r => r.course_id);

        res.json({ 
            success: true, 
            courses: coursesResult.rows, 
            ownedIds: ownedIds,
            courseCount: courseRes.rows[0].count,
            registeredCount: studentRes.rows[0].count,
            scholarCount: scholarRes.rows[0].count, 
            purchaserCount: purchaserRes.rows[0].count
        });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to fetch academy data." });
    }
});

// 17. GET LESSONS FOR A SPECIFIC COURSE (FIXED TO USE PATHS)
app.post('/api/academy/lessons', async (req, res) => {
    const { email, courseId } = req.body;
    try {
        const userRes = await db.query('SELECT is_admin FROM users WHERE email = $1', [email]);
        const accessRes = await db.query('SELECT * FROM course_access WHERE email = $1 AND course_id = $2', [email, courseId]);

        if (userRes.rows[0]?.is_admin || accessRes.rows.length > 0) {
            // MERGED: Fetching original lesson data + new progress data
            const lessonsRes = await db.query(`
                SELECT l.id, l.title, l.video_path as video, l.pdf_path as pdf, p.watched, p.last_seconds 
                FROM lessons l 
                LEFT JOIN lesson_progress p ON l.id = p.lesson_id AND p.email = $1
                WHERE l.course_id = $2 ORDER BY l.id ASC`, [email, courseId]);
            res.json({ success: true, lessons: lessonsRes.rows });
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

// --- UPDATED PAYSTACK VERIFICATION (STRICT) ---
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 NATER HUB SERVER ONLINE ON PORT ${PORT}`));
