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
let lastDir      = 0;      // rotation angle in radians for player arrow

// ── Canvas setup ──────────────────────────────
const canvas = document.getElementById("mazeCanvas");
const ctx    = canvas.getContext("2d");

// Cell size based on difficulty — bigger cell = fewer cells visible = easier
const CELL_SIZES = { basic: 36, medium: 20, hard: 15 };

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

        // Size canvas — clamp to 90vw max
        const cell     = CELL_SIZES[difficulty];
        const maxPx    = Math.floor(window.innerWidth * 0.90);
        const rawW     = mazeData.cols * cell;
        const rawH     = mazeData.rows * cell;
        const scale    = rawW > maxPx ? maxPx / rawW : 1;
        canvas.width   = Math.floor(rawW  * scale);
        canvas.height  = Math.floor(rawH  * scale);
        canvas.dataset.scale = scale;   // store for drawing

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
    const baseCell = CELL_SIZES[difficulty];
    const scale    = parseFloat(canvas.dataset.scale || 1);
    const cell     = baseCell * scale;
    const maze     = mazeData.maze;
    const rows     = mazeData.rows;
    const cols     = mazeData.cols;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background fill
    ctx.fillStyle = "#020917";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const x = c * cell;
            const y = r * cell;

            if (maze[r][c] === 1) {
                // Wall — very dark, almost black
                ctx.fillStyle = "#020813";
                ctx.fillRect(x, y, cell, cell);

                // Neon wall border — scales with cell size
                ctx.strokeStyle = cell >= 16
                    ? "rgba(0, 200, 255, 0.25)"
                    : "rgba(0, 180, 255, 0.45)";   // harder = more visible wall edge
                ctx.lineWidth   = cell > 14 ? 1 : 0.8;
                ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);

                // Inner highlight on top/left edges for 3D depth
                if (cell >= 14) {
                    ctx.fillStyle = "rgba(0, 180, 255, 0.06)";
                    ctx.fillRect(x, y, cell, 2);
                    ctx.fillRect(x, y, 2, cell);
                }
            } else {
                // Path — bright enough to contrast sharply with walls
                ctx.fillStyle = "#1e3a6e";
                ctx.fillRect(x, y, cell, cell);

                // Radial glow for larger cells (basic/medium)
                if (cell >= 16) {
                    const grad = ctx.createRadialGradient(
                        x + cell / 2, y + cell / 2, 0,
                        x + cell / 2, y + cell / 2, cell * 0.7
                    );
                    grad.addColorStop(0, "rgba(80, 160, 255, 0.22)");
                    grad.addColorStop(1, "rgba(80, 160, 255, 0)");
                    ctx.fillStyle = grad;
                    ctx.fillRect(x, y, cell, cell);
                } else {
                    // Hard level — flat bright tint instead of gradient (faster, clearer at small size)
                    ctx.fillStyle = "rgba(60, 130, 255, 0.15)";
                    ctx.fillRect(x, y, cell, cell);
                }

                // Subtle border only — just enough to separate adjacent path cells
                ctx.strokeStyle = "rgba(40, 100, 200, 0.2)";
                ctx.lineWidth   = 0.4;
                ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
            }
        }
    }

    // Draw end — flag on pole
    drawFlag(mazeData.end[0], mazeData.end[1], cell);

    // Draw start — rocket
    drawStart(mazeData.start[0], mazeData.start[1], cell);

    // Draw hint cells
    if (hintCells.length > 0) {
        drawHintCells(cell);
    }

    // Draw player — glowing arrow
    drawPlayer(playerPos[0], playerPos[1], cell);
}

