# cm_pro.spec
import sys
from pathlib import Path
from PyInstaller.utils.hooks import collect_all

block_cipher = None

datas = [
    ("frontend/dist", "frontend/dist"),
]
binaries = []
hiddenimports = [
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.loops.asyncio",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.http.h11_impl",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "uvicorn.lifespan.off",
    "email.mime.multipart",
    "email.mime.text",
    "email.mime.base",
    "apscheduler.schedulers.background",
    "apscheduler.executors.pool",
    "apscheduler.jobstores.sqlalchemy",
    "pytrends",
    "feedparser",
    "multipart",
    "python_multipart",
    "backend.routers.health_router",
    "backend.routers.config_router",
    "backend.routers.intelligence_router",
    "backend.routers.trends_router",
    "backend.routers.analytics_router",
    "backend.routers.planner_router",
    "backend.routers.reports_router",
    "backend.routers.image_router",
    "backend.routers.saved_router",
    "backend.routers.library_router",
    "backend.services.image_gen",
    "backend.services.intelligence",
    "backend.services.trends",
    "backend.services.analytics",
    "backend.services.planner",
    "backend.services.reports",
    "backend.app_paths",
    "backend.config",
    "backend.database",
    "backend.scheduler",
    "backend.main",
]

for pkg in ("fastapi", "starlette", "pydantic", "pydantic_core", "httpx", "anyio"):
    tmp_d, tmp_b, tmp_h = collect_all(pkg)
    datas += tmp_d
    binaries += tmp_b
    hiddenimports += tmp_h

a = Analysis(
    ["run.py"],
    pathex=[str(Path(".").resolve())],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter", "matplotlib", "numpy", "pandas"],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

if sys.platform == "win32":
    exe = EXE(
        pyz,
        a.scripts,
        a.binaries,
        a.zipfiles,
        a.datas,
        [],
        name="CM Pro",
        debug=False,
        bootloader_ignore_signals=False,
        strip=False,
        upx=True,
        upx_exclude=[],
        runtime_tmpdir=None,
        console=False,
        disable_windowed_traceback=False,
        argv_emulation=False,
        target_arch=None,
        codesign_identity=None,
        entitlements_file=None,
        icon=None,
    )
else:
    exe = EXE(
        pyz,
        a.scripts,
        [],
        exclude_binaries=True,
        name="CM Pro",
        debug=False,
        bootloader_ignore_signals=False,
        strip=False,
        upx=True,
        console=False,
        argv_emulation=False,
        target_arch=None,
        codesign_identity=None,
        entitlements_file=None,
        icon=None,
    )
    coll = COLLECT(
        exe,
        a.binaries,
        a.zipfiles,
        a.datas,
        strip=False,
        upx=True,
        upx_exclude=[],
        name="CM Pro",
    )
    app = BUNDLE(
        coll,
        name="CM Pro.app",
        icon=None,
        bundle_identifier="com.conexionsummit.cmpro",
        version="1.0.0",
    )
