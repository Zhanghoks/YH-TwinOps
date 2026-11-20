import { Component, type ReactNode } from 'react';

/** A missing GPU or failed asset must not take the operations workspace down. */
export class SceneBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="yh-scene-failure">
        <div className="yh-scene-status" role="alert">
          <h2>3D 场景暂时不可用</h2>
          <button type="button" onClick={() => this.setState({ failed: false })}>重试 3D 场景</button>
          <p>{this.props.fallback
            ? '当前无法渲染 3D，已切换到二维平面。可以定位设施、查看商品和问 Agent；二维画面不能用于检查 3D 穿模。'
            : '当前浏览器无法完成 3D 渲染。右侧运营助手和告警仍可使用。'}</p>
        </div>
        {this.props.fallback}
      </div>
    );
  }
}
