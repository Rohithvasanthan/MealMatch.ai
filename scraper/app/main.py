from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from playwright.async_api import async_playwright

from app.api import router
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.playwright = await async_playwright().start()
    app.state.browser = await app.state.playwright.chromium.launch(headless=settings.headless)
    yield
    await app.state.browser.close()
    await app.state.playwright.stop()


app = FastAPI(title="MealMatch AI Scraper", lifespan=lifespan)
app.include_router(router)


@app.get("/health")
async def health(request: Request):
    browser = getattr(request.app.state, "browser", None)
    return {"status": "ok", "browser_ready": browser is not None and browser.is_connected()}
