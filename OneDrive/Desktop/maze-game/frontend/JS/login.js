const API = "http://127.0.0.1:5000";

// ── Toggle login / register cards ──────────────────────────

document.getElementById("showRegister").addEventListener("click", function (e) {
    e.preventDefault();
    document.getElementById("loginCard").classList.add("hidden");
    document.getElementById("registerCard").classList.remove("hidden");
    clearMessages();
});

document.getElementById("showLogin").addEventListener("click", function (e) {
    e.preventDefault();
    document.getElementById("registerCard").classList.add("hidden");
    document.getElementById("loginCard").classList.remove("hidden");
    clearMessages();
});

// ── Password: show placeholder text, mask on typing ────────

document.getElementById("loginPassword").addEventListener("input", function () {
    this.type = "password";
});

document.getElementById("registerPassword").addEventListener("input", function () {
    this.type = "password";
});

// ── LOGIN ───────────────────────────────────────────────────

document.getElementById("loginForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const email    = this.querySelector('input[type="email"]').value.trim();
    const password = document.getElementById("loginPassword").value;

    setMessage("loginMsg", "Logging in...", "info");

    try {
        const res  = await fetch(`${API}/login`, {
            method:      "POST",
            headers:     { "Content-Type": "application/json" },
            credentials: "include",
            body:        JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (res.ok) {
            setMessage("loginMsg", `Welcome back, ${data.username}!`, "success");
            setTimeout(() => {
                window.location.href = "maze.html";
            }, 1000);
        } else {
            setMessage("loginMsg", data.error || "Login failed", "error");
        }

    } catch (err) {
        setMessage("loginMsg", "Cannot connect to server. Is the backend running?", "error");
    }
});

// ── REGISTER ────────────────────────────────────────────────

document.getElementById("registerForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const username = this.querySelector('input[type="text"]').value.trim();
    const email    = this.querySelector('input[type="email"]').value.trim();
    const password = document.getElementById("registerPassword").value;

    if (password.length < 6) {
        setMessage("registerMsg", "Password must be at least 6 characters", "error");
        return;
    }

    setMessage("registerMsg", "Creating account...", "info");

    try {
        const res  = await fetch(`${API}/register`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ username, email, password })
        });

        const data = await res.json();

        if (res.ok) {
            setMessage("registerMsg", "Registered! Please login.", "success");
            setTimeout(() => {
                document.getElementById("registerCard").classList.add("hidden");
                document.getElementById("loginCard").classList.remove("hidden");
            }, 1500);
        } else {
            setMessage("registerMsg", data.error || "Registration failed", "error");
        }

    } catch (err) {
        setMessage("registerMsg", "Cannot connect to server. Is the backend running?", "error");
    }
});

// ── Helpers ─────────────────────────────────────────────────

function setMessage(id, text, type) {
    let el = document.getElementById(id);
    if (!el) {
        el = document.createElement("p");
        el.id = id;
        el.className = "form-msg";
    }
    el.textContent = text;
    el.className   = `form-msg ${type}`;

    // Insert before the submit button of the active form
    if (id === "loginMsg") {
        document.getElementById("loginForm").querySelector(".btn").before(el);
    } else {
        document.getElementById("registerForm").querySelector(".btn").before(el);
    }
}

function clearMessages() {
    ["loginMsg", "registerMsg"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });
}
