import { tileName, type Meld } from "../logic/engine";

const INK = "#1B1B1B";
const RED = "#C62828";
const GREEN = "#1E7A3E";
const BLUE = "#1F4F9E";
const IVORY = "#F8F4E8";
const NUMS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
const HONORS = ["東", "南", "西", "北", "中", "發", "白"];

function suitOf(t: number): number {
  return t < 27 ? Math.floor(t / 9) : 3;
}

function dot(key: string, cx: number, cy: number, r: number, c: string) {
  return (
    <g key={key}>
      <circle cx={cx} cy={cy} r={r} fill={c} />
      <circle cx={cx} cy={cy} r={r * 0.62} fill="none" stroke={IVORY} strokeWidth={r * 0.2} />
      <circle cx={cx} cy={cy} r={r * 0.22} fill={IVORY} />
    </g>
  );
}
function stick(key: string, cx: number, cy: number, h: number, c: string, rot?: number) {
  return (
    <g key={key} transform={rot ? `rotate(${rot} ${cx} ${cy})` : undefined}>
      <rect x={cx - 2.1} y={cy - h / 2} width={4.2} height={h} rx={2} fill={c} />
      <line x1={cx - 2.1} x2={cx + 2.1} y1={cy} y2={cy} stroke={IVORY} strokeWidth={0.9} />
      <line x1={cx} x2={cx} y1={cy - h / 2 + 1.5} y2={cy + h / 2 - 1.5} stroke={IVORY} strokeWidth={0.5} opacity={0.6} />
    </g>
  );
}

export function tileFace(t: number) {
  const n = (t % 9) + 1;
  const font = '"Noto Sans TC","Songti TC",serif';
  if (t >= 27) {
    if (t === 33) return <rect x={6.5} y={8} width={17} height={26} rx={1.5} fill="none" stroke={BLUE} strokeWidth={2.2} />;
    const c = t === 31 ? RED : t === 32 ? GREEN : INK;
    return <text x={15} y={29.5} textAnchor="middle" fontSize={22} fontWeight={700} fill={c} fontFamily={font}>{HONORS[t - 27]}</text>;
  }
  const s = suitOf(t);
  if (s === 0) {
    return (
      <>
        <text x={15} y={17} textAnchor="middle" fontSize={14} fontWeight={700} fill={INK} fontFamily={font}>{NUMS[n - 1]}</text>
        <text x={15} y={36} textAnchor="middle" fontSize={15} fontWeight={700} fill={RED} fontFamily={font}>萬</text>
      </>
    );
  }
  if (s === 1) {
    const L: [number, number, number, string][] = [];
    if (n === 1) {
      return (
        <g>
          <circle cx={15} cy={21} r={12.5} fill="none" stroke={BLUE} strokeWidth={2.4} />
          <circle cx={15} cy={21} r={9.2} fill={GREEN} />
          <circle cx={15} cy={21} r={6.2} fill="none" stroke={IVORY} strokeWidth={1.2} />
          <circle cx={15} cy={21} r={4.2} fill={RED} />
          <circle cx={15} cy={21} r={1.4} fill={IVORY} />
        </g>
      );
    }
    if (n === 2) L.push([15, 12, 6.3, GREEN], [15, 30, 6.3, BLUE]);
    if (n === 3) L.push([7.5, 8.5, 5.3, BLUE], [15, 21, 5.3, RED], [22.5, 33.5, 5.3, GREEN]);
    if (n === 4) L.push([9, 12, 5.4, BLUE], [21, 12, 5.4, GREEN], [9, 30, 5.4, GREEN], [21, 30, 5.4, BLUE]);
    if (n === 5) L.push([8, 9, 4.8, BLUE], [22, 9, 4.8, GREEN], [15, 21, 4.8, RED], [8, 33, 4.8, GREEN], [22, 33, 4.8, BLUE]);
    if (n === 6) L.push([9, 8, 4.5, GREEN], [21, 8, 4.5, GREEN], [9, 22, 4.5, RED], [21, 22, 4.5, RED], [9, 34, 4.5, RED], [21, 34, 4.5, RED]);
    if (n === 7) L.push([6, 6, 3.9, GREEN], [15, 10, 3.9, GREEN], [24, 14, 3.9, GREEN], [9, 25.5, 4.3, RED], [21, 25.5, 4.3, RED], [9, 35.5, 4.3, RED], [21, 35.5, 4.3, RED]);
    if (n === 8) for (const y of [6.5, 16, 26, 35.5]) L.push([9, y, 4.3, BLUE], [21, y, 4.3, BLUE]);
    if (n === 9) [BLUE, RED, GREEN].forEach((c, r) => { for (const x of [6, 15, 24]) L.push([x, 8 + r * 13, 4.3, c]); });
    return <>{L.map(([x, y, r, c], i) => dot("d" + i, x, y, r, c))}</>;
  }
  if (n === 1) {
    return (
      <g>
        <path d="M15 33 L8.5 40 M15 33 L15 41 M15 33 L21.5 40" stroke={GREEN} strokeWidth={2} strokeLinecap="round" />
        <ellipse cx={15} cy={24} rx={6.5} ry={9.5} fill={GREEN} />
        <path d="M9 22 Q3 17 6 27 Z M21 22 Q27 17 24 27 Z" fill={BLUE} />
        <circle cx={15} cy={11} r={4.6} fill={RED} />
        <path d="M15 13.5 L13 17 L17 17 Z" fill={INK} />
        <circle cx={13.6} cy={10.2} r={0.9} fill={IVORY} />
      </g>
    );
  }
  const S: [number, number, number, string, number][] = [];
  if (n === 2) S.push([15, 11, 16, GREEN, 0], [15, 31, 16, GREEN, 0]);
  if (n === 3) S.push([15, 11, 16, GREEN, 0], [9, 31, 16, GREEN, 0], [21, 31, 16, GREEN, 0]);
  if (n === 4) S.push([9, 11, 16, GREEN, 0], [21, 11, 16, GREEN, 0], [9, 31, 16, GREEN, 0], [21, 31, 16, GREEN, 0]);
  if (n === 5) S.push([7, 11, 16, GREEN, 0], [23, 11, 16, GREEN, 0], [15, 21, 16, RED, 0], [7, 31, 16, GREEN, 0], [23, 31, 16, GREEN, 0]);
  if (n === 6) for (const y of [11, 31]) for (const x of [6, 15, 24]) S.push([x, y, 16, GREEN, 0]);
  if (n === 7) { S.push([15, 7, 11, RED, 0]); for (const y of [21, 35]) for (const x of [6, 15, 24]) S.push([x, y, 11, GREEN, 0]); }
  if (n === 8) S.push([5, 11, 16, GREEN, 0], [11.5, 11, 16, GREEN, 18], [18.5, 11, 16, GREEN, -18], [25, 11, 16, GREEN, 0], [5, 31, 16, GREEN, 0], [11.5, 31, 16, GREEN, -18], [18.5, 31, 16, GREEN, 18], [25, 31, 16, GREEN, 0]);
  if (n === 9) for (const y of [7, 21, 35]) for (const x of [6, 15, 24]) S.push([x, y, 11, x === 15 ? RED : GREEN, 0]);
  return <>{S.map(([x, y, h, c, r], i) => stick("s" + i, x, y, h, c, r))}</>;
}

