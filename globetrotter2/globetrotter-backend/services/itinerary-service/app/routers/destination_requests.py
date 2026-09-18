# =============================================================================
# routers/destination_requests.py
#
# THE APPROVAL WORKFLOW
# ------------------------
# As of the roles feature, a regular traveller can no longer call
# POST/PUT/DELETE /destinations directly (see routers/destinations.py -
# those three now require an admin). Instead:
#
#   POST /destinations/requests          any logged-in user proposes a
#                                         create / update / delete
#   GET  /destinations/requests          admin: see everything pending
#   GET  /destinations/requests/mine     anyone: see their OWN requests and
#                                         whether they were approved/rejected
#   POST /destinations/requests/{id}/approve   admin: apply the change
#   POST /destinations/requests/{id}/reject    admin: say no, optionally why
#
# WHY THIS ISN'T JUST "SET A FLAG ON THE DESTINATION"
# -------------------------------------------------------
# A request is its OWN record (not a half-applied destination), so a
# rejected or still-pending proposal never shows up in GET /destinations -
# regular browsing only ever sees real, admin-approved data. Approving a
# request runs the EXACT SAME create/update/delete code an admin's direct
# edit would (see apply_create/apply_update/apply_delete in
# routers/destinations.py) - there is only one path that actually writes to
# the destinations table, whether an admin used it directly or by approving
# someone else's suggestion.
#
# THIS ROUTER MUST BE REGISTERED BEFORE destinations.router IN main.py
# ------------------------------------------------------------------------
# destinations.router has a catch-all `GET /destinations/{destination_id}`.
# FastAPI matches routes in registration order, so if that router were
# registered first, a request to GET /destinations/requests would be
# swallowed by it (treating "requests" as a destination id) instead of
# reaching this router. See main.py.
# =============================================================================

from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, model_validator

from app.deps import get_current_user, require_admin
from app.routers.destinations import DestinationBody, _find, apply_create, apply_delete, apply_update
from app.storage import new_id, read_db, update_db

router = APIRouter(prefix="/destinations/requests", tags=["destination-requests"])


class SubmitRequestBody(BaseModel):
    type: Literal["create", "update", "delete"]
    destination_id: str | None = None
    payload: DestinationBody | None = None

    @model_validator(mode="after")
    def _check_shape(self):
        if self.type == "create":
            if self.payload is None:
                raise ValueError("payload is required for a 'create' request")
            if self.destination_id is not None:
                raise ValueError("destination_id must not be set for a 'create' request")
        else:  # update or delete
            if self.destination_id is None:
                raise ValueError(f"destination_id is required for a '{self.type}' request")
            if self.type == "update" and self.payload is None:
                raise ValueError("payload is required for an 'update' request")
        return self


def _find_request(db: dict, request_id: str) -> dict | None:
    return next((r for r in db.get("destination_requests", []) if r["id"] == request_id), None)


@router.post("", status_code=status.HTTP_201_CREATED)
def submit_request(body: SubmitRequestBody, current_user: dict = Depends(get_current_user)):
    if body.type in ("update", "delete"):
        db = read_db()
        if not _find(db, body.destination_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Destination not found")

    record = {
        "id": new_id(),
        "type": body.type,
        "destination_id": body.destination_id,
        "payload": body.payload.model_dump() if body.payload else None,
        "requested_by": current_user["id"],
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "reviewed_by": None,
        "reviewed_at": None,
        "reject_reason": None,
    }

    def _create(db):
        db.setdefault("destination_requests", []).append(record)
        return record

    return update_db(_create)


@router.get("")
def list_requests(
    status_filter: str | None = Query(default=None, alias="status"),
    current_user: dict = Depends(require_admin),
):
    """Admin's queue. `?status=pending` narrows it to what still needs a
    decision; omit it to see the full history."""
    db = read_db()
    requests_ = db.get("destination_requests", [])
    if status_filter:
        requests_ = [r for r in requests_ if r["status"] == status_filter]
    return sorted(requests_, key=lambda r: r["created_at"], reverse=True)


@router.get("/mine")
def list_my_requests(current_user: dict = Depends(get_current_user)):
    """So a regular traveller can see whether their suggestion was
    approved, rejected, or is still waiting - without needing admin
    rights to check."""
    db = read_db()
    mine = [r for r in db.get("destination_requests", []) if r["requested_by"] == current_user["id"]]
    return sorted(mine, key=lambda r: r["created_at"], reverse=True)


@router.post("/{request_id}/approve")
def approve_request(request_id: str, current_user: dict = Depends(require_admin)):
    db = read_db()
    req = _find_request(db, request_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if req["status"] != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Request already {req['status']}")

    if req["type"] == "create":
        result = apply_create(DestinationBody(**req["payload"]), created_by=req["requested_by"])
    elif req["type"] == "update":
        result = apply_update(req["destination_id"], DestinationBody(**req["payload"]))
        if result is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Destination no longer exists")
    else:  # delete
        if not apply_delete(req["destination_id"]):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Destination no longer exists")
        result = {"deleted": req["destination_id"]}

    def _mark_approved(db):
        stored = _find_request(db, request_id)
        stored["status"] = "approved"
        stored["reviewed_by"] = current_user["id"]
        stored["reviewed_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")

    update_db(_mark_approved)
    return {"request_id": request_id, "status": "approved", "result": result}


@router.post("/{request_id}/reject")
def reject_request(
    request_id: str,
    reason: str = Query(default="", max_length=500),
    current_user: dict = Depends(require_admin),
):
    db = read_db()
    req = _find_request(db, request_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if req["status"] != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Request already {req['status']}")

    def _mark_rejected(db):
        stored = _find_request(db, request_id)
        stored["status"] = "rejected"
        stored["reviewed_by"] = current_user["id"]
        stored["reviewed_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        stored["reject_reason"] = reason or None

    update_db(_mark_rejected)
    return {"request_id": request_id, "status": "rejected"}
