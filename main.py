from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import Optional, List
from pydantic import BaseModel
import secrets

from connect import connect
from config import load_config
from chat_ws import router as chat_router

app = FastAPI()
app.include_router(chat_router)
app.mount("/static", StaticFiles(directory="public"), name="static")

# Authentication setup
pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")
SECRET_KEY = "brahmabyte_irfanAlam"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Database connection
def get_db_connection():
    return connect(load_config())

# Models (kept minimal)
class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    is_active: bool

class RoomResponse(BaseModel):
    id: int
    name: str
    created_by: int
    token: str
# ... [keep all your existing endpoints below] ...
class UserSignup(BaseModel):
    username: str
    email: str
    password: str
    role: str = "user"

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class RoomCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    is_private: bool = False
# Admin dependency
async def require_admin(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Admin endpoints
@app.get("/admin/rooms", response_model=List[RoomResponse])
async def get_all_rooms(_ = Depends(require_admin)):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Use COALESCE to handle NULL tokens
        cursor.execute("""
            SELECT 
                id, 
                name, 
                created_by, 
                COALESCE(room_token, '') as token  -- Converts NULL to empty string
            FROM rooms 
            ORDER BY id
        """)
        
        rooms = [
            {
                "id": row[0],
                "name": row[1],
                "created_by": row[2],
                "token": row[3]  # Will never be NULL
            }
            for row in cursor.fetchall()
        ]
        
        return rooms
        
    finally:
        cursor and cursor.close()
        conn and conn.close() 
@app.get("/admin/users", response_model=List[UserResponse])
async def get_all_users(_ = Depends(require_admin)):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, username, email, role, is_active 
            FROM users
            ORDER BY id
        """)
        
        users = [
            {
                "id": row[0],
                "username": row[1],
                "email": row[2] or "",  # Handle NULL emails
                "role": row[3],
                "is_active": row[4]
            }
            for row in cursor.fetchall()
        ]
        
        return users
        
    except Exception as e:
        print(f"Error fetching users: {str(e)}")
        raise HTTPException(500, detail="Failed to fetch users")
    finally:
        cursor and cursor.close()
        conn and conn.close()
@app.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: int, _ = Depends(require_admin)):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # First delete from room_participants if needed
        cursor.execute("""
            DELETE FROM room_participants 
            WHERE user_id = %s
        """, (user_id,))
        
        # Then delete the user
        cursor.execute("""
            DELETE FROM users 
            WHERE id = %s
            RETURNING id
        """, (user_id,))
        
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="User not found")
            
        conn.commit()
        return {"status": "success", "message": "User deleted"}
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.delete("/admin/rooms/{room_token}")
async def admin_delete_room(room_token: str, _ = Depends(require_admin)):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # First delete from room_participants if needed
        cursor.execute("""
            DELETE FROM room_participants 
            WHERE room_id = (SELECT id FROM rooms WHERE room_token = %s)
        """, (room_token,))
        
        # Then delete the room
        cursor.execute("""
            DELETE FROM rooms 
            WHERE room_token = %s
            RETURNING id
        """, (room_token,))
        
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Room not found")
            
        conn.commit()
        return {"status": "success", "message": "Room deleted"}
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_db_connection():
    return connect(load_config())

@app.get("/")
def root():
    return RedirectResponse(url="/static/auth.html")

@app.post("/signup")
async def signup(user: UserSignup):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM users WHERE username = %s", (user.username,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Username already exists")

        hashed_password = pwd_context.hash(user.password)
        cursor.execute(
            """INSERT INTO users (username, email, hashed_password, role, is_active) 
            VALUES (%s, %s, %s, %s, %s) RETURNING id""",
            (user.username, user.email, hashed_password, user.role, True)
        )
        user_id = cursor.fetchone()[0]
        conn.commit()

        return {"status": "success", "user_id": user_id}
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.post("/login", response_model=Token)
async def login(credentials: UserLogin):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id, username, hashed_password, role FROM users WHERE username = %s", 
            (credentials.username,)
        )
        user = cursor.fetchone()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )

        if not pwd_context.verify(credentials.password, user[2]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )

        access_token = create_access_token(
            data={"sub": user[1], "user_id": user[0], "role": user[3]}
        )

        return {"access_token": access_token, "token_type": "bearer"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.get("/users/me")
async def read_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        user_id = payload.get("user_id")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT id, username, email, role FROM users WHERE username = %s", (username,))
        user = cursor.fetchone()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        return {
            "id": user[0],  # Make sure this is included
            "username": user[1],
            "email": user[2],
            "role": user[3]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
@app.get("/users/me/rooms")
async def get_user_rooms(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Select the creator as well
        cursor.execute("""
            SELECT r.id, r.name, r.description, r.room_token, r.created_by
            FROM rooms r
            LEFT JOIN room_participants rp ON r.id = rp.room_id
            WHERE r.created_by = %s OR rp.user_id = %s
            GROUP BY r.id
        """, (user_id, user_id))
        
        rooms = cursor.fetchall()
        return [{
            "id": room[0],
            "name": room[1],
            "description": room[2],
            "token": room[3],
            "created_by": room[4]  # ✅ now included!
        } for room in rooms]

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
@app.post("/rooms/create")
async def create_room(room: RoomCreateRequest, token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM rooms WHERE name = %s", (room.name,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Room name already taken")

        room_token = secrets.token_urlsafe(16)

        cursor.execute(
            """INSERT INTO rooms (name, description, created_by, is_private, room_token)
            VALUES (%s, %s, %s, %s, %s) RETURNING id""",
            (room.name, room.description, user_id, room.is_private, room_token)
        )
        room_id = cursor.fetchone()[0]
        conn.commit()

        return {"room_id": room_id, "room_token": room_token}
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.get("/rooms/token/{room_token}")
async def get_room_by_token(room_token: str, token: str = Depends(oauth2_scheme)):
    try:
        jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, name, description, created_by, is_private 
            FROM rooms WHERE room_token = %s
        """, (room_token,))
        room = cursor.fetchone()

        if not room:
            raise HTTPException(status_code=404, detail="Room not found")

        return {
            "id": room[0],
            "name": room[1],
            "description": room[2],
            "created_by": room[3],
            "is_private": room[4]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.put("/rooms/{room_token}")
async def update_room(
    room_token: str,
    room_data: dict,
    token: str = Depends(oauth2_scheme)
):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Verify user is the room creator
        cursor.execute("""
            SELECT created_by FROM rooms 
            WHERE room_token = %s
        """, (room_token,))
        room = cursor.fetchone()
        
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")
        
        if room[0] != user_id:
            raise HTTPException(
                status_code=403, 
                detail="Only room creator can update the room"
            )

        # Update room
        cursor.execute("""
            UPDATE rooms 
            SET name = %s 
            WHERE room_token = %s
            RETURNING id, name
        """, (room_data.get("name"), room_token))
        
        updated_room = cursor.fetchone()
        conn.commit()
        
        return {
            "id": updated_room[0],
            "name": updated_room[1]
        }
        
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.delete("/rooms/{room_token}")
async def delete_room(room_token: str, token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Check if the user is the room creator
        cursor.execute("SELECT created_by FROM rooms WHERE room_token = %s", (room_token,))
        room = cursor.fetchone()
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")

        if room[0] != user_id:
            raise HTTPException(status_code=403, detail="Only the room creator can delete this room")

        # Delete room participants first (if any foreign key constraints)
        cursor.execute("DELETE FROM room_participants WHERE room_id = (SELECT id FROM rooms WHERE room_token = %s)", (room_token,))

        # Delete room
        cursor.execute("DELETE FROM rooms WHERE room_token = %s", (room_token,))
        conn.commit()

        return {"status": "success", "message": "Room deleted"}

    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
