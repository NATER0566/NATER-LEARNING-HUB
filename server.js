require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const axios = require('axios'); 
const mongoose = require('mongoose'); 
const multer = require('multer'); 
const fs = require('fs'); 

const app = express();
app.use(cors());

// --- MONGODB CONNECTION ---
mongoose.connect(process.env.DATABASE_URL)
    .then(() => console.log("🚀 HUB CONNECTED TO MONGODB"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// --- MONGODB SCHEMAS (Kept exactly as provided) ---
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, unique: true, lowercase: true, required: true, trim: true },
    password: { type: String, required: true },
    is_activated: { type: Boolean, default: false },
    is_admin: { type: Boolean, default: false }
});
const User = mongoose.model('User', userSchema);

const courseSchema = new mongoose.Schema({
    title: String,
    price: Number,
    category: String,
    thumbnail: String
});
const Course = mongoose.model('Course', courseSchema);

const lessonSchema = new mongoose.Schema({
    course_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    title: String,
    video_path: String,
    pdf_path: String
});
const Lesson = mongoose.model('Lesson', lessonSchema);

const progressSchema = new mongoose.Schema({
    email: String,
    lesson_id: String,
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
    file_url: String
});
const Library = mongoose.model('Library', librarySchema);

const settingSchema = new mongoose.Schema({
    siteName: { type: String, default: "NATER LEARNING HUB" },
    tagline: String,
    avatar: String,
    contentType: String,
    contentValue: String,
    announcement: String,
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
    email: String,
    course_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    payment_reference: String
});
const Access = mongoose.model('Access', accessSchema);

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
app.use(express.static(path.join(__dirname))); 
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET;

// --- EMAIL ENGINE ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// Improved Template with clearer structure
const brandedEmail = (content, name, title = "NATER LEARNING HUB") => `
<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden; background: #fdfdfd;">
    <div style="background: #b71c1c; padding: 40px 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px; letter-spacing: 1px;">${title}</h1>
        <p style="color: #FFD700; margin: 10px 0 0 0; font-weight: bold; text-transform: uppercase; font-size: 12px;">Secure Academy Portal</p>
    </div>
    <div style="padding: 20px; text-align: center; background: white;">
         <img src="cid:logo" alt="Logo" style="width: 120px; height: auto;">
    </div>
    <div style="padding: 40px 30px; color: #333; line-height: 1.8; background: white;">
        <h2 style="color: #b71c1c; margin-top: 0;">Hello ${name},</h2>
        ${content}
        <br><br>
        <p style="font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 20px;">
            This is an automated notification from Nater Learning Hub. Please do not reply to this email.
        </p>
    </div>
    <div style="background: #1a1a1a; padding: 25px; text-align: center; color: #777; font-size: 11px;">
        &copy; ${new Date().getFullYear()} NATER LEARNING HUB. <br>
        Empowering Minds through Quality Digital Education.
    </div>
</div>`;

// --- 1. AUTHENTICATION API ---

