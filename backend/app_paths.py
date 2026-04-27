import sys
import os
from pathlib import Path


def get_base_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS)
    return Path(__file__).parent.parent


def get_user_data_dir() -> Path:
    env = os.environ.get("CM_USER_DATA_DIR")
    if env:
        p = Path(env)
    elif sys.platform == "darwin":
        p = Path.home() / "Library" / "Application Support" / "CM Pro"
    elif sys.platform == "win32":
        p = Path(os.environ.get("APPDATA", str(Path.home()))) / "CM Pro"
    else:
        p = Path.home() / ".cm_pro"
    p.mkdir(parents=True, exist_ok=True)
    return p


def get_frontend_dist() -> Path:
    env = os.environ.get("CM_FRONTEND_DIST")
    if env:
        return Path(env)
    return get_base_dir() / "frontend" / "dist"
