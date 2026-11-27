# PinableDesktop compatibility packaging

The CodeGraph source, viewer, databases, MCP, and npm metadata are unmodified
from upstream `3c230869878559f3f96bf5580b2d2c66dcf138e7`. Pinable themes, translations, star maps, G6
and the fork-only analysis workbench are not carried forward.

Only Desktop's existing distribution contract is retained: the six platform
bundles, the launcher and verified runtime manifest. Desktop's current
installer cannot consume the upstream ZIP or tarball directly. Do not run the
upstream GitHub publishing or Pages workflows on this fork.

The upstream source still reports 1.6.4; existing Pinable runtime users may
already have 1.6.5. Desktop selects by semantic version and will not upgrade
1.6.5 to 1.6.4. For that reason this branch only builds unpublished test
artifacts. Enable publication after Desktop can select verified upstream
artifacts directly, or once a newer upstream version can use the existing
contract. Existing release assets must not be retagged or removed.

For a migration smoke test, first index a disposable source tree, then check
`init`, `ui --no-open` on loopback and `serve --mcp`. Do not remove a user's
existing index automatically. Verify migration against a copy or request a
rebuild from source if needed.
