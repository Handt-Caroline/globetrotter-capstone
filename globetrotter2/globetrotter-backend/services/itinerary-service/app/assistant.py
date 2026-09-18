# =============================================================================
# assistant.py  -  THE FREE, SELF-HOSTED "AI" ASSISTANT
#
# WHAT THIS IS, HONESTLY
# ------------------------
# This is NOT a large language model. It does not generate text. It does
# not call any external API, and it never needs a billing-enabled API key
# - a deliberate choice, because paid dependencies that later demand
# billing (Google Maps, CARTO map tiles) have burned this project before.
#
# What it actually does is closer to a smart, on-site search engine:
#   1. Break the traveller's question into keywords.
#   2. Score every REAL destination in this service's own catalogue by how
#      well its name/category/neighbourhood/description/history/tips match
#      those keywords.
#   3. For the single best match, guess WHICH part of the answer they
#      want (history? directions? tips? price?) from words in the
#      question, and quote that real text back - it never invents a
#      sentence that isn't already sitting in seed.py/translations_fr.py.
#   4. If nothing scores well enough to be one clear answer, fall back to
#      listing the best-matching places instead of pretending to know.
#
# This is genuinely useful (it answers "tell me about X", "how do I get to
# X", "what's a cheap place for food nearby" using REAL app data) without
# ever risking a surprise bill. It is also honest about its own limits: it
# can't hold a multi-turn conversation, doesn't understand grammar, and
# will occasionally match the wrong place on an ambiguous question - the
# API response always says "source": "keyword-search" so nothing pretends
# to be smarter than it is.
# =============================================================================

import re

_STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "to", "of",
    "in", "on", "at", "for", "and", "or", "but", "with", "about", "near",
    "me", "my", "i", "you", "your", "it", "this", "that", "what", "where",
    "when", "how", "who", "can", "do", "does", "tell", "please", "some",
    "any", "there", "here", "want", "would", "like", "get", "go", "going",
}

# Which question-words steer the answer toward which destination field.
# Checked in this order - the first list whose words appear in the
# question wins.
_INTENT_FIELDS = [
    ("history", {"history", "historical", "story", "built", "founded", "who", "when", "year", "old"}),
    ("getting_there", {"reach", "directions", "transport", "taxi", "drive", "walk", "arrive", "getting"}),
    ("tips", {"tips", "advice", "avoid", "warn", "warning", "should", "recommend"}),
    ("what_to_expect", {"expect", "see", "do", "activities", "inside"}),
    ("price_range", {"cost", "price", "expensive", "cheap", "fcfa", "money", "budget", "free"}),
]

_FIELD_LABELS = {
    "history": "the history",
    "getting_there": "getting there",
    "tips": "some tips",
    "what_to_expect": "what to expect",
    "price_range": "the price",
}


def _tokenize(text: str) -> list[str]:
    words = re.findall(r"[a-zà-ÿ0-9]+", text.lower())
    return [w for w in words if w not in _STOPWORDS and len(w) > 1]


def _score(question_tokens: set[str], destination: dict) -> float:
    score = 0.0

    name_tokens = set(_tokenize(destination.get("name", "")))
    name_hits = question_tokens & name_tokens
    score += len(name_hits) * 5
    if name_tokens and name_tokens.issubset(question_tokens):
        score += 10  # the whole name was mentioned - very likely THE match

    score += len(question_tokens & set(_tokenize(destination.get("category", "")))) * 3
    score += len(question_tokens & set(_tokenize(destination.get("neighbourhood", "")))) * 2

    for field in ("description", "history", "getting_there", "what_to_expect", "tips"):
        field_tokens = _tokenize(destination.get(field, ""))
        # Count occurrences (not just presence) so a place whose history
        # mentions a keyword five times outranks one that mentions it once.
        for token in question_tokens:
            score += field_tokens.count(token) * 0.5

    return score


def _excerpt(text: str, max_chars: int = 500) -> str:
    text = text.strip()
    if len(text) <= max_chars:
        return text
    # Cut at the last sentence boundary before max_chars, so the answer
    # doesn't end mid-word.
    cut = text[:max_chars]
    last_period = cut.rfind(". ")
    return (cut[: last_period + 1] if last_period > 100 else cut) + "…"


def _pick_intent_field(question_tokens: set[str], destination: dict) -> str:
    for field, keywords in _INTENT_FIELDS:
        if question_tokens & keywords and destination.get(field):
            return field
    return "description" if destination.get("description") else "history"


def _destination_stub(destination: dict) -> dict:
    return {
        "id": destination["id"],
        "name": destination["name"],
        "category": destination.get("category", ""),
        "neighbourhood": destination.get("neighbourhood", ""),
        "rating": destination.get("rating", 0),
        "price_range": destination.get("price_range", ""),
    }


# A match needs at least this much score to count as "the traveller is
# clearly asking about this specific place" rather than a vague browse.
_CONFIDENT_MATCH_THRESHOLD = 5.0


def answer_question(question: str, destinations: list[dict]) -> dict:
    question_tokens = set(_tokenize(question))

    if not question_tokens:
        return {
            "answer": "Ask me something like \"tell me about Mont Fébé\" or \"where can I find street food nearby?\"",
            "matches": [],
            "source": "keyword-search",
        }

    scored = sorted(
        ((_score(question_tokens, d), d) for d in destinations),
        key=lambda pair: pair[0],
        reverse=True,
    )
    scored = [(s, d) for s, d in scored if s > 0]

    if not scored:
        return {
            "answer": (
                "I couldn't find anything in the catalogue matching that. Try a place name, a "
                "neighbourhood, or a category like \"museums\" or \"street food\"."
            ),
            "matches": [],
            "source": "keyword-search",
        }

    best_score, best_destination = scored[0]
    second_score = scored[1][0] if len(scored) > 1 else 0

    # A single, clearly-best match -> answer directly from that place's own
    # text, quoting the field the question seems to be asking about.
    if best_score >= _CONFIDENT_MATCH_THRESHOLD and best_score > second_score * 1.3:
        field = _pick_intent_field(question_tokens, best_destination)
        excerpt = _excerpt(str(best_destination.get(field, "")))
        answer = f"About {best_destination['name']} — {_FIELD_LABELS.get(field, field)}:\n\n{excerpt}"
        return {
            "answer": answer,
            "matches": [_destination_stub(best_destination)],
            "source": "keyword-search",
        }

    # Otherwise: several plausible places - list them rather than guessing.
    top_matches = [d for _, d in scored[:5]]
    names = ", ".join(d["name"] for d in top_matches[:3])
    answer = f"A few places that match what you're asking about: {names}. Tap one to see the full details."
    return {
        "answer": answer,
        "matches": [_destination_stub(d) for d in top_matches],
        "source": "keyword-search",
    }
