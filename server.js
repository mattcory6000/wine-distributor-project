const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const multer = require('multer');
const XLSX = require('xlsx');

const app = express();
const PORT = 3001;
const DATA_DIR = path.join(__dirname, 'data', 'persistence');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

app.get('/api/storage/:key', (req, res) => {
    const key = req.params.key;
    const filePath = path.join(DATA_DIR, `${key}.json`);

    if (fs.existsSync(filePath)) {
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            res.json({ value: data });
        } catch (error) {
            res.status(500).json({ error: 'Failed to read data' });
        }
    } else {
        res.status(404).json({ error: 'Key not found' });
    }
});

app.post('/api/storage/:key', (req, res) => {
    const key = req.params.key;
    const { value } = req.body;
    const filePath = path.join(DATA_DIR, `${key}.json`);

    try {
        fs.writeFileSync(filePath, value, 'utf8');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save data' });
    }
});

// --- Auth Endpoints ---

const USERS_FILE = path.join(DATA_DIR, 'users.json');

const getUsers = () => {
    if (fs.existsSync(USERS_FILE)) {
        return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    }
    return [];
};

const saveUsers = (users) => {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
};

app.post('/api/auth/signup', (req, res) => {
    const { username, password, email } = req.body; // Ignore 'type' from client
    const users = getUsers();

    if (users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'User already exists' });
    }

    // Strictly enforce customer type for all new signups
    const newUser = { id: `user-${Date.now()}`, username, password, type: 'customer', email };
    users.push(newUser);
    saveUsers(users);

    res.json({ success: true, user: { id: newUser.id, username, type: newUser.type, email } });
});

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const users = getUsers();

    const user = users.find(u => u.username === username && u.password === password);
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.accessRevoked) {
        return res.status(403).json({ error: 'Access Revoked. Please contact administrator.' });
    }

    res.json({ success: true, user: { id: user.id, username: user.username, type: user.type } });
});

// --- Admin User Management Endpoints ---

app.get('/api/auth/users', (req, res) => {
    const users = getUsers();
    // Return users without sensitive password data
    const safeUsers = users.map(u => ({
        id: u.id,
        username: u.username,
        type: u.type,
        email: u.email,
        accessRevoked: !!u.accessRevoked
    }));
    res.json(safeUsers);
});

app.patch('/api/auth/users/:id/access', (req, res) => {
    const { id } = req.params;
    const { accessRevoked } = req.body;

    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === id);

    if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Protection for 'treys' account
    if (users[userIndex].username === 'treys') {
        return res.status(403).json({ error: 'Access cannot be revoked for primary administrator "treys"' });
    }

    users[userIndex].accessRevoked = !!accessRevoked;
    saveUsers(users);

    res.json({ success: true, user: { id: users[userIndex].id, accessRevoked: users[userIndex].accessRevoked } });
});

app.patch('/api/auth/users/:id/role', (req, res) => {
    const { id } = req.params;
    const { type } = req.body;

    if (type !== 'admin' && type !== 'customer') {
        return res.status(400).json({ error: 'Invalid role type' });
    }

    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === id);

    if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
    }

    users[userIndex].type = type;
    saveUsers(users);

    res.json({ success: true, user: { id: users[userIndex].id, type: users[userIndex].type } });
});

app.post('/api/auth/forgot-password', (req, res) => {
    const { email } = req.body;
    const users = getUsers();
    const user = users.find(u => u.email === email);

    if (!user) {
        // Still return success for security (prevent email enum)
        return res.json({ success: true, message: 'If an account exists with this email, a reset link will be sent.' });
    }

    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const expiry = Date.now() + 3600000; // 1 hour

    const userIndex = users.findIndex(u => u.id === user.id);
    users[userIndex].resetToken = token;
    users[userIndex].resetTokenExpiry = expiry;
    saveUsers(users);

    const resetLink = `http://localhost:3000/?token=${token}`;
    console.log(`\n--- PASSWORD RESET SIMULATION ---`);
    console.log(`To: ${email}`);
    console.log(`Link: ${resetLink}`);
    console.log(`----------------------------------\n`);

    res.json({ success: true, message: 'If an account exists with this email, a reset link will be sent.' });
});

app.post('/api/auth/reset-password', (req, res) => {
    const { token, password } = req.body;
    const users = getUsers();
    const userIndex = users.findIndex(u => u.resetToken === token && u.resetTokenExpiry > Date.now());

    if (userIndex === -1) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    users[userIndex].password = password;
    delete users[userIndex].resetToken;
    delete users[userIndex].resetTokenExpiry;
    saveUsers(users);

    res.json({ success: true, message: 'Password has been reset successfully.' });
});

app.delete('/api/storage/:key', (req, res) => {
    const key = req.params.key;
    const filePath = path.join(DATA_DIR, `${key}.json`);

    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: 'Failed to delete data' });
        }
    } else {
        res.status(404).json({ error: 'Key not found' });
    }
});

// --- PDF Processing Endpoint ---

app.post('/api/upload/pdf', upload.single('pdf'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const inputPath = req.file.path;
    const outputPath = `${inputPath}.xlsx`;
    const scriptPath = path.join(__dirname, 'converters', 'convert_louis_dressner_pdf.py');

    console.log(`Processing PDF: ${req.file.originalname}`);

    exec(`python3 "${scriptPath}" "${inputPath}" "${outputPath}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            // Attempt cleanup
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            return res.status(500).json({ error: 'PDF conversion failed', details: stderr });
        }

        try {
            if (!fs.existsSync(outputPath)) {
                throw new Error('Output file not found');
            }

            const workbook = XLSX.readFile(outputPath);
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

            // Clean up files
            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);

            res.json({
                success: true,
                data: jsonData,
                filename: req.file.originalname
            });
        } catch (readError) {
            console.error(`Read error: ${readError}`);
            res.status(500).json({ error: 'Failed to read converted Excel file' });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Persistence server running at http://localhost:${PORT}`);
});
