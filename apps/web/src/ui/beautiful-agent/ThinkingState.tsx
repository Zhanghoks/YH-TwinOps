// Adapted from Beautiful UI ThinkingState (MIT, Shane Levine); real tool events only, no demo clock.
import {Collapsible,CollapsiblePanel,CollapsibleTrigger} from '@ui-sdk/react/collapsible';
import {Check,ChevronDown,LoaderCircle,Workflow} from 'lucide-react';
export interface TraceRow {id:string;primary:string;secondary?:string}
export default function ThinkingState({working,rows,children}:{working:boolean;rows:TraceRow[];children?:React.ReactNode}) {
  return <Collapsible className="ba-thinking" defaultOpen={false}>
    <CollapsibleTrigger aria-label={working?'查看查询状态':'展开证据与工具轨迹'} className="ba-trace-trigger">
      {working?<LoaderCircle className="ba-spinner" size={15} aria-hidden="true"/>:<Workflow size={15} aria-hidden="true"/>}
      <span>{working?'正在查询门店证据…':`工具轨迹 · ${rows.length} 次调用`}</span>
      <ChevronDown size={14} className="ba-trace-chevron" aria-hidden="true"/>
    </CollapsibleTrigger>
    {working&&<span className="ba-sr-only" role="status">正在查询门店证据…</span>}
    <CollapsiblePanel>
      <div className="ba-trace-rows">
        {working?<p>正在等待查询结果，尚无工具轨迹。</p>:<>
          <p className="ba-trace-caption">工具调用：{rows.length===0?'无记录':'以下为本次返回的调用记录'}</p>
          {rows.map(row=><div className="ba-trace-row" key={row.id}><Check size={13} aria-hidden="true"/><div><span>{row.primary}</span>{row.secondary&&<pre>{row.secondary}</pre>}</div></div>)}
        </>}
      </div>
      {children}
    </CollapsiblePanel>
  </Collapsible>;
}
