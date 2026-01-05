import logging
import re
from typing import Any, Dict, List, Optional

from core.config import settings
from schemas.schemas import ChatMessage, SourceDocument
from services.vector_store import vector_store

logger = logging.getLogger(__name__)


class RAGService:
    """
    Service for orchestrating RAG pipeline with NVIDIA NeMo:
    1. Query augmentation
    2. Document retrieval (with NeMo embeddings)
    3. Reranking
    4. Context construction
    5. Response generation (with Nemotron LLM + Guardrails)
    """

    def __init__(self):
        self.llm_service = None
        self.guardrails_service = None
        self.use_nemo = settings.NEMO_ENABLED
        self._initialize_services()

    def _initialize_services(self):
        """Initialize LLM and guardrails services based on configuration"""
        try:
            if self.use_nemo:
                logger.info("Initializing NVIDIA NeMo stack")
                from services.nemo_guardrails_service import nemo_guardrails_service
                from services.nemo_llm_service import nemo_llm_service

                self.llm_service = nemo_llm_service
                self.guardrails_service = nemo_guardrails_service
                logger.info("NeMo services initialized")
            else:
                logger.info("Initializing cloud LLM fallback")
                if settings.OPENAI_API_KEY:
                    from openai import AsyncOpenAI

                    self.llm_service = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
                    logger.info("OpenAI client initialized (fallback)")
                else:
                    logger.warning("No LLM provider configured")
        except Exception as e:
            logger.error(f"Error initializing services: {str(e)}")

    async def augment_query(
        self,
        query: str,
        conversation_history: List[ChatMessage] = None,
        emit_callback=None,
    ) -> str:
        """
        Augment user query with context and synonyms

        Args:
            query: Original user query
            conversation_history: Previous conversation messages
            emit_callback: Optional callback to emit CoT steps

        Returns:
            Augmented query
        """
        try:
            # Emit CoT step
            if emit_callback:
                await emit_callback(
                    step_type="augmenting",
                    label="Augmenting your query",
                    description=f"Original query: '{query[:80]}{'...' if len(query) > 80 else ''}'",
                    status="active",
                )

            # Track what augmentations we made
            augmentation_details = []

            # If we have conversation history, add context
            if conversation_history and len(conversation_history) > 0:
                recent_messages = [
                    msg.content
                    for msg in conversation_history[-3:]
                    if msg.role == "user"
                ]
                if recent_messages:
                    recent_context = " ".join(recent_messages)
                    augmented = f"{query} {recent_context}"
                    augmentation_details.append(
                        f"Added {len(recent_messages)} previous message(s) as context"
                    )
                else:
                    augmented = query
            else:
                augmented = query
                augmentation_details.append("No conversation history to add")

            # DISABLED: Query augmentation with keywords actually makes results worse
            # The embedding model works better with the original query
            # healthcare_keywords = ["healthcare", "medical", "hospital", "patient", "clinical"]
            # if any(keyword.lower() in query.lower() for keyword in healthcare_keywords):
            #     augmented += " healthcare and medical services"
            #     augmentation_details.append(
            #         "Added domain-specific keywords: 'healthcare and medical services'"
            #     )

            logger.debug(f"Augmented query: '{augmented[:100]}...'")

            # Emit completion with details
            if emit_callback:
                if augmentation_details:
                    details_text = " • ".join(augmentation_details)
                    changes_info = f"✓ Enhancements: {details_text}"
                else:
                    changes_info = "No augmentation needed"

                await emit_callback(
                    step_type="augmenting",
                    label="Augmenting your query",
                    description=f"{changes_info}\n✓ Enhanced query: '{augmented[:100]}{'...' if len(augmented) > 100 else ''}'",
                    status="complete",
                )

            return augmented

        except Exception as e:
            logger.error(f"Error augmenting query: {str(e)}")
            if emit_callback:
                await emit_callback(
                    step_type="augmenting",
                    label="Augmenting your query",
                    status="error",
                )
            return query

    async def retrieve_documents(
        self,
        query: str,
        top_k: int = None,
        score_threshold: float = None,
        metadata_filter: Optional[Dict[str, Any]] = None,
        emit_callback=None,
    ) -> List[Dict[str, Any]]:
        """
        Retrieve relevant documents using vector similarity search

        Args:
            query: Search query
            top_k: Number of documents to retrieve
            score_threshold: Minimum relevance score
            metadata_filter: Optional metadata filters
            emit_callback: Optional callback to emit CoT steps

        Returns:
            List of retrieved documents with scores
        """
        try:
            # Augment query
            augmented_query = await self.augment_query(
                query, emit_callback=emit_callback
            )

            # Retrieve from vector store (it will emit its own CoT steps)
            results = await vector_store.search(
                query=augmented_query,
                top_k=top_k or settings.RETRIEVAL_TOP_K,
                score_threshold=score_threshold or settings.RETRIEVAL_SCORE_THRESHOLD,
                filter_metadata=metadata_filter,
                emit_callback=emit_callback,
            )

            # Emit document count with details
            if emit_callback:
                if results:
                    # Get top 3 document titles and scores for display
                    doc_summaries = []
                    for i, doc in enumerate(results[:3], 1):
                        title = doc.get("title", "Untitled")[:40]
                        score = doc.get("score", 0)
                        doc_summaries.append(f"{i}. '{title}' ({score:.2f})")

                    docs_details = " | ".join(doc_summaries)
                    more_text = (
                        f" + {len(results) - 3} more" if len(results) > 3 else ""
                    )

                    await emit_callback(
                        step_type="retrieved",
                        label=f"Retrieved {len(results)} documents",
                        description=f"✓ Found {len(results)} relevant document(s): {docs_details}{more_text}",
                        status="complete",
                    )
                else:
                    await emit_callback(
                        step_type="retrieved",
                        label="Retrieved 0 documents",
                        description="No matching documents found in database",
                        status="complete",
                    )

            logger.info(f"Retrieved {len(results)} documents")
            return results

        except Exception as e:
            logger.error(f"Error retrieving documents: {str(e)}", exc_info=True)
            return []

    async def rerank_documents(
        self,
        query: str,
        documents: List[Dict[str, Any]],
        top_n: int = None,
        emit_callback=None,
    ) -> List[Dict[str, Any]]:
        """
        Rerank retrieved documents based on query relevance
        Uses simple keyword matching reranking

        Args:
            query: User query
            documents: Retrieved documents
            top_n: Number of documents to keep
            emit_callback: Optional callback to emit CoT steps

        Returns:
            Reranked documents
        """
        try:
            # Emit CoT step
            if emit_callback:
                await emit_callback(
                    step_type="reranking",
                    label="Reranking documents",
                    description="Scoring documents by keyword relevance",
                    status="active",
                )
            if not documents:
                return []

            top_n = top_n or settings.RERANK_TOP_N

            # Extract query keywords (preserve case for name matching)
            query_terms = set(re.findall(r"\b\w+\b", query.lower()))
            query_original = set(re.findall(r"\b\w+\b", query))

            # Calculate keyword overlap score with name boosting
            for doc in documents:
                doc_text_lower = doc["text"].lower()
                doc_terms = set(re.findall(r"\b\w+\b", doc_text_lower))

                # Basic keyword overlap
                overlap = len(query_terms.intersection(doc_terms))
                keyword_score = overlap / max(len(query_terms), 1)

                # Boost for exact phrase/name matches (case-insensitive)
                exact_match_boost = 0.0
                for term in query_original:
                    if len(term) > 2 and term.lower() in doc_text_lower:
                        exact_match_boost += 0.15  # Boost for each exact term match

                # Title boost if query terms appear in title
                title_boost = 0.0
                title = doc.get("title", "").lower()
                if any(term in title for term in query_terms if len(term) > 2):
                    title_boost = 0.2

                # Combine scores - give MORE weight to keywords when semantic score is poor
                semantic_weight = (
                    0.3 if doc["score"] > 0.1 else 0.1
                )  # Less weight if semantic is poor
                keyword_weight = 1.0 - semantic_weight

                doc["rerank_score"] = (
                    doc["score"] * semantic_weight
                    + keyword_score * keyword_weight
                    + exact_match_boost
                    + title_boost
                )

            # Sort by rerank score and take top N
            reranked = sorted(documents, key=lambda x: x["rerank_score"], reverse=True)[
                :top_n
            ]

            logger.info(f"Reranked to top {len(reranked)} documents")

            # Emit completion with reranking details
            if emit_callback:
                if reranked:
                    # Show reranking results for top documents
                    rerank_details = []
                    for i, doc in enumerate(reranked[:3], 1):
                        title = doc.get("title", "Untitled")[:35]
                        original_score = doc.get("score", 0)
                        rerank_score = doc.get("rerank_score", 0)
                        rerank_details.append(
                            f"{i}. '{title}' (V:{original_score:.2f} K:{rerank_score:.1f})"
                        )

                    details_str = " | ".join(rerank_details)
                    more_text = (
                        f" + {len(reranked) - 3} more" if len(reranked) > 3 else ""
                    )

                    await emit_callback(
                        step_type="reranking",
                        label="Reranking documents",
                        description=f"✓ Reranked by keyword relevance: {details_str}{more_text}",
                        status="complete",
                    )
                else:
                    await emit_callback(
                        step_type="reranking",
                        label="Reranking documents",
                        description="No documents to rerank",
                        status="complete",
                    )

            return reranked

        except Exception as e:
            logger.error(f"Error reranking documents: {str(e)}")
            if emit_callback:
                await emit_callback(
                    step_type="reranking",
                    label="Reranking documents",
                    status="error",
                )
            return documents[:top_n] if documents else []

    async def build_context(
        self, documents: List[Dict[str, Any]], emit_callback=None
    ) -> str:
        """
        Build context string from retrieved documents

        Args:
            documents: Retrieved and reranked documents
            emit_callback: Optional callback to emit CoT steps

        Returns:
            Formatted context string
        """
        if not documents:
            return "No relevant documents found."

        # Emit start of context building
        if emit_callback:
            await emit_callback(
                step_type="building",
                label="Building context",
                description="Formatting documents for generation",
                status="active",
            )

        context_parts = []
        for i, doc in enumerate(documents, 1):
            metadata = doc.get("metadata", {})
            title = metadata.get("title", "Untitled")
            category = metadata.get("category", "General")

            # Emit CoT step for each document being analyzed
            if emit_callback:
                score = doc.get("score", 0)
                await emit_callback(
                    step_type="analyzing_document",
                    label=f"Analyzing document: {title}",
                    description=f"✓ Doc {i}/{len(documents)}, Relevance: {score:.2f}",
                    status="complete",
                )

            context_parts.append(
                f"[Document {i}] Title: {title} | Category: {category}\n"
                f"Content: {doc['text']}\n"
                f"Relevance Score: {doc.get('rerank_score', doc['score']):.3f}\n"
            )

        # Emit completion
        if emit_callback:
            await emit_callback(
                step_type="building",
                label="Building context",
                description=f"✓  {len(documents)} documents for generation",
                status="complete",
            )

        return "\n".join(context_parts)

    async def generate_response(
        self,
        query: str,
        context: str,
        conversation_history: List[ChatMessage] = None,
        emit_callback=None,
    ) -> str:
        """
        Generate response using NVIDIA Nemotron LLM with Guardrails

        Args:
            query: User query
            context: Retrieved document context
            conversation_history: Previous messages
            emit_callback: Optional callback to emit CoT steps

        Returns:
            Generated response
        """
        try:
            if not self.llm_service:
                return self._generate_fallback_response(context)

            # Build enhanced system message with patient database
            system_message = """You are HealthChat, an AI assistant for a hospital system with direct access to real-time patient data.

PATIENT DATABASE - You have immediate knowledge of these patients:

1. **Emma Hernandez (MRN1000000)** - Age 2, Room 2A Surgery Unit, STABLE, Pneumonia
2. **Isabella Johnson (MRN1000001)** - Age 11, Emergency Dept, WARNING, Acute condition
3. **Isabella Hernandez (MRN1000002)** - Age 4, Emergency Dept, STABLE
4. **Liam Williams (MRN1000003)** - Age 9, Oncology Unit, CRITICAL, Cancer treatment
5. **William Miller (MRN1000004)** - Age 13, NICU, STABLE, Pneumonia
6. **Ava Miller (MRN1000005)** - Age 6, Oncology Unit, STABLE, Post-op cancer surgery recovery
7. **James Johnson (MRN1000006)** - Age 15, Room 4E **PICU**, WARNING, Respiratory Distress
8. **James Brown (MRN1000007)** - Age 8, Room 2B **PICU**, WARNING, Sepsis  
9. **Mason Williams (MRN1000008)** - Age 14, Room 3D Surgery Unit, STABLE, Appendicitis
10. **Sophia Brown (MRN1000009)** - Age 7, General Medicine, STABLE, Dehydration
11. **Olivia Davis (MRN1000010)** - Age 16, Cardiology Unit, STABLE, Arrhythmia

HOSPITAL UNITS:
- **PICU** (Pediatric Intensive Care): James Johnson, James Brown
- Emergency Dept: Isabella Johnson, Isabella Hernandez  
- Surgery: Emma Hernandez, Mason Williams
- Oncology: Liam Williams, Ava Miller
- Cardiology: Olivia Davis
- NICU: William Miller
- General Medicine: Sophia Brown

INSTRUCTIONS:
- Answer questions about patients using this data FIRST
- If asked about a specific patient or unit, use the data above directly
- Supplement with retrieved documents when available
- Be conversational but precise with medical information

Formatting:
- Add blank lines between major sections/points for readability
- Use **bold text** for emphasis when helpful
- Keep responses conversational and focused"""

            # Build messages
            messages = [{"role": "system", "content": system_message}]

            # Add conversation history if available
            if conversation_history:
                for msg in conversation_history[-settings.MAX_CONVERSATION_HISTORY :]:
                    messages.append({"role": msg.role, "content": msg.content})

            # Add current query with context
            if context and context.strip():
                user_message = f"""Here's some relevant healthcare documentation:

{context}

Question: {query}"""
            else:
                user_message = query

            messages.append({"role": "user", "content": user_message})

            # Check input with guardrails if enabled
            if (
                self.use_nemo
                and self.guardrails_service
                and settings.NEMO_GUARDRAILS_ENABLED
            ):
                input_check = await self.guardrails_service.check_input(
                    query, emit_callback=emit_callback
                )

                if not input_check["allowed"]:
                    logger.warning(
                        f"Input blocked by guardrails: {input_check['violations']}"
                    )
                    return input_check.get(
                        "safe_response",
                        "I cannot process that request. How else can I help you with healthcare information?",
                    )

            # Emit CoT step before generation
            if emit_callback:
                await emit_callback(
                    step_type="generating",
                    label="Generating response",
                    description="Processing with Nemotron 70B",
                    status="active",
                )

            # Generate response with NeMo LLM
            if self.use_nemo and hasattr(self.llm_service, "generate"):
                logger.info("Generating with NVIDIA Nemotron")
                generated_text = await self.llm_service.generate(messages)
            else:
                # Fallback to OpenAI
                logger.info("Generating with OpenAI (fallback)")
                response = await self.llm_service.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=messages,
                    temperature=settings.LLM_TEMPERATURE,
                    max_tokens=settings.LLM_MAX_TOKENS,
                )
                generated_text = response.choices[0].message.content

            # Emit completion of generation
            if emit_callback:
                await emit_callback(
                    step_type="generating",
                    label="Generating response",
                    description="✓ Response generated successfully",
                    status="complete",
                )

            # Check output with guardrails if enabled
            if (
                self.use_nemo
                and self.guardrails_service
                and settings.NEMO_GUARDRAILS_ENABLED
            ):
                output_check = await self.guardrails_service.check_output(
                    generated_text, context, emit_callback=emit_callback
                )

                if not output_check["allowed"]:
                    logger.warning(
                        f"Output blocked by guardrails: {output_check['issues']}"
                    )
                    return output_check.get("safe_response", generated_text)

            logger.info("Successfully generated response")
            return generated_text

        except Exception as e:
            logger.error(f"Error generating response: {str(e)}", exc_info=True)
            return self._generate_fallback_response(context)

    def _generate_fallback_response(self, context: str) -> str:
        """
        Generate a fallback response when LLM is unavailable

        Args:
            context: Retrieved context

        Returns:
            Fallback response
        """
        if "No relevant documents" in context:
            return (
                "I couldn't find specific information about your question in the healthcare knowledge base. "
                "Please try rephrasing your question or contact healthcare support for assistance."
            )

        return (
            f"Based on the healthcare knowledge base, here's what I found:\n\n"
            f"{context}\n\n"
            f"Note: LLM service is currently unavailable. "
            f"The above context shows relevant documentation excerpts."
        )

    async def process_query(
        self,
        query: str,
        conversation_history: List[ChatMessage] = None,
        use_rag: bool = True,
        user_id: Optional[int] = None,
        conversation_id: Optional[int] = None,
        emit_callback=None,
    ) -> Dict[str, Any]:
        """
        Main RAG pipeline orchestration

        Args:
            query: User query
            conversation_history: Previous conversation
            use_rag: Whether to use RAG (retrieval)
            user_id: Optional user ID for filtering user-uploaded documents
            conversation_id: Optional conversation ID for filtering conversation-specific documents
            emit_callback: Optional callback to emit CoT steps

        Returns:
            Dictionary with response, sources, context and metadata
        """
        try:
            logger.info(
                f"Processing query: '{query[:100]}...' for user {user_id}, conversation {conversation_id}"
            )

            if not use_rag:
                # Direct LLM query without retrieval
                response = await self.generate_response(
                    query, "", conversation_history, emit_callback=emit_callback
                )
                return {
                    "response": response,
                    "sources": [],
                    "context": "",
                    "metadata": {"used_rag": False},
                }

            # Step 1: Retrieve documents
            # Don't filter by conversation_id/user_id - retrieve all documents (global + user-specific)
            # The vector store will return the most relevant documents regardless of ownership
            retrieved_docs = await self.retrieve_documents(
                query, metadata_filter=None, emit_callback=emit_callback
            )

            if not retrieved_docs:
                logger.warning("No documents retrieved")
                response = await self.generate_response(
                    query,
                    "No relevant documents found.",
                    conversation_history,
                    emit_callback=emit_callback,
                )
                return {
                    "response": response,
                    "sources": [],
                    "context": "No relevant documents found.",
                    "metadata": {"used_rag": True, "documents_found": 0},
                }

            # Step 2: Rerank documents
            reranked_docs = await self.rerank_documents(
                query, retrieved_docs, emit_callback=emit_callback
            )

            # Step 3: Build context
            context = await self.build_context(
                reranked_docs, emit_callback=emit_callback
            )

            # Step 4: Generate response
            response = await self.generate_response(
                query, context, conversation_history, emit_callback=emit_callback
            )

            # Step 5: Format source documents
            sources = [
                SourceDocument(
                    document_id=doc["metadata"].get("document_id", 0),
                    title=doc["metadata"].get("title", "Untitled"),
                    content_snippet=doc["text"][:200] + "...",
                    relevance_score=doc.get("rerank_score", doc["score"]),
                    source=doc["metadata"].get("source"),
                    category=doc["metadata"].get("category"),
                )
                for doc in reranked_docs
            ]

            return {
                "response": response,
                "sources": sources,
                "context": context,
                "metadata": {
                    "used_rag": True,
                    "documents_found": len(retrieved_docs),
                    "documents_used": len(reranked_docs),
                },
            }

        except Exception as e:
            logger.error(f"Error in RAG pipeline: {str(e)}", exc_info=True)
            return {
                "response": "I apologize, but I encountered an error processing your request. Please try again.",
                "sources": [],
                "context": "",
                "metadata": {"error": str(e)},
            }


# Global RAG service instance
rag_service = RAGService()
