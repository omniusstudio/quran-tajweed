// A cloth bookmark ribbon hanging from the top edge of the page, as in a bound muṣḥaf.
export function Ribbon({ pinned, onClick, title }: { pinned: boolean; onClick: () => void; title: string }) {
  return (
    <button className={`ribbon${pinned ? ' pinned' : ''}`} onClick={(e) => { e.stopPropagation(); onClick(); }} aria-label={title} title={title}>
      <svg viewBox="0 0 28 120" width="28" height="120" aria-hidden focusable="false">
        <path className="rib-shadow" d="M5 0h20v104l-10-12-10 12z" />
        <path className="rib-body" d="M3 0h20v104l-10-12-10 12z" />
        <path className="rib-edge" d="M3 0h4v99l-2 2.5-2-2.5z" />
        <path className="rib-edge" d="M19 0h4v99l-2 2.5-2-2.5z" />
        <path className="rib-sheen" d="M9 0h3v100l-1.5-2-1.5 2z" />
      </svg>
    </button>
  );
}
