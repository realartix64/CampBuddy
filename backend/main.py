
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from vision import classify_plant
from llm import generate_response
from rag import ask_rag

app = FastAPI(title="CampBuddy API")

# Allow the local React frontend to contact FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"]
)

BASE_DIR = Path(__file__).resolve().parent


class ChatRequest(BaseModel):
    question: str
    plant_candidates: list[dict] = Field(
        default_factory=list
    )


@app.get("/")
def home():
    return {"message": "CampBuddy API running"}


# PIPELINE 1 + 3: Llama and contextual questions
@app.post("/api/chat")
def chat(request: ChatRequest):
    question = request.question.strip()

    if not question:
        raise HTTPException(400, "Question cannot be empty")

    # If a plant was scanned, include its candidates
    if request.plant_candidates:
        candidates = request.plant_candidates[:5]

        plant_context = "\n".join(
            f"{i+1}. {c.get('species', 'Unknown')}"
            f" (model score: {c.get('score', 0):.2%})"
            for i, c in enumerate(candidates)
        )

        question = f"""
A plant classifier previously analyzed a photograph.

Candidate species:
{plant_context}

These are unverified predictions, NOT confirmed
species identifications. Scores are not calibrated
probabilities of botanical correctness.

The user asks:
{question}

Discuss the candidate plant(s) as possibilities.
If the question refers to "this plant", use the
top candidate provisionally while acknowledging
the identification is uncertain.

Do not claim to have viewed the image yourself.
Do not recommend consuming or handling unknown
plants based on these predictions.
"""

    # Use RAG when a local database exists
    if (BASE_DIR / "chroma_db").exists():
        result = ask_rag(question)
        return result

    # Otherwise use general Llama knowledge
    answer = generate_response(question)

    return {
        "answer": answer,
        "reference_status": "General model knowledge only",
        "used_references": False,
        "sources": []
    }


# PIPELINE 2: MobileNetV3 classification
@app.post("/api/classify")
def classify(file: UploadFile = File(...)):

    if not file.content_type or not (
        file.content_type.startswith("image/")
    ):
        raise HTTPException(
            status_code=400,
            detail="Please upload an image"
        )

    # Limit uploaded image size to 10 MB
    contents = file.file.read(10 * 1024 * 1024 + 1)

    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="Image is too large"
        )

    try:
        result = classify_plant(contents)
        return result

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=f"Classification failed: {error}"
        )
