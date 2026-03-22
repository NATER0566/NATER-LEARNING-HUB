/**
 * ============================================================
 * NATER LEARNING HUB - CENTRAL SERVER ENGINE
 * ============================================================
 * Version: 3.1.0 (Professional Production)
 * Framework: Express.js | Database: MongoDB
 * Email Service: Resend | Payments: Paystack
 * Description: High-end education platform with dynamic 
 * scholarship granting and branded communication.
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
const PORT = process.env.PORT || 3000;
const resend = new Resend(process.env.RESEND_API_KEY);
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET;

// --- DATABASE CONNECTION ---
mongoose.connect(process.env.DATABASE_URL)
    .then(() => console.log("🚀 [HUB] DATABASE CONNECTION ESTABLISHED"))
    .catch(err => console.error("❌ [CRITICAL] MongoDB Connection Failed:", err));

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

const lessonSchema = new mongoose.Schema({
    course_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    title: { type: String, required: true },
    video_path: String,
    pdf_path: String,
    order: { type: Number, default: 0 }
});
const Lesson = mongoose.model('Lesson', lessonSchema);

const progressSchema = new mongoose.Schema({
    email: { type: String, required: true },
    lesson_id: { type: String, required: true },
    last_seconds: { type: Number, default: 0 },
    watched: { type: Boolean, default: false },
    updated_at: { type: Date, default: Date.now }
});
const Progress = mongoose.model('Progress', progressSchema);

const librarySchema = new mongoose.Schema({
    title: String,
    course_code: String,
    level: String,
    semester: String,
    type: String, 
    file_url: String,
    upload_date: { type: Date, default: Date.now }
});
const Library = mongoose.model('Library', librarySchema);

const settingSchema = new mongoose.Schema({
    siteName: { type: String, default: "NATER LEARNING HUB" },
    tagline: String,
    avatar: String,
    announcement: String,
    maintenance_mode: { type: Boolean, default: false },
    orbData: String 
});
const Setting = mongoose.model('Setting', settingSchema);

const commentSchema = new mongoose.Schema({
    lesson_id: String,
    email: String,
    user_name: String,
    comment: String,
    admin_reply: String,
    created_at: { type: Date, default: Date.now }
});
const Comment = mongoose.model('Comment', commentSchema);

const accessSchema = new mongoose.Schema({
    email: { type: String, required: true },
    course_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    payment_reference: String, 
    granted_at: { type: Date, default: Date.now }
});
const Access = mongoose.model('Access', accessSchema);

// --- MIDDLEWARE & FILE HANDLING ---

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const uniqueID = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${uniqueID}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage: storage });

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname)));

// --- PROFESSIONAL BRANDED EMAIL ENGINE ---

const brandedEmail = (content, name, actionUrl = "", title = "NATER LEARNING HUB") => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        .container { font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 16px; overflow: hidden; background: #ffffff; }
        .header { background: #b71c1c; padding: 30px; text-align: center; }
        .logo { width: 85px; height: 85px; border-radius: 50%; margin-bottom: 15px; border: 3px solid #FFD700; background: white; object-fit: cover; }
        .content { padding: 35px 30px; color: #333; line-height: 1.8; }
        .btn { background: #b71c1c; color: white !important; padding: 16px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; margin: 25px 0; }
        .footer { background: #1a1a1a; padding: 25px; text-align: center; color: #999; font-size: 11px; }
        .support-hub { margin-top: 40px; border-top: 2px solid #f0f0f0; padding-top: 20px; text-align: center; }
        .badge { background: #f9f9f9; border-left: 4px solid #b71c1c; padding: 12px 15px; margin: 15px 0; font-style: italic; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="${process.env.BASE_URL}/logo.jpg" alt="Logo" class="logo">
            <h1 style="color: white; margin: 0; font-size: 24px; letter-spacing: 1px;">${title}</h1>
        </div>
        <div class="content">
            <h2 style="color: #b71c1c; margin-top: 0;">Hello ${name},</h2>
            ${content}
            ${actionUrl ? `<center><a href="${actionUrl}" class="btn">PROCEED TO HUB</a></center>` : ''}
            <div class="support-hub">
                <p style="font-weight: bold; color: #1a1a1a; margin-bottom: 10px;">Need Direct Assistance?</p>
                <a href="https://wa.me/2348160979620" style="color: #25D366; text-decoration: none; font-weight: bold;">WhatsApp Support</a> | 
                <a href="mailto:nmbashau@gmail.com" style="color: #b71c1c; text-decoration: none; font-weight: bold;">Official Email</a>
            </div>
        </div>
        <div class="footer">
            &copy; ${new Date().getFullYear()} NATER LEARNING HUB. <br>
            Empowering Excellence through Digital Innovation.
        </div>
    </div>
</body>
</html>`;

/**
 * ------------------------------------------------------------
 * SECTION 1: USER AUTHENTICATION & ACCESS CONTROL
 * ------------------------------------------------------------
 */

