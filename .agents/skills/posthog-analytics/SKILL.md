---
name: posthog-analytics
description: Use PostHog safely for product analytics verification, funnels, feature flags, experiments, replay and release checks while keeping analytics non-authoritative.
---

# PostHog Analytics

Use when a project uses PostHog for product analytics, flags, experiments, replay, error investigation or release verification.

Pair this skill with `analytics-contract` whenever events or properties change.

## Connection first

Before relying on PostHog:
1. verify the PostHog connector/plugin is actually connected in the current host,
2. perform a harmless read,
3. confirm the intended PostHog project/environment,
4. confirm read/write permission,
5. only then query or modify flags/experiments.

Never claim PostHog verification if the connector is unavailable.

## Event discipline

The repository analytics contract is authoritative for event names, triggers, allowed properties, property types, identity rules, forbidden PII and migrations.

Prefer explicit business events such as `enquiry_submitted`, `estimate_viewed` and `quotation_downloaded` over generic click events.

Analytics is evidence, not business truth. Pricing, auth, payments, booking, entitlement, invoices and other transactional decisions must continue to work when PostHog is unavailable.

## Privacy

Do not send:
- passwords or auth tokens,
- payment details,
- free-form message bodies by default,
- precise addresses,
- raw email/phone values unless explicitly required and documented,
- sensitive health/legal/financial data.

Prefer anonymous or pseudonymous IDs and allow-listed properties.

## Release verification

When PostHog is connected, verify:
1. the expected project/environment,
2. expected release events arrive,
3. event duplication and property shape,
4. error/replay evidence only where consent/privacy permits,
5. feature flags have safe defaults and rollback values,
6. analytics failures do not break product flows.

Record evidence without copying sensitive payloads into Git.

## Flags and experiments

Before a write:
- verify project/environment,
- state the audience/rollout change,
- preserve the previous value for rollback,
- do not use a flag as the only safety boundary for sensitive behavior,
- verify both enabled and disabled paths where material.

## Failure mode

If PostHog is unavailable:
- keep the product flow operational,
- verify instrumentation locally/browser-side where possible,
- record the missing external verification,
- do not invent analytics results.
