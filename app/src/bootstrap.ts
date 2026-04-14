/**
 * Dedicated entry so Node globals (`Buffer`, `process`) are installed before Vite/React
 * injects any preamble that references other modules.
 */
import './polyfill-buffer'
import './main'
