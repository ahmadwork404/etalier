"use client";
import { useSyncExternalStore, type SetStateAction } from "react";
import { pageForPath, workspaceRoutes } from "./workspaceRoutes";
function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener("atelier:url", listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener("atelier:url", listener);
  };
}
function snapshot() {
  return window.location.pathname + window.location.search;
}
export function useUrlLocation() {
  return useSyncExternalStore(subscribe, snapshot, () => "/");
}
export function goToUrl(target: string, replace = false) {
  if (!target.startsWith("/") || target.startsWith("//")) return;
  if (snapshot() === target) return;
  const changedPage =
    window.location.pathname !==
    new URL(target, window.location.origin).pathname;
  window.history[replace ? "replaceState" : "pushState"](null, "", target);
  window.dispatchEvent(new Event("atelier:url"));
  if (changedPage) window.scrollTo(0, 0);
}
export function returnDestination(location: string) {
  const url = new URL(location, "http://local");
  const value = url.searchParams.get("returnTo") || "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  const target = new URL(value, "http://local");
  return Object.values(workspaceRoutes).includes(target.pathname) ||
    /^\/customers\/[\da-f-]{36}$/i.test(target.pathname)
    ? target.pathname + target.search
    : "/";
}
export function replaceLocation(target: string) {
  goToUrl(target, true);
}
export function navigateTo(page: string) {
  const path = workspaceRoutes[page];
  if (!path) return;
  goToUrl(path);
}
export function useWorkspacePage(): [string, (page: string) => void] {
  return [pageForPath(useUrlLocation().split("?")[0]), navigateTo];
}
export function useUrlParam(
  name: string,
  fallback = "",
  validate: (value: string) => boolean = () => true,
): [string, (value: SetStateAction<string>) => void] {
  const currentUrl = useUrlLocation();
  const raw = new URL(currentUrl, "http://local").searchParams.get(name);
  const value = raw !== null && validate(raw) ? raw : fallback;
  const update = (next: SetStateAction<string>) => {
    const url = new URL(window.location.href);
    const current = url.searchParams.get(name);
    const validCurrent =
      current !== null && validate(current) ? current : fallback;
    const resolved = typeof next === "function" ? next(validCurrent) : next;
    if (!validate(resolved)) return;
    if (!resolved) url.searchParams.delete(name);
    else url.searchParams.set(name, resolved);
    if (name === "q") url.searchParams.delete("page");
    const target = url.pathname + url.search;
    if (target === snapshot()) return;
    window.history.pushState(null, "", target);
    window.dispatchEvent(new Event("atelier:url"));
  };
  return [value, update];
}
export function useUrlPage(): [
  number,
  (value: SetStateAction<number>) => void,
] {
  const [raw, setRaw] = useUrlParam("page", "1", (value) =>
    /^[1-9]\d{0,5}$/.test(value),
  );
  return [
    Number(raw),
    (next) =>
      setRaw((previous) =>
        String(typeof next === "function" ? next(Number(previous)) : next),
      ),
  ];
}
export const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
