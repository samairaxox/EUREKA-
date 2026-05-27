from langgraph.graph import StateGraph, END
from typing import TypedDict, Optional, Any
from quiz_agent import quiz_agent
from flashcard_agent import flashcard_agent

class StudyState(TypedDict):
    user_input: str
    topic: str
    agent_type: str
    result: Optional[Any]
    num_questions: Optional[int]
    num_cards: Optional[int]

def route_agent(state: StudyState) -> StudyState:
    user_input = state["user_input"].lower().strip()
    if "quiz" in user_input:
        return {**state, "agent_type": "quiz"}
    elif "flash" in user_input:
        return {**state, "agent_type": "flashcard"}
    else:
        return {**state, "agent_type": "quiz"}

def run_quiz(state: StudyState) -> StudyState:
    num_q = state.get("num_questions") or 5
    result = quiz_agent(state["topic"], num_questions=num_q)
    return {**state, "result": result}

def run_flashcard(state: StudyState) -> StudyState:
    num_c = state.get("num_cards") or 10
    result = flashcard_agent(state["topic"], num_cards=num_c)
    return {**state, "result": result}

def decide_agent(state: StudyState) -> str:
    return state["agent_type"]

builder = StateGraph(StudyState)
builder.add_node("router", route_agent)
builder.add_node("quiz", run_quiz)
builder.add_node("flashcard", run_flashcard)
builder.set_entry_point("router")
builder.add_conditional_edges("router", decide_agent, {
    "quiz": "quiz",
    "flashcard": "flashcard"
})
builder.add_edge("quiz", END)
builder.add_edge("flashcard", END)

app_graph = builder.compile()