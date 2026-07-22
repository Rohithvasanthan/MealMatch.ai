from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    headless: bool = True
    nav_timeout_ms: int = 20000


settings = Settings()
