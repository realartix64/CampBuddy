# CampBuddy — Offline AI Wilderness Assistant

CampBuddy is an offline, AI-powered wilderness assistant designed to provide hikers, campers, and outdoor enthusiasts with access to useful information in environments without internet or cellular connectivity.

The application transforms a laptop into a local AI server, allowing nearby devices, such as smartphones, to connect through a local Wi-Fi network and interact with AI models without relying on cloud-based services.

## Key Features (Planned)

- **Offline AI Chatbot:** Answer questions about hiking, camping, wilderness survival, and outdoor equipment using locally hosted large language models.
- **Computer Vision:** Analyze uploaded images of plants, wildlife, and other outdoor subjects using a local vision model.
- **Retrieval-Augmented Generation (RAG):** Retrieve relevant information from locally stored survival manuals, first-aid guides, and regional hiking documents.
- **Cross-Device Accessibility:** Access the application through a smartphone browser connected to the laptop's local Wi-Fi network.
- **Privacy-Focused Architecture:** Keep AI inference and document processing on local hardware without requiring external API services.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS |
| Backend | Python, FastAPI |
| Local AI Inference | Ollama |
| Language Model | Llama 3.2 3B |
| Vision Model | Moondream |
| RAG Framework | LangChain |
| Vector Database | ChromaDB |
| Local Storage | SQLite (optional) |
| Networking | Local Wi-Fi hotspot |

## System Architecture

The application follows a client-server architecture:

1. A laptop hosts the React frontend, FastAPI backend, and local AI models.
2. A smartphone connects to the laptop through a local Wi-Fi network.
3. The user submits questions or images through the web interface.
4. FastAPI processes requests and communicates with the appropriate local AI model.
5. When applicable, the RAG pipeline retrieves supporting information from locally stored documents.
6. The generated response is returned to the user's smartphone.

All application processing is designed to operate without an active internet connection.

## Development Status

**Status: In Development**

The project is currently in its initial development stage. Frontend and backend setup, local AI integration, document retrieval, and image analysis are being developed incrementally.

## Project Goals

- Develop an accessible, offline-first AI assistant for outdoor environments.
- Integrate locally hosted language and vision models into a unified web application.
- Implement document retrieval to improve the relevance and traceability of AI-generated responses.
- Demonstrate communication between mobile clients and a local AI server without internet connectivity.

## Safety Disclaimer

CampBuddy is intended as an informational assistant and is not a substitute for professional medical advice, emergency services, certified wilderness training, or official navigation resources. AI-generated responses and image classifications may be inaccurate and should not be relied upon for critical safety decisions.

## License

License to be determined.