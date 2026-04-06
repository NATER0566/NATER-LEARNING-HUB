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
const multer = require('multer');

// --- APP INITIALIZATION ---
const app = express();
const PORT = process.env.PORT || 3000;

// --- MIDDLEWARE & FILE HANDLING ---
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Serve all static files from the root directory
app.use(express.static(path.join(__dirname)));

// --- FILE UPLOAD CONFIGURATION ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: function (req, file, cb) {
        // Accept images and documents
        if (file.mimetype.startsWith('image/') || 
            file.mimetype.startsWith('video/') || 
            file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images, videos, and PDFs are allowed.'));
        }
    }
});

// --- MOCK DATABASE (for testing) ---
const mockUsers = [];
const mockCourses = [
    { id: '1', title: 'Introduction to Web Development', price: 49.99, category: 'Programming' },
    { id: '2', title: 'Advanced JavaScript', price: 79.99, category: 'Programming' },
    { id: '3', title: 'Database Design Fundamentals', price: 59.99, category: 'Database' }
];

// --- UPLOAD ENDPOINTS ---

// Admin profile photo upload
app.post('/api/admin/upload-profile', upload.single('profilePhoto'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded." });
        }
        
        // Save profile photo info to mock database
        const profilePhoto = {
            filename: req.file.filename,
            originalName: req.file.originalname,
            path: req.file.path,
            uploadDate: new Date()
        };
        
        // Store in a simple JSON file for persistence
        const profilePath = path.join(__dirname, 'admin-profile.json');
        fs.writeFileSync(profilePath, JSON.stringify(profilePhoto));
        
        res.json({ 
            success: true, 
            message: "Profile photo uploaded successfully",
            filename: req.file.filename,
            url: `/uploads/${req.file.filename}`
        });
    } catch (err) {
        console.error('Profile upload error:', err);
        res.status(500).json({ success: false, message: "Upload failed." });
    }
});

// Course upload
app.post('/api/admin/upload-course', upload.single('thumbnail'), async (req, res) => {
    try {
        const { title, price, category } = req.body;
        
        if (!title || !price || !category) {
            return res.status(400).json({ success: false, message: "Missing required fields." });
        }
        
        const course = {
            id: Date.now().toString(),
            title,
            price: parseFloat(price),
            category,
            thumbnail: req.file ? `/uploads/${req.file.filename}` : null,
            createdAt: new Date()
        };
        
        mockCourses.push(course);
        
        res.json({ 
            success: true, 
            message: "Course uploaded successfully",
            course
        });
    } catch (err) {
        console.error('Course upload error:', err);
        res.status(500).json({ success: false, message: "Upload failed." });
    }
});

// Lesson upload
app.post('/api/admin/upload-lesson', upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'pdf', maxCount: 1 }
]), async (req, res) => {
    try {
        const { courseId, title } = req.body;
        
        if (!courseId || !title) {
            return res.status(400).json({ success: false, message: "Missing required fields." });
        }
        
        const lesson = {
            id: Date.now().toString(),
            courseId,
            title,
            video: req.files.video ? `/uploads/${req.files.video[0].filename}` : null,
            pdf: req.files.pdf ? `/uploads/${req.files.pdf[0].filename}` : null,
            createdAt: new Date()
        };
        
        // Store lessons in mock database
        if (!global.mockLessons) global.mockLessons = [];
        global.mockLessons.push(lesson);
        
        res.json({ 
            success: true, 
            message: "Lesson uploaded successfully",
            lesson
        });
    } catch (err) {
        console.error('Lesson upload error:', err);
        res.status(500).json({ success: false, message: "Upload failed." });
    }
});

// Library material upload
app.post('/api/admin/upload-library', upload.single('file'), async (req, res) => {
    try {
        const { title, courseCode, level, semester, mediaType } = req.body;
        
        if (!title || !courseCode) {
            return res.status(400).json({ success: false, message: "Missing required fields." });
        }
        
        const material = {
            id: Date.now().toString(),
            title,
            courseCode,
            level,
            semester,
            mediaType,
            file: req.file ? `/uploads/${req.file.filename}` : null,
            createdAt: new Date()
        };
        
        // Store materials in mock database
        if (!global.mockLibrary) global.mockLibrary = [];
        global.mockLibrary.push(material);
        
        res.json({ 
            success: true, 
            message: "Library material uploaded successfully",
            material
        });
    } catch (err) {
        console.error('Library upload error:', err);
        res.status(500).json({ success: false, message: "Upload failed." });
    }
});

