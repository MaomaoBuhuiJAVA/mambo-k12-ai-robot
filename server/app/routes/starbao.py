from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import require_admin
from ..database import get_session
from ..models import StarbaoConversation, StarbaoMessage
from ..schemas import (
    StarbaoConversationRead,
    StarbaoMessageCreate,
    StarbaoMessageListRead,
    StarbaoMessageRead,
    StarbaoSettingsUpdate,
)


DEVICE_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{3,64}$")

router = APIRouter(
    prefix="/api/v1/starbao",
    dependencies=[Depends(require_admin)],
    tags=["starbao"],
)


def _validate_device_id(device_id: str) -> None:
    if not DEVICE_ID_PATTERN.fullmatch(device_id):
        raise HTTPException(status_code=422, detail="invalid_device_id")


async def _get_or_create_conversation(
    session: AsyncSession, device_id: str
) -> StarbaoConversation:
    conversation = await session.scalar(
        select(StarbaoConversation).where(StarbaoConversation.device_id == device_id)
    )
    if conversation is None:
        conversation = StarbaoConversation(device_id=device_id)
        session.add(conversation)
        await session.commit()
        await session.refresh(conversation)
    return conversation


@router.get("/conversations/{device_id}", response_model=StarbaoConversationRead)
async def get_or_create_conversation(
    device_id: str, session: AsyncSession = Depends(get_session)
) -> StarbaoConversationRead:
    _validate_device_id(device_id)
    conversation = await _get_or_create_conversation(session, device_id)
    return StarbaoConversationRead.model_validate(conversation)


@router.patch(
    "/conversations/{device_id}/settings", response_model=StarbaoConversationRead
)
async def update_conversation_settings(
    device_id: str,
    request: StarbaoSettingsUpdate,
    session: AsyncSession = Depends(get_session),
) -> StarbaoConversationRead:
    _validate_device_id(device_id)
    conversation = await _get_or_create_conversation(session, device_id)
    conversation.speak_on_orangepi = request.speak_on_orangepi
    await session.commit()
    await session.refresh(conversation)
    return StarbaoConversationRead.model_validate(conversation)


@router.get(
    "/conversations/{device_id}/messages", response_model=StarbaoMessageListRead
)
async def list_messages(
    device_id: str,
    after: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
) -> StarbaoMessageListRead:
    _validate_device_id(device_id)
    conversation = await _get_or_create_conversation(session, device_id)
    result = await session.scalars(
        select(StarbaoMessage)
        .where(
            StarbaoMessage.conversation_id == conversation.conversation_id,
            StarbaoMessage.sequence > after,
        )
        .order_by(StarbaoMessage.sequence.asc())
        .limit(limit)
    )
    return StarbaoMessageListRead(
        messages=[StarbaoMessageRead.model_validate(item) for item in result],
        latest_sequence=conversation.latest_sequence,
    )


@router.post(
    "/conversations/{device_id}/messages", response_model=StarbaoMessageRead
)
async def append_message(
    device_id: str,
    request: StarbaoMessageCreate,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> StarbaoMessageRead:
    _validate_device_id(device_id)
    conversation = await _get_or_create_conversation(session, device_id)
    existing = await session.scalar(
        select(StarbaoMessage).where(
            StarbaoMessage.conversation_id == conversation.conversation_id,
            StarbaoMessage.client_message_id == request.client_message_id,
        )
    )
    if existing is not None:
        return StarbaoMessageRead.model_validate(existing)

    locked_conversation = await session.scalar(
        select(StarbaoConversation)
        .where(StarbaoConversation.conversation_id == conversation.conversation_id)
        .with_for_update()
    )
    if locked_conversation is None:
        raise HTTPException(status_code=404, detail="conversation_not_found")

    existing = await session.scalar(
        select(StarbaoMessage).where(
            StarbaoMessage.conversation_id == locked_conversation.conversation_id,
            StarbaoMessage.client_message_id == request.client_message_id,
        )
    )
    if existing is not None:
        return StarbaoMessageRead.model_validate(existing)

    locked_conversation.latest_sequence += 1
    message = StarbaoMessage(
        conversation_id=locked_conversation.conversation_id,
        sequence=locked_conversation.latest_sequence,
        **request.model_dump(),
    )
    session.add(message)
    await session.commit()
    await session.refresh(message)
    response.status_code = 201
    return StarbaoMessageRead.model_validate(message)
