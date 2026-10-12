from langchain_ollama import ChatOllama

llm = ChatOllama(
    model="llama3.2:3b",
    temperature=0.2,
    num_ctx=4096
)


class GenerationCancelled(Exception):
    """Raised when the client cancels a response mid-generation."""


def generate_response(prompt, cancel_event=None):
    # Stream tokens so we can stop between chunks. Closing the stream
    # drops the connection to Ollama, which stops generation on the GPU/CPU.
    stream = llm.stream(prompt)
    parts = []

    try:
        for chunk in stream:
            if cancel_event is not None and cancel_event.is_set():
                raise GenerationCancelled()
            parts.append(chunk.content)
    finally:
        stream.close()

    return "".join(parts)
