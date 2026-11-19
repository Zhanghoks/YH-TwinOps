import { Component, type ReactNode } from 'react';

/** A missing GPU or failed asset must not take the operations workspace down. */
export class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section role="alert" style={{ padding: '2rem', maxWidth: 560, color: '#334155' }}>
        <h2>3D 场景暂时不可用</h2>
        <p>当前浏览器无法完成 3D 渲染，可能不支持 WebGL，或模型资源加载失败。右侧运营助手和告警仍可使用。</p>
        <p>请使用支持 WebGL 的浏览器查看模型。此状态不代表模型已通过视觉检查。</p>
        <button type="button" onClick={() => this.setState({ failed: false })}>重试 3D 场景</button>
      </section>
    );
  }
}
