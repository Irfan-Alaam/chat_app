# db/migrate.py
import os
from connect import connect
from config import load_config

def run_migrations():
    conn = None
    try:
        conn = connect(load_config())
        cursor = conn.cursor()
        
        # Read and execute your SQL file
        with open('db/init/01_tables.sql', 'r') as f:
            sql = f.read()
            cursor.execute(sql)
        
        conn.commit()
        print("✅ Database tables created successfully")
    except Exception as e:
        print("❌ Migration failed:", e)
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    run_migrations()