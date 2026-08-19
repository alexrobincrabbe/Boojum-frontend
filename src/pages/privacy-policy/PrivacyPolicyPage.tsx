import { useState } from "react";
import { STORAGE_KEY } from "../../components/CookieBanner";

export default function PrivacyPolicyPage() {
  const [withdrawn, setWithdrawn] = useState(false);

  const withdrawConsent = () => {
    localStorage.removeItem(STORAGE_KEY);
    setWithdrawn(true);
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto" style={{ color: "#e2e8f0", lineHeight: 1.8 }}>
        <h1 style={{ color: "#facc15", fontSize: "2rem", fontWeight: 700, marginBottom: "8px" }}>
          Privacy Policy
        </h1>
        <p style={{ color: "#94a3b8", marginBottom: "40px" }}>
          Last updated: 19 August 2026
        </p>

        <Section title="1. Who we are">
          <p>
            Boojum Games operates the website at{" "}
            <strong style={{ color: "#71bbe9" }}>boojumgames.com</strong> (the
            "Site"). When this policy refers to "we", "us", or "our" it means Boojum
            Games.
          </p>
          <p>
            Questions about this policy or your personal data can be sent to{" "}
            <a href="mailto:privacy@boojumgames.com" style={linkStyle}>
              privacy@boojumgames.com
            </a>
            .
          </p>
        </Section>

        <Section title="2. What data we collect and why">
          <SubHeading>Account data</SubHeading>
          <p>
            When you register, we collect your username, email address, and (if you
            use Google Sign-In) your Google profile name and picture URL. We use
            this to authenticate you and personalise your experience.
          </p>

          <SubHeading>Gameplay data</SubHeading>
          <p>
            Scores, game history, saved boards, and tournament results are stored so
            you can track your progress and appear on leaderboards. This data is
            associated with your account.
          </p>

          <SubHeading>Profile data</SubHeading>
          <p>
            Display name, profile picture, chat colour, and any bio text you choose
            to add. This information is visible to other players.
          </p>

          <SubHeading>Technical / session data</SubHeading>
          <p>
            We store a session cookie after login (essential, no consent required)
            and a JWT token in your browser to keep you signed in securely.
          </p>

          <SubHeading>Analytics data (with your consent only)</SubHeading>
          <p>
            If you accept analytics cookies, Vercel Analytics and Vercel Speed
            Insights collect <strong>anonymous</strong> usage data: page views,
            navigation paths, and performance metrics. No personal identifiers are
            included. This data is processed by{" "}
            <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" style={linkStyle}>
              Vercel Inc.
            </a>{" "}
            under their privacy policy.
          </p>
        </Section>

        <Section title="3. Cookies we use">
          <table style={tableStyle}>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Purpose</Th>
                <Th>Type</Th>
                <Th>Duration</Th>
              </tr>
            </thead>
            <tbody>
              <Tr>
                <Td><code>sessionid</code></Td>
                <Td>Keeps you logged in</Td>
                <Td>Essential</Td>
                <Td>Session</Td>
              </Tr>
              <Tr>
                <Td><code>csrftoken</code></Td>
                <Td>Protects against cross-site request forgery</Td>
                <Td>Essential</Td>
                <Td>1 year</Td>
              </Tr>
              <Tr>
                <Td><code>boojum_cookie_consent</code></Td>
                <Td>Remembers your cookie preferences</Td>
                <Td>Essential</Td>
                <Td>1 year (localStorage)</Td>
              </Tr>
              <Tr>
                <Td><code>_vercel_*</code></Td>
                <Td>Anonymous analytics (Vercel)</Td>
                <Td>Analytics (consent required)</Td>
                <Td>Up to 1 year</Td>
              </Tr>
            </tbody>
          </table>
          <p style={{ marginTop: "12px" }}>
            We do <strong>not</strong> use advertising cookies, social-media tracking
            pixels, or any third-party marketing cookies.
          </p>
        </Section>

        <Section title="4. Legal basis for processing (GDPR)">
          <p>We process your personal data under the following lawful bases:</p>
          <ul style={listStyle}>
            <li>
              <strong>Contract</strong> — account and gameplay data is necessary to
              provide the service you signed up for (Art. 6(1)(b) GDPR).
            </li>
            <li>
              <strong>Legitimate interests</strong> — we retain game history to
              power leaderboards and improve the site (Art. 6(1)(f) GDPR).
            </li>
            <li>
              <strong>Consent</strong> — analytics cookies are only set after you
              give explicit consent via the cookie banner (Art. 6(1)(a) GDPR).
            </li>
          </ul>
        </Section>

        <Section title="5. Data sharing">
          <p>
            We do <strong>not</strong> sell or rent your personal data. We share data
            only with the following processors, strictly to operate the service:
          </p>
          <ul style={listStyle}>
            <li>
              <strong>Vercel</strong> — hosting and (with consent) analytics.{" "}
              <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" style={linkStyle}>
                Vercel Privacy Policy
              </a>
            </li>
            <li>
              <strong>Google</strong> — optional Google Sign-In via OAuth 2.0.{" "}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={linkStyle}>
                Google Privacy Policy
              </a>
            </li>
          </ul>
          <p>
            All processors are either based in the EEA or maintain adequate
            safeguards (Standard Contractual Clauses) for international transfers.
          </p>
        </Section>

        <Section title="6. Data retention">
          <p>
            Account data is retained for as long as your account is active. If you
            delete your account, we will erase your personal data within 30 days,
            except where retention is required by law or to resolve disputes.
            Anonymised gameplay statistics (no link to your identity) may be kept
            indefinitely.
          </p>
        </Section>

        <Section title="7. Your rights (EEA / UK residents)">
          <p>Under GDPR and UK GDPR you have the right to:</p>
          <ul style={listStyle}>
            <li><strong>Access</strong> — request a copy of the data we hold about you.</li>
            <li><strong>Rectification</strong> — correct inaccurate data.</li>
            <li><strong>Erasure</strong> — request deletion of your data ("right to be forgotten").</li>
            <li><strong>Restriction</strong> — ask us to limit processing in certain circumstances.</li>
            <li><strong>Portability</strong> — receive your data in a machine-readable format.</li>
            <li><strong>Object</strong> — object to processing based on legitimate interests.</li>
            <li>
              <strong>Withdraw consent</strong> — withdraw analytics consent at any time (see
              below).
            </li>
          </ul>
          <p>
            To exercise any of these rights, email{" "}
            <a href="mailto:privacy@boojumgames.com" style={linkStyle}>
              privacy@boojumgames.com
            </a>
            . We will respond within 30 days. You also have the right to lodge a
            complaint with your national data protection authority (e.g.{" "}
            <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" style={linkStyle}>
              ICO
            </a>{" "}
            in the UK).
          </p>
        </Section>

        <Section title="8. Manage your cookie consent">
          <p>
            You can withdraw or change your cookie consent at any time. Clicking
            the button below clears your stored preference — the cookie banner will
            reappear on your next page load so you can make a new choice.
          </p>
          {withdrawn ? (
            <p style={{ color: "#4ade80", fontWeight: 600 }}>
              ✓ Your consent has been cleared. Reload the page to update your
              preferences.
            </p>
          ) : (
            <button onClick={withdrawConsent} style={dangerBtnStyle}>
              Withdraw / change cookie consent
            </button>
          )}
        </Section>

        <Section title="9. Children">
          <p>
            The Site is not directed at children under 13. We do not knowingly
            collect personal data from children. If you believe a child has
            provided us with their data, please contact us and we will delete it
            promptly.
          </p>
        </Section>

        <Section title="10. Changes to this policy">
          <p>
            We may update this policy from time to time. The "Last updated" date at
            the top of the page will reflect any changes. Significant changes will
            be announced in-game or by email.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "36px" }}>
      <h2 style={{ color: "#71bbe9", fontSize: "1.15rem", fontWeight: 700, marginBottom: "12px", borderBottom: "1px solid #2d2d4e", paddingBottom: "6px" }}>
        {title}
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {children}
      </div>
    </section>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontWeight: 600, color: "#facc15", margin: "8px 0 2px" }}>{children}</p>
  );
}

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "13px",
};

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ textAlign: "left", padding: "8px 12px", background: "#12122a", color: "#94a3b8", borderBottom: "1px solid #2d2d4e" }}>
      {children}
    </th>
  );
}

function Tr({ children }: { children: React.ReactNode }) {
  return <tr style={{ borderBottom: "1px solid #1e1e3a" }}>{children}</tr>;
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ padding: "8px 12px", color: "#e2e8f0", verticalAlign: "top" }}>
      {children}
    </td>
  );
}

const linkStyle: React.CSSProperties = { color: "#71bbe9", textDecoration: "underline" };

const listStyle: React.CSSProperties = {
  paddingLeft: "20px",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  margin: 0,
};

const dangerBtnStyle: React.CSSProperties = {
  padding: "9px 20px",
  borderRadius: "6px",
  border: "1px solid #ef4444",
  background: "transparent",
  color: "#ef4444",
  fontWeight: 600,
  fontSize: "14px",
  cursor: "pointer",
};
