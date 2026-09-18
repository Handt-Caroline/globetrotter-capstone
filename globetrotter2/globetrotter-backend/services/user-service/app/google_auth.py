# =============================================================================
# google_auth.py  -  VERIFYING A "SIGN IN WITH GOOGLE" ID TOKEN
#
# HOW THIS WORKS, IN PLAIN TERMS
# ---------------------------------
# The frontend loads Google's own script (Google Identity Services) and
# shows GOOGLE's own "Sign in with Google" button - we never see anyone's
# Google password. When someone signs in there, Google hands the browser a
# signed JWT called an "ID token" that says "I am Google, and I vouch that
# this email address belongs to whoever just proved it by signing into
# their Google account". The browser sends that token here (see routers/
# auth.py's POST /auth/google), and this file's only job is to check
# Google's signature on it - the same idea as every other JWT in this
# project (see security.py), except the key that signs it is Google's, not
# ours, and it rotates automatically - the `google-auth` library handles
# that by fetching Google's current public keys over HTTPS and caching
# them, so we never have to manage keys ourselves.
#
# WHY THIS NEEDS NO PAID API AND NO BILLING
# ---------------------------------------------
# "Sign in with Google" (verifying an ID token) is completely free - no
# usage tier, no credit card, nothing to accidentally get billed for. The
# one thing you DO need is a free "OAuth Client ID", created once in
# Google Cloud Console (see the project README for the exact steps) -
# that's a public IDENTIFIER, not a secret (it's fine that the frontend
# knows it too), and it's what GOOGLE_CLIENT_ID below holds. This is a
# genuinely different situation from the Google MAPS API this project got
# burned by before, which does have paid usage tiers past a free quota.
# =============================================================================

import os

from fastapi import HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")

# Reused across requests - it internally caches Google's public keys
# instead of re-fetching them on every single sign-in.
_google_request = google_requests.Request()


def verify_google_id_token(token: str) -> tuple[str, str]:
    """Returns (email, name) if `token` is a genuine, unexpired ID token
    issued by Google for OUR app (GOOGLE_CLIENT_ID). Raises a clean
    HTTPException otherwise - never lets a bad or forged token through."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign-in isn't configured on this server (GOOGLE_CLIENT_ID is unset).",
        )
    try:
        payload = google_id_token.verify_oauth2_token(token, _google_request, GOOGLE_CLIENT_ID)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid Google token: {error}")

    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google token has no email")
    if not payload.get("email_verified", False):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="That Google account's email isn't verified")

    name = payload.get("name") or email.split("@")[0]
    return email, name
