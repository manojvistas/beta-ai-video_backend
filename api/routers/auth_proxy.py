"""
Reverse proxy router for the Node.js auth-api service.

Forwards all requests under /auth/ to http://localhost:4000/
so that the auth-api is reachable through the single Render port (15055).
"""

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import Response
from loguru import logger

router = APIRouter()

AUTH_API_BASE = "http://localhost:4000"

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(base_url=AUTH_API_BASE, timeout=30.0)
    return _client


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy_auth(request: Request, path: str):
    """Forward any request to the internal auth-api service."""
    client = _get_client()

    target_url = f"/{path}"
    if request.url.query:
        target_url = f"{target_url}?{request.url.query}"

    # Forward headers, excluding hop-by-hop headers
    excluded_headers = {"host", "transfer-encoding", "connection"}
    headers = {
        k: v
        for k, v in request.headers.items()
        if k.lower() not in excluded_headers
    }

    body = await request.body()

    try:
        resp = await client.request(
            method=request.method,
            url=target_url,
            headers=headers,
            content=body,
        )
    except httpx.ConnectError:
        logger.error("Auth-api is not reachable at {}", AUTH_API_BASE)
        return Response(
            content='{"error":"Auth service unavailable"}',
            status_code=503,
            media_type="application/json",
        )

    # Forward response headers, excluding hop-by-hop
    response_headers = {
        k: v
        for k, v in resp.headers.items()
        if k.lower() not in {"transfer-encoding", "connection", "content-encoding", "content-length"}
    }

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers=response_headers,
        media_type=resp.headers.get("content-type"),
    )