// Feature orb configuration
app.post('/api/admin/update-orb', async (req, res) => {
    try {
        const { title, description, link, isActive } = req.body;
        
        const orbConfig = {
            title,
            description,
            link,
            isActive: isActive || false,
            updatedAt: new Date()
        };
        
        // Store orb configuration
        const orbPath = path.join(__dirname, 'orb-config.json');
        fs.writeFileSync(orbPath, JSON.stringify(orbConfig));
        
        res.json({ 
            success: true, 
            message: "Feature orb updated successfully"
        });
    } catch (err) {
        console.error('Orb update error:', err);
        res.status(500).json({ success: false, message: "Update failed." });
    }
});

// Get admin profile photo
app.get('/api/admin/profile', async (req, res) => {
    try {
        const profilePath = path.join(__dirname, 'admin-profile.json');
        
        if (fs.existsSync(profilePath)) {
            const profileData = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
            res.json({ 
                success: true, 
                profile: profileData
            });
        } else {
            res.json({ 
                success: true, 
                profile: null
            });
        }
    } catch (err) {
        console.error('Profile get error:', err);
        res.status(500).json({ success: false, message: "Failed to get profile." });
    }
});

// Get all courses for admin
app.get('/api/admin/courses', async (req, res) => {
    try {
        res.json({ 
            success: true, 
            courses: mockCourses
        });
    } catch (err) {
        console.error('Courses get error:', err);
        res.status(500).json({ success: false, message: "Failed to get courses." });
    }
});

// Get all lessons for admin
app.get('/api/admin/lessons', async (req, res) => {
    try {
        const lessons = global.mockLessons || [];
        res.json({ 
            success: true, 
            lessons
        });
    } catch (err) {
        console.error('Lessons get error:', err);
        res.status(500).json({ success: false, message: "Failed to get lessons." });
    }
});

// Get all library materials for admin
app.get('/api/admin/library', async (req, res) => {
    try {
        const materials = global.mockLibrary || [];
        res.json({ 
            success: true, 
            materials
        });
    } catch (err) {
        console.error('Library get error:', err);
        res.status(500).json({ success: false, message: "Failed to get library materials." });
    }
});

// Delete course
app.delete('/api/admin/course/:id', async (req, res) => {
    try {
        const courseId = req.params.id;
        const index = mockCourses.findIndex(c => c.id === courseId);
        
        if (index !== -1) {
            mockCourses.splice(index, 1);
            res.json({ 
                success: true, 
                message: "Course deleted successfully"
            });
        } else {
            res.status(404).json({ 
                success: false, 
                message: "Course not found"
            });
        }
    } catch (err) {
        console.error('Course delete error:', err);
        res.status(500).json({ success: false, message: "Delete failed." });
    }
});

// Delete lesson
app.delete('/api/admin/lesson/:id', async (req, res) => {
    try {
        const lessonId = req.params.id;
        const lessons = global.mockLessons || [];
        const index = lessons.findIndex(l => l.id === lessonId);
        
        if (index !== -1) {
            lessons.splice(index, 1);
            res.json({ 
                success: true, 
                message: "Lesson deleted successfully"
            });
        } else {
            res.status(404).json({ 
                success: false, 
                message: "Lesson not found"
            });
        }
    } catch (err) {
        console.error('Lesson delete error:', err);
        res.status(500).json({ success: false, message: "Delete failed." });
    }
});

// Delete library material
app.delete('/api/admin/library/:id', async (req, res) => {
    try {
        const materialId = req.params.id;
        const materials = global.mockLibrary || [];
        const index = materials.findIndex(m => m.id === materialId);
        
        if (index !== -1) {
            materials.splice(index, 1);
            res.json({ 
                success: true, 
                message: "Library material deleted successfully"
            });
        } else {
            res.status(404).json({ 
                success: false, 
                message: "Material not found"
            });
        }
    } catch (err) {
        console.error('Library delete error:', err);
        res.status(500).json({ success: false, message: "Delete failed." });
    }
});

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

