import { useState, useEffect } from "react";

export type CookieConsent = {
  necessary: true;
  analytics: boolean;
};

export const STORAGE_KEY = "boojum_cookie_consent";

export function getStoredConsent(): CookieConsent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CookieConsent;
  } catch {
    return null;
  }
}

function saveConsent(consent: CookieConsent) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
}

interface Props {
  onConsent: (consent: CookieConsent) => void;
}

export default function CookieBanner({ onConsent }: Props) {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analyticsChecked, setAnalyticsChecked] = useState(false);

  useEffect(() => {
    const stored = getStoredConsent();
    if (!stored) {
      setVisible(true);
    } else {
      onConsent(stored);
    }
  }, []);

  const accept = (consent: CookieConsent) => {
    saveConsent(consent);
    onConsent(consent);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cookie consent"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "#1a1a2e",
        borderTop: "1px solid #2d2d4e",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.5)",
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        maxHeight: "90vh",
        overflowY: "auto",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <p style={{ margin: 0, fontSize: "15px", color: "#e2e8f0", lineHeight: 1.6 }}>
          <strong style={{ color: "#facc15" }}>We use cookies</strong> to keep the site working
          (essential) and, with your consent, to understand how it's used (analytics). We do{" "}
          <strong>not</strong> use advertising or tracking cookies. You can change your choice at
          any time in Settings.{" "}
          <a
            href="/privacy-policy"
            style={{ color: "#71bbe9", textDecoration: "underline" }}
          >
            Privacy&nbsp;Policy
          </a>
        </p>
      </div>

      {showDetails && (
        <div
          style={{
            background: "#12122a",
            border: "1px solid #2d2d4e",
            borderRadius: "8px",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <CookieRow
            title="Essential cookies"
            description="Required for login, sessions, and core gameplay. Always active."
            locked
            checked
          />
          <CookieRow
            title="Analytics cookies"
            description="Anonymous usage data via Vercel Analytics and Google Analytics — helps us improve the game."
            checked={analyticsChecked}
            onChange={setAnalyticsChecked}
          />
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          alignItems: "center",
        }}
      >
        <button
          onClick={() => accept({ necessary: true, analytics: true })}
          style={btnStyle("#facc15", "#1a1a2e")}
        >
          Accept all
        </button>
        <button
          onClick={() => accept({ necessary: true, analytics: false })}
          style={btnStyle("#374151", "#e2e8f0")}
        >
          Reject non-essential
        </button>
        {!showDetails ? (
          <button
            onClick={() => setShowDetails(true)}
            style={linkBtnStyle}
          >
            Manage preferences
          </button>
        ) : (
          <button
            onClick={() => accept({ necessary: true, analytics: analyticsChecked })}
            style={btnStyle("#4f46e5", "#e2e8f0")}
          >
            Save my choices
          </button>
        )}
      </div>
    </div>
  );
}

interface CookieRowProps {
  title: string;
  description: string;
  checked: boolean;
  locked?: boolean;
  onChange?: (v: boolean) => void;
}

function CookieRow({ title, description, checked, locked, onChange }: CookieRowProps) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start" }}>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 600, color: "#e2e8f0", fontSize: "14px" }}>{title}</p>
        <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: "13px", lineHeight: 1.5 }}>
          {description}
        </p>
      </div>
      {locked ? (
        <span
          style={{
            fontSize: "12px",
            color: "#6b7280",
            border: "1px solid #374151",
            borderRadius: "4px",
            padding: "2px 8px",
            whiteSpace: "nowrap",
            marginTop: "2px",
          }}
        >
          Always on
        </span>
      ) : (
        <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", marginTop: "2px" }}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange?.(e.target.checked)}
            style={{ width: "16px", height: "16px", accentColor: "#71bbe9", cursor: "pointer" }}
          />
          <span style={{ fontSize: "13px", color: "#94a3b8" }}>{checked ? "On" : "Off"}</span>
        </label>
      )}
    </div>
  );
}

const btnStyle = (bg: string, color: string): React.CSSProperties => ({
  padding: "8px 20px",
  borderRadius: "6px",
  border: "none",
  background: bg,
  color,
  fontWeight: 600,
  fontSize: "14px",
  cursor: "pointer",
  whiteSpace: "nowrap",
});

const linkBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#71bbe9",
  fontSize: "14px",
  cursor: "pointer",
  textDecoration: "underline",
  padding: "8px 0",
};
