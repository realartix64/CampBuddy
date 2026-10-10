
from fastapi import FastAPI

app = FastAPI(title="CampBuddy API")

@app.get("/")
def home():
    return {"message": "Offline CampBuddy API running"}
