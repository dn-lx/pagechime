"""Prepare private Manifest assets from the PDF and existing narration outputs.
Requires: python -m pip install pymupdf soundfile; ffmpeg and ffprobe on PATH.
Book text and audio are deliberately excluded from the public app repository.
"""
import argparse, json, re, shutil, subprocess, difflib, tempfile
from pathlib import Path
import fitz
import soundfile as sf

RANGES=[(0,2),(2,5),(5,6),(6,7),(7,11),(11,13),(13,37),(37,89),(89,109),(109,147),(147,173),(173,195),(195,209),(209,221),(221,225),(225,227),(227,229),(229,235),(235,237)]
def tokens(text): return re.findall(r'[\w]+', text.casefold())
def prepare(pdf, narration, chunks, output):
    out=output/'books'/'manifest';(out/'audio').mkdir(parents=True,exist_ok=True)
    shutil.copy2(pdf,out/'book.pdf')
    doc=fitz.open(pdf)
    pix=doc[0].get_pixmap(matrix=fitz.Matrix(.8,.8),alpha=False)
    pix.pil_save(str(out/'cover.webp'),format='WEBP',quality=85)
    manifest=json.loads((narration/'manifest.json').read_text())
    chapters=[]
    for i,m in enumerate(manifest):
        a,b=RANGES[i]; words=[]; owners=[]
        for n in range(a,b):
            pg=doc[n]
            if i==17:
                w,h=pg.rect.width,pg.rect.height
                text=pg.get_text(clip=fitz.Rect(0,55,w/2,h-45),sort=True)+' '+pg.get_text(clip=fitz.Rect(w/2,55,w,h-45),sort=True)
            else:text=pg.get_text(sort=True)
            for line in text.splitlines():
                if line.strip() in ['Contents','Index','Notes'] or re.fullmatch(r'\s*\d+\s*',line):continue
                ts=tokens(line);words.extend(ts);owners.extend([n+1]*len(ts))
        spoken=[w for c in m['chunks'] for w in tokens(c['text'])]
        mapping=[None]*len(spoken)
        for match in difflib.SequenceMatcher(None,spoken,words,autojunk=False).get_matching_blocks():
            for j in range(match.size):mapping[match.a+j]=owners[match.b+j]
        last=a+1
        for j,v in enumerate(mapping):
            if v is not None:last=max(last,v)
            mapping[j]=last
        filename=f'{i+1:02d}.mp3';source=narration/(m['stem']+'.mp3');dest=out/'audio'/filename
        if source.stat().st_size>24*1024*1024:
            subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(source),'-c:a','libmp3lame','-b:a','48k',str(dest)],check=True)
        else:shutil.copy2(source,dest)
        duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(dest)],text=True))
        raw=[sf.info(str(chunks/(c['key']+'.wav'))).duration for c in m['chunks']]
        ratio=duration/sum(raw);start=0.;offset=0;segments=[]
        for c,d in zip(m['chunks'],raw):
            page=mapping[offset] if offset<len(mapping) else b
            segments.append({'start':round(start,3),'end':round(start+d*ratio,3),'page':page,'text':c['text']})
            start+=d*ratio;offset+=len(tokens(c['text']))
        chapters.append({'id':f'chapter-{i+1}','title':m['title'],'audio':f'/books/manifest/audio/{filename}','file':filename,'duration':duration,'firstPage':a+1,'segments':segments})
        print('Prepared',m['title'],flush=True)
    book={'id':'manifest','title':'Manifest in Action','subtitle':'Unlock Your Limitless Potential','author':'Roxie Nafousi','description':'A quieter way to explore the seven steps. Read, listen, and leave a little space to reflect.','voice':'Kokoro · Emma · British English · female','narration':'kokoro','pageCount':len(doc),'pdf':'/books/manifest/book.pdf','cover':'/books/manifest/cover.webp','chapters':chapters,'duration':sum(c['duration'] for c in chapters),'timing':'passage'}
    (out/'book.json').write_text(json.dumps(book,ensure_ascii=False))
    (output/'library.json').write_text(json.dumps({'books':[{'id':'manifest','url':'/books/manifest/book.json'}]}))
    print('Done:',len(chapters),'chapters,',sum(len(c['segments']) for c in chapters),'timed passages')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--pdf',type=Path,required=True);p.add_argument('--narration-dir',type=Path,required=True);p.add_argument('--chunks-dir',type=Path,required=True);p.add_argument('--output',type=Path,default=Path('apps/web/public'))
    a=p.parse_args();prepare(a.pdf,a.narration_dir,a.chunks_dir,a.output)
