// Adapted from Beautiful UI ContextCards (MIT, Shane Levine), pinned source in README.md.
import type {ReactNode} from 'react';
export type ContextChunk = {id:string;title:string;chars:string;body:ReactNode;source:string;badge:string};
export default function ContextCards({chunks,labels}:{chunks:ContextChunk[];labels:{header:string;count:string}}) {
  return <div className="ba-context-cards">
    <div className="ba-context-heading"><span>{labels.header}</span><span className="ba-count">{labels.count}</span></div>
    {chunks.map(chunk=><div key={chunk.id} className="ba-context-card">
      <div className="ba-card-bar"><span className="ba-card-title"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg><span>{chunk.title}</span></span><span className="ba-card-meta">{chunk.chars}</span></div>
      <div className="ba-context-body">{chunk.body}</div>
      <div className="ba-source-wrap"><span className="ba-source-chip"><span className="ba-source-badge">{chunk.badge}</span>{chunk.source}</span></div>
    </div>)}
  </div>;
}
