"""initial migration

Revision ID: f1f91d4c55ac
Revises:
Create Date: 2025-10-08 16:03:56.782203

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "f1f91d4c55ac"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ### Create users table first (required for foreign keys) ###
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_id", "users", ["id"])
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # ### Create conversations table with user_id ###
    op.create_table(
        "conversations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_conversations_id"), "conversations", ["id"], unique=False)
    op.create_index(
        op.f("ix_conversations_session_id"),
        "conversations",
        ["session_id"],
        unique=True,
    )
    op.create_index("ix_conversations_user_id", "conversations", ["user_id"])

    # ### Create documents table with user_id and conversation_id ###
    op.create_table(
        "documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("source", sa.String(length=1000), nullable=True),
        sa.Column("category", sa.String(length=200), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("chunk_count", sa.Integer(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("conversation_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["conversations.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_documents_category"), "documents", ["category"], unique=False
    )
    op.create_index(op.f("ix_documents_id"), "documents", ["id"], unique=False)
    op.create_index("ix_documents_user_id", "documents", ["user_id"])
    op.create_index(
        op.f("ix_documents_conversation_id"), "documents", ["conversation_id"]
    )

    # ### Create document_chunks table ###
    op.create_table(
        "document_chunks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("chunk_text", sa.Text(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("vector_id", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["documents.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_document_chunk",
        "document_chunks",
        ["document_id", "chunk_index"],
        unique=False,
    )
    op.create_index(
        op.f("ix_document_chunks_document_id"),
        "document_chunks",
        ["document_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_document_chunks_id"), "document_chunks", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_document_chunks_vector_id"),
        "document_chunks",
        ["vector_id"],
        unique=False,
    )

    # ### Create messages table with chain_of_thought_steps and suggestions ###
    op.create_table(
        "messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("conversation_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("sources", sa.Text(), nullable=True),
        sa.Column("chain_of_thought_steps", sa.Text(), nullable=True),
        sa.Column("suggestions", sa.Text(), nullable=True),
        sa.Column("relevance_score", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["conversations.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_conversation_created",
        "messages",
        ["conversation_id", "created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_messages_conversation_id"),
        "messages",
        ["conversation_id"],
        unique=False,
    )
    op.create_index(op.f("ix_messages_id"), "messages", ["id"], unique=False)
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### Drop tables in reverse order (respecting foreign keys) ###
    # Drop messages first (depends on conversations)
    op.drop_index(op.f("ix_messages_id"), table_name="messages")
    op.drop_index(op.f("ix_messages_conversation_id"), table_name="messages")
    op.drop_index("idx_conversation_created", table_name="messages")
    op.drop_table("messages")

    # Drop document_chunks (depends on documents)
    op.drop_index(op.f("ix_document_chunks_vector_id"), table_name="document_chunks")
    op.drop_index(op.f("ix_document_chunks_id"), table_name="document_chunks")
    op.drop_index(op.f("ix_document_chunks_document_id"), table_name="document_chunks")
    op.drop_index("idx_document_chunk", table_name="document_chunks")
    op.drop_table("document_chunks")

    # Drop documents (depends on users and conversations)
    op.drop_index(op.f("ix_documents_conversation_id"), table_name="documents")
    op.drop_index("ix_documents_user_id", table_name="documents")
    op.drop_index(op.f("ix_documents_id"), table_name="documents")
    op.drop_index(op.f("ix_documents_category"), table_name="documents")
    op.drop_table("documents")

    # Drop conversations (depends on users)
    op.drop_index("ix_conversations_user_id", table_name="conversations")
    op.drop_index(op.f("ix_conversations_session_id"), table_name="conversations")
    op.drop_index(op.f("ix_conversations_id"), table_name="conversations")
    op.drop_table("conversations")

    # Drop users last
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_table("users")
    # ### end Alembic commands ###
