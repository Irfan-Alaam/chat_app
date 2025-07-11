# connect.py
import psycopg2
from psycopg2.extras import DictCursor
from config import load_config 

def connect(config):
    """Connect to the PostgreSQL database server"""
    try:
        conn = psycopg2.connect(
            **config,
            cursor_factory=DictCursor  # Allows dict-like row access
        )
        print('Connected to the PostgreSQL server.')
        return conn
    except (psycopg2.DatabaseError, Exception) as error:
        print(error)
        raise
