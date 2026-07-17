FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY server/requirements.txt /app/server/requirements.txt
RUN pip install --no-cache-dir -r /app/server/requirements.txt

COPY server /app/server
COPY alembic.ini /app/alembic.ini
RUN chmod +x /app/server/entrypoint.sh
EXPOSE 8000
ENTRYPOINT ["/app/server/entrypoint.sh"]
