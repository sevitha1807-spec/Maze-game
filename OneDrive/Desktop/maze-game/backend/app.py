from flask import Flask, request, jsonify, session
from flask_cors import CORS
import mysql.connector
from dotenv import load_dotenv
import os
import bcrypt
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
# BFS MAZE SOLVER
# ──────────────────────────────────────────────

def bfs_solve(maze, start, end):
    """
    Solves a maze using Breadth-First Search.

    maze  : 2D list — 0 = open path, 1 = wall
    start : [row, col]
    end   : [row, col]

    Returns the shortest path as a list of [row, col] steps,
    or an empty list if no path exists.
    """
    rows = len(maze)
    cols = len(maze[0])
    start = tuple(start)
    end   = tuple(end)

    queue   = deque([[start]])
    visited = {start}

    while queue:
        path = queue.popleft()
        current = path[-1]

        if current == end:
            return [list(p) for p in path]

        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nr, nc = current[0] + dr, current[1] + dc
            neighbor = (nr, nc)

            if (0 <= nr < rows and
                0 <= nc < cols and
                maze[nr][nc] == 0 and
                neighbor not in visited):

                visited.add(neighbor)
                queue.append(path + [neighbor])

    return []   # no path found


# ──────────────────────────────────────────────
# ROUTES
# ──────────────────────────────────────────────

@app.route("/")
def home():
    return jsonify({"message": "AI Maze Game Backend is Running!"})


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

        # Check duplicate email
        cursor.execute("SELECT id FROM players WHERE email = %s", (email,))
        if cursor.fetchone():
            return jsonify({"error": "Email already registered"}), 409

        cursor.execute(
            "INSERT INTO players (username, email, password) VALUES (%s, %s, %s)",
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
        cursor.close()
        conn.close()

        if not user:
            return jsonify({"error": "Invalid email or password"}), 401

        if not bcrypt.checkpw(password.encode("utf-8"), user["password"].encode("utf-8")):
            return jsonify({"error": "Invalid email or password"}), 401

        session["user_id"]  = user["id"]
        session["username"] = user["username"]

        return jsonify({
            "message":  "Login successful!",
            "username": user["username"]
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# LOGOUT
@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out successfully"}), 200


# SOLVE MAZE (BFS)
@app.route("/solve", methods=["POST"])
def solve():
    data  = request.get_json()
    maze  = data.get("maze")
    start = data.get("start")
    end   = data.get("end")

    if maze is None or start is None or end is None:
        return jsonify({"error": "maze, start, and end are required"}), 400

    path = bfs_solve(maze, start, end)

    if not path:
        return jsonify({"message": "No path found", "path": []}), 200

    return jsonify({
        "message": "Path found!",
        "path":    path,
        "steps":   len(path)
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
            "INSERT INTO game_scores (player_id, steps, time_seconds) VALUES (%s, %s, %s)",
            (session["user_id"], steps, time)
        )
        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"message": "Score saved!"}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# GET LEADERBOARD
@app.route("/leaderboard", methods=["GET"])
def leaderboard():
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT p.username, gs.steps, gs.time_seconds, gs.played_at
            FROM game_scores gs
            JOIN players p ON gs.player_id = p.id
            ORDER BY gs.steps ASC, gs.time_seconds ASC
            LIMIT 10
        """)
        scores = cursor.fetchall()
        cursor.close()
        conn.close()

        # Convert datetime to string for JSON
        for s in scores:
            if s["played_at"]:
                s["played_at"] = str(s["played_at"])

        return jsonify({"leaderboard": scores}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)
