"use client";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, X } from "lucide-react";
import { RecordVisual } from "./RecordVisual";
import { toast } from "./Toasts";

type Service = {
  id: string;
  name: string;
  icon_key?: string;
  image_version?: string | null;
};
export function ServiceVisual({ service }: { service: Service }) {
  const [failed, setFailed] = useState("");
  const src = service.image_version
    ? `/api/v1/services/${service.id}/image?v=${service.image_version}`
    : "";
  return src && failed !== src ? (
    <img
      className="service-image"
      src={src}
      width={54}
      height={54}
      alt={service.name}
      onError={() => setFailed(src)}
    />
  ) : (
    <RecordVisual
      kind="services"
      name={service.name}
      identity={service.id}
      iconKey={service.icon_key}
    />
  );
}
const presets = [
  ["auto", "Automatic"],
  ["haircut", "Haircut"],
  ["color", "Coloring"],
  ["wash", "Hair wash"],
  ["facial", "Facial"],
  ["nails", "Nails"],
  ["massage", "Massage"],
  ["brows", "Brows"],
] as const;
export function ServiceImageEditor({ service }: { service: Service }) {
  const cache = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState(service);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setCurrent(service);
  }, [service.image_version, service.icon_key]);
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function save(icon?: string) {
    if (busy || (icon === undefined && !file)) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/v1/services/${service.id}/${icon === undefined ? "image" : "visual"}`,
        {
          method: icon === undefined ? "PUT" : "PATCH",
          headers: {
            "Content-Type":
              icon === undefined ? file!.type : "application/json",
          },
          body: icon === undefined ? file! : JSON.stringify({ icon_key: icon }),
        },
      );
      const payload = await response.json();
      if (!response.ok)
        throw Error(payload.error?.message || "Unable to save service image");
      setCurrent((value) => ({ ...value, ...payload.data }));
      setFile(null);
      if (input.current) input.current.value = "";
      await cache.invalidateQueries();
      toast.success(
        icon === undefined ? "Service image uploaded." : "Service icon saved.",
      );
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="service-image-editor" aria-label="Service image">
      <h3>Service image</h3>
      <div className="service-image-preview">
        {preview ? (
          <img
            className="service-image"
            src={preview}
            alt="Selected service image preview"
            width={72}
            height={72}
          />
        ) : (
          <ServiceVisual service={current} />
        )}
        <div>
          <strong>
            {file ? file.name : "Choose a standard icon or upload your own"}
          </strong>
          <small>
            JPG, PNG or WebP · up to 2 MB. Images and icons save immediately.
          </small>
        </div>
      </div>
      <div
        className="service-icon-options"
        role="group"
        aria-label="Standard service icons"
      >
        {presets.map(([key, label]) => (
          <button
            type="button"
            key={key}
            className="service-icon-option"
            aria-pressed={
              !current.image_version && (current.icon_key || "auto") === key
            }
            disabled={busy}
            onClick={() => save(key)}
          >
            <RecordVisual
              kind="services"
              name={label}
              identity={key}
              iconKey={key}
            />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <input
        ref={input}
        className="sr-only"
        type="file"
        aria-label="Choose service image"
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          if (!chosen) return;
          if (
            !["image/jpeg", "image/png", "image/webp"].includes(chosen.type) ||
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
          <Upload size={16} />
          {file ? "Choose another" : "Upload your own image"}
        </button>
        {file && (
          <>
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => save()}
            >
              {busy ? "Saving…" : "Save image"}
            </button>
            <button
              type="button"
              aria-label="Cancel image selection"
              disabled={busy}
              onClick={() => {
                setFile(null);
                if (input.current) input.current.value = "";
              }}
            >
              <X size={17} />
            </button>
          </>
        )}
      </div>
      {current.image_version && (
        <small>Choose a standard icon to replace the uploaded image.</small>
      )}
    </section>
  );
}
