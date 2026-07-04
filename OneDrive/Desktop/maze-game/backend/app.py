from flask import Flask, request, jsonify
import mysql.connector
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)

conn = mysql.connector.connect(
    host=os.getenv("DB_HOST"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    database=os.getenv("DB_NAME")
)

cursor = conn.cursor()

@app.route("/")
def home():
    return "AI Maze Solver Backend is Running!"

@app.route("/register", methods=["POST"])
def register():
    data = request.json

    username = data["username"]
    email = data["email"]
    password = data["password"]

    sql = "INSERT INTO players(username, email, password) VALUES(%s, %s, %s)"
    cursor.execute(sql, (username, email, password))
    conn.commit()

    return jsonify({"message": "User Registered Successfully!"})

if __name__ == "__main__":
    app.run(debug=True)
    