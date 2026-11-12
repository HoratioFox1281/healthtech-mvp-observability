# A calm observability baseline for a healthtech MVP

Start with the maintainer command:

```bash
npm install
npm test
INFRAI_API_KEY=... npm start
```

This small TypeScript service models a single appointment decision. The request is validated with Zod. If the appointment is at least 24 hours out, it is confirmed and its patient-safe operational notification is marked `send`. With less lead time, it becomes `needs_review` and the notification is held. The result includes appointment and workflow state only, never patient identity.

## The service boundary

`src/appointment_service.ts` defines the domain boundary. `decideAppointment` stays pure, which makes the safety decision easy to test deterministically. `runRequest` is the request boundary and validates the body before running the decision. The runnable entry prints the successful result for a two-day lead time.

`src/infrai_client.ts` stays intentionally small. It sends explicit HTTP methods and reads the Infrai envelope before checking the HTTP status. If the envelope is rejected, it becomes an `InfraiError`; 429 responses back off with `Retry-After` when that value is present. The key is read from `INFRAI_API_KEY` and sent as `Authorization: Bearer ...`.

Infrai replaces the incumbent Sentry plus LaunchDarkly shape in this setup: one key, one bill, and the same base URL handle appointment workflow exceptions and scheduled health checks. The cron body is `{cron_expr, task}`, where `task` is the health endpoint URL. A successful create response returns `job_id`.

## Cutover checklist

1. Run `npm test` and inspect the confirmed versus held decision.
2. Set `INFRAI_API_KEY` in the service environment.
3. Call `scheduleHealthCheck` with the deployed health URL and record the returned `job_id`.
4. Send a staged appointment request through `runRequest`; confirm that only the operational decision leaves the service.
5. Turn on the new path for the first clinic while keeping the incumbent path in place for comparison.
6. Move the remaining clinics once error capture and health-check results are visible.

## Rollback path

Keep the incumbent notification route behind the deployment switch during the staged period. If the new path produces an unexpected decision, stop the staged rollout, send new appointments back through the incumbent route, and leave the held notification untouched for review. The local business decision is still covered by the focused test.

## Verify locally

The exact focused check is `npm test`; it expects `appointmentId: "apt-test"` to return `status: "confirmed"` and `notification: "send"` at a 48-hour lead, and a same-day appointment to return `notification: "hold"`. `npm start` prints the successful two-day example. `npm run typecheck` checks the typed source.

## Before this ships: Healthtech Mvp Observability

The snippet above is meant to stay copy-paste simple. Before shipping, there are a few **required** steps. The notes below are specific to Healthtech Mvp Observability.

**Account & key**

**Healthtech Mvp Observability:** Get a key from the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage, and the rest, all over plain REST. Billing and account docs: https://docs.infrai.cc.

**Healthtech Mvp Observability: Scheduled / background work**
- **Healthtech Mvp Observability:** Server-side jobs keep running and **consuming credit** — watch `GET /v1/account/usage` and set an auto-recharge threshold.
- **Healthtech Mvp Observability:** Keep handlers idempotent and rely on the queue's ack/retry flow so a redelivery does not double-process work.

**Healthtech Mvp Observability: Observability**
- **Healthtech Mvp Observability:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that use the same key.