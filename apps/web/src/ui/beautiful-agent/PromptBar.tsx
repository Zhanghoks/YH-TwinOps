// Adapted from Beautiful UI PromptBar's tall composer (MIT, Shane Levine); unsupported demo controls removed.
import {Button} from '@ui-sdk/react/button';
import {Field,FieldLabel,FieldDescription} from '@ui-sdk/react/field';
import {Textarea} from '@ui-sdk/react/textarea';
import {ArrowUp,Database} from 'lucide-react';
export default function PromptBar({value,onChange,onSend,busy}:{value:string;onChange:(value:string)=>void;onSend:()=>void;busy:boolean}) {
  const canSend=value.trim().length>0&&!busy;
  return <form className="ba-promptbar" data-promptbar onSubmit={event=>{event.preventDefault();if(canSend)onSend();}}>
    <Field name="agent-question" className="ba-prompt-field">
      <FieldLabel className="ba-sr-only">向门店助手提问</FieldLabel>
      <Textarea className="ba-prompt-input" rows={3} autoResize value={value} onValueChange={onChange} disabled={busy} placeholder="问问门店现状，或推演一个想法…"
        onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();if(canSend)onSend();}}}/>
      <div className="ba-prompt-controls"><span className="ba-prompt-context"><Database size={13} aria-hidden="true"/>当前场景</span><FieldDescription>Enter 发送 · Shift+Enter 换行</FieldDescription><Button type="submit" className="ba-send" aria-label="提问" disabled={!canSend}><ArrowUp size={17} strokeWidth={2.4} aria-hidden="true"/></Button></div>
    </Field>
  </form>;
}
