from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import require_admin
from ..database import get_session
from ..models import (
    ConversationMessage,
    Course,
    ExerciseAttempt,
    LearningSession,
    Student,
    utc_now,
)
from ..schemas import (
    CourseCreate,
    CourseRead,
    ExerciseAttemptCreate,
    ExerciseAttemptRead,
    LearningSessionCreate,
    LearningSessionEnd,
    LearningSessionRead,
    MessageCreate,
    MessageRead,
    Stage,
    StudentCreate,
    StudentRead,
    StudentUpdate,
)


router = APIRouter(
    prefix="/api/v1",
    dependencies=[Depends(require_admin)],
    tags=["learning"],
)


@router.post("/students", response_model=StudentRead, status_code=201)
async def create_student(
    request: StudentCreate, session: AsyncSession = Depends(get_session)
) -> StudentRead:
    student = Student(**request.model_dump())
    session.add(student)
    await session.commit()
    await session.refresh(student)
    return StudentRead.model_validate(student)


@router.get("/students", response_model=list[StudentRead])
async def list_students(
    stage: Stage | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
) -> list[StudentRead]:
    query = select(Student).order_by(Student.created_at.desc()).limit(limit)
    if stage is not None:
        query = query.where(Student.stage == stage)
    result = await session.scalars(query)
    return [StudentRead.model_validate(item) for item in result]


@router.get("/students/{student_id}", response_model=StudentRead)
async def get_student(
    student_id: str, session: AsyncSession = Depends(get_session)
) -> StudentRead:
    student = await session.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="student_not_found")
    return StudentRead.model_validate(student)


@router.patch("/students/{student_id}", response_model=StudentRead)
async def update_student(
    student_id: str,
    request: StudentUpdate,
    session: AsyncSession = Depends(get_session),
) -> StudentRead:
    student = await session.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="student_not_found")
    for key, value in request.model_dump(exclude_unset=True).items():
        setattr(student, key, value)
    student.updated_at = utc_now()
    await session.commit()
    await session.refresh(student)
    return StudentRead.model_validate(student)


@router.post("/courses", response_model=CourseRead, status_code=201)
async def create_course(
    request: CourseCreate, session: AsyncSession = Depends(get_session)
) -> CourseRead:
    course = Course(**request.model_dump())
    session.add(course)
    await session.commit()
    await session.refresh(course)
    return CourseRead.model_validate(course)


@router.get("/courses", response_model=list[CourseRead])
async def list_courses(
    stage: Stage | None = None,
    status: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
) -> list[CourseRead]:
    query = select(Course).order_by(Course.created_at.desc()).limit(limit)
    if stage is not None:
        query = query.where(Course.stage == stage)
    if status is not None:
        query = query.where(Course.status == status)
    result = await session.scalars(query)
    return [CourseRead.model_validate(item) for item in result]


@router.get("/courses/{course_id}", response_model=CourseRead)
async def get_course(
    course_id: str, session: AsyncSession = Depends(get_session)
) -> CourseRead:
    course = await session.get(Course, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="course_not_found")
    return CourseRead.model_validate(course)


@router.post("/learning-sessions", response_model=LearningSessionRead, status_code=201)
async def create_learning_session(
    request: LearningSessionCreate, session: AsyncSession = Depends(get_session)
) -> LearningSessionRead:
    student = await session.get(Student, request.student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="student_not_found")
    if request.course_id is not None:
        course = await session.get(Course, request.course_id)
        if course is None:
            raise HTTPException(status_code=404, detail="course_not_found")
        if course.stage != student.stage:
            raise HTTPException(status_code=409, detail="student_course_stage_mismatch")
    learning_session = LearningSession(**request.model_dump())
    session.add(learning_session)
    await session.commit()
    await session.refresh(learning_session)
    return LearningSessionRead.model_validate(learning_session)


@router.get("/learning-sessions", response_model=list[LearningSessionRead])
async def list_learning_sessions(
    student_id: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
) -> list[LearningSessionRead]:
    query = (
        select(LearningSession)
        .order_by(LearningSession.started_at.desc())
        .limit(limit)
    )
    if student_id is not None:
        query = query.where(LearningSession.student_id == student_id)
    result = await session.scalars(query)
    return [LearningSessionRead.model_validate(item) for item in result]


