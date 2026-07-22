# Playwright's official image ships Chromium plus every OS-level dependency
# it needs (fonts, codecs, etc.) already installed and version-matched to the
# `playwright` pip package below — this is what makes Playwright reliable on
# a platform like Render, where hand-installing browser deps via apt is the
# single most common cause of scraper deployments failing in production.
FROM mcr.microsoft.com/playwright/python:v1.61.0-jammy

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

ENV HOST=0.0.0.0
ENV HEADLESS=true
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

# Render (and most PaaS providers) inject $PORT at runtime and expect the
# service to bind to it — shell form so that expansion actually happens.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
