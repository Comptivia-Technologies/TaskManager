/**
 * Split point for Framer Motion's DOM feature set.
 *
 * Importing `domAnimation` directly puts it in the main chunk, which defeats the
 * point of LazyMotion. Loading it through this module lets the bundler give it its
 * own chunk, fetched after first paint — the first frame of the app does not need it.
 */
export { domAnimation as default } from 'framer-motion';
