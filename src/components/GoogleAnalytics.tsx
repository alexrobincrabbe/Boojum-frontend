import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const GA_MEASUREMENT_ID = "G-RD9WQXRB98";

/**
 * Enables GA4 storage consent and sends SPA page views.
 * Only mount when the user has accepted analytics cookies.
 */
export default function GoogleAnalytics() {
  const location = useLocation();
  const consentGranted = useRef(false);

  useEffect(() => {
    if (typeof window.gtag !== "function") return;

    if (!consentGranted.current) {
      window.gtag("consent", "update", {
        ad_storage: "denied",
        analytics_storage: "granted",
      });
      consentGranted.current = true;
    }

    window.gtag("event", "page_view", {
      page_path: location.pathname + location.search,
      page_title: document.title,
      send_to: GA_MEASUREMENT_ID,
    });
  }, [location.pathname, location.search]);

  return null;
}
