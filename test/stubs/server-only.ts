// Tests run outside the React Server Components bundler, where the real "server-only" package
// throws on import. The guarantee it gives (no server code in client bundles) is still enforced by
// `next build`.
export {};
