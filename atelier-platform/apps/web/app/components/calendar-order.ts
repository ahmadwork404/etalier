export type CalendarAppointment = {
  id: string;
  starts_at: string;
  ends_at?: string;
  status: string;
  [key: string]: any;
};
const terminal = new Set(["completed", "cancelled", "no_show", "rescheduled"]);
export function appointmentPhase(
  appointment: CalendarAppointment,
  now: number,
) {
  const start = new Date(appointment.starts_at).getTime();
  const end = new Date(appointment.ends_at || appointment.starts_at).getTime();
  if (terminal.has(appointment.status)) return "finished";
  if (start <= now && end > now) return "now";
  return start > now ? "upcoming" : "past";
}
export function prioritizeAppointments(
  items: CalendarAppointment[],
  now: number,
) {
  const rank = { now: 0, upcoming: 1, past: 2, finished: 3 };
  return [...items].sort((a, b) => {
    const phaseA = appointmentPhase(a, now),
      phaseB = appointmentPhase(b, now);
    return (
      rank[phaseA] - rank[phaseB] ||
      (phaseA === "now" || phaseA === "upcoming" ? 1 : -1) *
        (Date.parse(a.starts_at) - Date.parse(b.starts_at)) ||
      a.id.localeCompare(b.id)
    );
  });
}
