from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


Stage = Literal["lower_primary", "upper_primary", "middle_school", "high_school"]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class DeviceRead(ORMModel):
    device_id: str
    online: bool
    first_seen_at: datetime
    last_seen_at: datetime
    connected_at: datetime | None
    disconnected_at: datetime | None
    agent_version: str | None
    platform: str | None
    capabilities: list[str]
    hardware: dict[str, Any]
    latest_status: dict[str, Any]


class DeviceStatusRead(ORMModel):
    id: int
    device_id: str
    recorded_at: datetime
    payload: dict[str, Any]


class StudentCreate(BaseModel):
    display_name: str = Field(min_length=1, max_length=80)
    stage: Stage
    interests: list[str] = Field(default_factory=list, max_length=20)


class StudentUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=80)
    stage: Stage | None = None
    interests: list[str] | None = Field(default=None, max_length=20)


class StudentRead(ORMModel):
    student_id: str
    display_name: str
    stage: Stage
    interests: list[str]
    created_at: datetime
    updated_at: datetime


class CourseCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    stage: Stage
    description: str = Field(default="", max_length=5000)
    status: Literal["draft", "published", "archived"] = "draft"
    course_data: dict[str, Any] = Field(default_factory=dict)


class CourseRead(ORMModel):
    course_id: str
    title: str
    stage: Stage
    description: str
    status: Literal["draft", "published", "archived"]
    course_data: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class LearningSessionCreate(BaseModel):
    student_id: str
    course_id: str | None = None


class LearningSessionRead(ORMModel):
    session_id: str
    student_id: str
    course_id: str | None
    state: Literal["active", "completed", "abandoned"]
    started_at: datetime
    ended_at: datetime | None


class LearningSessionEnd(BaseModel):
    state: Literal["completed", "abandoned"] = "completed"


class MessageCreate(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1, max_length=20_000)
    modality_data: dict[str, Any] = Field(default_factory=dict)


class MessageRead(ORMModel):
    message_id: str
    session_id: str
    role: Literal["system", "user", "assistant"]
    content: str
    modality_data: dict[str, Any]
    created_at: datetime


class ExerciseAttemptCreate(BaseModel):
    knowledge_point: str = Field(min_length=1, max_length=160)
    question_data: dict[str, Any]
    answer_data: dict[str, Any]
    correct: bool | None = None
    score: float | None = Field(default=None, ge=0, le=1)
    feedback: str = Field(default="", max_length=5000)


class ExerciseAttemptRead(ORMModel):
    attempt_id: str
    session_id: str
    knowledge_point: str
    question_data: dict[str, Any]
    answer_data: dict[str, Any]
    correct: bool | None
    score: float | None
    feedback: str
    created_at: datetime
