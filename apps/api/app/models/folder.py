from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.document import Document
    from app.models.user import User


class Folder(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "folders"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(200))
    color: Mapped[str | None] = mapped_column(String(7), default=None)
    emoji: Mapped[str | None] = mapped_column(String(10), default=None)

    owner: Mapped[User] = relationship(back_populates="folders")
    documents: Mapped[list[Document]] = relationship(back_populates="folder", passive_deletes=True)
