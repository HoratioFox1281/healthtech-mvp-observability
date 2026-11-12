import assert from "node:assert/strict";
import { decideAppointment } from "./appointment_service.ts";

const now = new Date("2026-01-01T09:00:00.000Z");
const input = {
  appointmentId: "apt-test",
  patientId: "patient-test",
  clinicianId: "clinician-test",
  startsAt: "2026-01-03T09:00:00.000Z",
  channel: "sms" as const,
};

assert.deepEqual(decideAppointment(input, now), {
  appointmentId: "apt-test",
  status: "confirmed",
  notification: "send",
});

assert.equal(decideAppointment({ ...input, startsAt: "2026-01-01T20:00:00.000Z" }, now).notification, "hold");
console.log("appointment decision test passed");
