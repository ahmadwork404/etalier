"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Power } from "lucide-react";
import { toast } from "./Toasts";
export function EmployeeStatus({
  employee,
  canEdit,
}: {
  employee: any;
  canEdit: boolean;
}) {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={`employee-status-toggle badge ${employee.active ? "on" : "warning"}`}
      aria-label={`${employee.active ? "Deactivate" : "Activate"} ${employee.name}`}
      aria-pressed={employee.active}
      disabled={busy || !canEdit}
      title={
        employee.active
          ? "Deactivate for new work and bookings"
          : "Activate for new work and bookings"
      }
      onClick={async () => {
        if (busy || !canEdit) return;
        setBusy(true);
        try {
          const response = await fetch(
            `/api/v1/records/employees/${employee.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ active: !employee.active }),
            },
          );
          const payload = await response.json();
          if (!response.ok)
            throw Error(payload.error?.message || "Unable to update employee");
          await cache.invalidateQueries();
          toast.success(
            employee.active
              ? "Employee deactivated. Existing history is retained."
              : "Employee activated.",
          );
        } catch (error) {
          toast.error((error as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Power size={14} />
      {busy ? "Saving…" : employee.active ? "Active" : "Inactive"}
    </button>
  );
}
