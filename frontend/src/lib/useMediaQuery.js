/**
 * useMediaQuery + viewport-breakpoint helpers.
 *
 * The codebase uses inline styles (no Tailwind in JSX, just the plugin
 * for the CSS reset), so responsive logic lives in JS instead of CSS.
 * Components call useIsMobile() and conditionally render or restyle
 * based on the boolean.
 *
 * SSR/StrictMode safe — falls back to false when window.matchMedia
 * isn't available, hydrates correctly on mount.
 */

import { useEffect, useState } from "react";

// Threshold below which we switch to the mobile UI. 768px is the
// standard "iPad portrait / phone landscape" cutoff most responsive
// frameworks settle on; below it, the desktop layouts (with their
// fixed-width nav segments, sidebar Classroom layout, etc.) get
// painful. Above it, desktop UI wins.
//
// Bumping this would mostly affect tablets — set to 768 in v1 so a
// landscape iPhone still gets the mobile UI (its width is ~926).
export const MOBILE_BREAKPOINT_PX = 768;

/**
 * Subscribe to a media query string. Returns its current match.
 *
 * @param {string} query  e.g. "(max-width: 768px)" or "(orientation: portrait)"
 * @returns {boolean}
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mql = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    // Set once on mount in case the query value changed between the
    // initial useState lazy init and the effect firing (rare, but
    // happens with router-driven query rebuilds).
    setMatches(mql.matches);
    // addEventListener replaced addListener in modern browsers; both
    // work on Safari 14+, which is the floor we care about for the
    // PWA install target.
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

/**
 * True when the viewport is at-or-below the mobile breakpoint.
 * The single switch every component checks to render its mobile
 * variant. Centralized so we can move the breakpoint in one place.
 */
export function useIsMobile() {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);
}
