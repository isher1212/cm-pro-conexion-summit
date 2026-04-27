from apscheduler.schedulers.background import BackgroundScheduler

_scheduler: BackgroundScheduler | None = None

def get_scheduler() -> BackgroundScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = BackgroundScheduler(timezone="America/Bogota")
    return _scheduler

def start_scheduler():
    scheduler = get_scheduler()
    if not scheduler.running:
        scheduler.start()

def stop_scheduler():
    scheduler = get_scheduler()
    if scheduler.running:
        scheduler.shutdown(wait=False)
