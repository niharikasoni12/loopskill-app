from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Text, JSON
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.orm import declarative_base
import json
import os

# --- Database Setup ---
SQLALCHEMY_DATABASE_URL = "sqlite:///./loopskill.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class DBUser(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    auth_id = Column(String, unique=True, index=True) # email or phone
    auth_type = Column(String) # 'email' or 'phone'
    image = Column(Text)
    teach = Column(String)
    learn = Column(String)
    hobbies = Column(JSON)
    posts = Column(JSON)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- App Setup ---
app = FastAPI(title="LoopSkill API")
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/", response_class=HTMLResponse)
async def read_index(request: Request):
    with open("static/index.html", "r", encoding="utf-8") as f:
        return f.read()

# --- Auth & User Models ---
class UserLogin(BaseModel):
    auth_id: str
    auth_type: str
    password: str = None
    otp: str = None

class UserRegister(BaseModel):
    name: str
    auth_id: str
    auth_type: str
    image: str
    teach: str
    learn: str

@app.post("/api/auth/login")
async def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(DBUser).filter(DBUser.auth_id == user.auth_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found. Please register first.")
    
    # Mocking real authentication
    if user.auth_type == 'email' and user.password == "wrong":
        raise HTTPException(status_code=401, detail="Invalid password")
    if user.auth_type == 'phone' and user.otp != "123456":
        raise HTTPException(status_code=401, detail="Invalid OTP (Use 123456)")

    return {
        "user_id": db_user.id,
        "name": db_user.name,
        "image": db_user.image,
        "teach": db_user.teach,
        "learn": db_user.learn
    }

@app.post("/api/auth/register")
async def register(user: UserRegister, db: Session = Depends(get_db)):
    db_user = db.query(DBUser).filter(DBUser.auth_id == user.auth_id).first()
    if db_user:
        # Update existing user
        db_user.name = user.name
        db_user.image = user.image
        db_user.teach = user.teach
        db_user.learn = user.learn
    else:
        db_user = DBUser(
            name=user.name,
            auth_id=user.auth_id,
            auth_type=user.auth_type,
            image=user.image,
            teach=user.teach,
            learn=user.learn,
            hobbies=[],
            posts=[]
        )
        db.add(db_user)
    
    db.commit()
    db.refresh(db_user)
    return {
        "user_id": db_user.id, 
        "name": db_user.name,
        "image": db_user.image,
        "teach": db_user.teach,
        "learn": db_user.learn
    }

@app.get("/api/users/profiles")
async def get_profiles(db: Session = Depends(get_db)):
    users = db.query(DBUser).all()
    # If no users in DB, return some mock ones
    if not users:
        return [
            {"id": 2, "name": "Alex", "image": "https://i.pravatar.cc/300?u=2", "teach": "Python", "learn": "Guitar", "hobbies": ["Coding", "Music"], "posts": ["Looking for a Guitar teacher!"]},
            {"id": 3, "name": "Sam", "image": "https://i.pravatar.cc/300?u=3", "teach": "Public Speaking", "learn": "React", "hobbies": ["Reading", "Podcasts"], "posts": ["Can someone review my speech?"]},
            {"id": 4, "name": "Jordan", "image": "https://i.pravatar.cc/300?u=4", "teach": "Design", "learn": "Machine Learning", "hobbies": ["Art", "AI"], "posts": ["Starting a Figma workshop today."]},
        ]
    
    # Return real users
    return [
        {
            "id": u.id,
            "name": u.name,
            "image": u.image,
            "teach": u.teach,
            "learn": u.learn,
            "hobbies": u.hobbies or ["General"],
            "posts": u.posts or []
        }
        for u in users
    ]

# --- WebSockets ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

@app.websocket("/ws/chat/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.dumps({"client_id": client_id, "message": data})
            await manager.broadcast(message)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
