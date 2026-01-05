import logging
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.schemas import Token, UserResponse, LoginRequest
from services.auth_service import auth_service
from middleware.auth_middleware import get_current_active_user
from core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/login", response_model=Token)
async def login_for_access_token(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate user and return JWT token.
    """
    try:
        user = auth_service.authenticate_user(db, request.email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or domain not allowed",
                headers={"WWW-Authenticate": "Bearer"},
            )

        access_token_expires = timedelta(hours=settings.JWT_EXPIRATION_HOURS)
        access_token = auth_service.create_access_token(
            data={"sub": user.email}, expires_delta=access_token_expires
        )
        logger.info(f"User {user.email} logged in successfully.")
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": UserResponse.model_validate(user),
        }
    except HTTPException:
        raise  # Re-raise existing HTTPException
    except Exception as e:
        logger.error(f"Error during login: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during login.",
        )


@router.post("/logout")
async def logout(response: Response):
    """
    Placeholder for logout. Client-side should delete token.
    """
    response.delete_cookie(
        key="access_token"
    )  # Example for cookie-based, not strictly needed for bearer
    return {"message": "Logged out successfully (client-side token removal required)"}


@router.get("/me", response_model=UserResponse)
async def read_users_me(
    current_user: UserResponse = Depends(get_current_active_user),
):
    """
    Get current authenticated user's information.
    """
    return current_user


@router.post("/verify-token")
async def verify_token(current_user: UserResponse = Depends(get_current_active_user)):
    """
    Verify if the current token is valid.
    """
    return {"message": "Token is valid", "user": current_user}