export function Tile(props: {
  t: number;
  size?: number;
  selected?: boolean;
  mark?: "drawn" | "good" | "bad" | "miss" | "recent";
  onClick?: () => void;
  disabled?: boolean;
  back?: boolean;
}) {
  const w = props.size ?? 36;
  const h = Math.round(w * 1.36);
  const cls = [
    "tile",
    props.back ? "back" : "",
    props.selected ? "sel" : "",
    props.mark ? `m-${props.mark}` : "",
    props.disabled ? "off" : "",
  ].filter(Boolean).join(" ");
  const face = props.back || props.t < 0 ? null : (
    <svg viewBox="0 0 30 42" width="100%" height="100%" aria-hidden="true">{tileFace(props.t)}</svg>
  );
  const label = props.back || props.t < 0 ? "蓋牌" : tileName(props.t);
  if (props.onClick) {
    return <button type="button" className={cls} style={{ width: w, height: h }} onClick={props.onClick} disabled={props.disabled} aria-label={label}>{face}</button>;
  }
  return <div className={cls} style={{ width: w, height: h }} aria-label={label}>{face}</div>;
}

export function TileBack(props: { w?: number }) {
  const w = props.w ?? 8;
  return <div className="tile-back" style={{ width: w, height: Math.round(w * 2.5) }} aria-label="蓋牌" />;
}

export function MeldRow(props: { melds: Meld[]; size: number; hide?: number; seat?: number }) {
  if (props.melds.length === 0) return null;
  return (
    <div className="melds">
      {props.melds.map((m, i) => (
        <div key={i} className="meld" data-ml={`${props.seat ?? -1}-${i}`} style={{ visibility: props.hide === i ? "hidden" : "visible" }}>
          <div className="meld-tiles">
            {m.tiles.map((t, j) => <Tile key={j} t={t} size={props.size} back={t < 0} />)}
          </div>
          <span>{m.kind === "chi" ? "吃" : m.kind === "pon" ? "碰" : m.kind === "ankan" ? "暗槓" : "槓"}</span>
        </div>
      ))}
    </div>
  );
}