app.post('/api/register', async (req, res) => {
    let { name, email, pass } = req.body;
    if (!email || !pass) return res.status(400).json({ success: false, message: "Missing fields." });
    const cleanEmail = email.trim().toLowerCase();
    try {
        const userExists = await User.findOne({ email: cleanEmail });
        if (userExists) return res.status(400).json({ success: false, message: "Email registered already." });

        const hashedPassword = await bcrypt.hash(pass, 10);
        const newUser = new User({ name, email: cleanEmail, password: hashedPassword });
        await newUser.save();

        await Access.deleteMany({ email: cleanEmail });

        const activationLink = `${process.env.BASE_URL}/api/activate?email=${encodeURIComponent(cleanEmail)}`;
        
        await transporter.sendMail({
            from: `"NATER LEARNING HUB" <${process.env.EMAIL_USER}>`,
            to: cleanEmail, 
            subject: "Welcome to Nater Learning Hub – Activate Your Account",
            html: brandedEmail(`
                <p>Your account has been successfully created. To begin accessing our secure academy, courses, and digital library, you must verify your email address.</p>
                <p>Please click the button below to activate your account. After activation, you will be able to log in and start learning immediately.</p>
                <div style="text-align: center; margin: 35px 0;">
                    <a href="${activationLink}" style="background: #b71c1c; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">ACTIVATE MY ACCOUNT</a>
                </div>
                <p>If you did not create this account, you can safely ignore this email.</p>
            `, name),
            attachments: [{ filename: 'logo.jpg', path: path.join(__dirname, 'logo.jpg'), cid: 'logo' }]
        });
        res.json({ success: true, message: "Registration successful! Check your email to activate." });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.get('/api/activate', async (req, res) => {
    try {
        const cleanEmail = decodeURIComponent(req.query.email).trim().toLowerCase();
        const user = await User.findOneAndUpdate({ email: cleanEmail }, { is_activated: true });
        if(!user) return res.status(404).send("Activation failed: User not found.");
        res.sendFile(path.resolve(__dirname, 'success.html'));
    } catch (err) { res.status(500).send("Activation failed."); }
});

app.post('/api/login', async (req, res) => {
    const { email, pass } = req.body;
    const cleanEmail = email.trim().toLowerCase();
    try {
        const user = await User.findOne({ email: cleanEmail });
        if (!user || !(await bcrypt.compare(pass, user.password))) return res.status(401).json({ success: false, message: "Invalid credentials." });
        if (!user.is_activated) return res.status(403).json({ success: false, message: "Account not activated." });

        const token = jwt.sign({ id: user._id, email: user.email, name: user.name, is_admin: user.is_admin }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ success: true, token });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/forgot-password', async (req, res) => {
    const cleanEmail = req.body.email.trim().toLowerCase();
    try {
        const user = await User.findOne({ email: cleanEmail });
        if (!user) return res.status(404).json({ success: false, message: "Email not found." });
        const resetLink = `${process.env.BASE_URL}/reset-password.html?email=${encodeURIComponent(cleanEmail)}`;
        await transporter.sendMail({
            from: `"NATER LEARNING HUB" <${process.env.EMAIL_USER}>`,
            to: cleanEmail, 
            subject: "Password Reset Request – Nater Learning Hub",
            html: brandedEmail(`
                <p>We received a request to reset your password for your Nater Learning Hub account.</p>
                <p>If you made this request, click the button below to choose a new password:</p>
                <div style="text-align: center; margin: 35px 0;">
                    <a href="${resetLink}" style="background: #1a1a1a; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">RESET MY PASSWORD</a>
                </div>
                <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
            `, user.name),
            attachments: [{ filename: 'logo.jpg', path: path.join(__dirname, 'logo.jpg'), cid: 'logo' }]
        });
        res.json({ success: true, message: "Instructions sent." });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/complete-reset', async (req, res) => {
    const { email, pass } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(pass, 10);
        await User.findOneAndUpdate({ email: email.toLowerCase() }, { password: hashedPassword });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

// --- 2. PROGRESS TRACKING & LESSONS (Unchanged) ---
app.post('/api/academy/lessons', async (req, res) => {
    const { email, courseId } = req.body;
    try {
        const user = await User.findOne({ email });
        const access = await Access.findOne({ email, course_id: courseId });
        if (user?.is_admin || access) {
            const lessons = await Lesson.find({ course_id: courseId }).sort({ _id: 1 }).lean();
            const lessonsWithProgress = await Promise.all(lessons.map(async (lesson) => {
                const prog = await Progress.findOne({ email, lesson_id: lesson._id.toString() });
                return {
                    id: lesson._id, title: lesson.title, video: lesson.video_path,
                    pdf: lesson.pdf_path, watched: prog ? prog.watched : false
                };
            }));
            res.json({ success: true, lessons: lessonsWithProgress, enrollment: access || { payment_reference: 'ADMIN-AUTH' } });
        } else res.status(403).json({ success: false, message: "Unauthorized." });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/academy/save-progress', async (req, res) => {
    try {
        await Progress.findOneAndUpdate({ email: req.body.email, lesson_id: req.body.lessonId }, { last_seconds: req.body.seconds }, { upsert: true });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/academy/mark-watched', async (req, res) => {
    try {
        await Progress.findOneAndUpdate({ email: req.body.email, lesson_id: req.body.lessonId }, { watched: true, updated_at: Date.now() }, { upsert: true });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

// --- 3. DISCUSSION SYSTEM (Unchanged) ---
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
        const comment = await Comment.findByIdAndUpdate(req.body.commentId, { admin_reply: req.body.reply });
        if (comment) {
            await transporter.sendMail({ 
                from: `"NATER LEARNING HUB" <${process.env.EMAIL_USER}>`, 
                to: comment.email, 
                subject: "Instructor Replied to Your Question", 
                html: brandedEmail(`
                    <p>An instructor has replied to your question in the lesson discussion.</p>
                    <div style="background: #f9f9f9; padding: 15px; border-left: 4px solid #b71c1c; margin: 20px 0;">
                        <b>Reply:</b> ${req.body.reply}
                    </div>
                    <p>Log in to the academy to continue the conversation.</p>
                `, comment.user_name),
                attachments: [{ filename: 'logo.jpg', path: path.join(__dirname, 'logo.jpg'), cid: 'logo' }]
            });
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/academy/delete-comment', async (req, res) => {
    try {
        await Comment.findByIdAndDelete(req.body.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

// --- 4. CERTIFICATE VERIFICATION (Unchanged) ---
app.post('/api/verify-certificate', async (req, res) => {
    const { certId, email, courseId } = req.body; 
    try {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(404).json({ success: false });
        if (certId === "ADMIN-AUTH" || certId === "SCHOLAR-AUTH") {
            const course = await Course.findById(courseId) || await Course.findOne();
            return res.json({ success: true, studentName: user.name, courseName: course.title });
        }
        const access = await Access.findOne({ payment_reference: certId, email: email.toLowerCase() }).populate('course_id');
        if (access) {
            res.json({ success: true, studentName: user.name, courseName: access.course_id?.title || "HUB COURSE" });
        } else res.status(404).json({ success: false });
    } catch (err) { res.status(500).json({ success: false }); }
});

// --- 5. ADMIN COMMAND CENTER (Unchanged) ---
app.get('/api/public-settings', async (req, res) => {
    try {
        const data = await Setting.findOne();
        res.json({ success: true, ...data?._doc, siteName: data?.siteName || "NATER LEARNING HUB" });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/update-settings', async (req, res) => {
    try {
        await Setting.findOneAndUpdate({}, req.body, { upsert: true });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/update-news', async (req, res) => {
    try {
        await Setting.findOneAndUpdate({}, { announcement: req.body.news }, { upsert: true });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

// --- 6. ACADEMY OPERATIONS ---

app.post('/api/academy/add-course', async (req, res) => {
    try {
        const course = new Course(req.body);
        await course.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/academy/edit-course', async (req, res) => {
    try {
        await Course.findByIdAndUpdate(req.body.id, req.body);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/academy/add-lesson', upload.fields([{ name: 'video' }, { name: 'pdf' }]), async (req, res) => {
    try {
        const lesson = new Lesson({
            course_id: req.body.courseId, title: req.body.title,
            video_path: req.files['video'] ? `uploads/${req.files['video'][0].filename}` : null,
            pdf_path: req.files['pdf'] ? `uploads/${req.files['pdf'][0].filename}` : null
        });
        await lesson.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/academy/all-courses', async (req, res) => {
    try {
        const courses = await Course.find().sort({ _id: -1 }).lean();
        const accessRecords = await Access.find({ email: req.body.email });
        const courseCount = courses.length;
        const registeredCount = await User.countDocuments();
        
        const ownedIds = accessRecords
            .map(a => a.course_id ? a.course_id.toString() : null)
            .filter(id => id !== null);
        
        const scholarCount = await Access.countDocuments({ payment_reference: 'manual' });
        const purchaserCount = await Access.countDocuments({ payment_reference: { $ne: 'manual' } });

        const formatted = courses.map(c => ({ ...c, id: c._id.toString() }));
        res.json({ success: true, courses: formatted, ownedIds, courseCount, registeredCount, scholarCount, purchaserCount });
    } catch (err) { res.status(500).json({ success: false }); }
});

// UPDATED: Added email notification for manual access grant
app.post('/api/academy/grant-access', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email.toLowerCase() });
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        if (req.body.type === 'all') {
            const courses = await Course.find();
            for(let c of courses) await Access.findOneAndUpdate({ email: req.body.email, course_id: c._id }, { payment_reference: 'manual' }, { upsert: true });
        } else {
            await Access.findOneAndUpdate({ email: req.body.email, course_id: req.body.courseId }, { payment_reference: 'manual' }, { upsert: true });
        }

        // Notify user
        await transporter.sendMail({
            from: `"NATER LEARNING HUB" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: "Course Access Granted – Nater Learning Hub",
            html: brandedEmail(`
                <p>You have been granted access to a course on Nater Learning Hub by an administrator.</p>
                <p>You can now log in and start learning immediately. Visit your dashboard to access the new content in your academy.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.BASE_URL}/academy.html" style="background: #b71c1c; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">GO TO MY ACADEMY</a>
                </div>
            `, user.name),
            attachments: [{ filename: 'logo.jpg', path: path.join(__dirname, 'logo.jpg'), cid: 'logo' }]
        });

        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/academy/delete-course', async (req, res) => {
    try {
        await Lesson.deleteMany({ course_id: req.body.id });
        await Course.findByIdAndDelete(req.body.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

// --- 7. LIBRARY REPOSITORY (Unchanged) ---
app.post('/api/library/add', upload.single('file'), async (req, res) => {
    try {
        const item = new Library({ ...req.body, file_url: req.file ? `uploads/${req.file.filename}` : null });
        await item.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.get('/api/library/all', async (req, res) => {
    try {
        const result = await Library.find().sort({ _id: -1 });
        const formatted = result.map(item => ({ ...item._doc, id: item._id, courseCode: item.course_code, fileURL: item.file_url }));
        res.json(formatted);
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/library/delete', async (req, res) => {
    try {
        await Library.findByIdAndDelete(req.body.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

// --- 8. PAYSTACK INTEGRATION ---

// UPDATED: Added email notification for successful purchase
app.post('/api/paystack/verify', async (req, res) => {
    try {
        const { reference, email } = req.body;
        if (!reference || reference === 'manual') return res.status(400).json({ success: false });

        let payRes;
        try {
            payRes = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, { 
                headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } 
            });
        } catch (e) { return res.status(400).json({ success: false, message: "Reference not found." }); }
        
        if (payRes.data.data.status === 'success') {
            const courseId = payRes.data.data.metadata?.courseId;
            const courseTitle = payRes.data.data.metadata?.courseTitle || "Premium Course";
            if (!courseId) return res.status(400).json({ success: false });

            await Access.findOneAndUpdate(
                { email: email.toLowerCase(), course_id: courseId }, 
                { payment_reference: reference }, 
                { upsert: true }
            );

            // Fetch User for the name
            const user = await User.findOne({ email: email.toLowerCase() });

            // Notify user of purchase
            await transporter.sendMail({
                from: `"NATER LEARNING HUB" <${process.env.EMAIL_USER}>`,
                to: email.toLowerCase(),
                subject: "Course Purchase Confirmed – Nater Learning Hub",
                html: brandedEmail(`
                    <p>Your payment has been successfully verified. You now have full access to the course you purchased.</p>
                    <div style="background: #fff8e1; border: 1px solid #ffd54f; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <b style="color: #b71c1c;">Purchased Course:</b> ${courseTitle}
                    </div>
                    <p>To begin learning, log in to your dashboard and open the academy section. We wish you success in your learning journey!</p>
                    <div style="text-align: center; margin: 25px 0;">
                        <a href="${process.env.BASE_URL}/academy.html" style="background: #1a1a1a; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">START LEARNING NOW</a>
                    </div>
                `, user?.name || "Student"),
                attachments: [{ filename: 'logo.jpg', path: path.join(__dirname, 'logo.jpg'), cid: 'logo' }]
            });

            res.json({ success: true });
        } else res.status(400).json({ success: false });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.get('/api/paystack/initialize', async (req, res) => {
    try {
        const { email, amount, courseId, title } = req.query;
        const response = await axios.post('https://api.paystack.co/transaction/initialize', {
            email, amount: Number(amount) * 100, metadata: { courseId, courseTitle: title },
            callback_url: `${process.env.BASE_URL}/verify-payment.html`
        }, { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } });
        res.redirect(response.data.data.authorization_url);
    } catch (err) { res.status(500).send("Init Error"); }
});

// --- 9. INSTANT BRANDING & PAGE SERVERS (Unchanged) ---
app.get('/api/branding/instant', async (req, res) => {
    try {
        const data = await Setting.findOne().lean();
        res.json({ success: true, ...data });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.get('/dashboard.html', (req, res) => { res.sendFile(path.join(__dirname, 'dashboard.html')); });
app.get('/academy.html', (req, res) => { res.sendFile(path.join(__dirname, 'academy.html')); });
app.get('/admin.html', (req, res) => { res.sendFile(path.join(__dirname, 'admin.html')); });
app.get('/certificate.html', (req, res) => { res.sendFile(path.join(__dirname, 'certificate.html')); });

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 NATER HUB ONLINE ON PORT ${PORT}`));