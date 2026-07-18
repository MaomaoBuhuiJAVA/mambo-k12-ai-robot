"""Persist device hardware capability details.

Revision ID: 9a4d7e2c1b6f
Revises: 8f3c6e5d1a2b
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "9a4d7e2c1b6f"
down_revision = "8f3c6e5d1a2b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "devices",
        sa.Column(
            "hardware",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
    )


def downgrade() -> None:
    op.drop_column("devices", "hardware")
