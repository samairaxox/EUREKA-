"""Shared in-process gate for calls that use the same Groq API key."""
import os
import threading
from dotenv import load_dotenv

load_dotenv()

MAX_CONCURRENT_REQUESTS = max(1, int(os.getenv("GROQ_MAX_CONCURRENT_REQUESTS", "1")))
LLM_GATE = threading.BoundedSemaphore(MAX_CONCURRENT_REQUESTS)
