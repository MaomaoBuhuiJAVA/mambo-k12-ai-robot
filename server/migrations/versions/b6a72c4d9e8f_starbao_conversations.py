"""Add shared Starbao conversations.

Revision ID: b6a72c4d9e8f
Revises: 9a4d7e2c1b6f
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "b6a72c4d9e8f"
down_revision = "9a4d7e2c1b6f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "starbao_conversations",
        sa.Column("conversation_id", sa.String(length=36), nullable=False),
        sa.Column("device_id", sa.String(length=64), nullable=False),
        sa.Column("speak_on_orangepi", sa.Boolean(), nullable=False),
        sa.Column("latest_sequence", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("conversation_id"),
    )
    op.create_index(
        "ix_starbao_conversations_device_id",
        "starbao_conversations",
        ["device_id"],
        unique=True,
    )
    op.create_table(
        "starbao_messages",
        sa.Column("message_id", sa.String(length=36), nullable=False),
        sa.Column("conversation_id", sa.String(length=36), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("client_message_id", sa.String(length=128), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("origin", sa.String(length=16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("reply_to_message_id", sa.String(length=36), nullable=True),
        sa.Column("announce_on_orangepi", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["starbao_conversations.conversation_id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("message_id"),
        sa.UniqueConstraint(
            "conversation_id",
            "sequence",
            name="uq_starbao_messages_conversation_sequence",
        ),
        sa.UniqueConstraint(
            "conversation_id",
            "client_message_id",
            name="uq_starbao_messages_conversation_client_message",
        ),
    )
    op.create_index(
        "ix_starbao_messages_conversation_sequence",
        "starbao_messages",
        ["conversation_id", "sequence"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_starbao_messages_conversation_sequence", table_name="starbao_messages"
    )
    op.drop_table("starbao_messages")
    op.drop_index(
        "ix_starbao_conversations_device_id", table_name="starbao_conversations"
    )
    op.drop_table("starbao_conversations")
