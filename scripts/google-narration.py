"""Prepare matching British Neural2 narration with provider word timepoints.
Default is an offline cost preflight. Google network requests are paused under
the owner's zero-spend requirement, including --check and --generate.
"""
import argparse, base64, hashlib, json, math, re, shutil, subprocess, time, urllib.request
from pathlib import Path
from xml.sax.saxutils import escape

API='https://texttospeech.googleapis.com/v1beta1/text:synthesize'
PRICE_DATE='2026-10-24'
# Owner directive: approve no Google charges. Change only after explicit owner
# authorization and review; CLI budgets/environment variables cannot enable calls.
GOOGLE_REQUESTS_ALLOWED=False
ZERO_SPEND_MESSAGE="Google API requests are disabled by Pagechime's zero-spend policy. Keep using the prepared Emma audio; offline preflight is available without --check or --generate."

def require_google_requests():
    if not GOOGLE_REQUESTS_ALLOWED: raise ValueError(ZERO_SPEND_MESSAGE)

def open_google(request,timeout):
    require_google_requests()
    return urllib.request.urlopen(request,timeout=timeout)

def duration(path):
    return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(path)],text=True).strip())

def utf16(text): return len(text.encode('utf-16-le'))//2

def word_requests(text,voice,rate,limit=4800):
    tokens=list(re.finditer(r'\S+\s*',text)); requests=[]; current=[]
    def wrap(matches):
        parts=[]
        for i,m in enumerate(matches): parts.append(f'<mark name="{"START" if i==0 else "w"+str(i)}"/>'+escape(m.group()))
        return '<speak><p>'+''.join(parts)+'<mark name="END"/></p></speak>'
    for token in tokens:
        if current and len(wrap(current+[token]).encode('utf8'))>limit:
            requests.append(current);current=[]
        if len(wrap([token]).encode('utf8'))>limit: raise ValueError('A single word exceeds the Google request limit')
        current.append(token)
    if current: requests.append(current)
    result=[]
    for matches in requests:
        ssml=wrap(matches)
        payload={'input':{'ssml':ssml},'voice':{'languageCode':'en-GB','name':voice},'audioConfig':{'audioEncoding':'LINEAR16','speakingRate':rate},'enableTimePointing':['SSML_MARK']}
        marks=[{'name':'START' if i==0 else 'w'+str(i),'from':utf16(text[:m.start()]),'to':utf16(text[:m.start()+len(m.group().rstrip())])} for i,m in enumerate(matches)]
        # Google bills whitespace/SSML except mark tags. Do not assume free quota.
        billable=len(re.sub(r'<mark\b[^>]*/>','',ssml))
        result.append({'payload':payload,'marks':marks,'characters':billable,'key':hashlib.sha256(json.dumps(payload,sort_keys=True).encode()).hexdigest()})
    return result

def point_cues(request,response,length):
    points={p.get('markName'):p.get('timeSeconds') for p in response.get('timepoints',[])}
    expected=[m['name'] for m in request['marks']]+['END']
    if any(type(points.get(name)) not in (int,float) or not math.isfinite(points[name]) for name in expected): raise ValueError('Google did not return every requested word mark. The response is preserved for review; no timings are guessed.')
    values=[float(points[name]) for name in expected]
    if any(a<0 or b<=a for a,b in zip(values,values[1:])) or values[-1]>length+.05 or values[-2]>=length: raise ValueError('Google returned invalid or unordered word timepoints')
    return [{**{k:m[k] for k in ['from','to']},'start':values[i],'end':min(length,values[i+1])} for i,m in enumerate(request['marks'])]

def access_token():
    require_google_requests()
    if not shutil.which('gcloud'): raise ValueError('Install the Google Cloud CLI and complete Application Default Credentials sign-in first.')
    try: return subprocess.check_output(['gcloud','auth','application-default','print-access-token'],text=True,stderr=subprocess.DEVNULL).strip()
    except subprocess.CalledProcessError: raise ValueError('Google Cloud sign-in is required. Run gcloud auth application-default login outside the application.')

