import logging
from fastapi import APIRouter
from backend.database import get_db
from backend.config import load_config
from backend.services.auto_publish import publish_proposal, run_auto_publish_cycle

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/publish/proposal/{proposal_id}")
def publish_one(proposal_id: int):
    return publish_proposal(get_db(), proposal_id, load_config())


@router.post("/publish/run-cycle")
def run_cycle():
    return run_auto_publish_cycle(get_db(), load_config())
