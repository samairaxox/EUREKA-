# quick test — paste into a test.py file and run it
from rag_engine import build_vectorstore, rag_query

with open("Round2_Evaluation_Rubrics.pdf", "rb") as f:
    vs = build_vectorstore(f.read())

import sys
sys.stdout.reconfigure(encoding='utf-8')
print(rag_query(vs, "Summarize the main points"))