// ── Draw START — green glowing rocket ────────
function drawStart(r, c, cell) {
    const x  = c * cell + cell / 2;
    const y  = r * cell + cell / 2;
    const s  = cell * 0.38;

    // Background glow circle
    ctx.shadowColor = "#00ff88";
    ctx.shadowBlur  = cell * 0.6;
    ctx.fillStyle   = "rgba(0,255,136,0.18)";
    ctx.beginPath();
    ctx.arc(x, y, s * 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur  = 0;

    // Draw rocket body (pointing up)
    ctx.save();
    ctx.translate(x, y);

    // Body
    ctx.fillStyle = "#00ff88";
    ctx.beginPath();
    ctx.moveTo(0, -s);          // nose
    ctx.lineTo(s * 0.45, s * 0.3);
    ctx.lineTo(-s * 0.45, s * 0.3);
    ctx.closePath();
    ctx.fill();

    // Fins left
    ctx.beginPath();
    ctx.moveTo(-s * 0.45, s * 0.1);
    ctx.lineTo(-s * 0.8, s * 0.6);
    ctx.lineTo(-s * 0.25, s * 0.4);
    ctx.closePath();
    ctx.fill();

    // Fins right
    ctx.beginPath();
    ctx.moveTo(s * 0.45, s * 0.1);
    ctx.lineTo(s * 0.8, s * 0.6);
    ctx.lineTo(s * 0.25, s * 0.4);
    ctx.closePath();
    ctx.fill();

    // Flame
    ctx.fillStyle = "#ffd700";
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, s * 0.35);
    ctx.lineTo(0, s * 0.75);
    ctx.lineTo(s * 0.2, s * 0.35);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

// ── Draw END — chequered flag on pole ────────
function drawFlag(r, c, cell) {
    const x  = c * cell;
    const y  = r * cell;
    const s  = cell;

    // Background glow
    ctx.shadowColor = "#ff00cc";
    ctx.shadowBlur  = cell * 0.7;
    ctx.fillStyle   = "rgba(255,0,204,0.15)";
    ctx.fillRect(x, y, s, s);
    ctx.shadowBlur  = 0;

    const px  = x + s * 0.22;   // pole x
    const top = y + s * 0.1;
    const bot = y + s * 0.92;
    const fw  = s * 0.52;        // flag width
    const fh  = s * 0.38;        // flag height

    // Pole
    ctx.strokeStyle = "#ff80df";
    ctx.lineWidth   = Math.max(1.5, s * 0.06);
    ctx.shadowColor = "#ff00cc";
    ctx.shadowBlur  = 4;
    ctx.beginPath();
    ctx.moveTo(px, top);
    ctx.lineTo(px, bot);
    ctx.stroke();
    ctx.shadowBlur  = 0;

    // Chequered flag — 4x3 squares
    const sqW = fw / 4;
    const sqH = fh / 3;
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 4; col++) {
            ctx.fillStyle = (row + col) % 2 === 0 ? "#ffffff" : "#cc00aa";
            ctx.fillRect(px + col * sqW, top + row * sqH, sqW, sqH);
        }
    }

    // Flag border
    ctx.strokeStyle = "#ff00cc";
    ctx.lineWidth   = 0.8;
    ctx.strokeRect(px, top, fw, fh);
}

