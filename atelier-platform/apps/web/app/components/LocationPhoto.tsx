"use client";
import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus, MapPin } from "lucide-react";
import { toast } from "./Toasts";
export function LocationVisual({ location }: { location: any }) {
  const [failed, setFailed] = useState(false);
  return location.image_version && !failed ? (
    <img
      className="location-photo"
      src={`/api/v1/location-profiles/${location.id}/photo?v=${location.image_version}`}
      alt={location.name}
      onError={() => setFailed(true)}
    />
  ) : (
    <span className="location-photo location-photo-placeholder">
      <MapPin size={24} />
    </span>
  );
}
export function LocationPhotoEditor({ location }: { location: any }) {
  const input = useRef<HTMLInputElement>(null),
    cache = useQueryClient();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function upload(file?: File) {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      setError("Choose a JPG, PNG or WebP image up to 2 MB.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/v1/location-profiles/${location.id}/photo`, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        }),
        b = await r.json();
      if (!r.ok) throw Error(b.error?.message || "Unable to upload photo");
      await cache.invalidateQueries();
      toast.success("Location photo updated.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  async function remove() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/v1/location-profiles/${location.id}/photo`, {
          method: "DELETE",
        }),
        b = await r.json();
      if (!r.ok) throw Error(b.error?.message || "Unable to remove photo");
      await cache.invalidateQueries();
      toast.success("Location photo removed.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="location-photo-editor">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label="Location photo"
        onChange={(e) => upload(e.target.files?.[0])}
      />
      <button
        className="secondary"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        <ImagePlus size={16} />
        {busy
          ? "Saving…"
          : location.image_version
            ? "Change photo"
            : "Upload photo"}
      </button>
      {location.image_version && (
        <button className="text-button" disabled={busy} onClick={remove}>
          Remove photo
        </button>
      )}
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
