export function HotBadge({ count }: { count: number }) {
  const label = `🔥 Hurry! This item is in ${count} other cart${count === 1 ? "" : "s"} right now.`;

  return (
    <div
      aria-label={label}
      className="absolute top-2 left-2 group/hotbadge"
      style={{ zIndex: 10 }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "1.75rem",
          height: "1.75rem",
          borderRadius: "9999px",
          backgroundColor: "rgba(0,0,0,0.65)",
          fontSize: "1rem",
          lineHeight: 1,
          backdropFilter: "blur(4px)",
        }}
      >
        🔥
      </span>
      {/* Tooltip — visible on hover, pointer-events: none so it doesn't block the card link */}
      <div
        className="absolute top-full left-0 mt-1 hidden group-hover/hotbadge:block"
        style={{
          background: "rgba(20,20,20,0.92)",
          color: "#fff",
          WebkitTextFillColor: "#fff",
          backgroundImage: "none",
          WebkitBackgroundClip: "unset",
          backgroundClip: "unset",
          padding: "0.35rem 0.6rem",
          borderRadius: "0.375rem",
          fontSize: "0.7rem",
          whiteSpace: "nowrap",
          border: "1px solid rgba(255,255,255,0.14)",
          pointerEvents: "none",
          zIndex: 50,
        }}
      >
        {label}
      </div>
    </div>
  );
}
