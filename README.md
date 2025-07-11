# Chat Application

A real-time chat app with FastAPI backend and  JavaScript frontend.

## Features
- JWT Authentication & Role-Based Access Control (RBAC) 
- Protected WebSocket Chat
- User authentication (Login/Signup)
- Real-time messaging via WebSockets
- Room creation and management
- Responsive design
------------------------------------------------------------------------------------------------------------------------------------------------
## Setup using Docker with
1. Set up environment variables:
Create a .env file in the root directory:
Edit the .env file with your preferred settings.

2. Build and run the containers:
bash
docker-compose up --build
Access the application:

3. Open your browser and visit:
   http://localhost:8000
------------------------------------------------------------------------------------------------------------------------------------------------
## Setup locally with postgres installed just change database.ini credentials and nothing more

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
------------------------------------------------------------------------------------------------------------------------------------------------
## Manual Database Setup

1. **Prerequisites**:
   - PostgreSQL installed
   - psql command line tool

2. **Setup Database**:
   ```bash
   # Create database and tables (will prompt for password)
   psql -U postgres -f setup_database.sql

   # Or if you need to specify password:
   PGPASSWORD=yourpassword psql -U postgres -f setup_database.sql
