"""
Run this file once to set up the database tables.
Usage: python db.py
"""

import mysql.connector
from dotenv import load_dotenv
import os

load_dotenv()

try:
    conn = mysql.connector.connect(
        host=os.getenv("DB_HOST"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME")
    )
    cursor = conn.cursor()

    # Players table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS players (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            username   VARCHAR(100) NOT NULL,
            email      VARCHAR(150) NOT NULL UNIQUE,
            password   VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Game scores table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS game_scores (
            id             INT AUTO_INCREMENT PRIMARY KEY,
            player_id      INT NOT NULL,
            steps          INT NOT NULL,
            time_seconds   FLOAT NOT NULL,
            played_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (player_id) REFERENCES players(id)
        )
    """)

    conn.commit()
    cursor.close()
    conn.close()

    print("✅ Database tables created successfully!")

except Exception as e:
    print(f"❌ Error: {e}")
