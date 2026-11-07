// Pick a club from one A to Z list with a search box. Opens as a sheet over the setup screen.

import { useEffect, useRef, useState } from "react";
import { CLUB_BY_ID, searchClubs } from "../game/clubs";

export function ClubPicker({ value, onChange, label }: { value: string; onChange: (id: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const current = value ? CLUB_BY_ID[value]?.name : null;
  return (
    <>
      <button type="button" className="club-btn" aria-label={`${label}: ${current ?? "No club"}. Change`} onClick={() => setOpen(true)}>
        <span>{current ?? "No club (general questions only)"}</span>
        <small>Change</small>
      </button>
      {open && <ClubSheet value={value} label={label} onPick={(id) => { onChange(id); setOpen(false); }} onClose={() => setOpen(false)} />}
    </>
  );
}

function ClubSheet({ value, label, onPick, onClose }: { value: string; label: string; onPick: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const list = searchClubs(q);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet club-sheet" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2>{label}</h2>
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
        </header>
        <input ref={input} type="search" className="club-search" placeholder="Search 92 clubs" value={q} aria-label="Search clubs"
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && list[0]) onPick(list[0].id); }} />
        <ul className="club-list" role="listbox" aria-label="Clubs">
          {!q && (
            <li><button type="button" role="option" aria-selected={!value} className={!value ? "on" : ""} onClick={() => onPick("")}>No club <small>general questions only</small></button></li>
          )}
          {list.map((c) => (
            <li key={c.id}><button type="button" role="option" aria-selected={value === c.id} className={value === c.id ? "on" : ""} onClick={() => onPick(c.id)}>{c.name}</button></li>
          ))}
          {!list.length && <li className="muted">No club called "{q}"</li>}
        </ul>
      </section>
    </div>
  );
}
