from contextlib import asynccontextmanager

from fastapi import FastAPI
from playwright.async_api import Browser, Playwright, async_playwright

from app.core.config import settings

playwright_instance: Playwright | None = None
browser: Browser | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global playwright_instance, browser
    playwright_instance = await async_playwright().start()
    browser = await playwright_instance.chromium.launch(headless=settings.headless)
    yield
    await browser.close()
    await playwright_instance.stop()


app = FastAPI(title="MealMatch AI Scraper", lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "ok", "browser_ready": browser is not None and browser.is_connected()}
