import { useEffect, useState } from "react";
import { createRoom } from "./net/rooms";
import { defaultSettings, saveName, savedName } from "./net/firebase";
import type { Settings } from "./net/host";
import { LobbyPreview, Online } from "./ui/Online";
import { Practice } from "./ui/Practice";
import { TileLookProvider, TileSheet, type BackColor, type TileLook } from "./ui/Tile";

type Screen = "home" | "room" | "practice" | "preview";

function isLook(v: string | null): v is TileLook {
  return v === "A" || v === "B" || v === "C" || v === "D";
}
function isBack(v: string | null): v is BackColor {
  return v === "green" || v === "blue" || v === "pink" || v === "yellow";
}
function readLook(): TileLook {
  const q = new URLSearchParams(location.search);
  const fromUrl = q.get("tiles") || q.get("sheet");
  if (isLook(fromUrl)) return fromUrl;
  const saved = localStorage.getItem("kajiang.tiles");
  if (isLook(saved)) return saved;
  return "D";
}
function readBack(): BackColor {
  const q = new URLSearchParams(location.search).get("back");
  if (isBack(q)) return q;
  const saved = localStorage.getItem("kajiang.back");
  if (isBack(saved)) return saved;
  return "green";
}

function readTheme(): "light" | "dark" | "auto" {
  const v = localStorage.getItem("kajiang.theme");
  return v === "light" || v === "dark" ? v : "auto";
}

export function App() {
  const [theme, setTheme] = useState(readTheme);
  const [look, setLook] = useState<TileLook>(readLook);
  const [back, setBack] = useState<BackColor>(readBack);
  const [name, setName] = useState(savedName);
  const [screen, setScreen] = useState<Screen>("home");
  const [code, setCode] = useState("");
  const [join, setJoin] = useState("");
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "auto") root.removeAttribute("data-theme");
    else root.dataset.theme = theme;
    localStorage.setItem("kajiang.theme", theme);
  }, [theme]);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const room = (q.get("room") || "").toUpperCase();
    if (q.get("preview") === "lobby") setScreen("preview");
    else if (q.get("demo") === "1") setScreen("practice");
    else if (room) { setCode(room); setJoin(room); setScreen("room"); }
    const onPop = () => {
      const now = new URLSearchParams(location.search);
      const r = (now.get("room") || "").toUpperCase();
      if (now.get("demo") === "1") setScreen("practice");
      else if (r) { setCode(r); setScreen("room"); }
      else setScreen("home");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const nick = name.trim().slice(0, 8);
  const goHome = () => {
    const url = new URL(location.href);
    url.searchParams.delete("room");
    url.searchParams.delete("demo");
    url.searchParams.delete("preview");
    history.pushState({}, "", url);
    setScreen("home");
  };
  const openPractice = (demo = false) => {
    const url = new URL(location.href);
    url.searchParams.delete("room");
    if (demo) url.searchParams.set("demo", "1");
    else url.searchParams.delete("demo");
    history.pushState({}, "", url);
    setScreen("practice");
  };
  const openRoom = (next: string) => {
    const url = new URL(location.href);
    url.searchParams.set("room", next);
    url.searchParams.delete("demo");
    history.pushState({}, "", url);
    setCode(next);
    setScreen("room");
  };

  const chooseLook = (next: TileLook) => {
    setLook(next);
    localStorage.setItem("kajiang.tiles", next);
  };
  const chooseBack = (next: BackColor) => {
    setBack(next);
    localStorage.setItem("kajiang.back", next);
  };
  const sheet = new URLSearchParams(location.search).get("sheet");
  if (isLook(sheet)) {
    return (
      <TileLookProvider look={sheet} back={back}>
        <div className="app" style={{ maxWidth: 980, background: "#fff" }}>
          <h1>KAJIANG</h1>
          <TileSheet look={sheet} />
        </div>
      </TileLookProvider>
    );
  }

  return (
    <TileLookProvider look={look} back={back}>
    <div className="app">
      <header className="top">
        <div className="brand">
          <div>
            <h1>KAJIANG</h1>
            <p className="sub">台灣十六張・南部台・跟朋友連線</p>
          </div>
        </div>
        <button className="icon-btn" onClick={() => setTheme(theme === "light" ? "dark" : theme === "dark" ? "auto" : "light")} aria-label="切換配色">
          {theme === "light" ? "淺色" : theme === "dark" ? "深色" : "自動"}
        </button>
      </header>
      {screen === "preview" ? <LobbyPreview /> : null}
      {screen === "practice" ? <Practice demo={new URLSearchParams(location.search).get("demo") === "1"} onHome={goHome} /> : null}
      {screen === "room" ? <Online code={code} name={nick || "玩家"} onHome={goHome} /> : null}
      {screen === "home" ? (
        <div className="stack">
          <section className="card stack">
            <div className="seg" aria-label="牌面">
              <button type="button" aria-pressed={look === "D"} onClick={() => chooseLook("D")}>D 實體</button>
              <button type="button" aria-pressed={look === "A"} onClick={() => chooseLook("A")}>A 雀神</button>
              <button type="button" aria-pressed={look === "B"} onClick={() => chooseLook("B")}>B 雀魂</button>
              <button type="button" aria-pressed={look === "C"} onClick={() => chooseLook("C")}>C 傳統</button>
            </div>
            {look === "D" ? (
              <div className="seg" aria-label="牌背顏色">
                <button type="button" aria-pressed={back === "green"} onClick={() => chooseBack("green")}>綠背</button>
                <button type="button" aria-pressed={back === "blue"} onClick={() => chooseBack("blue")}>藍背</button>
                <button type="button" aria-pressed={back === "pink"} onClick={() => chooseBack("pink")}>粉背</button>
                <button type="button" aria-pressed={back === "yellow"} onClick={() => chooseBack("yellow")}>黃背</button>
              </div>
            ) : null}
            <p className="muted">預設 D：白牌面、底部露出牌背色，五萬寫成伍。A 雀神、B 雀魂、C 傳統仍可切換。</p>
            <label className="field">暱稱
              <input maxLength={8} value={name} placeholder="例如 春" onChange={(e) => { setName(e.target.value); saveName(e.target.value.trim().slice(0, 8)); }} />
            </label>
            <div className="seg">
              <button aria-pressed={settings.len === "quan"} onClick={() => setSettings({ ...settings, len: "quan" })}>一圈</button>
              <button aria-pressed={settings.len === "jiang"} onClick={() => setSettings({ ...settings, len: "jiang" })}>一將</button>
            </div>
            <div className="seg">
              {[["30/10", 30, 10], ["50/20", 50, 20], ["100/30", 100, 30]].map(([label, base, per]) => (
                <button key={String(label)} aria-pressed={settings.base === base && settings.per === per} onClick={() => setSettings({ ...settings, base: Number(base), per: Number(per) })}>{label}</button>
              ))}
            </div>
            <p className="muted">底 {settings.base}、每台 {settings.per}。放槍付一筆，自摸三家各付一筆，莊家另加莊家台。胡牌最少 1 台。人不齊由電腦補位。</p>
            {err ? <p className="err">{err}</p> : null}
            <button className="btn primary" disabled={busy || !nick} onClick={() => {
              setBusy(true); setErr("");
              createRoom(nick, settings).then(openRoom).catch((e: Error) => setErr(e.message || "開房失敗")).finally(() => setBusy(false));
            }}>{busy ? "開房中…" : "開新房間"}</button>
          </section>
          <section className="card stack">
            <label className="field">房間代碼
              <input value={join} maxLength={4} placeholder="四個字" onChange={(e) => setJoin(e.target.value.toUpperCase())} />
            </label>
            <button className="btn" disabled={!nick || !/^[A-HJ-NP-Z2-9]{4}$/.test(join.trim().toUpperCase())} onClick={() => openRoom(join.trim().toUpperCase())}>加入房間</button>
            <button className="btn" onClick={() => openPractice(false)}>單機練習</button>
          </section>
          <Rules />
        </div>
      ) : null}
    </div>
    </TileLookProvider>
  );
}