// Get slideshow data for index page
app.get('/api/slideshow', async (req, res) => {
    try {
        // Default slideshow data - can be replaced with database storage
        const slides = [
            {
                id: 1,
                title: 'World-Class Education',
                description: 'Join thousands of successful students transforming their careers',
                image: 'https://picsum.photos/seed/education1/1200/500.jpg'
            },
            {
                id: 2,
                title: 'Expert Instructors',
                description: 'Learn from industry leaders with real-world experience',
                image: 'https://picsum.photos/seed/instructors2/1200/500.jpg'
            },
            {
                id: 3,
                title: 'Flexible Learning',
                description: 'Study at your own pace with our comprehensive online platform',
                image: 'https://picsum.photos/seed/flexible3/1200/500.jpg'
            }
        ];
        
        res.json({ 
            success: true, 
            data: slides
        });
    } catch (err) {
        console.error('Slideshow error:', err);
        res.status(500).json({ success: false, data: [] });
    }
});

// Get library materials for public access
app.get('/api/library/all', async (req, res) => {
    try {
        const materials = global.mockLibrary || [];
        res.json(materials);
    } catch (err) {
        console.error('Library get error:', err);
        res.status(500).json([]);
    }
});

// Update settings endpoint
app.post('/api/update-settings', async (req, res) => {
    try {
        const { siteName, tagline } = req.body;
        
        // Store settings in a simple JSON file
        const settings = {
            siteName: siteName || "NATER LEARNING HUB",
            tagline: tagline || "Empowering Excellence through Digital Innovation",
            updatedAt: new Date()
        };
        
        const settingsPath = path.join(__dirname, 'settings.json');
        fs.writeFileSync(settingsPath, JSON.stringify(settings));
        
        res.json({ 
            success: true, 
            message: "Settings updated successfully"
        });
    } catch (err) {
        console.error('Settings update error:', err);
        res.status(500).json({ success: false, message: "Update failed." });
    }
});

// Update public box endpoint
app.post('/api/update-public-box', async (req, res) => {
    try {
        const { contentType, contentValue } = req.body;
        
        // Store public box content
        const publicBox = {
            contentType,
            contentValue,
            updatedAt: new Date()
        };
        
        const publicBoxPath = path.join(__dirname, 'public-box.json');
        fs.writeFileSync(publicBoxPath, JSON.stringify(publicBox));
        
        res.json({ 
            success: true, 
            message: "Public content updated successfully"
        });
    } catch (err) {
        console.error('Public box update error:', err);
        res.status(500).json({ success: false, message: "Update failed." });
    }
});

// Update news endpoint
app.post('/api/update-news', async (req, res) => {
    try {
        const { news } = req.body;
        
        // Store news
        const newsData = {
            news,
            updatedAt: new Date()
        };
        
        const newsPath = path.join(__dirname, 'news.json');
        fs.writeFileSync(newsPath, JSON.stringify(newsData));
        
        res.json({ 
            success: true, 
            message: "News updated successfully"
        });
    } catch (err) {
        console.error('News update error:', err);
        res.status(500).json({ success: false, message: "Update failed." });
    }
});

// Grant access endpoint
app.post('/api/academy/grant-access', async (req, res) => {
    try {
        const { email, type, courseId } = req.body;
        
        // Store access grant
        const accessGrant = {
            email,
            type,
            courseId,
            grantedAt: new Date()
        };
        
        if (!global.mockAccessGrants) global.mockAccessGrants = [];
        global.mockAccessGrants.push(accessGrant);
        
        res.json({ 
            success: true, 
            message: "Access granted successfully"
        });
    } catch (err) {
        console.error('Access grant error:', err);
        res.status(500).json({ success: false, message: "Grant failed." });
    }
});

// Get all content for admin
app.post('/api/academy/all-content-detailed', async (req, res) => {
    try {
        const lessons = global.mockLessons || [];
        const materials = global.mockLibrary || [];
        
        // Combine courses with their lessons
        const coursesWithLessons = mockCourses.map(course => ({
            ...course,
            lessons: lessons.filter(lesson => lesson.courseId === course.id)
        }));
        
        res.json({ 
            success: true, 
            courses: coursesWithLessons,
            materials
        });
    } catch (err) {
        console.error('Content get error:', err);
        res.status(500).json({ success: false, message: "Failed to get content." });
    }
});

// Delete library material endpoint (for admin.html)
app.delete('/api/admin/library/:id', async (req, res) => {
    try {
        const materialId = req.params.id;
        const materials = global.mockLibrary || [];
        const index = materials.findIndex(m => m.id === materialId);
        
        if (index !== -1) {
            materials.splice(index, 1);
            res.json({ 
                success: true, 
                message: "Library material deleted successfully"
            });
        } else {
            res.status(404).json({ 
                success: false, 
                message: "Material not found"
            });
        }
    } catch (err) {
        console.error('Library delete error:', err);
        res.status(500).json({ success: false, message: "Delete failed." });
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
