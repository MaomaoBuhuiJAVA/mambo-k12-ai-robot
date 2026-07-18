"""Add deadlines to device commands.

Revision ID: 8f3c6e5d1a2b
Revises: e15f68546fe0
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "8f3c6e5d1a2b"
down_revision = "e15f68546fe0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "device_commands",
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        op.execute(
            sa.text(
                "UPDATE device_commands "
                "SET expires_at = datetime(created_at, '+30 seconds') "
                "WHERE expires_at IS NULL"
            )
        )
    else:
        op.execute(
            sa.text(
                "UPDATE device_commands "
                "SET expires_at = created_at + INTERVAL '30 seconds' "
                "WHERE expires_at IS NULL"
            )
        )
    with op.batch_alter_table("device_commands") as batch_op:
        batch_op.alter_column("expires_at", nullable=False)
        batch_op.create_index(
            "ix_device_commands_expires_at", ["expires_at"], unique=False
        )


def downgrade() -> None:
    with op.batch_alter_table("device_commands") as batch_op:
        batch_op.drop_index("ix_device_commands_expires_at")
        batch_op.drop_column("expires_at")
