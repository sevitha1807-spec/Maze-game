from flask import Flask, request, jsonify, session
from flask_cors import CORS
import mysql.connector
from dotenv import load_dotenv
import os
import bcrypt
import random
import heapq
from collections import deque

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "maze_secret_key")
CORS(app, supports_credentials=True, origins=["http://127.0.0.1:5500", "http://localhost:5500"])

# ──────────────────────────────────────────────
# DB CONNECTION
# ──────────────────────────────────────────────

def get_db():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME")
    )


# ──────────────────────────────────────────────
# MAZE GENERATION — Recursive Backtracker (DFS)
# Produces a perfect maze (exactly one path between any two cells)
# ──────────────────────────────────────────────

def generate_maze(rows, cols):
    """
    Generate a maze using Recursive Backtracker (DFS).
    Returns a 2D grid where 0=path, 1=wall.
    Grid size is (2*rows+1) x (2*cols+1) to include walls between cells.
    """
    grid_rows = 2 * rows + 1
    grid_cols = 2 * cols + 1

    # Start all walls
    maze = [[1] * grid_cols for _ in range(grid_rows)]

    def carve(r, c):
        # Mark this cell as open
        maze[2 * r + 1][2 * c + 1] = 0
        directions = [(0, 1), (0, -1), (1, 0), (-1, 0)]
        random.shuffle(directions)
        for dr, dc in directions:
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and maze[2*nr+1][2*nc+1] == 1:
                # Remove wall between current and neighbour
                maze[2*r+1 + dr][2*c+1 + dc] = 0
                carve(nr, nc)

    import sys
    sys.setrecursionlimit(10000)
    carve(0, 0)

    # Ensure start and end are open
    maze[1][1] = 0
    maze[grid_rows - 2][grid_cols - 2] = 0

    return maze


# ──────────────────────────────────────────────
# ALGORITHM 1: BFS — used for Basic
# Guarantees shortest path, explores level by level
# ──────────────────────────────────────────────

def bfs_solve(maze, start, end):
    rows, cols = len(maze), len(maze[0])
    start, end = tuple(start), tuple(end)
    queue   = deque([[start]])
    visited = {start}

    while queue:
        path    = queue.popleft()
        current = path[-1]
        if current == end:
            return [list(p) for p in path]
        for dr, dc in [(-1,0),(1,0),(0,-1),(0,1)]:
            nr, nc = current[0]+dr, current[1]+dc
            nb = (nr, nc)
            if 0<=nr<rows and 0<=nc<cols and maze[nr][nc]==0 and nb not in visited:
                visited.add(nb)
                queue.append(path + [nb])
    return []


# ──────────────────────────────────────────────
# ALGORITHM 2: Dijkstra — used for Medium
# Weighted shortest path (all weights=1 here, but demonstrates the algorithm)
# ──────────────────────────────────────────────

def dijkstra_solve(maze, start, end):
    rows, cols = len(maze), len(maze[0])
    start, end = tuple(start), tuple(end)
    dist = {start: 0}
    prev = {start: None}
    heap = [(0, start)]

    while heap:
        cost, current = heapq.heappop(heap)
        if current == end:
            # Reconstruct path
            path = []
            node = end
            while node is not None:
                path.append(list(node))
                node = prev[node]
            return path[::-1]
        if cost > dist.get(current, float('inf')):
            continue
        for dr, dc in [(-1,0),(1,0),(0,-1),(0,1)]:
            nr, nc = current[0]+dr, current[1]+dc
            nb = (nr, nc)
            if 0<=nr<rows and 0<=nc<cols and maze[nr][nc]==0:
                new_cost = cost + 1
                if new_cost < dist.get(nb, float('inf')):
                    dist[nb] = new_cost
                    prev[nb] = current
                    heapq.heappush(heap, (new_cost, nb))
    return []


# ──────────────────────────────────────────────
# ALGORITHM 3: A* — used for Hard
# Heuristic-guided search — fastest to goal
# ──────────────────────────────────────────────

def astar_solve(maze, start, end):
    rows, cols = len(maze), len(maze[0])
    start, end = tuple(start), tuple(end)

    def heuristic(a, b):
        # Manhattan distance
        return abs(a[0]-b[0]) + abs(a[1]-b[1])

    open_set = [(heuristic(start, end), 0, start)]
    came_from = {start: None}
    g_score   = {start: 0}

    while open_set:
        _, g, current = heapq.heappop(open_set)
        if current == end:
            path = []
            node = end
            while node is not None:
                path.append(list(node))
                node = came_from[node]
            return path[::-1]
        for dr, dc in [(-1,0),(1,0),(0,-1),(0,1)]:
            nr, nc = current[0]+dr, current[1]+dc
            nb = (nr, nc)
            if 0<=nr<rows and 0<=nc<cols and maze[nr][nc]==0:
                tentative_g = g + 1
                if tentative_g < g_score.get(nb, float('inf')):
                    g_score[nb]   = tentative_g
                    came_from[nb] = current
                    f = tentative_g + heuristic(nb, end)
                    heapq.heappush(open_set, (f, tentative_g, nb))
    return []


# ──────────────────────────────────────────────
# DIFFICULTY CONFIG
# ──────────────────────────────────────────────

DIFFICULTY = {
    "basic":  {"rows": 10, "cols": 10, "algorithm": "BFS"},
    "medium": {"rows": 20, "cols": 20, "algorithm": "Dijkstra"},
    "hard":   {"rows": 30, "cols": 30, "algorithm": "A*"},
}


