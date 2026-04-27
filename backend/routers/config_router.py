from fastapi import APIRouter
from typing import Any
from backend.config import load_config, save_config, CONFIG_PATH

router = APIRouter()

@router.get("/config")
def get_config() -> dict[str, Any]:
    return load_config()

@router.post("/config")
def update_config(updates: dict[str, Any]) -> dict[str, Any]:
    cfg = load_config()
    cfg.update(updates)
    save_config(cfg)
    return cfg
