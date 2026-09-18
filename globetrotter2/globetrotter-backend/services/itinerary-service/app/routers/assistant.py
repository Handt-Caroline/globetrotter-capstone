# =============================================================================
# routers/assistant.py
#
# POST /assistant/ask  -> { question: "..." }  ->  { answer, matches, source }
#
# Public, like browsing destinations - no login needed to ask a question,
# same reasoning as GET /destinations. See app/assistant.py for what
# actually answers the question (a free, keyword-based search over this
# service's own destination data - explicitly NOT a paid/generative AI).
# =============================================================================

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.assistant import answer_question
from app.storage import read_db

router = APIRouter(prefix="/assistant", tags=["assistant"])


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)


@router.post("/ask")
def ask(payload: AskRequest):
    db = read_db()
    return answer_question(payload.question, db["destinations"])
