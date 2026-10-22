"""Routes for the Threat Map Desktop page under /api/plugins/hermes-threatmap/.

Every answer is HTTP 200 JSON, ``{"ok": true, ...}`` or ``{"ok": false, "error": ...}``, so the page
handles failures in one place. Handlers are plain ``def``: FastAPI runs them in its threadpool, so
the blocking Check Point lookups stay off the event loop.
"""

import importlib
import importlib.util
import sys
from pathlib import Path

from fastapi import APIRouter

# Load the plugin package under a private name: the agent loader's module name is its own business.
_ROOT = Path(__file__).resolve().parents[1]
_NAME = "_hermes_threatmap_http"
if _NAME not in sys.modules:
    _spec = importlib.util.spec_from_file_location(_NAME, _ROOT / "__init__.py", submodule_search_locations=[str(_ROOT)])
    _module = importlib.util.module_from_spec(_spec)
    sys.modules[_NAME] = _module
    _spec.loader.exec_module(_module)
feed = importlib.import_module(_NAME + ".threatmap.feed")
checkpoint = importlib.import_module(_NAME + ".threatmap.checkpoint")

router = APIRouter()
hub = feed.FeedHub(checkpoint.open_feed)


def _answer(work):
    try:
        return {"ok": True, **work()}
    except feed.UpstreamError as exc:
        return {"ok": False, "error": str(exc), "status": exc.status}


@router.get("/events")
def events(after: int = 0, limit: int = 500):
    """Poll for attacks newer than ``after``. Polling is what keeps the upstream stream open."""
    return _answer(lambda: hub.poll(after, limit))


@router.get("/status")
def status():
    return _answer(hub.status)


@router.post("/stop")
def stop():
    hub.stop()
    return _answer(hub.status)


@router.get("/country/{code}")
def country(code: str):
    return _answer(lambda: checkpoint.country(code))


@router.get("/top")
def top():
    return _answer(checkpoint.top_stats)
