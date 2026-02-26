import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "../ConfirmDialog";

const defaultProps = {
  open: true,
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
  title: "문서 삭제",
  description: "이 문서를 삭제하시겠습니까?",
};

describe("ConfirmDialog", () => {
  it("renders nothing when open is false", () => {
    render(<ConfirmDialog {...defaultProps} open={false} />);
    expect(screen.queryByText("문서 삭제")).not.toBeInTheDocument();
  });

  it("renders title and description when open", () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText("문서 삭제")).toBeInTheDocument();
    expect(screen.getByText("이 문서를 삭제하시겠습니까?")).toBeInTheDocument();
  });

  it("renders default button labels", () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText("삭제")).toBeInTheDocument();
    expect(screen.getByText("취소")).toBeInTheDocument();
  });

  it("renders custom button labels", () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        confirmLabel="확인"
        cancelLabel="돌아가기"
      />,
    );
    expect(screen.getByText("확인")).toBeInTheDocument();
    expect(screen.getByText("돌아가기")).toBeInTheDocument();
  });

  it("calls onConfirm when confirm button is clicked", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByText("삭제"));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onCancel when cancel button is clicked", async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);
    await userEvent.click(screen.getByText("취소"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("calls onCancel when ESC key is pressed", () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("calls onCancel when overlay is clicked", async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);
    // Overlay is the first child with aria-hidden
    const overlay = document.querySelector("[aria-hidden]");
    expect(overlay).toBeTruthy();
    await userEvent.click(overlay!);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("disables buttons and shows spinner when loading", () => {
    render(<ConfirmDialog {...defaultProps} loading />);
    const buttons = screen.getAllByRole("button");
    const confirmBtn = buttons.find((btn) => btn.querySelector(".animate-spin"));
    expect(confirmBtn).toBeTruthy();
    expect(confirmBtn).toBeDisabled();
    const cancelBtn = screen.getByText("취소");
    expect(cancelBtn).toBeDisabled();
  });

  it("does not call onCancel on ESC when loading", () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} loading />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("does not call onCancel on overlay click when loading", async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} loading />);
    const overlay = document.querySelector("[aria-hidden]");
    await userEvent.click(overlay!);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("has correct aria attributes", () => {
    render(<ConfirmDialog {...defaultProps} />);
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "confirm-title");
    expect(dialog).toHaveAttribute("aria-describedby", "confirm-desc");
  });
});
