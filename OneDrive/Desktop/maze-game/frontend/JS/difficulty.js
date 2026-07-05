let selectedLevel = null;

function selectLevel(level) {
    // Remove selected from all cards
    document.querySelectorAll(".level-card").forEach(card => {
        card.classList.remove("selected");
    });

    // Highlight chosen card
    document.getElementById(level + "Card").classList.add("selected");

    selectedLevel = level;

    // Enable start button
    const btn = document.getElementById("startBtn");
    btn.disabled = false;
    btn.textContent = `START ${level.toUpperCase()} GAME`;
}

function startGame() {
    if (!selectedLevel) return;

    // Store selected difficulty for the maze page
    localStorage.setItem("difficulty", selectedLevel);

    window.location.href = "maze.html";
}
