# database.py
from connect import connect
from config import load_config

def get_db_connection():
    config = load_config()
    return connect(config)

def get_cursor():
    conn = get_db_connection()
    cur = conn.cursor()
    return conn, cur
