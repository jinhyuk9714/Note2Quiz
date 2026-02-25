import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChunkViewer } from "../ChunkViewer";
import type { Chunk } from "@/types/api";

const LONG_CONTENT =
  "This is the full expanded content of the first chunk that is definitely longer than eighty characters and should be truncated in the collapsed preview state.";

const chunks: Chunk[] = [
  { id: "c1", index: 0, content: LONG_CONTENT, token_count: 50 },
  {
    id: "c2",
    index: 1,
    content: "Second chunk with much longer content that goes beyond the preview limit to test truncation behavior in the collapsed state",
    token_count: 120,
  },
];

describe("ChunkViewer", () => {
  it("renders chunk count and indices", () => {
    render(<ChunkViewer chunks={chunks} />);
    expect(screen.getByText("2개 섹션")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows token counts", () => {
    render(<ChunkViewer chunks={chunks} />);
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
  });

  it("expands chunk content on click", async () => {
    render(<ChunkViewer chunks={chunks} />);
    // Full content should not be visible initially (only truncated preview)
    expect(screen.queryByText(LONG_CONTENT)).not.toBeInTheDocument();

    // Click the first chunk button
    await userEvent.click(screen.getByText("1"));
    expect(screen.getByText(LONG_CONTENT)).toBeInTheDocument();
  });

  it("collapses expanded chunk on second click", async () => {
    render(<ChunkViewer chunks={chunks} />);
    const btn = screen.getByText("1");

    await userEvent.click(btn);
    expect(screen.getByText(LONG_CONTENT)).toBeInTheDocument();

    await userEvent.click(btn);
    expect(screen.queryByText(LONG_CONTENT)).not.toBeInTheDocument();
  });

  it("toggles all chunks with toggle all button", async () => {
    render(<ChunkViewer chunks={chunks} />);

    await userEvent.click(screen.getByText("모두 펼치기"));
    expect(screen.getByText(LONG_CONTENT)).toBeInTheDocument();
    expect(screen.getByText("모두 접기")).toBeInTheDocument();

    await userEvent.click(screen.getByText("모두 접기"));
    expect(screen.queryByText(LONG_CONTENT)).not.toBeInTheDocument();
    expect(screen.getByText("모두 펼치기")).toBeInTheDocument();
  });
});
