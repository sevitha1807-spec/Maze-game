const API = "http://127.0.0.1:5000";

// ── Toggle login / register cards ──────────────────

document.getElementById("showRegister").addEventListener("click", function (e) {
    e.preventDefault();
    document.getElementById("loginCard").classList.add("hidden");
    document.getElementById("registerCard").classList.remove("hidden");
    clearAllErrors();
});

document.getElementById("showLogin").addEventListener("click", function (e) {
    e.preventDefault();
    document.getElementById("registerCard").classList.add("hidden");
    document.getElementById("loginCard").classList.remove("hidden");
    clearAllErrors();
});

// ── Password: readable placeholder, mask on typing ──

document.getElementById("loginPassword").addEventListener("input", function () {
    this.type = "password";
});

document.getElementById("registerPassword").addEventListener("input", function () {
    this.type = "password";
});

// ── LOGIN ────────────────────────────────────────────

document.getElementById("loginForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    clearAllErrors();

    const email    = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    // Client-side validation
    let valid = true;

    if (!email) {
        showFieldError("loginEmailErr", "Email is required");
        valid = false;
    } else if (!isValidEmail(email)) {
        showFieldError("loginEmailErr", "Enter a valid email address");
        valid = false;
    }

    if (!password) {
        showFieldError("loginPasswordErr", "Password is required");
        valid = false;
    }

    if (!valid) return;

    setMsg("loginMsg", "Logging in...", "info");
    disableBtn("loginForm", true);

    try {
        const res  = await fetch(`${API}/login`, {
            method:      "POST",
            headers:     { "Content-Type": "application/json" },
            credentials: "include",
            body:        JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (res.ok) {
            setMsg("loginMsg", `Welcome back, ${data.username}! Redirecting...`, "success");
            setTimeout(() => {
                window.location.href = "difficulty.html";
            }, 1000);
        } else {
            setMsg("loginMsg", data.error || "Login failed. Try again.", "error");
            disableBtn("loginForm", false);
        }

    } catch (err) {
        setMsg("loginMsg", "Cannot reach server. Make sure the backend is running.", "error");
        disableBtn("loginForm", false);
    }
});

// ── REGISTER ─────────────────────────────────────────

document.getElementById("registerForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    clearAllErrors();

    const username = document.getElementById("regUsername").value.trim();
    const email    = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("registerPassword").value;

    // Client-side validation
    let valid = true;

    if (!username) {
        showFieldError("regUsernameErr", "Username is required");
        valid = false;
    } else if (username.length < 3) {
        showFieldError("regUsernameErr", "Username must be at least 3 characters");
        valid = false;
    }

    if (!email) {
        showFieldError("regEmailErr", "Email is required");
        valid = false;
    } else if (!isValidEmail(email)) {
        showFieldError("regEmailErr", "Enter a valid email address");
        valid = false;
    }

    if (!password) {
        showFieldError("regPasswordErr", "Password is required");
        valid = false;
    } else if (password.length < 6) {
        showFieldError("regPasswordErr", "Password must be at least 6 characters");
        valid = false;
    }

    if (!valid) return;

    setMsg("registerMsg", "Creating account...", "info");
    disableBtn("registerForm", true);

    try {
        const res  = await fetch(`${API}/register`, {
            method:      "POST",
            headers:     { "Content-Type": "application/json" },
            credentials: "include",
            body:        JSON.stringify({ username, email, password })
        });

        const data = await res.json();

        if (res.ok) {
            setMsg("registerMsg", "Account created! Please login.", "success");
            setTimeout(() => {
                document.getElementById("registerCard").classList.add("hidden");
                document.getElementById("loginCard").classList.remove("hidden");
                clearAllErrors();
            }, 1500);
        } else {
            setMsg("registerMsg", data.error || "Registration failed. Try again.", "error");
            disableBtn("registerForm", false);
        }

    } catch (err) {
        setMsg("registerMsg", "Cannot reach server. Make sure the backend is running.", "error");
        disableBtn("registerForm", false);
    }
});

// ── Helpers ──────────────────────────────────────────

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showFieldError(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
}

function setMsg(id, text, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className   = `form-msg ${type}`;
}

function clearAllErrors() {
    ["loginEmailErr", "loginPasswordErr", "regUsernameErr",
     "regEmailErr", "regPasswordErr"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = "";
    });
    ["loginMsg", "registerMsg"].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.textContent = ""; el.className = "form-msg"; }
    });
}

function disableBtn(formId, state) {
    const btn = document.getElementById(formId).querySelector(".btn");
    if (btn) {
        btn.disabled    = state;
        btn.textContent = state
            ? (formId === "loginForm" ? "LOGGING IN..." : "REGISTERING...")
            : (formId === "loginForm" ? "LOGIN"         : "REGISTER");
    }
}
