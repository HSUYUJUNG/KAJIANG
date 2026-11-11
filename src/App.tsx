import { useEffect, useState } from "react";
import { createRoom } from "./net/rooms";
import { defaultSettings, saveName, savedName } from "./net/firebase";
import type { Settings } from "./net/host";
import { GameBoundary } from "./ui/ErrorBoundary";
import { ChipControl, LobbyPreview, Online } from "./ui/Online";
import { Practice } from "./ui/Practice";

type Screen = "home" | "room" | "practice" | "preview";

function readTheme(): "light" | "dark" | "auto" {
  const v = localStorage.getItem("kajiang.theme");
  return v === "light" || v === "dark" ? v : "auto";
}

export function App() {
  const [theme, setTheme] = useState(readTheme);
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

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <h1>KAJIANG</h1>
        </div>
        <button className="icon-btn" onClick={() => setTheme(theme === "light" ? "dark" : theme === "dark" ? "auto" : "light")} aria-label="切換配色">
          {theme === "light" ? "淺色" : theme === "dark" ? "深色" : "自動"}
        </button>
      </header>
      <GameBoundary key={`${screen}:${code}`} onHome={goHome}>
      {screen === "preview" ? <LobbyPreview /> : null}
      {screen === "practice" ? <Practice demo={new URLSearchParams(location.search).get("demo") === "1"} onHome={goHome} /> : null}
      {screen === "room" ? <Online code={code} name={nick || "玩家"} onHome={goHome} /> : null}
      {screen === "home" ? (
        <div className="stack">
          <section className="card stack">
            <label className="field">暱稱
              <input maxLength={8} value={name} onChange={(e) => { setName(e.target.value); saveName(e.target.value.trim().slice(0, 8)); }} />
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
            <ChipControl settings={settings} host onSettings={setSettings} />
            <p className="muted">底 {settings.base}、每台 {settings.per}，起始籌碼 {settings.chips ?? 2000}。放槍付一筆，自摸三家各付一筆，莊家另加莊家台。胡牌最少 1 台。人不齊由電腦補位。</p>
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
      </GameBoundary>
    </div>
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