app.post('/api/register', async (req, res) => {
    try {
        let { name, email, pass } = req.body;
        if (!name || !email || !pass) return res.status(400).json({ success: false, message: "Missing required fields." });
        
        const cleanEmail = email.trim().toLowerCase();
        const existingUser = await User.findOne({ email: cleanEmail });
        if (existingUser) return res.status(400).json({ success: false, message: "Email already registered." });

        const hashedPassword = await bcrypt.hash(pass, 12);
        const newUser = new User({ name, email: cleanEmail, password: hashedPassword });
        await newUser.save();

        const activationLink = `${process.env.BASE_URL}/api/activate?email=${encodeURIComponent(cleanEmail)}`;

        await resend.emails.send({
            from: process.env.MAIL_SENDER,
            to: cleanEmail,
            subject: "Verify Your Enrollment – Nater Hub",
            html: brandedEmail(`
                <p>Welcome to the academy! Your registration was successful. We are thrilled to have you join our community of learners.</p>
                <p>To activate your account and access your dashboard, please click the verification button below:</p>
            `, name, activationLink)
        });

        res.json({ success: true, message: "Verification email sent. Please check your inbox." });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error during registration." });
    }
});

app.get('/api/activate', async (req, res) => {
    try {
        const cleanEmail = decodeURIComponent(req.query.email).trim().toLowerCase();
        const user = await User.findOneAndUpdate({ email: cleanEmail }, { is_activated: true });
        if (!user) return res.status(404).send("User not found.");
        res.sendFile(path.resolve(__dirname, 'success.html'));
    } catch (err) {
        res.status(500).send("Activation failed.");
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, pass } = req.body;
        const user = await User.findOne({ email: email.trim().toLowerCase() });

        if (!user) return res.status(404).json({ success: false, message: "Account does not exist." });
        if (!user.is_activated) return res.status(403).json({ success: false, message: "Account not activated." });

        const isValid = await bcrypt.compare(pass, user.password);
        if (!isValid) return res.status(401).json({ success: false, message: "Invalid credentials." });

        const token = jwt.sign(
            { id: user._id, email: user.email, name: user.name, is_admin: user.is_admin },
            process.env.JWT_SECRET,
            { expiresIn: '48h' }
        );

        res.json({ success: true, token, user: { name: user.name, email: user.email, is_admin: user.is_admin } });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/forgot-password', async (req, res) => {
    try {
        const email = req.body.email.trim().toLowerCase();
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ success: false, message: "No account found." });

        const resetLink = `${process.env.BASE_URL}/reset-password.html?email=${encodeURIComponent(email)}`;
        await resend.emails.send({
            from: process.env.MAIL_SENDER,
            to: email,
            subject: "Secure Password Reset",
            html: brandedEmail(`
                <p>A password reset was requested for your account. If you made this request, click the button below to set a new password.</p>
                <p><b>If you did not request this, you can safely ignore this email.</b></p>
            `, user.name, resetLink)
        });
        res.json({ success: true, message: "Reset instructions sent to your email." });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/complete-reset', async (req, res) => {
    try {
        const { email, pass } = req.body;
        const hashedPassword = await bcrypt.hash(pass, 12);
        await User.findOneAndUpdate({ email: email.toLowerCase() }, { password: hashedPassword });
        res.json({ success: true, message: "Password updated successfully." });
    } catch (err) { res.status(500).json({ success: false }); }
});

/**
 * ------------------------------------------------------------
 * SECTION 2: ACADEMY ENGINE (COURSES & LESSONS)
 * ------------------------------------------------------------
 */

