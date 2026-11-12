import { z } from "zod";
import { infrai } from "./infrai_client.ts";

export const appointmentRequest = z.object({
  appointmentId: z.string().min(1),
  patientId: z.string().min(1),
  clinicianId: z.string().min(1),
  startsAt: z.string().datetime(),
  channel: z.enum(["sms", "email"]),
});

export type AppointmentRequest = z.infer<typeof appointmentRequest>;

export type AppointmentDecision = {
  appointmentId: string;
  status: "confirmed" | "needs_review";
  notification: "send" | "hold";
};

export function decideAppointment(input: AppointmentRequest, now: Date): AppointmentDecision {
  const start = new Date(input.startsAt).getTime();
  const leadHours = (start - now.getTime()) / 3_600_000;
  const safeToNotify = leadHours >= 24;
  return {
    appointmentId: input.appointmentId,
    status: safeToNotify ? "confirmed" : "needs_review",
    notification: safeToNotify ? "send" : "hold",
  };
}

export async function captureAppointmentException(error: unknown, appointmentId: string): Promise<void> {
  await infrai.errors.capture({
    exception: `${error instanceof Error ? error.name : "Error"}: appointment workflow failed`,
    context: { appointmentId, service: "appointment-workflow" },
  });
}

export async function scheduleHealthCheck(taskUrl: string): Promise<{ job_id: string }> {
  return infrai.cron.create({ cron_expr: "*/5 * * * *", task: taskUrl });
}

export async function runRequest(body: unknown, now = new Date()): Promise<AppointmentDecision> {
  const input = appointmentRequest.parse(body);
  return decideAppointment(input, now);
}

if (process.argv[1]?.endsWith("appointment_service.ts")) {
  const example = {
    appointmentId: "apt-1001",
    patientId: "patient-204",
    clinicianId: "clinician-18",
    startsAt: new Date(Date.now() + 48 * 3_600_000).toISOString(),
    channel: "sms",
  };
  console.log(await runRequest(example));
}
