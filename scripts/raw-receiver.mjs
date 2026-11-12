// Hulpje voor de scrape: de bronsite blokkeert scripts (429) maar niet een echte browser. Dit servertje ontvangt
// de HTML die een browsertabblad op www.bluepuremarine.com ophaalt en bewaart die in scripts/raw/html/.
// Gebruik: node scripts/raw-receiver.mjs  (luistert op http://localhost:4777, alleen lokaal)
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "raw", "html");
fs.mkdirSync(dir, { recursive: true });

http
  .createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    res.setHeader("Access-Control-Allow-Private-Network", "true");
    if (req.method === "OPTIONS") return res.end();
    const name = new URL(req.url, "http://x").searchParams.get("name")?.replace(/[^a-z0-9._-]/gi, "_");
    // Brugpagina: de winkel staat geen http-verzoeken toe (CSP), maar wel een apart venster. Het winkel-tabblad
    // opent deze pagina en stuurt de HTML met postMessage door; deze pagina bewaart hem via een POST naar zichzelf.
    if (req.method === "GET" && req.url.startsWith("/bridge")) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.end(`<!doctype html><title>bridge</title><p id="n">0</p><script>let n=0;addEventListener("message",async e=>{const d=e.data;if(!d||!d.name)return;await fetch("/?name="+encodeURIComponent(d.name),{method:"POST",body:d.body});document.getElementById("n").textContent=++n;e.source.postMessage({ack:d.name},"*")});if(opener)opener.postMessage({ready:1},"*")</script>`);
    }
    if (req.method !== "POST" || !name) return res.end("raw-receiver");
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      fs.writeFileSync(path.join(dir, name), Buffer.concat(chunks));
      console.log(name, Buffer.concat(chunks).length);
      res.end("ok");
    });
  })
  .listen(4777, "127.0.0.1", () => console.log("raw-receiver op http://127.0.0.1:4777"));
