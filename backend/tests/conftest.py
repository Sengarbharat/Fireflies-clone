import os
import tempfile
from pathlib import Path

import pytest

# Point the app at a throwaway database before it is imported.
_TMP = Path(tempfile.mkdtemp())
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP / 'test.db'}"
os.environ["SEED_ON_STARTUP"] = "true"
os.environ["ANTHROPIC_API_KEY"] = ""

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


SAMPLES = Path(__file__).resolve().parents[2] / "samples"
