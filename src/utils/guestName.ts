// src/utils/guestName.ts
export function getOrCreateGuestName() {
    const key = "guest_name";
    let name = localStorage.getItem(key);
    if (name) return name;
  
    // safe-ish unique suffix
    const suffix = crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(16).slice(2, 10);
    name = `Guest_${suffix}`;
    localStorage.setItem(key, name);
    return name;
  }
  