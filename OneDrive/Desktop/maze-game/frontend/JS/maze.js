const API = "http://127.0.0.1:5000";

// ── State ─────────────────────────────────────
let mazeData     = null;   // full response from backend
let playerPos    = null;   // [row, col]
let moveCount    = 0;
let timerInterval= null;
let seconds      = 0;
let solving      = false;
let difficulty   = localStorage.getItem("difficulty") || "basic";
let hintsLeft    = 3;
let hintCells    = [];     // cells currently highlighted as hint

// ── Canvas setup ──────────────────────────────
const canvas = document.getElementById("mazeCanvas");
const ctx    = canvas.getContext("2d");

// Cell size based on difficulty
const CELL_SIZES = { basic: 40, medium: 22, hard: 16 };

// ── Init ──────────────────────────────────────
window.onload = async function () {
    await loadMaze();

    document.getElementById("solveBtn").addEventListener("click", aiSolve);
    document.getElementById("hintBtn").addEventListener("click", showHint);
    document.getElementById("newBtn").addEventListener("click", loadMaze);
    document.getElementById("playAgainBtn").addEventListener("click", () => {
        hideModal();
        loadMaze();
    });
    document.getElementById("changeLevelBtn").addEventListener("click", () => {
        window.location.href = "difficulty.html";
    });

    document.addEventListener("keydown", handleKey);
};

// ── Load maze from backend ────────────────────
async function loadMaze() {
    solving = false;
    stopTimer();
    moveCount = 0;
    seconds   = 0;
    hintsLeft = 3;
    hintCells = [];
    updateStats();
    updateHintBtn();
    hideModal();

    document.getElementById("loadingMsg").style.display = "block";
    canvas.style.display = "none";

    try {
        const res  = await fetch(`${API}/generate-maze`, {
            method:      "POST",
            headers:     { "Content-Type": "application/json" },
            credentials: "include",
            body:        JSON.stringify({ difficulty })
        });
        mazeData = await res.json();

        playerPos = [...mazeData.start];

        // Set badge & algorithm label
        const badge = document.getElementById("difficultyBadge");
        badge.textContent = difficulty.toUpperCase();
        badge.className   = `badge ${difficulty}`;
        document.getElementById("algoLabel").textContent =
            `Algorithm: ${mazeData.algorithm}`;

        // Size canvas
        const cell = CELL_SIZES[difficulty];
        canvas.width  = mazeData.cols * cell;
        canvas.height = mazeData.rows * cell;

        document.getElementById("loadingMsg").style.display = "none";
        canvas.style.display = "block";

        drawMaze();
        startTimer();

    } catch (err) {
        document.getElementById("loadingMsg").textContent =
            "Cannot reach server. Make sure Flask is running.";
    }
}

// ── Draw maze on canvas ───────────────────────
function drawMaze() {
    if (!mazeData) return;
    const cell = CELL_SIZES[difficulty];
    const maze = mazeData.maze;
    const rows = mazeData.rows;
    const cols = mazeData.cols;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const x = c * cell;
            const y = r * cell;

            if (maze[r][c] === 1) {
                // Wall
                ctx.fillStyle = "#0a1628";
                ctx.fillRect(x, y, cell, cell);
                // Subtle neon border on walls
                ctx.strokeStyle = "rgba(0,255,255,0.08)";
                ctx.lineWidth   = 0.5;
                ctx.strokeRect(x, y, cell, cell);
            } else {
                // Path
                ctx.fillStyle = "#0f1e40";
                ctx.fillRect(x, y, cell, cell);
            }
        }
    }

    // Draw end (goal)
    drawCell(mazeData.end[0], mazeData.end[1], "#ff00ff", "★", cell);

    // Draw start
    drawCell(mazeData.start[0], mazeData.start[1], "#00ff88", "S", cell);

    // Draw hint cells
    if (hintCells.length > 0) {
        drawHintCells(cell);
    }

    // Draw player
    drawPlayer(playerPos[0], playerPos[1], cell);
}

function drawCell(r, c, color, label, cell) {
    const x = c * cell;
    const y = r * cell;

    ctx.fillStyle = color + "22";
    ctx.fillRect(x, y, cell, cell);

    ctx.fillStyle   = color;
    ctx.font        = `bold ${Math.max(10, cell * 0.5)}px Arial`;
    ctx.textAlign   = "center";
    ctx.textBaseline= "middle";
    ctx.fillText(label, x + cell / 2, y + cell / 2);
}

function drawPlayer(r, c, cell) {
    const x = c * cell + cell / 2;
    const y = r * cell + cell / 2;
    const radius = cell * 0.35;

    // Glow effect
    ctx.shadowColor = "cyan";
    ctx.shadowBlur  = 12;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = "cyan";
    ctx.fill();

    ctx.shadowBlur = 0;
}

// ── Draw AI solution path ─────────────────────
function drawPath(path) {
    const cell = CELL_SIZES[difficulty];

    path.forEach(([r, c], i) => {
        // Skip start and end cells
        if (i === 0 || i === path.length - 1) return;

        const x = c * cell;
        const y = r * cell;

        ctx.fillStyle = "rgba(0, 255, 255, 0.25)";
        ctx.fillRect(x + 2, y + 2, cell - 4, cell - 4);
    });
}

