# Chat Application

A real-time chat app with FastAPI backend and  JavaScript frontend.

## Features
- JWT Authentication & Role-Based Access Control (RBAC) 
- Protected WebSocket Chat
- User authentication (Login/Signup)
- Real-time messaging via WebSockets
- Room creation and management
- Responsive design

## Setup

1. Clone the repository:
```bash
git clone https://github.com/Irfan-Alaam/chat_app.git
cd chat_app

2. Set up Python environment:
bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows
pip install -r requirements.txt

3. Configure database:

Rename database/database.ini.sample to database.ini
Update with your PostgreSQL credentials

4. Run the application:
bash
uvicorn main:app --reload

Then,
Access at: http://localhost:8000
or http://localhost:8000/static/auth.html
