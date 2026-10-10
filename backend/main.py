import urllib.request
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from rag import ask_rag, DB_DIR

app = FastAPI(title="CampBuddy API")


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)


@app.get("/")
def home():
    return {"message": "Offline CampBuddy API running"}


@app.post("/api/ask")
def ask(req: AskRequest):  # plain def on purpose: runs in a thread pool
    try:
        return ask_rag(req.question.strip())
    except RuntimeError as e:        # e.g. ChromaDB not built
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:           # e.g. Ollama not running
        raise HTTPException(status_code=502, detail=f"Model error: {e}")


@app.get("/api/health")
def health():
    try:
        urllib.request.urlopen("http://localhost:11434", timeout=2)
        ollama = True
    except Exception:
        ollama = False
    return {"ollama": ollama, "vector_store": DB_DIR.exists()}