# ──────────────────────────────────────────────
# ROUTES
# ──────────────────────────────────────────────

@app.route("/")
def home():
    return jsonify({"message": "AI Maze Game Backend is Running!"})


# GENERATE MAZE
@app.route("/generate-maze", methods=["POST"])
def generate_maze_route():
    data       = request.get_json()
    difficulty = data.get("difficulty", "basic").lower()

    if difficulty not in DIFFICULTY:
        return jsonify({"error": "Invalid difficulty. Choose basic, medium, or hard"}), 400

    config = DIFFICULTY[difficulty]
    rows   = config["rows"]
    cols   = config["cols"]
    algo   = config["algorithm"]

    maze       = generate_maze(rows, cols)
    grid_rows  = len(maze)
    grid_cols  = len(maze[0])

    start = [1, 1]
    end   = [grid_rows - 2, grid_cols - 2]

    # Solve using the algorithm for this difficulty
    if algo == "BFS":
        path = bfs_solve(maze, start, end)
    elif algo == "Dijkstra":
        path = dijkstra_solve(maze, start, end)
    else:  # A*
        path = astar_solve(maze, start, end)

    return jsonify({
        "maze":       maze,
        "start":      start,
        "end":        end,
        "path":       path,
        "steps":      len(path),
        "algorithm":  algo,
        "difficulty": difficulty,
        "rows":       grid_rows,
        "cols":       grid_cols
    }), 200


# REGISTER
@app.route("/register", methods=["POST"])
def register():
    data     = request.get_json()
    username = data.get("username", "").strip()
    email    = data.get("email", "").strip()
    password = data.get("password", "")

    if not username or not email or not password:
        return jsonify({"error": "All fields are required"}), 400

    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())

    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT player_id FROM players WHERE email = %s", (email,))
        if cursor.fetchone():
            return jsonify({"error": "Email already registered"}), 409

        cursor.execute(
            "INSERT INTO players (player_name, email, password) VALUES (%s, %s, %s)",
            (username, email, hashed.decode("utf-8"))
        )
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": "Registered successfully!"}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# LOGIN
@app.route("/login", methods=["POST"])
def login():
    data     = request.get_json()
    email    = data.get("email", "").strip()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM players WHERE email = %s", (email,))
        user = cursor.fetchone()

        if not user:
            cursor.close()
            conn.close()
            return jsonify({"error": "Invalid email or password"}), 401

        stored      = user["password"]
        password_ok = False

        if stored.startswith("$2b$") or stored.startswith("$2a$"):
            password_ok = bcrypt.checkpw(password.encode("utf-8"), stored.encode("utf-8"))
        else:
            if stored == password:
                password_ok = True
                hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
                upgrade_cursor = conn.cursor()
                upgrade_cursor.execute(
                    "UPDATE players SET password = %s WHERE player_id = %s",
                    (hashed, user["player_id"])
                )
                conn.commit()
                upgrade_cursor.close()

        cursor.close()
        conn.close()

        if not password_ok:
            return jsonify({"error": "Invalid email or password"}), 401

        session["user_id"]  = user["player_id"]
        session["username"] = user["player_name"]

        return jsonify({
            "message":  "Login successful!",
            "username": user["player_name"]
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# CHECK SESSION
@app.route("/check-session", methods=["GET"])
def check_session():
    if "user_id" in session:
        return jsonify({"logged_in": True, "username": session.get("username")}), 200
    return jsonify({"logged_in": False}), 200


# LOGOUT
@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out successfully"}), 200


# SOLVE MAZE (manual call from frontend)
@app.route("/solve", methods=["POST"])
def solve():
    data       = request.get_json()
    maze       = data.get("maze")
    start      = data.get("start")
    end        = data.get("end")
    difficulty = data.get("difficulty", "basic").lower()

    if maze is None or start is None or end is None:
        return jsonify({"error": "maze, start, and end are required"}), 400

    algo = DIFFICULTY.get(difficulty, {}).get("algorithm", "BFS")

    if algo == "BFS":
        path = bfs_solve(maze, start, end)
    elif algo == "Dijkstra":
        path = dijkstra_solve(maze, start, end)
    else:
        path = astar_solve(maze, start, end)

    if not path:
        return jsonify({"message": "No path found", "path": [], "algorithm": algo}), 200

    return jsonify({
        "message":   "Path found!",
        "path":      path,
        "steps":     len(path),
        "algorithm": algo
    }), 200


# SAVE SCORE
@app.route("/score", methods=["POST"])
def save_score():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401

    data  = request.get_json()
    steps = data.get("steps")
    time  = data.get("time")

    if steps is None or time is None:
        return jsonify({"error": "steps and time are required"}), 400

    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO scores (player_id, time_taken, moves) VALUES (%s, %s, %s)",
            (session["user_id"], time, steps)
        )
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": "Score saved!"}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# LEADERBOARD
@app.route("/leaderboard", methods=["GET"])
def leaderboard():
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT p.player_name AS username, s.moves AS steps,
                   s.time_taken AS time_seconds, s.played_on AS played_at
            FROM scores s
            JOIN players p ON s.player_id = p.player_id
            ORDER BY s.moves ASC, s.time_taken ASC
            LIMIT 10
        """)
        scores = cursor.fetchall()
        cursor.close()
        conn.close()
        for s in scores:
            if s["played_at"]:
                s["played_at"] = str(s["played_at"])
        return jsonify({"leaderboard": scores}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)
