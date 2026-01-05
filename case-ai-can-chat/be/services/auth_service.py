import logging
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from core.config import settings
from db.models import User

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthService:
    """
    Service for user authentication and JWT token management.
    Handles user creation, login, and token validation.
    """

    def __init__(self):
        self.SECRET_KEY = settings.JWT_SECRET_KEY
        self.ALGORITHM = settings.JWT_ALGORITHM
        self.ACCESS_TOKEN_EXPIRE_HOURS = settings.JWT_EXPIRATION_HOURS
        self.ALLOWED_EMAIL_DOMAIN = settings.ALLOWED_EMAIL_DOMAIN

    def create_access_token(
        self, data: dict, expires_delta: Optional[timedelta] = None
    ):
        """
        Creates a new JWT access token.
        """
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(hours=self.ACCESS_TOKEN_EXPIRE_HOURS)
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, self.SECRET_KEY, algorithm=self.ALGORITHM)
        return encoded_jwt

    def verify_token(self, token: str) -> Optional[str]:
        """
        Verifies a JWT token and returns the subject (email).
        """
        try:
            payload = jwt.decode(token, self.SECRET_KEY, algorithms=[self.ALGORITHM])
            email: str = payload.get("sub")
            if email is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Could not validate credentials",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            return email
        except JWTError as e:
            logger.warning(f"JWT verification failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

    def get_user_by_email(self, db: Session, email: str) -> Optional[User]:
        """
        Retrieves a user by their email address.
        """
        return db.query(User).filter(User.email == email).first()

    def create_user(self, db: Session, email: str) -> User:
        """
        Creates a new user if the email domain is allowed.
        """
        if not email.endswith(f"@{self.ALLOWED_EMAIL_DOMAIN}"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email domain must be @{self.ALLOWED_EMAIL_DOMAIN}",
            )

        existing_user = self.get_user_by_email(db, email)
        if existing_user:
            return existing_user  # Return existing user if already registered

        name = email.split("@")[0].replace(".", " ").title()  # Extract name from email
        db_user = User(email=email, name=name)
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        logger.info(f"New user created: {email}")
        return db_user

    def authenticate_user(self, db: Session, email: str) -> User:
        """
        Authenticates a user by email. Creates user if not exists.
        """
        user = self.get_user_by_email(db, email)
        if not user:
            user = self.create_user(db, email)
        return user


auth_service = AuthService()