def check_voice(project,voice,token):
    request=urllib.request.Request('https://texttospeech.googleapis.com/v1/voices?languageCode=en-GB',headers={'Authorization':'Bearer '+token,'x-goog-user-project':project})
    with open_google(request,timeout=30) as response: data=json.load(response)
    if not any(v.get('name')==voice and v.get('ssmlGender')=='FEMALE' for v in data.get('voices',[])): raise ValueError('The selected British female voice is not available in this project.')

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--book',type=Path,required=True);p.add_argument('--project');p.add_argument('--voice',default='en-GB-Neural2-A');p.add_argument('--rate',type=float,default=.95);p.add_argument('--generate',action='store_true');p.add_argument('--check',action='store_true');p.add_argument('--sample',action='store_true');p.add_argument('--max-cost-usd',type=float);p.add_argument('--price-per-million',type=float,default=16);p.add_argument('--cache',type=Path,default=Path('.cache/pagechime-neural2'))
    a=p.parse_args()
    if (a.generate or a.check) and not GOOGLE_REQUESTS_ALLOWED:
        p.error(ZERO_SPEND_MESSAGE)
    if not re.fullmatch(r'en-GB-Neural2-[A-Z]',a.voice) or not .8<=a.rate<=1.1: p.error('Use a British Neural2 voice and a natural narration rate of 0.8–1.1.')
    if a.price_per_million<=0 or not math.isfinite(a.price_per_million): p.error('Use a valid current Google price.')
    book=json.loads(a.book.read_text());chapters=book['chapters'];plans=[]
    if a.sample:
        chapter=next((c for c in chapters if 'introduction' in c['title'].lower()),chapters[0]);segment=next((s for s in chapter['segments'] if len(s['text'])>120),chapter['segments'][0]);sample=' '.join(segment['text'].split()[:110]);chapters=[{**chapter,'segments':[{**segment,'text':sample}]}]
    for chapter in chapters: plans.append([word_requests(segment['text'],a.voice,a.rate) for segment in chapter['segments']])
    requests=[r for c in plans for segment in c for r in segment]
    pending=[r for r in requests if not (a.cache/(r['key']+'.json')).exists() or not (a.cache/(r['key']+'.wav')).exists()]
    characters=sum(r['characters'] for r in pending);estimate=math.ceil(characters*a.price_per_million/1_000_000*10000)/10000
    print(json.dumps({'mode':'audition' if a.sample else 'book','voice':a.voice,'speakingRate':a.rate,'requests':len(requests),'uncachedRequests':len(pending),'billableCharactersBeforeFreeQuota':characters,'estimatedMaximumUSD':estimate,'pricePerMillion':a.price_per_million,'priceChecked':PRICE_DATE,'googleRequestsAllowed':GOOGLE_REQUESTS_ALLOWED,'maximumApprovedSpendUSD':0,'timing':'SSML word-start marks and provider END; verify the audition before full synthesis'}),flush=True)
    if not a.generate and not a.check:
        print('Offline preflight only. No Google request or charge. Google API requests are paused under the owner\'s zero-spend policy.');return
    if not a.project or not re.fullmatch(r'[a-z][a-z0-9-]{4,61}[a-z0-9]',a.project): p.error('Provide the owner’s Google Cloud project ID.')
    if a.generate and (a.max_cost_usd is None or not math.isfinite(a.max_cost_usd) or a.max_cost_usd<estimate): p.error('Generation needs --max-cost-usd at least the conservative preflight estimate; free quota is not assumed.')
    try: token=access_token();check_voice(a.project,a.voice,token)
    except Exception as error: p.error(str(error))
    print('Project credentials and British female voice verified. No synthesis charge from this check.',flush=True)
    if not a.generate:return
    a.cache.mkdir(parents=True,exist_ok=True)
    target=a.cache/'auditions'/a.voice if a.sample else a.book.parent/'google';target.mkdir(parents=True,exist_ok=True)
    output=[];refreshed=time.time()
    for ci,(chapter,plan) in enumerate(zip(chapters,plans)):
        chunks=[];segments=[];cursor=0
        for original,requests in zip(chapter['segments'],plan):
            words=[];start=cursor
            for request in requests:
                wav=a.cache/(request['key']+'.wav');meta=a.cache/(request['key']+'.json')
                if not wav.exists() or not meta.exists():
                    if time.time()-refreshed>1800: token=access_token();refreshed=time.time()
                    http=urllib.request.Request(API,data=json.dumps(request['payload']).encode(),headers={'Authorization':'Bearer '+token,'x-goog-user-project':a.project,'Content-Type':'application/json'})
                    with open_google(http,timeout=90) as response: result=json.load(response)
                    # Preserve responses before validation so a bad/missing mark is not silently billed again.
                    wav.write_bytes(base64.b64decode(result.pop('audioContent')));meta.write_text(json.dumps(result))
                length=duration(wav);result=json.loads(meta.read_text());cues=point_cues(request,result,length)
                words.extend({**w,'start':round(cursor+w['start'],3),'end':round(cursor+w['end'],3)} for w in cues);cursor+=length;chunks.append(wav.resolve())
            segments.append({'start':round(start,3),'end':round(cursor,3),'page':original['page'],'text':original['text'],'words':words})
        concat=a.cache/f'concat-{a.voice}-{ci}.txt';concat.write_text(''.join("file '"+str(path).replace("'","'\\''")+"'\n" for path in chunks))
        audio=target/f'{ci+1:02}.mp3'
        subprocess.run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i',str(concat),'-c:a','libmp3lame','-b:a','64k',str(audio)],check=True)
        if audio.stat().st_size>24*1024*1024: subprocess.run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i',str(concat),'-c:a','libmp3lame','-b:a','48k',str(audio)],check=True)
        if audio.stat().st_size>24*1024*1024: raise ValueError('Generated chapter exceeds the static-host limit; split the chapter before publishing.')
        length=duration(audio)
        # Gapless MP3 preserves the WAV timeline; allow encoder padding without scaling true provider marks.
        if length+.05<cursor: raise ValueError('Encoded audio is shorter than its timing track')
        output.append({**chapter,'audio':f'/books/{book["id"]}/google/{audio.name}','file':audio.name,'duration':length,'segments':segments})
        print('Prepared Google chapter',ci+1,'of',len(chapters),flush=True)
    if a.sample:
        print('Audition saved privately:',target,'Review tone/pacing before full-book generation.');return
    result={**book,'narration':'google','voice':f'Google Neural2 · {a.voice} · British English · female','chapters':output,'duration':sum(c['duration'] for c in output),'timing':'word-marks','timingProvenance':'Google SSML word-start marks; each interval ends at the next mark or provider END.'};result.pop('alternateNarration',None)
    (target/'book.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')))
    book['alternateNarration']=f'/books/{book["id"]}/google/book.json';a.book.write_text(json.dumps(book,ensure_ascii=False,separators=(',',':')))
    print('Full Google narration prepared. Republish private build assets and rebuild develop; no public Git media.')

if __name__=='__main__':main()