// ── Hint: show next 3 steps from player position ──
function showHint() {
    if (solving || !mazeData || hintsLeft <= 0) return;

    const path = mazeData.path;
    if (!path || path.length === 0) return;

    // Find player's closest position on the solution path
    let playerIdx = -1;
    let minDist   = Infinity;
    for (let i = 0; i < path.length; i++) {
        const d = Math.abs(path[i][0] - playerPos[0]) + Math.abs(path[i][1] - playerPos[1]);
        if (d < minDist) { minDist = d; playerIdx = i; }
    }

    // Highlight next 3 steps ahead on the path
    const HINT_STEPS = 3;
    hintCells = [];
    for (let i = playerIdx + 1; i <= Math.min(playerIdx + HINT_STEPS, path.length - 1); i++) {
        hintCells.push(path[i]);
    }

    hintsLeft--;
    updateHintBtn();
    drawMaze();

    // Auto-clear hint after 2 seconds
    setTimeout(() => {
        hintCells = [];
        drawMaze();
    }, 2000);
}

// ── Draw hint cells ───────────────────────────
function drawHintCells(cell) {
    hintCells.forEach(([r, c], idx) => {
        const x = c * cell;
        const y = r * cell;

        // Fading intensity — first step brightest
        const alpha = 0.7 - idx * 0.15;

        ctx.shadowColor = "#ffd700";
        ctx.shadowBlur  = 10;

        ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`;
        ctx.beginPath();
        ctx.roundRect
            ? ctx.roundRect(x + 3, y + 3, cell - 6, cell - 6, 3)
            : ctx.rect(x + 3, y + 3, cell - 6, cell - 6);
        ctx.fill();

        ctx.shadowBlur = 0;

        // Step number label
        if (cell >= 18) {
            ctx.fillStyle    = "#000";
            ctx.font         = `bold ${Math.max(9, cell * 0.35)}px Arial`;
            ctx.textAlign    = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(idx + 1, x + cell / 2, y + cell / 2);
        }
    });
}

// ── Update hint button state ──────────────────
function updateHintBtn() {
    const btn = document.getElementById("hintBtn");
    const cnt = document.getElementById("hintCount");
    cnt.textContent = `(${hintsLeft})`;
    if (hintsLeft <= 0) {
        btn.disabled = true;
        btn.style.opacity = "0.4";
        btn.style.cursor  = "not-allowed";
    }
}

// ── Player movement ───────────────────────────
function handleKey(e) {
    if (solving || !mazeData) return;

    const moves = {
        ArrowUp:    [-1,  0],
        ArrowDown:  [ 1,  0],
        ArrowLeft:  [ 0, -1],
        ArrowRight: [ 0,  1]
    };

    const dir = moves[e.key];
    if (!dir) return;

    e.preventDefault();

    const nr = playerPos[0] + dir[0];
    const nc = playerPos[1] + dir[1];

    // Boundary + wall check
    if (nr < 0 || nc < 0 || nr >= mazeData.rows || nc >= mazeData.cols) return;
    if (mazeData.maze[nr][nc] === 1) return;

    playerPos = [nr, nc];
    moveCount++;
    hintCells = [];   // clear hint on move
    updateStats();
    drawMaze();

    // Check win
    if (nr === mazeData.end[0] && nc === mazeData.end[1]) {
        stopTimer();
        showWin();
    }
}

// ── AI Solve animation ────────────────────────
async function aiSolve() {
    if (solving || !mazeData) return;
    solving = true;

    const path = mazeData.path;
    if (!path || path.length === 0) {
        alert("No solution found!");
        solving = false;
        return;
    }

    // Reset player to start
    playerPos = [...mazeData.start];
    drawMaze();

    // Animate step by step
    const delay = difficulty === "basic" ? 80 : difficulty === "medium" ? 40 : 20;

    for (let i = 0; i < path.length; i++) {
        await sleep(delay);
        playerPos = path[i];
        drawMaze();
        drawPath(path.slice(0, i + 1));
    }

    solving = false;
    stopTimer();
    moveCount = path.length - 1;
    updateStats();
    showWin(true);
}

// ── Timer ─────────────────────────────────────
function startTimer() {
    stopTimer();
    seconds = 0;
    timerInterval = setInterval(() => {
        seconds++;
        document.getElementById("timer").textContent = formatTime(seconds);
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

function formatTime(s) {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
}

// ── Stats ─────────────────────────────────────
function updateStats() {
    document.getElementById("moveCount").textContent = moveCount;
    document.getElementById("timer").textContent     = formatTime(seconds);
}

// ── Win modal ─────────────────────────────────
function showWin(aiSolved = false) {
    const label = aiSolved ? `AI solved it in` : `You solved it in`;
    document.getElementById("winStats").textContent =
        `${label} ${moveCount} moves and ${formatTime(seconds)}!`;
    document.getElementById("winModal").classList.remove("hidden");

    // Save score to backend
    saveScore(moveCount, seconds);
}

function hideModal() {
    document.getElementById("winModal").classList.add("hidden");
}

// ── Save score ────────────────────────────────
async function saveScore(steps, time) {
    try {
        await fetch(`${API}/score`, {
            method:      "POST",
            headers:     { "Content-Type": "application/json" },
            credentials: "include",
            body:        JSON.stringify({ steps, time })
        });
    } catch (e) {
        // silently ignore if not logged in
    }
}

// ── Helper ────────────────────────────────────
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
