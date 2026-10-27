import {
  narrationParts,
  readingParagraphs,
  readingDisplay,
  type Segment,
  type ReadingPage,
  type ReadingAppearance,
  type ReaderNote,
} from "@pagechime/core";
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function bookTextHtml(
  page: ReadingPage | undefined,
  title: string,
  chapter: number,
  first: boolean,
  appearance: ReadingAppearance,
  notes: ReaderNote[],
  active: number,
  colors: {
    paper: string;
    ink: string;
    muted: string;
    line: string;
    accent: string;
    highlight: string;
    soft: string;
  },
  context = "",
  segments: Segment[] = [],
) {
  const fragments = readingParagraphs(page)
    .map((group) => {
      const f = group[0];
      return `<p class="passage ${group.some((f) => f.segment === active) ? "spoken" : ""} ${f.heading ? "heading" : ""}"><button aria-label="Listen from here" data-listen="${f.segment}"><svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M4 2l10 6-10 6z"/></svg></button>${group
        .map(
          (f) =>
            `<span data-fragment data-segment="${f.segment}" data-start="${f.start}"${segments[f.segment]?.readingEdits?.length ? ` data-offsets="${escape(JSON.stringify(readingDisplay(f, segments[f.segment].readingEdits).offsets))}"` : ""}>${narrationParts(
              f,
              notes,
              segments[f.segment]?.words,
              segments[f.segment]?.readingEdits,
            )
              .map((part) => {
                const value =
                  part.wordFrom === undefined
                    ? escape(part.text)
                    : `<span data-word-from="${part.wordFrom}">${escape(part.text)}</span>`;
                return part.highlighted ? `<mark>${value}</mark>` : value;
              })
              .join("")}</span>`,
        )
        .join("")}</p>`;
    })
    .join("");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5"><style>
*{box-sizing:border-box}body{margin:0;padding:25px ${appearance.width === "wide" ? 18 : 27}px;background:${colors.paper};color:${colors.ink};font-family:${appearance.font === "serif" ? "Georgia,serif" : "system-ui,sans-serif"};font-size:${appearance.size}px;line-height:${appearance.leading};overflow-wrap:anywhere;-webkit-text-size-adjust:100%}h1{font:normal 28px/1.2 Georgia,serif;text-align:center;margin:15px 0 30px}.chapter{font:9px system-ui;letter-spacing:.18em;text-align:center;color:${colors.muted}}p{position:relative;white-space:pre-wrap;margin:0 0 19px;padding:3px 5px;border-radius:3px}.spoken{background:${colors.soft}}.heading{font:500 13px/1.7 system-ui;letter-spacing:.07em}.spoken-word{background:#ced7b4;color:#26301d;border-radius:.15em;box-shadow:0 0 0 2px #ced7b4}mark,::selection{background:${colors.highlight};color:inherit}button{position:absolute;left:-25px;top:0;width:25px;min-height:44px;padding:0;background:none;border:0;color:${colors.accent};font-size:14px}button:focus-visible{outline:2px solid ${colors.accent}}.end{width:25px;height:1px;background:${colors.line};margin:30px auto}
</style><body>${first ? `<div class="chapter">CHAPTER ${chapter + 1}</div><h1>${escape(title)}</h1>` : ""}<article aria-label="Book text">${fragments}</article><div class="end"></div><script>
const send=x=>window.ReactNativeWebView?.postMessage(JSON.stringify({...x,context:${JSON.stringify(context).replace(/</g, "\\u003c")}}));
document.addEventListener('click',e=>{const b=e.target.closest('[data-listen]');if(b)send({type:'listen',segment:Number(b.dataset.listen)});});
const followMessage=event=>{let message;try{message=JSON.parse(event.data)}catch{return}if(message.type!=='narration'||message.context!==${JSON.stringify(context).replace(/</g, "\\u003c")})return;
 document.querySelectorAll('.spoken-word').forEach(n=>n.classList.remove('spoken-word'));
 document.querySelectorAll('.spoken').forEach(n=>n.classList.remove('spoken'));
 if(!Number.isSafeInteger(message.segment)||message.segment<0)return;
 const fragment=document.querySelector('[data-fragment][data-segment="'+message.segment+'"]');fragment?.closest('p')?.classList.add('spoken');
 if(!Number.isSafeInteger(message.from)||message.from<0)return;
 document.querySelectorAll('[data-fragment][data-segment="'+message.segment+'"] [data-word-from="'+message.from+'"]').forEach(n=>n.classList.add('spoken-word'));
 document.querySelector('.spoken-word')?.scrollIntoView({block:'nearest',inline:'nearest'});
};document.addEventListener('message',followMessage);window.addEventListener('message',followMessage);
let timer;document.addEventListener('selectionchange',()=>{clearTimeout(timer);timer=setTimeout(()=>{
 const s=getSelection();if(!s||s.isCollapsed||!s.rangeCount)return;const r=s.getRangeAt(0),quote=s.toString().trim();if(!quote||quote.length>2000)return;
 const part=(node,offset)=>{const el=(node.nodeType===1?node:node.parentElement)?.closest('[data-fragment]');if(!el)return null;const before=document.createRange();before.selectNodeContents(el);before.setEnd(node,offset);return {segment:Number(el.dataset.segment),offset:el.dataset.offsets?JSON.parse(el.dataset.offsets)[before.toString().length]:Number(el.dataset.start)+before.toString().length};};
 const a=part(r.startContainer,r.startOffset),b=part(r.endContainer,r.endOffset);if(a&&b)send({type:'selection',quote,segment:a.segment,offset:a.offset,endSegment:b.segment,endOffset:b.offset});
},120);});
</script></body></html>`;
}