app.post('/api/academy/all-courses', async (req, res) => {
    try {
        const { email } = req.body;
        const courses = await Course.find().sort({ created_at: -1 }).lean();
        const accessRecords = await Access.find({ email: email?.toLowerCase() });
        
        const stats = {
            totalCourses: courses.length,
            totalStudents: await User.countDocuments(),
            totalSales: await Access.countDocuments({ payment_reference: { $ne: 'scholarship' } }),
            totalScholarships: await Access.countDocuments({ payment_reference: 'scholarship' })
        };

        const ownedIds = accessRecords.map(a => a.course_id?.toString());
        const formattedCourses = courses.map(c => ({
            ...c,
            id: c._id,
            isOwned: ownedIds.includes(c._id.toString())
        }));

        res.json({ success: true, courses: formattedCourses, stats, ownedIds });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/academy/lessons', async (req, res) => {
    try {
        const { email, courseId } = req.body;
        const user = await User.findOne({ email });
        const hasAccess = await Access.findOne({ email, course_id: courseId });

        if (!user?.is_admin && !hasAccess) {
            return res.status(403).json({ success: false, message: "Enrollment required." });
        }

        const lessons = await Lesson.find({ course_id: courseId }).sort({ order: 1, _id: 1 }).lean();
        const progress = await Progress.find({ email, lesson_id: { $in: lessons.map(l => l._id.toString()) } });

        const enrichedLessons = lessons.map(l => {
            const p = progress.find(pg => pg.lesson_id === l._id.toString());
            return {
                ...l,
                id: l._id,
                watched: p ? p.watched : false,
                lastSeconds: p ? p.last_seconds : 0
            };
        });

        res.json({ success: true, lessons: enrichedLessons, enrollment: hasAccess || { payment_reference: 'ADMIN' } });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/academy/save-progress', async (req, res) => {
    try {
        const { email, lessonId, seconds, watched } = req.body;
        await Progress.findOneAndUpdate(
            { email, lesson_id: lessonId },
            { last_seconds: seconds, watched: watched || false, updated_at: Date.now() },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

/**
 * ------------------------------------------------------------
 * SECTION 3: PAYMENT GATEWAY (PAYSTACK INTEGRATION)
 * ------------------------------------------------------------
 */

app.get('/api/paystack/initialize', async (req, res) => {
    try {
        const { email, amount, courseId, title } = req.query;
        const paystackResponse = await axios.post('https://api.paystack.co/transaction/initialize', {
            email,
            amount: Math.round(Number(amount) * 100), 
            metadata: { courseId, courseTitle: title },
            callback_url: `${process.env.BASE_URL}/verify-payment.html`
        }, {
            headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` }
        });
        
        res.redirect(paystackResponse.data.data.authorization_url);
    } catch (err) {
        res.status(500).send("Payment system currently unavailable.");
    }
});

app.post('/api/paystack/verify', async (req, res) => {
    try {
        const { reference, email } = req.body;
        const verifyRes = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` }
        });

        if (verifyRes.data.data.status === 'success') {
            const { courseId, courseTitle } = verifyRes.data.data.metadata;
            const cleanEmail = email.toLowerCase();
            const user = await User.findOne({ email: cleanEmail });

            await Access.findOneAndUpdate(
                { email: cleanEmail, course_id: courseId },
                { payment_reference: reference },
                { upsert: true }
            );

            await resend.emails.send({
                from: process.env.MAIL_SENDER,
                to: cleanEmail,
                subject: `Payment Confirmed: ${courseTitle}`,
                html: brandedEmail(`
                    <p>Success! Your payment for <b>${courseTitle}</b> has been confirmed. You now have full lifetime access to this course.</p>
                    <div class="badge">
                        <strong>Transaction ID:</strong> ${reference}<br>
                        <strong>Status:</strong> Enrollment Activated
                    </div>
                    <p>Click the button below to start your first lesson!</p>
                `, user?.name || "Student", `${process.env.BASE_URL}/academy.html`)
            });

            res.json({ success: true });
        } else {
            res.status(400).json({ success: false, message: "Payment not successful." });
        }
    } catch (err) { res.status(500).json({ success: false }); }
});

/**
 * ------------------------------------------------------------
 * SECTION 4: ADMIN COMMAND CENTER
 * ------------------------------------------------------------
 */

app.post('/api/academy/add-course', async (req, res) => {
    try {
        const newCourse = new Course(req.body);
        await newCourse.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/academy/add-lesson', upload.fields([{ name: 'video' }, { name: 'pdf' }]), async (req, res) => {
    try {
        const lessonData = {
            course_id: req.body.courseId,
            title: req.body.title,
            video_path: req.files['video'] ? `uploads/${req.files['video'].filename}` : null,
            pdf_path: req.files['pdf'] ? `uploads/${req.files['pdf'].filename}` : null,
            order: req.body.order || 0
        };
        const lesson = new Lesson(lessonData);
        await lesson.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/academy/grant-access', async (req, res) => {
    try {
        const { email, courseId, type } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(404).json({ success: false, message: "User not found." });

        let emailBody = "";
        let subject = "Hub Access Granted";

        if (type === 'all') {
            const allCourses = await Course.find();
            for (let c of allCourses) {
                await Access.findOneAndUpdate({ email: email.toLowerCase(), course_id: c._id }, { payment_reference: 'scholarship' }, { upsert: true });
            }
            subject = "Full Academy Scholarship Awarded";
            emailBody = `
                <p>Congratulations! We are pleased to inform you that you have been awarded a <b>Full Institutional Scholarship</b>.</p>
                <p>You now have unrestricted access to <b>EVERY course (${allCourses.length} courses)</b> currently available in our library.</p>
                <p>Your enrollment has been manually activated by the administration. Happy learning!</p>
            `;
        } else {
            const course = await Course.findById(courseId);
            await Access.findOneAndUpdate({ email: email.toLowerCase(), course_id: courseId }, { payment_reference: 'manual_grant' }, { upsert: true });
            subject = `Course Access Unlocked: ${course.title}`;
            emailBody = `<p>An administrator has manually activated your access to the premium course: <b>${course.title}</b>. You can now access all its resources in your dashboard.</p>`;
        }

        await resend.emails.send({
            from: process.env.MAIL_SENDER,
            to: email,
            subject: subject,
            html: brandedEmail(emailBody, user.name, `${process.env.BASE_URL}/academy.html`)
        });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

/**
 * ------------------------------------------------------------
 * SECTION 5: LIBRARY & PUBLIC SETTINGS
 * ------------------------------------------------------------
 */

app.post('/api/library/add', upload.single('file'), async (req, res) => {
    try {
        const item = new Library({
            ...req.body,
            file_url: req.file ? `uploads/${req.file.filename}` : null
        });
        await item.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.get('/api/library/all', async (req, res) => {
    try {
        const items = await Library.find().sort({ upload_date: -1 });
        res.json(items.map(i => ({ ...i._doc, id: i._id })));
    } catch (err) { res.status(500).json([]); }
});

app.get('/api/public-settings', async (req, res) => {
    try {
        const settings = await Setting.findOne() || await Setting.create({ siteName: "NATER HUB" });
        res.json({ success: true, ...settings._doc });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/update-settings', async (req, res) => {
    try {
        await Setting.findOneAndUpdate({}, req.body, { upsert: true });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

/**
 * ------------------------------------------------------------
 * SECTION 6: DISCUSSION SYSTEM
 * ------------------------------------------------------------
 */

app.post('/api/academy/get-comments', async (req, res) => {
    try {
        const comments = await Comment.find({ lesson_id: req.body.lessonId }).sort({ created_at: -1 });
        res.json({ success: true, comments });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/academy/post-comment', async (req, res) => {
    try {
        const newComment = new Comment({ ...req.body, user_name: req.body.name });
        await newComment.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/academy/reply-comment', async (req, res) => {
    try {
        const { commentId, reply } = req.body;
        const comment = await Comment.findByIdAndUpdate(commentId, { admin_reply: reply });
        if (comment) {
            await resend.emails.send({
                from: process.env.MAIL_SENDER,
                to: comment.email,
                subject: "New Instructor Response",
                html: brandedEmail(`
                    <p>An instructor has responded to your question in the lesson discussion area:</p>
                    <div class="badge">
                        " ${reply} "
                    </div>
                    <p>Click below to view the response and continue the discussion.</p>
                `, comment.user_name, `${process.env.BASE_URL}/academy.html`)
            });
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

/**
 * ------------------------------------------------------------
 * SECTION 7: STATIC PAGE ROUTES
 * ------------------------------------------------------------
 */

app.get('/dashboard.html', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/academy.html', (req, res) => res.sendFile(path.join(__dirname, 'academy.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/certificate.html', (req, res) => res.sendFile(path.join(__dirname, 'certificate.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Start Server
app.listen(PORT, () => {
    console.log(`
    ================================================
    🚀 NATER HUB ENGINE ACTIVATED
    📡 PORT: ${PORT}
    🌐 BASE URL: ${process.env.BASE_URL}
    ================================================
    `);
});