"""Recover private Manifest editions/audio from the owner's bundle and chaptered M4B.
This preparation writes only ignored private build inputs, never Git book contents.
Run align-book.py with the generated source.json to finish actual audio alignment.
"""
import argparse, hashlib, json, re, shutil, stat, subprocess, zipfile
from pathlib import Path, PurePosixPath
import xml.etree.ElementTree as ET
import fitz

RANGES = [(0,2),(2,5),(5,6),(6,7),(7,11),(11,13),(13,37),(37,89),(89,109),(109,147),(147,173),(173,195),(195,209),(209,221),(221,225),(225,227),(227,229),(229,235),(235,237)]
NS = {'x':'http://www.w3.org/1999/xhtml','opf':'http://www.idpf.org/2007/opf'}
EPUB = '{http://www.idpf.org/2007/ops}type'
BLOCKS = {'h1','h2','h3','h4','p','li','td','dt','dd'}

def probe(path):
    return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_chapters','-of','json',str(path)]))

def extract_bundle(bundle, target):
    with zipfile.ZipFile(bundle) as z:
        if len(z.infolist()) > 100 or sum(x.file_size for x in z.infolist()) > 50_000_000:
            raise ValueError('Unexpected edition bundle size')
        for info in z.infolist():
            p = PurePosixPath(info.filename)
            if p.is_absolute() or '..' in p.parts or '\\' in info.filename or stat.S_ISLNK(info.external_attr >> 16):
                raise ValueError('Unsafe edition bundle path')
            dest = target.joinpath(*p.parts)
            dest.parent.mkdir(parents=True, exist_ok=True)
            if not info.is_dir(): dest.write_bytes(z.read(info))

def epub_passages(path):
    """Read spine text once, retaining source page markers and paragraph boundaries."""
    result = []; page = 8; runs = []
    def flush():
        nonlocal runs
        for physical, value in runs:
            text = re.sub(r'\s+', ' ', value).strip()
            if text: result.append({'page':physical, 'text':text})
        runs = []
    def add(text):
        if not text: return
        if runs and runs[-1][0] == page: runs[-1] = (page, runs[-1][1] + text)
        else: runs.append((page, text))
    def walk(node):
        nonlocal page
        tag = node.tag.split('}')[-1]
        if node.get(EPUB) == 'pagebreak':
            title = node.get('title','')
            if title.isdigit(): page = int(title) + 7
            return
        if tag in BLOCKS: flush()
        add(node.text)
        for child in node:
            walk(child); add(child.tail)
        if tag in BLOCKS: flush()
    with zipfile.ZipFile(path) as z:
        package = ET.fromstring(z.read('EPUB/content.opf'))
        items = {x.get('id'):x.get('href') for x in package.findall('opf:manifest/opf:item',NS)}
        for item in package.findall('opf:spine/opf:itemref',NS):
            name = items[item.get('idref')]
            if not (name.startswith('chapter-') or name == 'back.xhtml'): continue
            if name == 'back.xhtml': page = 237
            root = ET.fromstring(z.read('EPUB/'+name)); body = root.find('x:body',NS)
            walk(body); flush()
    return result

def front_passages(doc, a, b):
    result=[]
    for n in range(a,b):
        texts=[]
        for block in doc[n].get_text('blocks',sort=True):
            text=re.sub(r'\s+',' ',block[4]).strip()
            if not text or (block[1] > doc[n].rect.height - 45 and text.isdigit()): continue
            key=re.sub(r'\W','',text).casefold()
            if any(re.sub(r'\W','',old).casefold()==key for old in texts): continue
            texts.append(text)
        result.extend({'page':n+1,'text':t} for t in texts)
    return result

def prepare(bundle, audio, output, work):
    editions=work/'editions';editions.mkdir(parents=True,exist_ok=True)
    extract_bundle(bundle,editions)
    pdf=editions/'Manifest-in-Action-Page-Matched.pdf';doc=fitz.open(pdf)
    if len(doc)!=237: raise ValueError('Expected the supplied 237-page edition')
    info=probe(audio);bounds=info.get('chapters',[])
    if len(bounds)!=19: raise ValueError('Expected the complete 19-chapter audiobook')
    if info['format'].get('tags',{}).get('artist')!='Roxie Nafousi': raise ValueError('Unexpected audiobook author')
    out=output/'books'/'manifest';(out/'audio').mkdir(parents=True,exist_ok=True)
    shutil.copy2(pdf,out/'book.pdf')
    (out/'editions').mkdir(exist_ok=True)
    edition_files=[('Cozy interactive PDF','pdf','Manifest-in-Action-Cozy-Interactive.pdf'),('Kindle EPUB','epub','Manifest-in-Action-Kindle.epub'),('Page-matched EPUB','epub','Manifest-in-Action-Page-Matched.epub')]
    editions_meta=[]
    for label,kind,name in edition_files:
        shutil.copy2(editions/name,out/'editions'/name)
        editions_meta.append({'label':label,'kind':kind,'url':'/books/manifest/editions/'+name})
    shutil.copy2(editions/'Font-licenses.txt',out/'editions'/'Font-licenses.txt')
    doc[0].get_pixmap(matrix=fitz.Matrix(.8,.8),alpha=False).pil_save(str(out/'cover.webp'),format='WEBP',quality=85)
    paragraphs=epub_passages(editions/'Manifest-in-Action-Kindle.epub');chapters=[]
    for i,((a,b),bound) in enumerate(zip(RANGES,bounds)):
        dest=out/'audio'/f'{i+1:02}.mp3';start=float(bound['start_time']);end=float(bound['end_time'])
        if not dest.exists():
            subprocess.run(['ffmpeg','-v','error','-y','-ss',str(start),'-i',str(audio),'-t',str(end-start),'-vn','-c:a','libmp3lame','-b:a','48k',str(dest)],check=True)
        if dest.stat().st_size>25*1024*1024: raise ValueError('Chapter exceeds static hosting size limit')
        duration=float(probe(dest)['format']['duration'])
        parts=front_passages(doc,a,b) if i<4 else [p for p in paragraphs if a<p['page']<=b]
        if not parts: raise ValueError('A chapter has no reading text')
        chapters.append({'id':f'chapter-{i+1}','title':bound.get('tags',{}).get('title',f'Chapter {i+1}'),'audio':f'/books/manifest/audio/{dest.name}','file':dest.name,'duration':duration,'firstPage':a+1,'source':parts})
        print(f'Prepared chapter {i+1}/19: {len(parts)} passages, {duration:.1f}s',flush=True)
    book={'id':'manifest','title':'Manifest in Action','subtitle':'Unlock Your Limitless Potential','author':'Roxie Nafousi','description':'Read, listen and reflect through the seven steps, with page-matched and cozy reading editions.','voice':'Kokoro · Emma · British English · female','narration':'kokoro','pageCount':237,'pdf':'/books/manifest/book.pdf','cover':'/books/manifest/cover.webp','editions':editions_meta,'credits':'/books/manifest/editions/Font-licenses.txt','chapters':chapters,'duration':sum(c['duration'] for c in chapters)}
    work.mkdir(parents=True,exist_ok=True);(work/'source.json').write_text(json.dumps(book,ensure_ascii=False))
    print('Private source prepared; run align-book.py before publishing a catalog.',flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--bundle',type=Path,required=True);p.add_argument('--audio',type=Path,required=True);p.add_argument('--output',type=Path,default=Path('apps/web/public'));p.add_argument('--work',type=Path,required=True)
    args=p.parse_args();prepare(args.bundle,args.audio,args.output,args.work)
