# chat_ws.py
from fastapi import WebSocket, WebSocketDisconnect, APIRouter, Query, HTTPException, status
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import json
from database import get_cursor

router = APIRouter()

SECRET_KEY = "brahmabyte_irfanAlam"
ALGORITHM = "HS256"

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}  # {room_token: {user_id: websocket}}

    async def connect(self, websocket: WebSocket, room_token: str, user_id: str):
        await websocket.accept()
        if room_token not in self.active_connections:
            self.active_connections[room_token] = {}
        self.active_connections[room_token][user_id] = websocket
        print(f"[CONNECT] User {user_id} joined room {room_token}")

    def disconnect(self, websocket: WebSocket, room_token: str, user_id: str):
        try:
            if room_token in self.active_connections and user_id in self.active_connections[room_token]:
                del self.active_connections[room_token][user_id]
                if not self.active_connections[room_token]:  # Remove room if empty
                    del self.active_connections[room_token]
                print(f"[DISCONNECT] User {user_id} left room {room_token}")
        except Exception as e:
            print(f"[ERROR] Disconnect failed: {str(e)}")

    async def broadcast(self, message: dict, room_token: str, exclude_user_id: str = None):
        if room_token not in self.active_connections:
            return
            
        for user_id, connection in self.active_connections[room_token].items():
            if user_id == exclude_user_id:
                continue
            try:
                await connection.send_text(json.dumps(message))
            except Exception as e:
                print(f"[ERROR] Failed to send to {user_id}: {str(e)}")
                self.disconnect(connection, room_token, user_id)

manager = ConnectionManager()

async def verify_websocket_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if not all(k in payload for k in ["sub", "user_id", "role"]):
            raise ValueError("Missing required token fields")
        return {
            "username": payload["sub"],
            "user_id": str(payload["user_id"]),  # Ensure user_id is string for dict keys
            "role": payload["role"]
        }
    except JWTError as e:
        print(f"Token verification failed: {str(e)}")
        raise WebSocketDisconnect(code=status.WS_1008_POLICY_VIOLATION)

async def get_room_by_token(room_token: str) -> dict:
    try:
        conn, cur = get_cursor()
        cur.execute("SELECT id, name FROM rooms WHERE room_token = %s", (room_token,))
        room = cur.fetchone()
        if not room:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Room not found"
            )
        return {
            "id": room["id"],
            "name": room["name"]
        }
    except Exception as e:
        print(f"Room lookup error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error"
        )
    finally:
        if conn:
            conn.close()

async def send_recent_messages(websocket: WebSocket, room_id: int, limit: int = 20):
    try:
        conn, cur = get_cursor()
        cur.execute("""
            SELECT m.id, m.content, m.created_at, u.username as sender
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.room_id = %s
            ORDER BY m.created_at DESC
            LIMIT %s
        """, (room_id, limit))

        messages = cur.fetchall()
        for msg in reversed(messages):  # Send oldest first
            await websocket.send_text(json.dumps({
                "type": "history",
                "id": msg["id"],
                "sender": msg["sender"],
                "content": msg["content"],
                "timestamp": msg["created_at"].isoformat()
            }))
    except Exception as e:
        print(f"Error fetching message history: {str(e)}")
        await websocket.send_text(json.dumps({
            "type": "error",
            "content": "Could not load message history"
        }))
    finally:
        if conn:
            conn.close()

@router.websocket("/ws/token/{room_token}")
async def websocket_endpoint_token(websocket: WebSocket, room_token: str, token: str = Query(...)):
    user = None
    room = None
    try:
        # Verify token
        user = await verify_websocket_token(token)
        
        # Get room info
        room = await get_room_by_token(room_token)
        
        # Connect to room
        await manager.connect(websocket, room_token, user["user_id"])
        
        # Send welcome message
        await websocket.send_text(json.dumps({
            "type": "system",
            "content": f"Welcome {user['username']} to {room['name']}",
            "user": user
        }))
        
        # Send message history immediately after connection
        await send_recent_messages(websocket, room["id"])
        
        # Handle incoming messages
        while True:
            data = await websocket.receive_text()
            
            # Skip if it's a history request (we already sent history)
            if data.strip() == '{"type":"get_history"}':
                continue
                
            # Process regular chat messages
            conn = None
            try:
                conn, cur = get_cursor()
                cur.execute("""
                    INSERT INTO messages (content, sender_id, room_id, created_at)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id, created_at
                """, (data, user["user_id"], room["id"], datetime.utcnow()))
                message_data = cur.fetchone()
                conn.commit()
                
                # Prepare the message to broadcast
                message = {
                    "type": "chat",
                    "id": message_data["id"],
                    "sender": user["username"],
                    "content": data,
                    "timestamp": message_data["created_at"].isoformat(),
                    "room_id": room["id"]
                }
                
                # Broadcast to all in room (including sender)
                await manager.broadcast(message, room_token)
                
            except Exception as e:
                print(f"Error handling message: {str(e)}")
                if conn:
                    conn.rollback()
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "content": "Failed to send message"
                }))
            finally:
                if conn:
                    conn.close()
                    
    except WebSocketDisconnect:
        print(f"User {user['username'] if user else 'unknown'} disconnected")
        if user and room:
            await manager.broadcast({
                "type": "system",
                "content": f"{user['username']} left the chat"
            }, room_token)
            manager.disconnect(websocket, room_token, user["user_id"])
    except Exception as e:
        print(f"WebSocket error: {str(e)}")
        try:
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        except:
            pass
        if user and room:
            manager.disconnect(websocket, room_token, user["user_id"])