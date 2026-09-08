# =============================================================================
# constants.py
#
# Onboarding.jsx lets the user pick interests like "Historical Landmarks",
# "Street Food", "Football & Sport"... (full, human-readable labels) and
# sends those labels to POST /recommendations/preferences.
#
# Meanwhile every destination has a short `category` id like "landmarks",
# "streetfood", "sports" (see seed.py).
#
# This dictionary is the bridge between the two, so we can turn
# "the user likes Street Food" -> "show them destinations where
# category == streetfood".
#
# Several labels may point at the same category on purpose (e.g. both
# "Viewpoints & Hills" and "Photography Spots" lead to viewpoints), and
# the labels used by older versions of the app are kept at the bottom so
# preferences saved before this update still resolve.
# =============================================================================

INTEREST_LABEL_TO_CATEGORY = {
    # --- Culture & heritage ---
    "Historical Landmarks": "landmarks",
    "Museums & Heritage": "museums",
    "Religious Sites": "religious",
    "Local Traditions & Craft": "traditions",
    "Performing Arts & Cinema": "arts",
    "Libraries & Archives": "library",
    # --- Food & drink ---
    "Street Food": "streetfood",
    "Food & Restaurants": "restaurant",
    "Cafés & Coffee": "cafe",
    "Markets & Shopping": "shopping",
    # --- Going out ---
    "Live Music & Nightlife": "nightlife",
    "Festivals & Events": "festivals",
    "Football & Sport": "sports",
    # --- Outdoors ---
    "Nature & Parks": "nature",
    "Viewpoints & Hills": "viewpoints",
    "Photography Spots": "viewpoints",
    "Outdoor & Hiking": "outdoor",
    "Hidden Gems & Day Trips": "hidden",
    # --- Practical ---
    "Wellness & Spas": "wellness",
    "Family & Kids": "family",
    "Budget-Friendly / Free": "budget",
    "Coworking & Remote Work": "coworking",

    # --- Legacy labels (kept so older saved preferences still work) ---
    "Local Traditions": "traditions",
    "Art & Culture": "museums",
    "Cafés": "cafe",
    "Libraries & History": "library",
    "Nightlife & Bars": "nightlife",
    "Performing Arts": "arts",
    "Outdoor Adventure": "outdoor",
    "Shopping & Boutiques": "shopping",
    "Hidden Gems": "hidden",
    "Coworking & Work": "coworking",
}
