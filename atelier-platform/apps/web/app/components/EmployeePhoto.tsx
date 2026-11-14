"use client";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Upload, X } from "lucide-react";
import { RecordVisual } from "./RecordVisual";
import { toast } from "./Toasts";
export function EmployeeAvatar({ employee }: { employee: any }) {
  const [failed, setFailed] = useState("");
  const src = employee.image_version
    ? `/api/v1/employee-profiles/${employee.id}/photo?v=${employee.image_version}`
    : "";
  return src && failed !== src ? (
    <img
      className="customer-photo employee-photo"
      src={src}
      alt={employee.name}
      width={64}
      height={64}
      onError={() => setFailed(src)}
    />
  ) : (
    <RecordVisual
      kind="employees"
      name={employee.name}
      identity={employee.id}
    />
  );
}
export function EmployeePhotoEditor({ employee }: { employee: any }) {
  const cache = useQueryClient(),
    input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <div className="employee-photo-editor">
      {preview ? (
        <img
          className="customer-photo"
          src={preview}
          alt="Selected employee photo preview"
        />
      ) : (
        <EmployeeAvatar employee={employee} />
      )}
      <div>
        <input
          ref={input}
          className="sr-only"
          aria-label="Choose employee photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            if (!chosen) return;
            if (
              !["image/jpeg", "image/png", "image/webp"].includes(
                chosen.type,
              ) ||
              !chosen.size ||
              chosen.size > 2 * 1024 * 1024
            ) {
              toast.error("Choose a JPG, PNG or WebP image up to 2 MB.");
              event.target.value = "";
              return;
            }
            setFile(chosen);
          }}
        />
        <div className="photo-upload-actions">
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            <Camera size={15} />
            {file ? "Choose another" : "Change photo"}
          </button>
          {file && (
            <>
              <button
                type="button"
                className="primary"
                disabled={busy}
                onClick={async () => {
                  if (!file || busy) return;
                  setBusy(true);
                  try {
                    const response = await fetch(
                      `/api/v1/employee-profiles/${employee.id}/photo`,
                      {
                        method: "PUT",
                        headers: { "Content-Type": file.type },
                        body: file,
                      },
                    );
                    const payload = await response.json();
                    if (!response.ok)
                      throw Error(
                        payload.error?.message || "Unable to upload photo",
                      );
                    await cache.invalidateQueries();
                    setFile(null);
                    if (input.current) input.current.value = "";
                    toast.success("Employee photo updated.");
                  } catch (error) {
                    toast.error((error as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Upload size={15} />
                {busy ? "Uploading…" : "Save photo"}
              </button>
              <button
                type="button"
                aria-label="Cancel employee photo selection"
                disabled={busy}
                onClick={() => {
                  setFile(null);
                  if (input.current) input.current.value = "";
                }}
              >
                <X size={16} />
              </button>
            </>
          )}
        </div>
        <small>JPG, PNG or WebP · up to 2 MB</small>
      </div>
    </div>
  );
}
