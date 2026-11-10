import { createContext, useContext, type ReactNode } from "react";
import { tileName, type Meld } from "../logic/engine";

export type TileLook = "A" | "B" | "C" | "D";
export type BackColor = "green" | "blue" | "pink" | "yellow";

type TileTheme = { look: TileLook; back: BackColor };
const TileLookContext = createContext<TileTheme>({ look: "D", back: "green" });
export function TileLookProvider(props: { look: TileLook; back?: BackColor; children: ReactNode }) {
  return <TileLookContext.Provider value={{ look: props.look, back: props.back ?? "green" }}>{props.children}</TileLookContext.Provider>;
}
export function useTileLook(): TileLook {
  return useContext(TileLookContext).look;
}
export function useBackColor(): BackColor {
  return useContext(TileLookContext).back;
}

const NUMS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
const HONORS = ["東", "南", "西", "北", "中", "發", "白"];
const FONT = 'system-ui, "PingFang TC", "Noto Sans CJK TC", sans-serif';
const BRUSH = '"Songti TC", "PMingLiU", "Noto Serif CJK TC", "Source Han Serif TC", serif';

type Pal = { ink: string; red: string; green: string; blue: string; hi: string; num: number; wan: number; honor: number; weight: number };
const PAL: Record<TileLook, Pal> = {
  A: { ink: "#1a1a1a", red: "#e10600", green: "#128a34", blue: "#1d4ed8", hi: "#ffffff", num: 15, wan: 16, honor: 22, weight: 750 },
  B: { ink: "#111111", red: "#e00000", green: "#00a63a", blue: "#1238c0", hi: "#ffffff", num: 16, wan: 18, honor: 24, weight: 800 },
  C: { ink: "#1b1b1b", red: "#b71c1c", green: "#1b6b38", blue: "#1a3f86", hi: "#f7f1e4", num: 13, wan: 14, honor: 20, weight: 650 },
  D: { ink: "#141414", red: "#d01212", green: "#157a32", blue: "#111111", hi: "#ffffff", num: 15, wan: 17, honor: 23, weight: 700 },
};

function suitOf(t: number): number {
  return t < 27 ? Math.floor(t / 9) : 3;
}

function Dot(props: { cx: number; cy: number; r: number; c: string; look: TileLook; hi: string }) {
  const { cx, cy, r, c, look, hi } = props;
  if (look === "B") {
    return (
      <g>
        <circle cx={cx} cy={cy} r={r} fill={c} />
        <circle cx={cx} cy={cy} r={r * 0.7} fill="#fff" />
        <circle cx={cx} cy={cy} r={r * 0.46} fill={c} />
        <circle cx={cx} cy={cy} r={r * 0.14} fill="#fff" />
      </g>
    );
  }
  if (look === "C") {
    return (
      <g>
        <circle cx={cx} cy={cy} r={r} fill={c} />
        <circle cx={cx} cy={cy} r={r * 0.55} fill="none" stroke={hi} strokeWidth={Math.max(0.6, r * 0.16)} />
        <circle cx={cx} cy={cy} r={r * 0.16} fill={hi} />
      </g>
    );
  }
  if (look === "D") {
    const inner = c === "#d01212" ? "#157a32" : "#d01212";
    return (
      <g>
        <circle cx={cx} cy={cy} r={r} fill="#141414" />
        <circle cx={cx} cy={cy} r={r * 0.84} fill={c} />
        <circle cx={cx} cy={cy} r={r * 0.62} fill="none" stroke="#141414" strokeWidth={Math.max(0.45, r * 0.09)} />
        <circle cx={cx} cy={cy} r={r * 0.28} fill={inner} />
        <circle cx={cx} cy={cy} r={r * 0.1} fill="#141414" />
      </g>
    );
  }
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={c} />
      <circle cx={cx} cy={cy} r={r * 0.32} fill="#fff" />
    </g>
  );
}

