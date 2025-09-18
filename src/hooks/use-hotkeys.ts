import { useEffect } from "react";

type Hotkey = {
  combo: string; // e.g. "mod+s", "mod+n", "mod+\\"
  handler: (e: KeyboardEvent) => void;
  enabled?: boolean | (() => boolean);
};

function normalize(combo: string) {
  return combo
    .toLowerCase()
    .replace("cmd", "mod")
    .replace("ctrl", "mod")
    .replace(/\s+/g, "");
}

function matches(e: KeyboardEvent, combo: string) {
  const c = normalize(combo);
  const parts = c.split("+");
  const needMod = parts.includes("mod");
  const key = parts[parts.length - 1];

  // Determine pressed key string
  const pressed = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();

  const modOk = !needMod || e.ctrlKey || e.metaKey;
  const altOk = parts.includes("alt") ? e.altKey : true; // allow Alt/AltGr when not explicitly required
  const shiftReq = parts.includes("shift");
  const shiftOk = shiftReq ? e.shiftKey : true;

  return modOk && altOk && shiftOk && pressed === key;
}

export function useHotkeys(hotkeys: Hotkey[]) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      for (const hk of hotkeys) {
        const enabled = typeof hk.enabled === "function" ? hk.enabled() : hk.enabled ?? true;
        if (!enabled) continue;
        if (matches(e, hk.combo)) {
          e.preventDefault();
          hk.handler(e);
          break;
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hotkeys]);
}

export default useHotkeys;