// ── Draw PLAYER — glowing neon arrow ─────────
function drawPlayer(r, c, cell) {
    const x  = c * cell + cell / 2;
    const y  = r * cell + cell / 2;
    const s  = cell * 0.38;

    ctx.shadowColor = "cyan";
    ctx.shadowBlur  = cell * 0.7;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(lastDir);

    // Outer ring
    ctx.strokeStyle = "rgba(0,255,255,0.5)";
    ctx.lineWidth   = Math.max(1, s * 0.2);
    ctx.beginPath();
    ctx.arc(0, 0, s * 1.15, 0, Math.PI * 2);
    ctx.stroke();

    // Arrow body (pointing up — rotates with last move direction handled via state)
    ctx.fillStyle = "cyan";
    ctx.beginPath();
    ctx.moveTo(0, -s);            // tip
    ctx.lineTo(s * 0.55, s * 0.5);
    ctx.lineTo(s * 0.2, s * 0.2);
    ctx.lineTo(s * 0.2, s * 0.8);
    ctx.lineTo(-s * 0.2, s * 0.8);
    ctx.lineTo(-s * 0.2, s * 0.2);
    ctx.lineTo(-s * 0.55, s * 0.5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
    ctx.shadowBlur = 0;
}

// ── Draw AI solution path ─────────────────────
function drawPath(path) {
    const baseCell = CELL_SIZES[difficulty];
    const scale    = parseFloat(canvas.dataset.scale || 1);
    const cell     = baseCell * scale;

    path.forEach(([r, c], i) => {
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
    const baseCell = CELL_SIZES[difficulty];
    const scale    = parseFloat(canvas.dataset.scale || 1);
    const c2       = baseCell * scale;

    hintCells.forEach(([r, c], idx) => {
        const x = c * c2;
        const y = r * c2;
        const alpha = 0.7 - idx * 0.15;

        ctx.shadowColor = "#ffd700";
        ctx.shadowBlur  = 10;
        ctx.fillStyle   = `rgba(255, 215, 0, ${alpha})`;
        ctx.beginPath();
        ctx.roundRect
            ? ctx.roundRect(x + 3, y + 3, c2 - 6, c2 - 6, 3)
            : ctx.rect(x + 3, y + 3, c2 - 6, c2 - 6);
        ctx.fill();
        ctx.shadowBlur = 0;

        if (c2 >= 14) {
            ctx.fillStyle    = "#000";
            ctx.font         = `bold ${Math.max(8, c2 * 0.35)}px Arial`;
            ctx.textAlign    = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(idx + 1, x + c2 / 2, y + c2 / 2);
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

    const dirAngles = {
        ArrowUp: 0, ArrowDown: Math.PI,
        ArrowLeft: -Math.PI / 2, ArrowRight: Math.PI / 2
    };
    if (dirAngles[e.key] !== undefined) lastDir = dirAngles[e.key];

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
    const optimalMoves = mazeData.optimal_moves;   // from backend algorithm
    const playerMoves  = moveCount;
    const timeTaken    = seconds;
    const baseScore    = mazeData.base_score;       // longer path = higher base

    // Efficiency: how close player was to the optimal path (capped at 100%)
    const efficiency = Math.min(100, Math.round((optimalMoves / Math.max(playerMoves, 1)) * 100));

    // Score: starts from base_score (tied to path length + difficulty)
    // Penalty for extra moves and time — rewards players who take the shortest path
    const extraMoves  = Math.max(0, playerMoves - optimalMoves);
    const movePenalty = extraMoves * 10;   // -10 per extra move beyond optimal
    const timePenalty = Math.floor(timeTaken / 5);  // -1 per 5 seconds
    const finalScore  = Math.max(0, baseScore - movePenalty - timePenalty);

    // Populate modal
    document.getElementById("winTitle").textContent     = aiSolved ? "🤖 AI Solved It!" : "🎉 You Solved It!";
    document.getElementById("wBase").textContent        = baseScore.toLocaleString();
    document.getElementById("wYourMoves").textContent   = playerMoves;
    document.getElementById("wOptimal").textContent     = optimalMoves;
    document.getElementById("wAlgo").textContent        = `(${mazeData.algorithm})`;
    document.getElementById("wEfficiency").textContent  = `${efficiency}%`;
    document.getElementById("wTime").textContent        = formatTime(timeTaken);
    document.getElementById("wScore").textContent       = finalScore.toLocaleString();

    // Colour efficiency value
    const effEl = document.getElementById("wEfficiency");
    effEl.style.color = efficiency >= 90 ? "#00ff88"
                      : efficiency >= 60 ? "#ffd700"
                      : "#ff6b6b";

    document.getElementById("winModal").classList.remove("hidden");

    // Save score to backend
    saveScore(playerMoves, timeTaken, finalScore);
}

function hideModal() {
    document.getElementById("winModal").classList.add("hidden");
}

// ── Save score ────────────────────────────────
async function saveScore(steps, time, score) {
    try {
        await fetch(`${API}/score`, {
            method:      "POST",
            headers:     { "Content-Type": "application/json" },
            credentials: "include",
            body:        JSON.stringify({ steps, time, score, difficulty })
        });
    } catch (e) {
        // silently ignore if not logged in
    }
}

// ── Helper ────────────────────────────────────
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
