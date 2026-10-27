# Security review — initial Pagechime implementation

Reviewed 2026-10-23 by an independent read-only agent under AGENTS.md. Findings were repaired: imported-book availability during library/network failure; manual page/bookmark persistence; partial offline download cleanup; native import persistence/cleanup; PDF error recovery; legacy WebKit PDF compatibility; native per-source player identity and asynchronous generation guards; schema validation before rendering.

No application secrets are committed or embedded in clients. The initial release had no backend; REQ-007 adds the isolated account API described below. No payment flow, analytics or microphone requirement. The full book is restricted to ignored private build inputs and owner-private hosting. Imports use parsed PDF/text data, never injected HTML. Cached downloads reject redirects/HTML login pages. Native PDF WebView permits only its synthetic local document and blob worker URLs.

## Open tooling advisory — REQ-005

Full-monorepo `npm audit --omit=dev --audit-level=high` reports four high-severity affected dependency nodes from one advisory: [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), node-forge <=1.4.0, via Expo CLI and @expo/code-signing-certificates. npm latest is 1.4.0 and upstream lists no patched version. Downgrading to Expo 44 is not an acceptable repair. No crypto fork or audit-result suppression is introduced.

The issue concerns RSA PKCS#1 v1.5 signature verification accepting extra nested DigestAlgorithm elements. Independent review traced the affected code to Expo CLI certificate/signature utilities. This app does not configure Expo Updates, an EAS project ID or signed OTA manifests. Static Next.js output and Metro app bundles do not include node-forge or code-signing-certificates. Metro export does not invoke the CLI's manifest signature verification boundary. No affected verification boundary was demonstrated in the deployed web reader or unsigned exported bundles; this does not certify future signing/OTA paths.

The **blocking web release audit** is `npm audit --workspace @pagechime/web --workspace @pagechime/core --omit=dev --audit-level=high` and returns zero vulnerabilities. CI additionally runs the full tooling audit as a clearly named, non-blocking diagnostic job; it remains failing and visible until upstream remediation. The whole repository is not claimed audit-clean.

Recheck when node-forge/Expo releases a fix, and before any signed native, app-store or Expo OTA delivery. REQ-005 remains open. Real-device, signing and OTA verification are outside the completed initial export evidence.

## Custom reader accounts — REQ-007

Independent review confirmed the final schema, custom authentication and client boundaries after repairing revocation races, null input/pagination, offline worker restarts, expiry and logout retry/storage failures, stale async callbacks and delayed cookie clearing. The payload/retention migration was separately cleared before application. Actual SQL and public hosted denied-path checks passed; account/browser/native export evidence and hosted limits are recorded in [reader account setup](READER-ACCOUNTS.md). The tables intentionally deny all anon/authenticated grants; service-role-only API calls derive ownership from verified opaque sessions. No Supabase Auth user is required. Netlify routing and successful hosted account flows must be checked after deployment; source/fixture checks do not establish those runtime outcomes.

A reviewed Gitleaks false positive matched the public Supabase function resource UUID in historical commit27f8632, Current Handoff line20. `.gitleaksignore` names exactly that commit/file/rule/line fingerprint, with its rationale; no scan rule or path is disabled. The UUID identifies a resource and grants no access. Rerun the identical8.24.3 history scan after this repair.