function Stick(props: { cx: number; cy: number; h: number; c: string; look: TileLook; rot?: number }) {
  const { cx, cy, h, c, look, rot } = props;
  if (look === "D") {
    const bw = 2.15;
    const y0 = cy - h / 2;
    const nodes = [0.28, 0.5, 0.72].map((p) => y0 + h * p);
    return (
      <g transform={rot ? `rotate(${rot} ${cx} ${cy})` : undefined}>
        <rect x={cx - bw / 2} y={y0} width={bw} height={h} rx={0.4} fill={c} />
        <rect x={cx - 0.28} y={y0 + 0.6} width={0.55} height={Math.max(1, h - 1.2)} fill="#141414" />
        {nodes.map((y) => <line key={y} x1={cx - bw / 2} x2={cx + bw / 2} y1={y} y2={y} stroke="#141414" strokeWidth={0.7} />)}
      </g>
    );
  }
  const w = look === "B" ? 5.8 : look === "C" ? 3.4 : 4.4;
  const body = look === "B" ? (
    <path d={`M ${cx - w / 2} ${cy - h / 2 + 2} Q ${cx} ${cy - h / 2 - 1.2} ${cx + w / 2} ${cy - h / 2 + 2} L ${cx + w * 0.42} ${cy + h / 2 - 1} Q ${cx} ${cy + h / 2 + 1.4} ${cx - w * 0.42} ${cy + h / 2 - 1} Z`} fill={c} />
  ) : (
    <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={w / 2} fill={c} />
  );
  return (
    <g transform={rot ? `rotate(${rot} ${cx} ${cy})` : undefined}>
      {body}
      {look !== "C" ? <rect x={cx - 0.65} y={cy - h / 2 + 2} width={1.3} height={Math.max(1, h - 4)} rx={0.6} fill="#fff" opacity={look === "B" ? 0.7 : 0.4} /> : null}
    </g>
  );
}

function flowerDisc() {
  const petals = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    const px = 15 + Math.cos(a) * 5.2;
    const py = 21 + Math.sin(a) * 5.2;
    return <ellipse key={i} cx={px} cy={py} rx={2.5} ry={4.1} transform={`rotate(${(a * 180) / Math.PI + 90} ${px} ${py})`} fill={i % 2 ? "#d01212" : "#157a32"} stroke="#141414" strokeWidth={0.45} />;
  });
  return (
    <g>
      <circle cx={15} cy={21} r={12.2} fill="#141414" />
      <circle cx={15} cy={21} r={11.2} fill="#fff" />
      {petals}
      <circle cx={15} cy={21} r={3.6} fill="#141414" />
      <circle cx={15} cy={21} r={2.2} fill="#d01212" />
      <circle cx={15} cy={21} r={0.8} fill="#157a32" />
    </g>
  );
}

function ornateBlank() {
  return (
    <g stroke="#141414" fill="none">
      <rect x={5.6} y={6.2} width={18.8} height={29.6} rx={1.2} strokeWidth={1.7} />
      <rect x={8.1} y={8.8} width={13.8} height={24.4} rx={0.6} strokeWidth={0.7} />
      <path d="M7.2 8.2 h2.2 M7.2 8.2 v2.2 M22.8 8.2 h-2.2 M22.8 8.2 v2.2 M7.2 33.8 h2.2 M7.2 33.8 v-2.2 M22.8 33.8 h-2.2 M22.8 33.8 v-2.2" strokeWidth={1.1} strokeLinecap="square" />
    </g>
  );
}

