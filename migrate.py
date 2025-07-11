# migrate.py (now in root directory)
import os
from connect import connect
from config import load_config

def run_migrations():
    conn = None
    try:
        conn = connect(load_config())
        cursor = conn.cursor()
        
        # Get the directory where this script is located
        script_dir = os.path.dirname(os.path.abspath(__file__))
        sql_path = os.path.join(script_dir, 'db', 'init', '01_tables.sql')
        
        # Read and execute your SQL file
        with open(sql_path, 'r') as f:
            sql = f.read()
            cursor.execute(sql)
        
        conn.commit()
        print("✅ Database tables created successfully")
    except Exception as e:
        print("❌ Migration failed:", e)

if __name__ == '__main__':
    run_migrations()