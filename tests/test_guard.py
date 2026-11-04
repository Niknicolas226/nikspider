import pytest
from nikspider.stage0_intake_guard.guard import is_public_host, is_allowed_target

def test_private_ips_blocked():
    assert not is_public_host("http://127.0.0.1:8000")
    assert not is_public_host("http://10.0.0.1")
    assert not is_public_host("http://192.168.1.25")
    assert not is_public_host("http://172.16.0.10")

def test_localhost_only_in_demo_mode(monkeypatch):
    monkeypatch.setenv("DEMO_MODE", "0")
    assert not is_allowed_target("http://localhost:5000")
    assert not is_allowed_target("http://127.0.0.1:5000")

    monkeypatch.setenv("DEMO_MODE", "1")
    assert is_allowed_target("http://localhost:5000")
    assert is_allowed_target("http://127.0.0.1:5000")

