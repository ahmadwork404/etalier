"use client";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Upload, X } from "lucide-react";
import { RecordVisual } from "./RecordVisual";
import { toast } from "./Toasts";
type PhotoCustomer = {
  id: string;
  name: string;
  photo_media_id?: string | null;
};
export function CustomerAvatar({
  customer,
  photoUrl,
}: {
  customer: PhotoCustomer;
  photoUrl?: string;
}) {
  const source =
    photoUrl ||
    (customer.photo_media_id
      ? `/api/v1/customers/${customer.id}/photo?v=${customer.photo_media_id}`
      : "");
  const [failed, setFailed] = useState("");
  return source && failed !== source ? (
    <img
      className="customer-photo"
      src={source}
      alt={customer.name}
      width={54}
      height={54}
      onError={() => setFailed(source)}
    />
  ) : (
    <RecordVisual
      name={customer.name}
      kind="customers"
      identity={customer.id}
    />
  );
}
async function request(path: string, body: unknown) {
  const response = await fetch("/api/v1/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok)
    throw Error(
      Object.values(payload.error?.issues?.fieldErrors || {})
        .flat()
        .join(" ") ||
        payload.error?.message ||
        "Photo upload failed",
    );
  return payload.data;
}
export function CustomerPhotoUpload({ customer }: { customer: PhotoCustomer }) {
  const cache = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [savedPhotoId, setSavedPhotoId] = useState<string | null>(null);
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
  async function upload() {
    if (!file || busy) return;
    setBusy(true);
    try {
      const signed = await request(`customers/${customer.id}/photo/upload`, {
        content_type: file.type,
        size_bytes: file.size,
      });
      const response = await fetch(signed.url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok)
        throw Error(
          "Photo could not be uploaded. Check the storage bucket’s CORS configuration.",
        );
      const verified = await request(
        `customers/${customer.id}/photo/${signed.media_id}/verify`,
        {},
      );
      setSavedPhotoId(verified.photo_media_id);
      await cache.invalidateQueries();
      setFile(null);
      if (input.current) input.current.value = "";
      toast.success("Customer photo updated.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="customer-photo-editor">
      {preview ? (
        <img
          className="customer-photo photo-preview"
          src={preview}
          alt="Selected customer photo preview"
          width={70}
          height={70}
        />
      ) : (
        <CustomerAvatar
          customer={
            savedPhotoId
              ? { ...customer, photo_media_id: savedPhotoId }
              : customer
          }
        />
      )}
      <input
        ref={input}
        className="sr-only"
        aria-label="Choose customer photo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          if (!chosen) return;
          if (
            !["image/jpeg", "image/png", "image/webp"].includes(chosen.type) ||
            chosen.size > 5 * 1024 * 1024 ||
            !chosen.size
          ) {
            toast.error("Choose a JPG, PNG or WebP photo up to 5 MB.");
            event.target.value = "";
            return;
          }
          setFile(chosen);
        }}
      />
      <div>
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
          <div className="photo-upload-actions">
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={upload}
            >
              <Upload size={15} />
              {busy ? "Uploading…" : "Upload photo"}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              aria-label="Cancel photo selection"
              onClick={() => {
                setFile(null);
                if (input.current) input.current.value = "";
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}
        <small>
          {file
            ? "Preview only until uploaded"
            : "JPG, PNG or WebP · up to 5 MB"}
        </small>
      </div>
    </div>
  );
}
