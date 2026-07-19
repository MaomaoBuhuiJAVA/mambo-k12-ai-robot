from server.app.config import _normalize_database_url


def test_normalize_database_url_uses_asyncpg_for_railway_postgres() -> None:
    assert (
        _normalize_database_url("postgresql://user:password@postgres.railway.internal:5432/railway")
        == "postgresql+asyncpg://user:password@postgres.railway.internal:5432/railway"
    )