function bird(look: TileLook, pal: Pal) {
  if (look === "D") {
    return (
      <g>
        <path d="M15 30 L9.5 38 M15 30 V39 M15 30 L20.5 38" stroke="#141414" strokeWidth={1.1} strokeLinecap="round" />
        <path d="M15 30 L9.5 38 M15 30 V39 M15 30 L20.5 38" stroke={pal.green} strokeWidth={0.7} strokeLinecap="round" />
        <ellipse cx={15} cy={21} rx={5} ry={7.2} fill={pal.green} stroke="#141414" strokeWidth={0.6} />
        <path d="M10 19.5c-5.2-.2-5.6 4.6-1.4 5.4z" fill="#141414" />
        <path d="M20 19.5c5.2-.2 5.6 4.6 1.4 5.4z" fill={pal.red} />
        <circle cx={15} cy={11.2} r={3.7} fill={pal.red} stroke="#141414" strokeWidth={0.55} />
        <path d="M15 13.2 L13.4 15.6 H16.6 Z" fill="#141414" />
        <circle cx={13.6} cy={10.4} r={0.7} fill="#fff" stroke="#141414" strokeWidth={0.3} />
      </g>
    );
  }
  if (look === "B") {
    return (
      <g>
        <path d="M15 30 C9 34 8 38 11 39 M15 30 V39 M15 30 C21 34 22 38 19 39" stroke={pal.green} strokeWidth={2.3} strokeLinecap="round" fill="none" />
        <ellipse cx={15} cy={20} rx={6.2} ry={8.2} fill={pal.red} />
        <path d="M9 18c-6-.4-7 5-2.6 6.2z M21 18c6-.4 7 5 2.6 6.2z" fill={pal.blue} />
        <circle cx={15} cy={10} r={4.3} fill={pal.red} />
        <path d="M15 12.2 L13.2 15.2 H16.8 Z" fill={pal.ink} />
        <circle cx={13.5} cy={9.2} r={0.85} fill="#fff" />
      </g>
    );
  }
  if (look === "C") {
    return (
      <g>
        <path d="M15 31 L9 38 M15 31 V39 M15 31 L21 38" stroke={pal.green} strokeWidth={1.7} strokeLinecap="round" />
        <ellipse cx={15} cy={22} rx={5.2} ry={7.4} fill={pal.green} />
        <path d="M10 20c-5 0-5.4 4.6-1.8 5.4z M20 20c5 0 5.4 4.6 1.8 5.4z" fill={pal.blue} />
        <circle cx={15} cy={12} r={3.5} fill={pal.red} />
        <path d="M15 14 L13.6 16.4 H16.4 Z" fill={pal.ink} />
        <circle cx={13.8} cy={11.2} r={0.6} fill={pal.hi} />
      </g>
    );
  }
  return (
    <g>
      <path d="M15 29 L10 36 M15 29 V37 M15 29 L20 36" stroke={pal.green} strokeWidth={2} strokeLinecap="round" />
      <ellipse cx={15} cy={20} rx={5.2} ry={7} fill={pal.green} />
      <path d="M10 18.5c-5-.6-5.2 4.4-1.6 5.2z M20 18.5c5-.6 5.2 4.4 1.6 5.2z" fill={pal.blue} />
      <circle cx={15} cy={11} r={3.6} fill={pal.red} />
      <path d="M15 13 L13.5 15.4 H16.5 Z" fill={pal.ink} />
      <circle cx={13.8} cy={10.2} r={0.7} fill="#fff" />
    </g>
  );
}