@router.get("/learning-sessions/{session_id}", response_model=LearningSessionRead)
async def get_learning_session(
    session_id: str, session: AsyncSession = Depends(get_session)
) -> LearningSessionRead:
    learning_session = await session.get(LearningSession, session_id)
    if learning_session is None:
        raise HTTPException(status_code=404, detail="learning_session_not_found")
    return LearningSessionRead.model_validate(learning_session)


@router.post("/learning-sessions/{session_id}/end", response_model=LearningSessionRead)
async def end_learning_session(
    session_id: str,
    request: LearningSessionEnd,
    session: AsyncSession = Depends(get_session),
) -> LearningSessionRead:
    learning_session = await session.get(LearningSession, session_id)
    if learning_session is None:
        raise HTTPException(status_code=404, detail="learning_session_not_found")
    if learning_session.state != "active":
        raise HTTPException(status_code=409, detail="learning_session_not_active")
    learning_session.state = request.state
    learning_session.ended_at = utc_now()
    await session.commit()
    await session.refresh(learning_session)
    return LearningSessionRead.model_validate(learning_session)


async def _active_learning_session(
    session: AsyncSession, session_id: str
) -> LearningSession:
    learning_session = await session.get(LearningSession, session_id)
    if learning_session is None:
        raise HTTPException(status_code=404, detail="learning_session_not_found")
    if learning_session.state != "active":
        raise HTTPException(status_code=409, detail="learning_session_not_active")
    return learning_session


@router.post(
    "/learning-sessions/{session_id}/messages",
    response_model=MessageRead,
    status_code=201,
)
async def create_message(
    session_id: str,
    request: MessageCreate,
    session: AsyncSession = Depends(get_session),
) -> MessageRead:
    await _active_learning_session(session, session_id)
    message = ConversationMessage(session_id=session_id, **request.model_dump())
    session.add(message)
    await session.commit()
    await session.refresh(message)
    return MessageRead.model_validate(message)


@router.get(
    "/learning-sessions/{session_id}/messages", response_model=list[MessageRead]
)
async def list_messages(
    session_id: str,
    limit: int = Query(default=200, ge=1, le=1000),
    session: AsyncSession = Depends(get_session),
) -> list[MessageRead]:
    if await session.get(LearningSession, session_id) is None:
        raise HTTPException(status_code=404, detail="learning_session_not_found")
    result = await session.scalars(
        select(ConversationMessage)
        .where(ConversationMessage.session_id == session_id)
        .order_by(ConversationMessage.created_at.asc())
        .limit(limit)
    )
    return [MessageRead.model_validate(item) for item in result]


@router.post(
    "/learning-sessions/{session_id}/attempts",
    response_model=ExerciseAttemptRead,
    status_code=201,
)
async def create_attempt(
    session_id: str,
    request: ExerciseAttemptCreate,
    session: AsyncSession = Depends(get_session),
) -> ExerciseAttemptRead:
    await _active_learning_session(session, session_id)
    attempt = ExerciseAttempt(session_id=session_id, **request.model_dump())
    session.add(attempt)
    await session.commit()
    await session.refresh(attempt)
    return ExerciseAttemptRead.model_validate(attempt)


@router.get(
    "/learning-sessions/{session_id}/attempts",
    response_model=list[ExerciseAttemptRead],
)
async def list_attempts(
    session_id: str,
    limit: int = Query(default=200, ge=1, le=1000),
    session: AsyncSession = Depends(get_session),
) -> list[ExerciseAttemptRead]:
    if await session.get(LearningSession, session_id) is None:
        raise HTTPException(status_code=404, detail="learning_session_not_found")
    result = await session.scalars(
        select(ExerciseAttempt)
        .where(ExerciseAttempt.session_id == session_id)
        .order_by(ExerciseAttempt.created_at.asc())
        .limit(limit)
    )
    return [ExerciseAttemptRead.model_validate(item) for item in result]