function Rules() {
  return (
    <details className="card">
      <summary>規則摘要</summary>
      <div className="stack" style={{ marginTop: 8 }}>
        <p>136 張、無花。每人 16 張，莊家先摸第 17 張。胡牌是五組面子加一對眼。</p>
        <p>吃只能吃上家。叫牌順序是胡、然後碰或槓、最後才吃。多人胡牌時，由出牌者的下家往下，較近的人截胡。</p>
        <p>明槓、暗槓、加槓都從牌尾補一張。加槓可以搶槓，暗槓不行。吃碰之後要先打牌。牌牆保留最後 16 張，摸不到就流局。</p>
        <p>你在下方，下家在右、對家在上、上家在左。一圈是四家各當過莊；一將是東南西北四圈。莊家胡牌或流局連莊，最多連 3 次。</p>
        <p>南部台不設台數上限。見字有台：任何字牌刻或槓 1 台。邊張、中洞、單吊都算獨聽。付款是底加台數乘每台。四家金額合計為 0。</p>
        <table>
          <tbody>
            {[
              ["自摸、門清、獨聽、搶槓、槓上開花、海底、半求人、字牌刻", "1"],
              ["門清自摸", "3"],
              ["平胡、全求人、三暗刻", "2"],
              ["碰碰胡、湊一色、小三元", "4"],
              ["四暗刻", "5"],
              ["五暗刻、清一色、小四喜、大三元", "8"],
              ["字一色、大四喜、地胡、人胡", "16"],
              ["天胡", "24"],
              ["莊家（莊家胡、放槍或被自摸）", "1＋連N拉N"],
            ].map(([n, t]) => <tr key={n}><td>{n}</td><td className="num">{t}</td></tr>)}
          </tbody>
        </table>
      </div>
    </details>
  );
}
