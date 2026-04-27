import sys
import os
import threading
import webbrowser
import time


def _open_browser(port: int) -> None:
    time.sleep(2.5)
    webbrowser.open(f"http://127.0.0.1:{port}")


def main() -> None:
    import uvicorn
    from backend.app_paths import get_base_dir

    port = int(os.environ.get("CM_PORT", "8765"))

    if getattr(sys, "frozen", False):
        bundle_dir = str(get_base_dir())
        if bundle_dir not in sys.path:
            sys.path.insert(0, bundle_dir)

    threading.Thread(target=_open_browser, args=(port,), daemon=True).start()

    uvicorn.run(
        "backend.main:app",
        host="127.0.0.1",
        port=port,
        log_level="warning",
    )


if __name__ == "__main__":
    main()
