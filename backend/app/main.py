"""FastAPI application entry point: `uvicorn app.main:app --reload`."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import init_db
from .routers import meetings, resources
from .services import llm


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    if settings.seed_on_startup:
        from .seed.loader import seed_if_empty

        seed_if_empty()
    else:
        init_db()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Fireflies Clone API",
        version="1.0.0",
        description="Meetings, transcripts, AI notes and action items.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        # Vercel preview deployments get unique subdomains.
        allow_origin_regex=r"https://.*\.vercel\.app",
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(meetings.router)
    app.include_router(resources.router)

    @app.get("/api/health", tags=["workspace"])
    def health():
        return {"status": "ok", "llm": "anthropic" if llm.is_enabled() else "rules"}

    return app


app = create_app()
