import { Component, type ReactNode } from "react";

interface Props { children: ReactNode; onHome: () => void }
interface State { failed: boolean }

/** 渲染出錯時留一句話，避免整頁變成空白。 */
export class GameBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    console.error(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="card stack">
        <p>牌桌沒能顯示出來。請重新整理頁面，再用同一個房間代碼進來。</p>
        <div className="row">
          <button className="btn primary" type="button" onClick={() => location.reload()}>重新整理</button>
          <button className="btn" type="button" onClick={this.props.onHome}>回首頁</button>
        </div>
      </section>
    );
  }
}