function pins(n: number, scale: number): [number, number, number, "g" | "b" | "r"][] {
  const s = scale;
  const out: [number, number, number, "g" | "b" | "r"][] = [];
  if (n === 2) out.push([15, 12, 6.2 * s, "g"], [15, 30, 6.2 * s, "b"]);
  if (n === 3) out.push([8, 9, 5.2 * s, "b"], [15, 21, 5.2 * s, "r"], [22, 33, 5.2 * s, "g"]);
  if (n === 4) out.push([9.5, 12, 5.3 * s, "b"], [20.5, 12, 5.3 * s, "g"], [9.5, 30, 5.3 * s, "g"], [20.5, 30, 5.3 * s, "b"]);
  if (n === 5) out.push([8.5, 9, 4.6 * s, "b"], [21.5, 9, 4.6 * s, "g"], [15, 21, 4.6 * s, "r"], [8.5, 33, 4.6 * s, "g"], [21.5, 33, 4.6 * s, "b"]);
  if (n === 6) out.push([9.5, 9, 4.4 * s, "g"], [20.5, 9, 4.4 * s, "g"], [9.5, 21, 4.4 * s, "r"], [20.5, 21, 4.4 * s, "r"], [9.5, 33, 4.4 * s, "r"], [20.5, 33, 4.4 * s, "r"]);
  if (n === 7) out.push([7, 7, 3.6 * s, "g"], [15, 11, 3.6 * s, "g"], [23, 15, 3.6 * s, "g"], [9.5, 26, 4.2 * s, "r"], [20.5, 26, 4.2 * s, "r"], [9.5, 35, 4.2 * s, "r"], [20.5, 35, 4.2 * s, "r"]);
  if (n === 8) for (const y of [7, 16, 25, 34]) out.push([9.5, y, 4 * s, "b"], [20.5, y, 4 * s, "b"]);
  if (n === 9) ["b", "r", "g"].forEach((c, row) => { for (const x of [7, 15, 23]) out.push([x, 8 + row * 13, 4 * s, c as "g" | "b" | "r"]); });
  return out;
}

function sticks(n: number, scale: number): [number, number, number, "g" | "r", number][] {
  const h = 15 * scale;
  const hs = 10 * scale;
  const S: [number, number, number, "g" | "r", number][] = [];
  if (n === 2) S.push([15, 11, h, "g", 0], [15, 31, h, "g", 0]);
  if (n === 3) S.push([15, 11, h, "g", 0], [9, 31, h, "g", 0], [21, 31, h, "g", 0]);
  if (n === 4) S.push([9, 11, h, "g", 0], [21, 11, h, "g", 0], [9, 31, h, "g", 0], [21, 31, h, "g", 0]);
  if (n === 5) S.push([8, 11, h, "g", 0], [22, 11, h, "g", 0], [15, 21, h, "r", 0], [8, 31, h, "g", 0], [22, 31, h, "g", 0]);
  if (n === 6) for (const y of [11, 31]) for (const x of [6.5, 15, 23.5]) S.push([x, y, h, "g", 0]);
  if (n === 7) { S.push([15, 7, hs, "r", 0]); for (const y of [20, 33]) for (const x of [6.5, 15, 23.5]) S.push([x, y, hs, "g", 0]); }
  if (n === 8) S.push([6, 11, h, "g", 0], [12, 11, h, "g", 16], [18, 11, h, "g", -16], [24, 11, h, "g", 0], [6, 31, h, "g", 0], [12, 31, h, "g", -16], [18, 31, h, "g", 16], [24, 31, h, "g", 0]);
  if (n === 9) for (const y of [7, 21, 34]) for (const x of [6.5, 15, 23.5]) S.push([x, y, hs, x === 15 ? "r" : "g", 0]);
  return S;
}

