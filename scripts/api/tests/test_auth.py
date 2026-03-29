"""Tests for Clerk JWT auth middleware and WebSocket ticket system."""

import os
import sys
import time
import uuid
from unittest.mock import patch

import pytest

# Ensure the scripts/ directory is on sys.path so `from api.*` imports resolve.
_scripts_dir = os.path.join(os.path.dirname(__file__), os.pardir, os.pardir)
sys.path.insert(0, os.path.abspath(_scripts_dir))

# --- ws_ticket tests ---

from api.ws_ticket import create_ticket, validate_ticket, _ticket_store, TICKET_TTL_SECONDS


class TestCreateTicket:
    def setup_method(self):
        _ticket_store.clear()

    def test_returns_valid_uuid(self):
        ticket = create_ticket("user_123")
        uuid.UUID(ticket)  # raises if not valid UUID

    def test_stores_user_id_and_expiry(self):
        ticket = create_ticket("user_abc")
        assert ticket in _ticket_store
        assert _ticket_store[ticket]["user_id"] == "user_abc"
        assert _ticket_store[ticket]["expires"] > time.time()


class TestValidateTicket:
    def setup_method(self):
        _ticket_store.clear()

    def test_valid_ticket_returns_user_id(self):
        ticket = create_ticket("user_xyz")
        assert validate_ticket(ticket) == "user_xyz"

    def test_ticket_is_single_use(self):
        ticket = create_ticket("user_once")
        assert validate_ticket(ticket) == "user_once"
        assert validate_ticket(ticket) is None

    def test_invalid_ticket_returns_none(self):
        assert validate_ticket("nonexistent-ticket") is None

    def test_expired_ticket_returns_none(self):
        ticket = create_ticket("user_exp")
        _ticket_store[ticket]["expires"] = time.time() - 1
        assert validate_ticket(ticket) is None

    def test_cleanup_removes_expired(self):
        t1 = create_ticket("user_old")
        _ticket_store[t1]["expires"] = time.time() - 1
        t2 = create_ticket("user_new")
        # validate triggers cleanup via _cleanup_expired
        validate_ticket("dummy")
        assert t1 not in _ticket_store
        assert t2 in _ticket_store


# --- auth.py tests ---

from api.auth import _get_allowed_users, _get_issuer


class TestGetAllowedUsers:
    def test_empty_env(self):
        with patch.dict(os.environ, {"ALLOWED_USER_IDS": ""}):
            assert _get_allowed_users() == set()

    def test_single_user(self):
        with patch.dict(os.environ, {"ALLOWED_USER_IDS": "user_123"}):
            assert _get_allowed_users() == {"user_123"}

    def test_multiple_users(self):
        with patch.dict(os.environ, {"ALLOWED_USER_IDS": "user_1,user_2,user_3"}):
            assert _get_allowed_users() == {"user_1", "user_2", "user_3"}

    def test_trims_whitespace(self):
        with patch.dict(os.environ, {"ALLOWED_USER_IDS": " user_1 , user_2 "}):
            assert _get_allowed_users() == {"user_1", "user_2"}


class TestGetIssuer:
    def test_returns_env_value(self):
        with patch.dict(os.environ, {"CLERK_ISSUER": "https://app.clerk.dev"}):
            assert _get_issuer() == "https://app.clerk.dev"

    def test_returns_empty_when_not_set(self):
        with patch.dict(os.environ, {}, clear=True):
            os.environ.pop("CLERK_ISSUER", None)
            assert _get_issuer() == ""
