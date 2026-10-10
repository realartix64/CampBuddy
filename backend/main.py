from fastapi import FastAPI

app = FastAPI() 

@app.get("/")
def home():
    return {"message": "Offline HikeBuddy API running"}