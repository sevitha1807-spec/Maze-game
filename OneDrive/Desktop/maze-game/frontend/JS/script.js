const API = "http://127.0.0.1:5000";

window.onload = async function () {

    // Show splash for 2.5s then check session
    setTimeout(async function () {

        document.getElementById("splash").style.display = "none";
        document.getElementById("main").style.display   = "flex";

        await checkSession();

    }, 2500);

};

// ── Check if user is already logged in ──────────────

async function checkSession() {
    try {
        const res  = await fetch(`${API}/check-session`, {
            method:      "GET",
            credentials: "include"
        });
        const data = await res.json();

        if (data.logged_in) {
            showUserView(data.username);
        } else {
            showGuestView();
        }

    } catch (err) {
        // Backend not reachable — just show guest view
        showGuestView();
    }
}

// ── Guest view (not logged in) ───────────────────────

function showGuestView() {
    document.getElementById("guestView").style.display = "flex";
    document.getElementById("userView").style.display  = "none";

    document.getElementById("loginBtn").addEventListener("click", function () {
        window.location.href = "login.html";
    });
}

// ── User view (logged in) ─────────────────────────────

function showUserView(username) {
    document.getElementById("guestView").style.display  = "none";
    document.getElementById("userView").style.display   = "flex";
    document.getElementById("usernameDisplay").textContent = username;

    document.getElementById("playBtn").addEventListener("click", function () {
        window.location.href = "difficulty.html";
    });

    document.getElementById("logoutBtn").addEventListener("click", async function () {
        await logout();
    });
}

// ── Logout ────────────────────────────────────────────

async function logout() {
    try {
        await fetch(`${API}/logout`, {
            method:      "POST",
            credentials: "include"
        });
    } catch (err) {
        // ignore error, clear local view anyway
    }

    showMsg("Logged out. See you soon!", "success");
    setTimeout(() => {
        showGuestView();
        document.getElementById("homeMsg").textContent = "";
    }, 1500);
}

function showMsg(text, type) {
    const el = document.getElementById("homeMsg");
    el.textContent = text;
    el.className   = `home-msg ${type}`;
}