export function tileFace(t: number, look: TileLook = "A") {
  const pal = PAL[look];
  const n = (t % 9) + 1;
  const col = (k: "g" | "b" | "r") => (k === "g" ? pal.green : k === "b" ? pal.blue : pal.red);
  if (t >= 27) {
    if (t === 33) {
      if (look === "D") return ornateBlank();
      const sw = look === "B" ? 3.1 : look === "C" ? 2 : 2.5;
      return <rect x={6.2} y={7} width={17.6} height={28} rx={look === "C" ? 1.2 : 2.4} fill="none" stroke={pal.blue} strokeWidth={sw} />;
    }
    const c = t === 31 ? pal.red : t === 32 ? pal.green : pal.ink;
    const face = look === "D" ? BRUSH : FONT;
    return <text x={15} y={29} textAnchor="middle" fontSize={pal.honor} fontWeight={look === "D" ? 700 : pal.weight} fill={c} fontFamily={face}>{HONORS[t - 27]}</text>;
  }
  if (suitOf(t) === 0) {
    const numeral = look === "D" && n === 5 ? "伍" : NUMS[n - 1];
    const face = look === "D" ? BRUSH : FONT;
    return (
      <>
        <text x={15} y={look === "B" ? 17 : 16} textAnchor="middle" fontSize={pal.num} fontWeight={pal.weight} fill={pal.ink} fontFamily={face}>{numeral}</text>
        <text x={15} y={look === "D" ? 35 : look === "B" ? 36 : 34} textAnchor="middle" fontSize={pal.wan} fontWeight={pal.weight} fill={pal.red} fontFamily={face}>萬</text>
      </>
    );
  }
  if (suitOf(t) === 1) {
    if (n === 1 && look === "D") return flowerDisc();
    if (n === 1) {
      const r = look === "B" ? 12 : look === "C" ? 9 : 10.5;
      return (
        <g>
          <circle cx={15} cy={21} r={r} fill="none" stroke={pal.blue} strokeWidth={look === "B" ? 2.8 : 2.2} />
          <circle cx={15} cy={21} r={r * 0.68} fill={pal.green} />
          {look === "B" ? <circle cx={15} cy={21} r={r * 0.48} fill="#fff" /> : null}
          <circle cx={15} cy={21} r={r * (look === "B" ? 0.32 : 0.38)} fill={pal.red} />
          <circle cx={15} cy={21} r={r * 0.12} fill="#fff" />
        </g>
      );
    }
    const scale = look === "B" ? 1.05 : look === "C" ? 0.82 : 0.95;
    return <>{pins(n, scale).map(([x, y, r, k], i) => <Dot key={i} cx={x} cy={y} r={r} c={col(k)} look={look} hi={pal.hi} />)}</>;
  }
  if (n === 1) return bird(look, pal);
  const scale = look === "B" ? 1.05 : look === "C" ? 0.86 : 1;
  return <>{sticks(n, scale).map(([x, y, h, k, rot], i) => <Stick key={i} cx={x} cy={y} h={h} c={col(k)} look={look} rot={rot || undefined} />)}</>;
}

export function Tile(props: {
  t: number;
  size?: number;
  selected?: boolean;
  mark?: "drawn" | "good" | "bad" | "miss" | "recent";
  onClick?: () => void;
  disabled?: boolean;
  back?: boolean;
  look?: TileLook;
}) {
  const ctx = useTileLook();
  const back = useBackColor();
  const look = props.look ?? ctx;
  const w = props.size ?? 36;
  const h = Math.round(w * (look === "B" ? 1.5 : look === "C" ? 1.32 : look === "D" ? 1.42 : 1.4));
  const cls = ["tile", `look-${look.toLowerCase()}`, look === "D" ? `edge-${back}` : "", props.back ? "back" : "", props.selected ? "sel" : "", props.mark ? `m-${props.mark}` : "", props.disabled ? "off" : ""].filter(Boolean).join(" ");
  const face = props.back || props.t < 0 ? null : (
    <span className="tile-face">
      <svg viewBox="0 0 30 42" width="100%" height="100%" aria-hidden="true">{tileFace(props.t, look)}</svg>
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

export function TileSheet(props: { look: TileLook }) {
  const row = (from: number, count: number) => (
    <div className="sheet-row">
      {Array.from({ length: count }, (_, i) => <Tile key={i} t={from + i} size={46} look={props.look} />)}
    </div>
  );
  const name = props.look === "A" ? "A 雀神風" : props.look === "B" ? "B 雀魂風" : props.look === "C" ? "C 傳統牌" : "D 實體牌";
  return (
    <div className="sheet">
      <p className="muted">{name}</p>
      {row(0, 9)}
      {row(9, 9)}
      {row(18, 9)}
      {row(27, 7)}
    </div>
  );
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
