from langchain_community.document_loaders import PyMuPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from dotenv import load_dotenv
import tempfile, os

load_dotenv()

embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
llm = ChatGroq(model="openai/gpt-oss-20b", temperature=0.5, groq_api_key=os.getenv("GROQ_API_KEY"))

def build_vectorstore(pdf_bytes: bytes):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as f:
        f.write(pdf_bytes)
        tmp_path = f.name
    loader = PyMuPDFLoader(tmp_path)
    docs = loader.load()
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    chunks = splitter.split_documents(docs)
    os.unlink(tmp_path)
    vectorstore = FAISS.from_documents(chunks, embeddings)
    return vectorstore

def rag_query(vectorstore, prompt: str) -> str:
    retriever = vectorstore.as_retriever(search_kwargs={"k": 4})
    docs = retriever.invoke(prompt)
    context = "\n\n".join([d.page_content for d in docs])
    full_prompt = f"Based on this content:\n\n{context}\n\n{prompt}"
    result = llm.invoke(full_prompt)
    return result.content