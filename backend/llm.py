
from langchain_ollama import ChatOllama

llm = ChatOllama(
    model="llama3.2:3b",
    temperature=0.2,
    num_ctx=4096
)

def generate_response(prompt):
    response = llm.invoke(prompt)
    return response.content
