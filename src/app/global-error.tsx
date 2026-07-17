"use client";

/**
 * Last-resort catcher: fires only if the root layout itself fails, so it can't
 * rely on any shared styling — everything here is inline.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FFF8EE",
          fontFamily: "system-ui, sans-serif",
          color: "#3B2A20",
          padding: "1rem",
        }}
      >
        <div style={{ maxWidth: "26rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Das Kitchen is having a moment</h1>
          <p style={{ color: "#5C4033", marginTop: "0.75rem" }}>
            Something broke badly. Please refresh — we&apos;re still cooking.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              background: "#B08D00",
              color: "#fff",
              border: 0,
              borderRadius: "999px",
              padding: "0.7rem 1.75rem",
              fontSize: "0.9rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p style={{ marginTop: "1.25rem", fontSize: "0.75rem", color: "#5C403366" }}>
              Reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
