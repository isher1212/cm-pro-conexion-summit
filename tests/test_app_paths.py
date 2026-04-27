import os
import sys
from pathlib import Path


def test_get_user_data_dir_creates_directory(tmp_path, monkeypatch):
    monkeypatch.setenv("CM_USER_DATA_DIR", str(tmp_path / "cm_test"))
    import importlib
    import backend.app_paths as ap
    importlib.reload(ap)
    d = ap.get_user_data_dir()
    assert d.exists()
    assert d.is_dir()


def test_get_user_data_dir_env_override(tmp_path, monkeypatch):
    monkeypatch.setenv("CM_USER_DATA_DIR", str(tmp_path / "override"))
    import importlib
    import backend.app_paths as ap
    importlib.reload(ap)
    d = ap.get_user_data_dir()
    assert "override" in str(d)


def test_get_frontend_dist_env_override(tmp_path, monkeypatch):
    monkeypatch.setenv("CM_FRONTEND_DIST", str(tmp_path / "dist"))
    import importlib
    import backend.app_paths as ap
    importlib.reload(ap)
    p = ap.get_frontend_dist()
    assert "dist" in str(p)


def test_get_frontend_dist_default_is_path():
    import importlib
    import backend.app_paths as ap
    importlib.reload(ap)
    p = ap.get_frontend_dist()
    assert isinstance(p, Path)


def test_get_base_dir_is_path():
    import backend.app_paths as ap
    b = ap.get_base_dir()
    assert isinstance(b, Path)
    assert b.exists()


def test_run_module_importable():
    import ast
    import pathlib
    src = (pathlib.Path(__file__).parent.parent / "run.py").read_text()
    ast.parse(src)
