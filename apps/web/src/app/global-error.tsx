"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: "sans-serif", background: "#f5f5f5" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>문제가 발생했습니다</h2>
          <p style={{ color: "#666", marginBottom: "1.5rem" }}>예기치 않은 오류가 발생했습니다.</p>
          <button
            onClick={reset}
            style={{
              padding: "0.75rem 1.5rem",
              background: "#6366f1",
              color: "#fff",
              border: "none",
              borderRadius: "0.5rem",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 600,
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
