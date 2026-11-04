"""Role provisioning: anon session always, userA/userB/admin if credentials supplied."""

from dataclasses import dataclass, field
import httpx


@dataclass
class SessionCtx:
    role: str = ""
    cookies: dict[str, str] = field(default_factory=dict)
    headers: dict[str, str] = field(default_factory=dict)
    owned_ids: list[str] = field(default_factory=list)


async def provision_anon(client: httpx.AsyncClient, start_url: str) -> SessionCtx:
    """Provision an anonymous session (no auth)."""
    try:
        await client.get(start_url, timeout=8.0)
    except Exception:
        pass
    return SessionCtx(role="anon", cookies={}, headers={})


async def provision_user(
    client: httpx.AsyncClient,
    login_url: str,
    username: str,
    password: str,
    role: str,
    username_field: str = "username",
    password_field: str = "password",
) -> SessionCtx:
    """Provision an authenticated session for a given user role."""
    try:
        r = await client.post(
            login_url,
            data={username_field: username, password_field: password},
            timeout=10.0,
        )
        # Extract cookies from response
        cookies = {}
        for cookie in client.cookies.jar:
            cookies[cookie.name] = cookie.value
        return SessionCtx(role=role, cookies=cookies, headers={})
    except Exception:
        return SessionCtx(role=role, cookies={}, headers={})


async def provision_roles(
    client: httpx.AsyncClient,
    base_url: str,
    credentials: dict[str, dict] | None = None,
) -> dict[str, SessionCtx]:
    """Provision all role sessions. Always returns at least `anon`."""
    roles: dict[str, SessionCtx] = {
        "anon": await provision_anon(client, base_url)
    }

    if credentials:
        for role, creds in credentials.items():
            login_url = creds.get("login_url", f"{base_url}/login")
            ctx = await provision_user(
                client,
                login_url,
                creds["username"],
                creds["password"],
                role,
                creds.get("username_field", "username"),
                creds.get("password_field", "password"),
            )
            if creds.get("owned_ids"):
                ctx.owned_ids = creds["owned_ids"]
            roles[role] = ctx

    return roles