from __future__ import annotations

import uuid

import jwt
import pytest

from app.services.auth_service import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


class TestHashPassword:
    def test_hash_and_verify(self) -> None:
        hashed = hash_password("mysecretpassword")
        assert verify_password("mysecretpassword", hashed)

    def test_wrong_password_fails(self) -> None:
        hashed = hash_password("correct")
        assert not verify_password("wrong", hashed)

    def test_hash_is_not_plain(self) -> None:
        hashed = hash_password("plain")
        assert hashed != "plain"


class TestAccessToken:
    def test_create_and_decode(self) -> None:
        uid = str(uuid.uuid4())
        token = create_access_token(uid)
        assert decode_access_token(token) == uid

    def test_invalid_token_raises(self) -> None:
        with pytest.raises(jwt.exceptions.DecodeError):
            decode_access_token("not-a-valid-token")

    def test_tampered_token_raises(self) -> None:
        token = create_access_token(str(uuid.uuid4()))
        tampered = token + "x"
        with pytest.raises(jwt.exceptions.DecodeError):
            decode_access_token(tampered)
