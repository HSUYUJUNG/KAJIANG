import { tileName, type Meld } from "../logic/engine";

const INK = "#161616";
const RED = "#E10600";
const GREEN = "#0E8A32";
const BLUE = "#1554D6";
const NUMS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
const HONORS = ["東", "南", "西", "北", "中", "發", "白"];
const FONT = 'system-ui, "PingFang TC", "Noto Sans CJK TC", sans-serif';

function suitOf(t: number): number {
  return t < 27 ? Math.floor(t / 9) : 3;
}

function dot(key: string, cx: number, cy: number, r: number, c: string) {
  return (
    <g key={key}>
      <circle cx={cx} cy={cy} r={r} fill={c} />
      <circle cx={cx} cy={cy} r={r * 0.58} fill="none" stroke="#fff" strokeWidth={Math.max(0.8, r * 0.2)} />
      <circle cx={cx} cy={cy} r={r * 0.16} fill="#fff" />
    </g>
  );
}
function stick(key: string, cx: number, cy: number, h: number, c: string, rot?: number) {
  const w = 5;
  return (
    <g key={key} transform={rot ? `rotate(${rot} ${cx} ${cy})` : undefined}>
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={w / 2} fill={c} />
      <rect x={cx - 0.7} y={cy - h / 2 + 1.4} width={1.5} height={Math.max(1, h - 2.8)} rx={0.7} fill="#fff" opacity={0.55} />
    </g>
  );
}

export function tileFace(t: number) {
  const n = (t % 9) + 1;
  if (t >= 27) {
    if (t === 33) return <rect x={6.5} y={7} width={17} height={28} rx={2.5} fill="none" stroke={BLUE} strokeWidth={2.6} />;
    const c = t === 31 ? RED : t === 32 ? GREEN : INK;
    return <text x={15} y={29} textAnchor="middle" fontSize={22} fontWeight={800} fill={c} fontFamily={FONT}>{HONORS[t - 27]}</text>;
  }
  const s = suitOf(t);
  if (s === 0) {
    return (
      <>
        <text x={15} y={16} textAnchor="middle" fontSize={15} fontWeight={800} fill={INK} fontFamily={FONT}>{NUMS[n - 1]}</text>
        <text x={15} y={34} textAnchor="middle" fontSize={16} fontWeight={800} fill={RED} fontFamily={FONT}>萬</text>
      </>
    );
  }
  if (s === 1) {
    const L: [number, number, number, string][] = [];
    if (n === 1) {
      return (
        <g>
          <circle cx={15} cy={19} r={11} fill="none" stroke={BLUE} strokeWidth={2.6} />
          <circle cx={15} cy={19} r={7.4} fill={GREEN} />
          <circle cx={15} cy={19} r={4} fill={RED} />
          <circle cx={15} cy={19} r={1.5} fill="#fff" />
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
        <path d="M15 27 L9 35 M15 27 V36 M15 27 L21 35" stroke={GREEN} strokeWidth={2.2} strokeLinecap="round" />
        <ellipse cx={15} cy={19} rx={5.6} ry={8} fill={GREEN} />
        <path d="M9.2 17.5c-6-1.5-6.5 5.5-2.4 6.6z M20.8 17.5c6-1.5 6.5 5.5 2.4 6.6z" fill={BLUE} />
        <circle cx={15} cy={9.2} r={4} fill={RED} />
        <path d="M15 11.4 L13.3 14.4 H16.7 Z" fill={INK} />
        <circle cx={13.7} cy={8.4} r={0.8} fill="#fff" />
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
    <span className="tile-face">
      <svg viewBox="0 0 30 42" width="100%" height="100%" aria-hidden="true">{tileFace(props.t)}</svg>
    </span>
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
