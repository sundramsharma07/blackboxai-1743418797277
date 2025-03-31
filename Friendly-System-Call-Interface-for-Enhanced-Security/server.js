const express = require('express');
const jwt = require('jsonwebtoken');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'your-secure-key-here'; // In production, use environment variable

// Middleware
app.set('trust proxy', 1); // Trust first proxy
app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

// Rate limiting for security
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Whitelist of allowed system calls
const ALLOWED_SYSCALLS = {
    'read': { args: 3, description: 'Read from a file descriptor' },
    'write': { args: 3, description: 'Write to a file descriptor' },
    'open': { args: 2, description: 'Open and possibly create a file' },
    'fork': { args: 0, description: 'Create a new process' }
};

// Mock user database (in production, use a real database)
const users = [
    {
        id: 1,
        username: 'admin',
        password: 'password123', // Changed to requested password
        role: 'admin'
    },
    {
        id: 2,
        username: 'user',
        password: 'user123', // Simplified user password
        role: 'user'
    }
];

// Authentication Endpoints
app.post('/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
        const token = jwt.sign(
            { userId: user.id, role: user.role },
            SECRET_KEY,
            { expiresIn: '1h' }
        );
        res.json({ token });
    } else {
        res.status(401).json({ message: 'Invalid credentials' });
    }
});

// Middleware to verify JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// System Monitoring Endpoints
app.get('/api/system/stats', authenticateToken, (req, res) => {
    try {
        const stats = {
            cpu: (os.loadavg()[0] * 100).toFixed(2),
            memory: ((1 - os.freemem() / os.totalmem()) * 100).toFixed(2),
            processes: os.cpus().length
        };
        res.json(stats);
    } catch (error) {
        console.error('Error getting system stats:', error);
        res.status(500).json({ message: 'Error getting system stats' });
    }
});

// System Call Execution Endpoint
app.post('/api/syscall/execute', authenticateToken, (req, res) => {
    const { syscall, params } = req.body;

    // Validate system call
    if (!ALLOWED_SYSCALLS[syscall]) {
        return res.status(400).json({ message: 'System call not allowed' });
    }

    // Validate parameters
    if (params.length !== ALLOWED_SYSCALLS[syscall].args) {
        return res.status(400).json({ 
            message: `Invalid number of parameters for ${syscall}. Expected ${ALLOWED_SYSCALLS[syscall].args}`
        });
    }

    // Execute in a sandboxed environment (simplified example)
    try {
        // In a real implementation, you would use proper sandboxing
        // This is just a demonstration - be extremely careful with real system calls
        const result = executeSandboxedSyscall(syscall, params);
        
        // Log the execution
        logSyscall(req.user.userId, syscall, params, result, true);
        
        res.json({ output: result });
    } catch (error) {
        // Log the failed execution
        logSyscall(req.user.userId, syscall, params, error.message, false);
        
        res.status(500).json({ message: error.message });
    }
});

// System Call Logs Endpoint
app.get('/api/syscall/logs', authenticateToken, (req, res) => {
    try {
        const logs = getSyscallLogs();
        res.json(logs);
    } catch (error) {
        console.error('Error getting logs:', error);
        res.status(500).json({ message: 'Error getting logs' });
    }
});

// Helper Functions
function executeSandboxedSyscall(syscall, params) {
    // This is a simplified example - in production, use proper sandboxing
    // For demonstration, we'll just return mock responses
    const mockResponses = {
        'read': `Read ${params[2]} bytes from FD ${params[0]}`,
        'write': `Wrote ${params[2]} bytes to FD ${params[0]}`,
        'open': `Opened file ${params[0]} with flags ${params[1]}`,
        'fork': `Created new process with PID ${Math.floor(Math.random() * 10000)}`
    };
    return mockResponses[syscall] || 'System call executed';
}

function logSyscall(userId, syscall, params, result, success) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        userId,
        syscall,
        params,
        result,
        success
    };

    const logPath = path.join(__dirname, 'syscall_logs.json');
    let logs = [];

    try {
        if (fs.existsSync(logPath)) {
            logs = JSON.parse(fs.readFileSync(logPath));
        }
    } catch (error) {
        console.error('Error reading log file:', error);
    }

    logs.push(logEntry);

    try {
        fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
    } catch (error) {
        console.error('Error writing to log file:', error);
    }
}

function getSyscallLogs() {
    const logPath = path.join(__dirname, 'syscall_logs.json');
    try {
        if (fs.existsSync(logPath)) {
            return JSON.parse(fs.readFileSync(logPath));
        }
        return [];
    } catch (error) {
        console.error('Error reading logs:', error);
        return [];
    }
}

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Handle all other routes by serving index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access the interface at: http://localhost:${PORT}`);
});
