import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const root = dirname(dirname(fileURLToPath(import.meta.url))),
  req = createRequire(join(root, "apps/web/package.json"));
const pdf = req.resolve("pdfjs-dist/legacy/build/pdf.mjs"),
  worker = readFileSync(
    req.resolve("pdfjs-dist/legacy/build/pdf.worker.min.mjs"),
    "utf8",
  );
const result = await build({
  stdin: {
    contents: `import*as p from ${JSON.stringify(pdf)};window.pdfjs=p;`,
    resolveDir: root,
  },
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  target: "es2022",
  minify: true,
});
const code = `${result.outputFiles[0].text}\nconst worker=${JSON.stringify(worker)};pdfjs.GlobalWorkerOptions.workerSrc=URL.createObjectURL(new Blob([worker],{type:'text/javascript'}));let doc=null,desired=1,task=null,token=0;const send=x=>window.ReactNativeWebView?.postMessage(JSON.stringify(x));async function render(){if(!doc)return;const id=++token;task?.cancel();try{const p=await doc.getPage(Math.max(1,Math.min(doc.numPages,desired)));if(id!==token)return;const c=document.querySelector('canvas'),v=p.getViewport({scale:innerWidth*(devicePixelRatio||1)/p.getViewport({scale:1}).width});c.width=v.width;c.height=v.height;c.style.width='100%';task=p.render({canvas:c,viewport:v});await task.promise;send({type:'rendered',page:desired});}catch(e){if(e.name!=='RenderingCancelledException')send({type:'error',message:'This PDF page could not open.'});}}window.pagechimePDF={async load(data,page){desired=page;try{if(doc)await doc.destroy();doc=await pdfjs.getDocument({data:Uint8Array.from(atob(data),c=>c.charCodeAt(0)),isEvalSupported:false}).promise;send({type:'loaded',count:doc.numPages});render();}catch(e){send({type:'error',message:'The PDF could not be opened.'});}},setPage(page){desired=page;render();}};addEventListener('resize',render);send({type:'ready'});`;
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#fffefb}canvas{display:block;width:100%;height:auto}</style></head><body><canvas aria-label="Original book page"></canvas><script>${code.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
writeFileSync(join(root, "apps/mobile/assets/pdf-viewer.generated.html"), html);
console.log("Prepared offline native PDF viewer");
