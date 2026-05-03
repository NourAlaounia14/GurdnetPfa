from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from schemas.user import UserCreate, UserLogin, UserOut, TokenResponse
from services.auth_service import register_user, loginUser
from dependencies.auth import get_current_user
from models.models import User
from fastapi.security import OAuth2PasswordRequestForm
router = APIRouter(prefix="/auth", tags=["Auth"])
@router.post("/register", response_model=UserOut)
def register(data: UserCreate, db: Session = Depends(get_db)):
    try:
        user = register_user(db, data)
        return user
    except ValueError as e:

        raise HTTPException(status_code=400, detail=str(e))
@router.post("/login",response_model=TokenResponse)
def login(data:OAuth2PasswordRequestForm = Depends(),db:Session=Depends(get_db)):
    try:
        token = loginUser(db, data.username,data.password)
        return {"access_token": token, "token_type": "bearer"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user