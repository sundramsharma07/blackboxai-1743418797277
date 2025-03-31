// Authentication and Session Management
let authToken = null;

document.getElementById("loginForm").addEventListener("submit", async function(event) {
    event.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        if (response.ok) {
            const data = await response.json();
            authToken = data.token;
            document.getElementById("usernameDisplay").textContent = username;
            document.getElementById("authStatus").classList.remove("hidden");
            document.getElementById("login").classList.add("hidden");
            document.getElementById("dashboard").classList.remove("hidden");
            
            // Start monitoring system stats
            startMonitoring();
        } else {
            alert("Login failed: Invalid credentials");
        }
    } catch (error) {
        console.error("Login error:", error);
        alert("Login failed: Server error");
    }
});

function logout() {
    authToken = null;
    document.getElementById("loginForm").reset();
    document.getElementById("authStatus").classList.add("hidden");
    document.getElementById("login").classList.remove("hidden");
    document.getElementById("dashboard").classList.add("hidden");
    stopMonitoring();
}

// System Monitoring
let monitoringInterval = null;

function startMonitoring() {
    // Initial update
    updateSystemStats();
    // Set up periodic updates
    monitoringInterval = setInterval(updateSystemStats, 2000);
}

function stopMonitoring() {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }
}

async function updateSystemStats() {
    try {
        const response = await fetch('/api/system/stats', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const stats = await response.json();
            document.getElementById("cpu-usage").textContent = `${stats.cpu}%`;
            document.getElementById("memory-usage").textContent = `${stats.memory}%`;
            document.getElementById("process-count").textContent = stats.processes;
        }
    } catch (error) {
        console.error("Failed to fetch system stats:", error);
    }
}

// System Call Execution
async function executeSyscall() {
    const syscall = document.getElementById("syscall-select").value;
    const params = document.getElementById("syscall-params").value.split(',').map(p => p.trim());

    try {
        const response = await fetch('/api/syscall/execute', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ syscall, params })
        });

        if (response.ok) {
            const result = await response.json();
            addLogEntry({
                timestamp: new Date().toISOString(),
                syscall,
                params,
                result: result.output,
                success: true
            });
        } else {
            const error = await response.json();
            addLogEntry({
                timestamp: new Date().toISOString(),
                syscall,
                params,
                result: error.message,
                success: false
            });
        }
    } catch (error) {
        console.error("System call execution failed:", error);
        addLogEntry({
            timestamp: new Date().toISOString(),
            syscall,
            params,
            result: "Connection error",
            success: false
        });
    }
}

// Log Management
function addLogEntry(entry) {
    const logsDiv = document.getElementById("logs");
    const logEntry = document.createElement("div");
    logEntry.className = `mb-2 p-2 rounded ${entry.success ? 'bg-green-50' : 'bg-red-50'}`;
    
    logEntry.innerHTML = `
        <div class="flex justify-between text-sm">
            <span class="font-semibold">${entry.syscall}(${entry.params.join(', ')})</span>
            <span class="text-gray-500">${new Date(entry.timestamp).toLocaleTimeString()}</span>
        </div>
        <div class="mt-1 text-sm ${entry.success ? 'text-green-600' : 'text-red-600'}">
            ${entry.result}
        </div>
    `;
    
    logsDiv.prepend(logEntry);
}

async function refreshLogs() {
    try {
        const response = await fetch('/api/syscall/logs', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const logs = await response.json();
            document.getElementById("logs").innerHTML = '';
            logs.forEach(log => addLogEntry(log));
        }
    } catch (error) {
        console.error("Failed to fetch logs:", error);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check for existing session
    // (Implementation would require server-side session validation)
});
