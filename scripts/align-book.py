"""Force-align known private book text to existing audio; publish verified word cues.
Offline preparation only. Install requirements-alignment.txt in a separate environment.
"""
import argparse, hashlib, json, re, time, unicodedata, difflib
from pathlib import Path


def canonical(text):
    return ''.join(c for c in unicodedata.normalize('NFKC',text).casefold() if not c.isspace())

def utf16(text):
    return len(text.encode('utf-16-le'))//2

def map_words(source, aligned, duration):
    """Map known-text alignment back to exact original UTF-16 selection offsets."""
    owners=[]; original=[]; records=[]
    for si, segment in enumerate(source):
        text=segment['text']
        for match in re.finditer(r'\S+',text):
            wi=len(records);records.append({'segment':si,'from':utf16(text[:match.start()]),'to':utf16(text[:match.end()]),'start':None,'end':None,'seen':set(),'expected':len(canonical(match.group()))})
            for ch in match.group():
                for normalized in canonical(ch): original.append(normalized);owners.append(wi)
    output=''.join(canonical(word['word']) for word in aligned)
    reference=''.join(original)
    positions=[None]*len(output)
    if output==reference: positions=list(range(len(output)))
    else:
        # Alignment libraries can omit/repeat a word. Only exact matching source
        # characters receive a cue; unmatched source remains visible and untimed.
        for block in difflib.SequenceMatcher(None,reference,output,autojunk=False).get_matching_blocks():
            for j in range(block.size): positions[block.b+j]=block.a+j
    position=0
    for word in aligned:
        value=canonical(word['word']);start=float(word['start']);end=float(word['end'])
        if 0<=start<end<=duration+.1 and end-start<12:
            for original_position in positions[position:position+len(value)]:
                if original_position is None: continue
                wi=owners[original_position];record=records[wi];record['seen'].add(original_position)
                record['start']=start if record['start'] is None else min(start,record['start'])
                record['end']=min(duration,end) if record['end'] is None else max(end,record['end'])
        position+=len(value)
    groups=[[] for _ in source];previous=0;good=0
    for record in records:
        start,end=record['start'],record['end']
        if start is None or end is None or len(record['seen'])!=record['expected'] or start<previous-.001 or end<=start: continue
        groups[record['segment']].append({'start':round(start,3),'end':round(end,3),'from':record['from'],'to':record['to']})
        previous=end;good+=1
    segments=[];pending=[]
    for original_segment,words in zip(source,groups):
        if not words:
            pending.append(original_segment);continue
        prefix='\n\n'.join(s['text'] for s in pending)
        offset=utf16(prefix)+2 if prefix else 0
        text=(prefix+'\n\n' if prefix else '')+original_segment['text']
        page=pending[0]['page'] if pending else original_segment['page']
        segments.append({'start':words[0]['start'],'end':words[-1]['end'],'page':page,'text':text,'words':[{**w,'from':w['from']+offset,'to':w['to']+offset} for w in words]})
        pending=[]
    if pending and segments: segments[-1]['text']+='\n\n'+'\n\n'.join(s['text'] for s in pending)
    if not segments: raise ValueError('No usable acoustic word cues')
    return segments,{'sourceWords':len(records),'alignedWords':good,'coverage':round(good/max(1,len(records)),4)}


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--source',type=Path,required=True);p.add_argument('--public',type=Path,default=Path('apps/web/public'));p.add_argument('--cache',type=Path,required=True);p.add_argument('--model',default='base.en');p.add_argument('--model-dir',default='/tmp/pagechime-alignment-models');p.add_argument('--threads',type=int,default=6);p.add_argument('--limit',type=int)
    args=p.parse_args();book=json.loads(args.source.read_text());args.cache.mkdir(parents=True,exist_ok=True)
    import stable_whisper
    model=None;audit=[];chapters=[]
    for i,chapter in enumerate(book['chapters'][:args.limit]):
        source=chapter['source'];audio=args.public/chapter['audio'].lstrip('/')
        key=hashlib.sha256(audio.read_bytes()+json.dumps(source,sort_keys=True).encode()+args.model.encode()).hexdigest()
        cache=args.cache/f'{i+1:02}-{key}.json';started=time.time()
        if cache.exists(): raw=json.loads(cache.read_text())
        else:
            if model is None:
                model=stable_whisper.load_faster_whisper(args.model,device='cpu',compute_type='int8',cpu_threads=args.threads,download_root=args.model_dir)
            result=model.align(str(audio),'\n\n'.join(s['text'] for s in source),language='en',original_split=True,regroup=False,fast_mode=True,verbose=False)
            if result is None: raise ValueError('Acoustic alignment failed')
            raw=result.to_dict();cache.write_text(json.dumps(raw,ensure_ascii=False))
        aligned=[w for segment in raw['segments'] for w in segment['words']]
        segments,stats=map_words(source,aligned,chapter['duration'])
        if stats['coverage']<.90: raise ValueError(f'Chapter {i+1} word coverage is below the publication threshold: {stats["coverage"]}')
        chapter={k:v for k,v in chapter.items() if k!='source'};chapter['segments']=segments;chapters.append(chapter)
        stats.update({'chapter':i+1,'seconds':round(time.time()-started,1)});audit.append(stats)
        print(json.dumps(stats),flush=True)
    (args.cache/'audit.json').write_text(json.dumps(audit,indent=2))
    if args.limit:
        print('Partial alignment completed; full catalog is not published.',flush=True);return
    book.update({'chapters':chapters,'timing':'word-aligned','timingProvenance':'Whisper base.en acoustic forced alignment of the supplied known text; timestamps are alignment estimates, not studio annotations.'})
    out=args.public/'books'/book['id'];(out/'book.json').write_text(json.dumps(book,ensure_ascii=False,separators=(',',':')))
    (args.public/'library.json').write_text(json.dumps({'version':1,'books':[{'id':book['id'],'url':f'/books/{book["id"]}/book.json'}]}))
    print('Published private catalog with',sum(x['alignedWords'] for x in audit),'acoustically aligned words.',flush=True)

if __name__=='__main__': main()
