import logging
import time
from typing import List, Optional

from db.models import User
from db.session import get_db
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from middleware.auth_middleware import get_current_active_user
from schemas.schemas import (
    BulkDocumentUpload,
    BulkUploadResponse,
    DocumentCreate,
    DocumentResponse,
    QueryRequest,
    QueryResponse,
)
from services.document_service import document_service
from services.vector_store import vector_store
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/documents", response_model=DocumentResponse, status_code=201)
async def create_document(document: DocumentCreate, db: Session = Depends(get_db)):
    """
    Create a new document with automatic chunking and embedding
    """
    try:
        result = await document_service.create_document(db, document)
        return result
    except Exception as e:
        logger.error(f"Error creating document: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to create document: {str(e)}"
        )


@router.post("/documents/bulk", response_model=BulkUploadResponse)
async def bulk_create_documents(
    upload: BulkDocumentUpload, db: Session = Depends(get_db)
):
    """
    Create multiple documents in batch
    """
    try:
        result = await document_service.bulk_create_documents(db, upload.documents)
        return BulkUploadResponse(**result)
    except Exception as e:
        logger.error(f"Error in bulk upload: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Bulk upload failed: {str(e)}")


@router.get("/documents", response_model=List[DocumentResponse])
def list_documents(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=1000),
    category: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    List all documents with optional filtering
    """
    try:
        documents = document_service.list_documents(db, skip, limit, category)
        return documents
    except Exception as e:
        logger.error(f"Error listing documents: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to list documents: {str(e)}"
        )


@router.get("/documents/{document_id}", response_model=DocumentResponse)
def get_document(document_id: int, db: Session = Depends(get_db)):
    """
    Get a specific document by ID
    """
    try:
        document = document_service.get_document(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        return document
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting document: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get document: {str(e)}")


@router.delete("/documents/{document_id}")
async def delete_document(document_id: int, db: Session = Depends(get_db)):
    """
    Delete a document and its embeddings
    """
    try:
        success = await document_service.delete_document(db, document_id)
        if not success:
            raise HTTPException(status_code=404, detail="Document not found")
        return {"message": "Document deleted successfully", "document_id": document_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting document: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to delete document: {str(e)}"
        )


@router.get("/documents/stats/summary")
def get_document_stats(db: Session = Depends(get_db)):
    """
    Get statistics about documents
    """
    try:
        stats = document_service.get_document_stats(db)
        return stats
    except Exception as e:
        logger.error(f"Error getting stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")


@router.post("/documents/query", response_model=QueryResponse)
async def query_documents(query_request: QueryRequest):
    """
    Direct query to vector store without conversation context
    """
    try:
        start_time = time.time()

        results = await vector_store.search(
            query=query_request.query,
            top_k=query_request.top_k,
            score_threshold=query_request.score_threshold,
        )

        execution_time = (time.time() - start_time) * 1000

        from schemas.schemas import SourceDocument

        source_docs = [
            SourceDocument(
                document_id=res["metadata"].get("document_id", 0),
                title=res["metadata"].get("title", "Untitled"),
                content_snippet=res["text"][:200] + "...",
                relevance_score=res["score"],
                source=res["metadata"].get("source"),
                category=res["metadata"].get("category"),
            )
            for res in results
        ]

        return QueryResponse(
            query=query_request.query,
            results=source_docs,
            total_found=len(results),
            execution_time_ms=round(execution_time, 2),
        )

    except Exception as e:
        logger.error(f"Error querying documents: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")


@router.post("/documents/upload", response_model=DocumentResponse, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    category: Optional[str] = Form(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Upload a document file (PDF, TXT, DOCX, MD) to a specific conversation
    Automatically processes and adds to vector store
    Requires authentication
    """
    try:
        logger.info(
            f"User {current_user.id} uploading file: {file.filename} to conversation {session_id}"
        )

        # Get or create conversation
        from services.conversation_service import conversation_service

        conversation = conversation_service.create_or_get_conversation(
            db, current_user.id, session_id
        )

        # Process and create document
        result = await document_service.upload_and_process_file(
            db=db,
            file=file,
            user_id=current_user.id,
            conversation_id=conversation.id,
            category=category,
        )

        return result

    except ValueError as e:
        logger.error(f"Validation error in upload: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error uploading document: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to upload document: {str(e)}"
        )


@router.get("/documents/user/list", response_model=List[DocumentResponse])
def list_user_documents(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=1000),
    category: Optional[str] = None,
    session_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    List documents uploaded by the current user
    Optionally filter by session_id to get conversation-specific documents
    Requires authentication
    """
    try:
        documents = document_service.list_user_documents(
            db, current_user.id, skip, limit, category, session_id
        )
        return documents
    except Exception as e:
        logger.error(f"Error listing user documents: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to list user documents: {str(e)}"
        )


@router.delete("/documents/user/{document_id}")
async def delete_user_document(
    document_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Delete a document owned by the current user
    Requires authentication and ownership
    """
    try:
        success = await document_service.delete_user_document(
            db, document_id, current_user.id
        )
        if not success:
            raise HTTPException(
                status_code=404, detail="Document not found or not owned by user"
            )
        return {"message": "Document deleted successfully", "document_id": document_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user document: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to delete document: {str(e)}"
        )
