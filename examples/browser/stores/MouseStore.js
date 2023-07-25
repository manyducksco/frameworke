import { Writable } from "@borf/browser";

/**
 * Tracks the mouse position.
 */
export function MouseStore(c) {
  const $$position = new Writable({ x: 0, y: 0 });

  c.onConnected(() => {
    c.log("listening for mousemove events");

    window.addEventListener("mousemove", (e) => {
      $$position.value = { x: e.clientX, y: e.clientY };
    });
  });

  return {
    $position: $$position.toReadable(),
  };
}
