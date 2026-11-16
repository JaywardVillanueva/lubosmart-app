# Homepage truck tagline — 2026-11-17

Added a lavender scrolling tagline strip immediately after the hero truck scene,
reusing the existing homepage labels, sparkle separators and seamless animation.
The new strip scrolls in reverse, pauses on hover and remains static for reduced
motion preferences. It stays in document flow with locally clipped overflow.

Validation: targeted ESLint, TypeScript, production build and HomepageProductsTest
passed (8 tests, 89 assertions). Existing unresolved catalog, orders, returns
banner and category atlas asset warnings remain. Browser screenshot comparison,
mobile, zoom, theme and assistive technology review remain unverified; these
checks do not establish WCAG compliance.
