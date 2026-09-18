# =============================================================================
# tests/test_assistant.py  -  ITINERARY SERVICE
#
# The "AI" assistant is really a free keyword search over this service's
# own real destination data (see app/assistant.py) - no external API, no
# billing risk. These tests prove it actually reads real seed content, not
# canned text.
# =============================================================================

from app.seed import SEED_DESTINATIONS


def test_asking_about_a_specific_place_by_name_quotes_its_real_history(client):
    landmark = next(d for d in SEED_DESTINATIONS if d["id"] == "dest_landmarks_01")

    response = client.post("/assistant/ask", json={"question": f"Tell me the history of {landmark['name']}"})
    assert response.status_code == 200
    body = response.json()

    assert body["source"] == "keyword-search"
    assert len(body["matches"]) == 1
    assert body["matches"][0]["id"] == landmark["id"]
    # The answer must contain real words lifted from the actual seed text,
    # not a generic scripted reply.
    first_history_words = landmark["history"].split()[:5]
    assert any(word in body["answer"] for word in first_history_words)


def test_asking_how_to_get_somewhere_prefers_the_getting_there_field(client):
    landmark = next(d for d in SEED_DESTINATIONS if d["id"] == "dest_landmarks_01" and d.get("getting_there"))

    response = client.post(
        "/assistant/ask", json={"question": f"how do I get to {landmark['name']}, directions please"}
    )
    body = response.json()

    assert body["matches"][0]["id"] == landmark["id"]
    getting_there_words = landmark["getting_there"].split()[:5]
    assert any(word in body["answer"] for word in getting_there_words)


def test_a_vague_question_lists_several_candidates_instead_of_guessing(client):
    response = client.post("/assistant/ask", json={"question": "museum"})
    body = response.json()

    assert len(body["matches"]) >= 1
    assert all(m["category"] for m in body["matches"])


def test_nonsense_question_returns_a_helpful_no_match_message(client):
    response = client.post("/assistant/ask", json={"question": "xyzzyplugh qwerty12345"})
    body = response.json()

    assert body["matches"] == []
    assert "couldn't find" in body["answer"].lower()


def test_empty_question_is_rejected(client):
    response = client.post("/assistant/ask", json={"question": ""})
    assert response.status_code == 422


def test_asking_needs_no_login(client):
    """Same rule as browsing destinations - no account needed."""
    response = client.post("/assistant/ask", json={"question": "museum"})
    assert response.status_code == 200
