const STORE_KEY='leagueNightBowlingTracker.v1';
const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
let deferredPrompt=null, ocrResult=null;
let state=load();
function blankState(){return {version:1,seasons:[],selected:{seasonId:null,leagueId:null,teamId:null}}}
function load(){try{return JSON.parse(localStorage.getItem(STORE_KEY))||blankState()}catch{return blankState()}}
function persist(){localStorage.setItem(STORE_KEY,JSON.stringify(state));renderAll()}
function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
function currentSeason(id=state.selected.seasonId){return state.seasons.find(x=>x.id===id)}
function currentLeague(seasonId=state.selected.seasonId,leagueId=state.selected.leagueId){return currentSeason(seasonId)?.leagues.find(x=>x.id===leagueId)}
function currentTeam(seasonId=state.selected.seasonId,leagueId=state.selected.leagueId,teamId=state.selected.teamId){return currentLeague(seasonId,leagueId)?.teams.find(x=>x.id===teamId)}
function ensureSelection(){if(!currentSeason()) state.selected.seasonId=state.seasons[0]?.id||null; const s=currentSeason(); if(!s?.leagues.some(x=>x.id===state.selected.leagueId)) state.selected.leagueId=s?.leagues[0]?.id||null; const l=currentLeague(); if(!l?.teams.some(x=>x.id===state.selected.teamId)) state.selected.teamId=l?.teams[0]?.id||null}
function optionHtml(items,selected,placeholder='None'){return `<option value="">${placeholder}</option>`+items.map(x=>`<option value="${x.id}" ${x.id===selected?'selected':''}>${esc(x.name)}</option>`).join('')}
function bindSelect(el,items,selected,onchange,placeholder){el.innerHTML=optionHtml(items,selected,placeholder);el.onchange=()=>onchange(el.value||null)}
function renderSelectors(){ensureSelection(); const s=currentSeason(),l=currentLeague();
  bindSelect($('#seasonSelect'),state.seasons,state.selected.seasonId,v=>{state.selected.seasonId=v;state.selected.leagueId=null;state.selected.teamId=null;persist()},'Choose season');
  bindSelect($('#leagueSelect'),s?.leagues||[],state.selected.leagueId,v=>{state.selected.leagueId=v;state.selected.teamId=null;persist()},'Choose league');
  bindSelect($('#teamSelect'),l?.teams||[],state.selected.teamId,v=>{state.selected.teamId=v;persist()},'Choose team');
  for(const prefix of ['night','history']){
    const sEl=$(`#${prefix}SeasonSelect`),lEl=$(`#${prefix}LeagueSelect`),tEl=$(`#${prefix}TeamSelect`);
    bindSelect(sEl,state.seasons,state.selected.seasonId,v=>{state.selected.seasonId=v;state.selected.leagueId=null;state.selected.teamId=null;persist()},'Season');
    bindSelect(lEl,currentSeason()?.leagues||[],state.selected.leagueId,v=>{state.selected.leagueId=v;state.selected.teamId=null;persist()},'League');
    bindSelect(tEl,currentLeague()?.teams||[],state.selected.teamId,v=>{state.selected.teamId=v;persist()},'Team');
  }
}
function addSeason(){const name=$('#newSeasonName').value.trim();if(!name)return toast('Enter a season name');const s={id:uid(),name,leagues:[]};state.seasons.push(s);state.selected={seasonId:s.id,leagueId:null,teamId:null};$('#newSeasonName').value='';persist();toast('Season added')}
function addLeague(){const s=currentSeason();if(!s)return toast('Create a season first');const name=$('#newLeagueName').value.trim();if(!name)return toast('Enter a league name');const l={id:uid(),name,teams:[]};s.leagues.push(l);state.selected.leagueId=l.id;state.selected.teamId=null;$('#newLeagueName').value='';persist();toast('League added')}
function addTeam(){const l=currentLeague();if(!l)return toast('Create a league first');const name=$('#newTeamName').value.trim();if(!name)return toast('Enter a team name');const t={id:uid(),name,bowlers:[],nights:[]};l.teams.push(t);state.selected.teamId=t.id;$('#newTeamName').value='';persist();toast('Team added')}
function addBowler(){const t=currentTeam();if(!t)return toast('Create a team first');const name=$('#newBowlerName').value.trim();if(!name)return toast('Enter a bowler name');t.bowlers.push({id:uid(),name});$('#newBowlerName').value='';persist();toast('Bowler added')}
function renderBowlers(){const t=currentTeam();const el=$('#bowlerList'); if(!t){el.innerHTML='<div class="empty">Choose a team.</div>';return} if(!t.bowlers.length){el.innerHTML='<div class="empty">No bowlers added yet.</div>';return}el.innerHTML=t.bowlers.map(b=>`<div class="bowler"><span>${esc(b.name)}</span><button class="icon-btn ghost" data-remove-bowler="${b.id}">Remove</button></div>`).join('');$$('[data-remove-bowler]').forEach(btn=>btn.onclick=()=>{if(confirm('Remove this bowler?')){t.bowlers=t.bowlers.filter(b=>b.id!==btn.dataset.removeBowler);persist()}})}
function normalizeFrame(s){return String(s||'').toUpperCase().replace(/\s+/g,'').replace(/[O0]/g,'0')}
function parseFrame(frame,index){const s=normalizeFrame(frame);if(index<9){if(s==='X')return [10];if(/^\d\/$/.test(s)){const a=+s[0];return [a,10-a]}if(/^\d[-\d]$/.test(s)){const a=+s[0],b=s[1]==='-'?0:+s[1];if(a+b<10)return[a,b]}if(/^[-]\d$/.test(s)){const b=+s[1];return[0,b]}if(s==='--')return[0,0];return null}
  let rolls=[]; for(let i=0;i<s.length;i++){const c=s[i];if(c==='X'){rolls.push(10)}else if(c==='-'){rolls.push(0)}else if(/\d/.test(c)){rolls.push(+c)}else if(c==='/'){if(!rolls.length)return null;rolls.push(10-rolls[rolls.length-1])}else return null}
  if(rolls.length<2||rolls.length>3||s[0]==='/')return null; const first=rolls[0],second=rolls[1];
  if(first<10 && first+second>10)return null;
  if(first===10 && s[1]==='/')return null;
  if(first===10 && second<10 && second+(rolls[2]||0)>10)return null;
  if(first<10 && s[2]==='/')return null;
  if(first<10 && first+second<10 && rolls.length!==2)return null;
  if(first===10 && rolls.length!==3)return null;
  if(first<10 && first+second===10 && rolls.length!==3)return null;
  return rolls
}
function bowlingScore(frames){if(!frames||frames.length!==10)return null;const all=[],starts=[];for(let i=0;i<10;i++){const r=parseFrame(frames[i],i);if(!r)return null;starts.push(all.length);all.push(...r)}let score=0;for(let i=0;i<9;i++){const r=parseFrame(frames[i],i),start=starts[i];if(r[0]===10){if(all[start+1]==null||all[start+2]==null)return null;score+=10+all[start+1]+all[start+2]}else if(r[0]+r[1]===10){if(all[start+2]==null)return null;score+=10+all[start+2]}else score+=r[0]+r[1]}score+=parseFrame(frames[9],9).reduce((a,b)=>a+b,0);return score}
function blankGames(team){return [1,2,3].map(game=>({game,bowlers:team.bowlers.map(b=>({bowlerId:b.id,name:b.name,frames:Array(10).fill('')}))}))}
let nightDraft=null;
function ensureDraft(){const t=currentTeam();if(!t){nightDraft=null;return}if(!nightDraft||nightDraft.teamId!==t.id){nightDraft={teamId:t.id,games:blankGames(t)}}else{for(const g of nightDraft.games){g.bowlers=t.bowlers.map(b=>g.bowlers.find(x=>x.bowlerId===b.id)||{bowlerId:b.id,name:b.name,frames:Array(10).fill('')})}}}
function renderScoreSheet(){ensureDraft();const el=$('#scoreSheet');const t=currentTeam(); if(!t){el.innerHTML='<div class="empty">Select a team first.</div>';return}if(!t.bowlers.length){el.innerHTML='<div class="empty">Add bowlers to this team first.</div>';return}
  el.innerHTML=nightDraft.games.map(g=>`<div class="game-block"><div class="game-heading"><h3>Game ${g.game}</h3><span class="muted">${g.bowlers.length} bowlers</span></div><table class="score-table"><thead><tr><th>Bowler</th>${Array.from({length:10},(_,i)=>`<th>${i+1}</th>`).join('')}<th>Total</th></tr></thead><tbody>${g.bowlers.map(b=>`<tr><td class="name-cell">${esc(b.name)}</td>${b.frames.map((f,i)=>`<td><input class="frame-input ${i===9?'tenth':''}" data-game="${g.game}" data-bowler="${b.bowlerId}" data-frame="${i}" value="${esc(f)}" maxlength="4" inputmode="text" autocomplete="off"></td>`).join('')}<td class="score-total" data-total="${g.game}:${b.bowlerId}">—</td></tr>`).join('')}</tbody></table></div>`).join('');
  $$('.frame-input').forEach(inp=>{inp.addEventListener('input',e=>{const g=nightDraft.games.find(x=>x.game===+inp.dataset.game);const b=g.bowlers.find(x=>x.bowlerId===inp.dataset.bowler);b.frames[+inp.dataset.frame]=normalizeFrame(inp.value);inp.value=b.frames[+inp.dataset.frame];updateTotals()});inp.addEventListener('focus',()=>inp.select())});updateTotals()}
function updateTotals(){if(!nightDraft)return;let valid=0,total=0;for(const g of nightDraft.games){for(const b of g.bowlers){total++;const s=bowlingScore(b.frames);const el=document.querySelector(`[data-total="${g.game}:${b.bowlerId}"]`);if(el){el.textContent=s??'—';el.classList.toggle('valid',s!=null);el.classList.toggle('invalid',s==null&&b.frames.some(Boolean))}if(s!=null)valid++}}$('#nightValidation').textContent=`${valid} of ${total} bowler games complete and valid.`}
function saveNight(){const t=currentTeam();if(!t||!nightDraft)return toast('Select a team');const entries=[];for(const g of nightDraft.games){for(const b of g.bowlers){const score=bowlingScore(b.frames);if(score==null)return toast(`Finish or correct Game ${g.game} for ${b.name}`);entries.push({game:g.game,bowlerId:b.bowlerId,name:b.name,frames:[...b.frames],score})}}
  t.nights.push({id:uid(),date:$('#nightDate').value||new Date().toISOString().slice(0,10),createdAt:new Date().toISOString(),entries});t.nights.sort((a,b)=>a.date.localeCompare(b.date));nightDraft={teamId:t.id,games:blankGames(t)};persist();toast('League night saved')}
function statsForTeam(t){const entries=(t?.nights||[]).flatMap(n=>n.entries);const scores=entries.map(e=>e.score);const series=[];for(const n of t?.nights||[]){const by={};for(const e of n.entries){(by[e.bowlerId]??=[]).push(e.score)}for(const arr of Object.values(by))if(arr.length===3)series.push(arr.reduce((a,b)=>a+b,0))}return {games:scores.length,avg:scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:0,high:scores.length?Math.max(...scores):0,highSeries:series.length?Math.max(...series):0}}
function renderDashboard(){const s=currentSeason(),l=currentLeague(),t=currentTeam();$('#dashTitle').textContent=t?`${t.name} — ${l.name}`:'No team selected';$('#dashSubtitle').textContent=s?`${s.name} season`:'Create a season, league, and team to get started.';const st=statsForTeam(t);$('#statCards').innerHTML=[['Games',st.games],['Average',st.avg?st.avg.toFixed(1):'—'],['High Game',st.high||'—'],['High Series',st.highSeries||'—']].map(([l,v])=>`<div class="stat"><div class="value">${v}</div><div class="label">${l}</div></div>`).join('');
  const nights=[...(t?.nights||[])].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);$('#recentNights').innerHTML=nights.length?nights.map(n=>{const scores=n.entries.map(e=>e.score);return `<div class="recent-item"><span>${formatDate(n.date)}</span><strong>${scores.length} games logged</strong></div>`}).join(''):'<div class="empty">No league nights saved yet.</div>';
  const highs=(t?.nights||[]).flatMap(n=>n.entries.map(e=>({...e,date:n.date}))).sort((a,b)=>b.score-a.score).slice(0,5);$('#highScores').innerHTML=highs.length?highs.map(e=>`<div class="recent-item"><span>${esc(e.name)} · ${formatDate(e.date)}</span><strong>${e.score}</strong></div>`).join(''):'<div class="empty">Scores will appear here.</div>'}
function formatDate(d){return new Date(d+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}
function renderHistory(){const t=currentTeam();const el=$('#historyList');if(!t||!t.nights.length){el.innerHTML='<div class="empty">No saved league nights for this team.</div>';return}el.innerHTML=[...t.nights].sort((a,b)=>b.date.localeCompare(a.date)).map(n=>{const ids=[...new Set(n.entries.map(e=>e.bowlerId))];const rows=ids.map(id=>{const es=n.entries.filter(e=>e.bowlerId===id).sort((a,b)=>a.game-b.game);const sum=es.reduce((a,b)=>a+b.score,0);return `<div>${esc(es[0]?.name||'')}</div>${[1,2,3].map(g=>`<div>${es.find(e=>e.game===g)?.score??'—'}</div>`).join('')}<div><strong>${sum}</strong></div>`}).join('');return `<div class="history-night"><div class="history-head"><strong>${formatDate(n.date)}</strong><button class="ghost danger icon-btn" data-delete-night="${n.id}">Delete</button></div><div class="history-grid"><div>Bowler</div><div>G1</div><div>G2</div><div>G3</div><div>Series</div>${rows}</div></div>`}).join('');$$('[data-delete-night]').forEach(btn=>btn.onclick=()=>{if(confirm('Delete this league night?')){t.nights=t.nights.filter(n=>n.id!==btn.dataset.deleteNight);persist();toast('League night deleted')}})}
function tokenizeMarks(line){return line.toUpperCase().replace(/\|/g,' ').split(/\s+/).map(x=>x.replace(/[^X\-\/0-9]/g,'')).filter(Boolean)}
function levenshtein(a,b){a=a.toLowerCase();b=b.toLowerCase();const m=Array.from({length:b.length+1},(_,i)=>[i]);for(let j=0;j<=a.length;j++)m[0][j]=j;for(let i=1;i<=b.length;i++)for(let j=1;j<=a.length;j++)m[i][j]=b[i-1]===a[j-1]?m[i-1][j-1]:1+Math.min(m[i-1][j],m[i][j-1],m[i-1][j-1]);return m[b.length][a.length]}
function detectOcrRows(text){
 const t=currentTeam();if(!t)return[];
 const lines=text.split(/\n+/).map(x=>x.trim()).filter(Boolean),used=new Set();
 return t.bowlers.map(b=>{
  const name=b.name.toLowerCase().replace(/[^a-z0-9]/g,'');
  let best=null;
  lines.forEach((line,i)=>{
   if(used.has(i))return;
   const prefix=line.split(/\s+/).slice(0,b.name.split(/\s+/).length).join('').toLowerCase().replace(/[^a-z0-9]/g,'');
   const distance=levenshtein(name,prefix);
   if(distance<=Math.max(1,Math.floor(name.length*.25))&&(!best||distance<best.distance))best={line,i,distance};
  });
  if(!best)return {bowlerId:b.id,name:b.name,line:'No matching name',frames:[]};
  used.add(best.i);
  // Only accept a complete, valid sequence. Never interpret totals as partial frames.
  const tail=best.line.split(/\s+/).slice(b.name.split(/\s+/).length).join(' ');
  const tokens=tail.toUpperCase().replace(/[|]/g,' ').trim().split(/\s+/);
  let frames=[];
  for(let start=0;start+10<=tokens.length;start++){
   const candidate=tokens.slice(start,start+10);
   if(candidate.every((f,i)=>parseFrame(f,i)!==null)&&bowlingScore(candidate)!==null){frames=candidate;break;}
  }
  return {bowlerId:b.id,name:b.name,line:best.line,frames};
 });
}
async function prepareScoreboard(file,enhance){
 const url=URL.createObjectURL(file),img=new Image();
 try{
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('This photo format could not be opened. Please upload a JPG or PNG.'));img.src=url;});
  const canvas=document.createElement('canvas');
  const scale=Math.min(2,3200/Math.max(img.naturalWidth,img.naturalHeight));
  canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);
  const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
  if(enhance){
   const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),d=pixels.data;let sum=0;
   for(let i=0;i<d.length;i+=4)sum+=.299*d[i]+.587*d[i+1]+.114*d[i+2];
   const invert=sum/(d.length/4)<128;
   for(let i=0;i<d.length;i+=4){let v=.299*d[i]+.587*d[i+1]+.114*d[i+2];if(invert)v=255-v;v=Math.max(0,Math.min(255,(v-128)*1.8+128));d[i]=d[i+1]=d[i+2]=v;}
   ctx.putImageData(pixels,0,0);
  }
  return canvas;
 }finally{URL.revokeObjectURL(url);}
}
async function runOcr(){
 const file=$('#scoreboardImage').files[0],team=currentTeam();
 if(!file)return toast('Choose a scoreboard photo first');
 if(!team?.bowlers.length)return toast('Select a team and add its bowlers first');
 if(!window.Tesseract){$('#ocrStatus').textContent='The OCR download did not load. Connect to the internet and reload this page.';return;}
 const teamId=team.id,game=+$('#ocrGame').value;let worker;
 ocrResult=null;$('#applyOcrBtn').disabled=true;$('#ocrProgress').classList.remove('hidden');$('#ocrDetails').classList.add('hidden');$('#runOcrBtn').disabled=true;$('#ocrStatus').textContent='Loading the OCR engine…';
 try{
  worker=await Tesseract.createWorker('eng',1,{logger:m=>{
   $('#ocrStatus').textContent=m.status==='recognizing text'?'Reading scoreboard… '+Math.round((m.progress||0)*100)+'%':m.status;
   $('#ocrProgressBar').style.width=Math.round((m.progress||0)*100)+'%';
  }});
  await worker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'});
  const enhanced=await prepareScoreboard(file,true);
  let result=await worker.recognize(enhanced),text=result.data.text||'',rows=detectOcrRows(text);
  if(!rows.some(r=>r.frames.length===10)){
   $('#ocrStatus').textContent='Trying the original photo with a different reading layout…';
   await worker.setParameters({tessedit_pageseg_mode:'3'});
   const original=await prepareScoreboard(file,false),retry=await worker.recognize(original);
   const retryRows=detectOcrRows(retry.data.text||'');
   if(retryRows.filter(r=>r.frames.length===10).length>rows.filter(r=>r.frames.length===10).length||(!text.trim()&&(retry.data.text||'').trim())){text=retry.data.text||'';rows=retryRows;}
  }
  if(currentTeam()?.id!==teamId)throw new Error('The selected team changed. Select the correct team and read this photo again.');
  ocrResult={text,rows,teamId,game};
  $('#ocrText').textContent=text||'No text was recognized.';
  $('#ocrDetected').innerHTML=rows.map(r=>'<div class="bowler"><div><strong>'+esc(r.name)+'</strong><div class="muted small">'+esc(r.line)+'</div></div><div>'+(r.frames.length?r.frames.map(esc).join(' · '):'No complete frame row detected')+'</div></div>').join('');
  $('#ocrDetails').classList.remove('hidden');$('#ocrDetails').open=true;
  const count=rows.filter(r=>r.frames.length===10).length;
  $('#applyOcrBtn').disabled=count===0;
  $('#ocrStatus').textContent=count?'Read '+count+' bowler rows for Game '+game+'. Review the marks before applying.':'Text was read, but no complete frame rows could be safely identified. Photograph only your team, straight on, with names and all 10 frames visible. Open the OCR text below to see what was read.';
 }catch(e){console.error(e);$('#ocrStatus').textContent='OCR could not finish: '+(e.message||'Check your internet connection and try a JPG or PNG photo.');}
 finally{if(worker)await worker.terminate().catch(()=>{});$('#runOcrBtn').disabled=false;$('#ocrProgress').classList.add('hidden');}
}
function applyOcr(){
 if(!ocrResult||!nightDraft)return;
 if(ocrResult.teamId!==currentTeam()?.id)return toast('Read the photo again for this team');
 const game=nightDraft.games.find(g=>g.game===ocrResult.game);
 if(!game)return;
 if(game.bowlers.some(b=>b.frames.some(Boolean))&&!confirm('Replace detected bowlers’ marks in Game '+game.game+'?'))return;
 let filled=0;
 for(const row of ocrResult.rows){if(row.frames.length!==10)continue;const b=game.bowlers.find(b=>b.bowlerId===row.bowlerId);if(b){b.frames=[...row.frames];filled+=10;}}
 renderScoreSheet();toast('Applied '+filled+' frame marks to Game '+game.game+'. Verify before saving.');
}
function exportBackup(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`bowling-tracker-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href)}
function importBackup(){const f=$('#importFile').files[0];if(!f)return toast('Choose a backup file');const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(reader.result);if(!data.seasons)throw new Error('Invalid');if(confirm('Replace current bowling data with this backup?')){state=data;nightDraft=null;persist();toast('Backup imported')}}catch{toast('That file is not a valid bowling backup')}};reader.readAsText(f)}
function clearNight(){const t=currentTeam();if(!t)return;if(confirm('Clear the current unsaved score sheet?')){nightDraft={teamId:t.id,games:blankGames(t)};renderScoreSheet()}}
function renderNightHeader(){const s=currentSeason(),l=currentLeague(),t=currentTeam();$('#nightSelection').textContent=t?`${s.name} · ${l.name} · ${t.name}`:'Choose a league and team'}
function renderAll(){ensureSelection();renderSelectors();renderBowlers();renderDashboard();renderHistory();renderNightHeader();renderScoreSheet()}
function showView(name){$$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));$$('.tab').forEach(t=>t.classList.toggle('active',t.dataset.view===name));window.scrollTo({top:0,behavior:'smooth'})}
$$('.tab').forEach(b=>b.onclick=()=>showView(b.dataset.view));$$('[data-go]').forEach(b=>b.onclick=()=>showView(b.dataset.go));
$('#addSeasonBtn').onclick=addSeason;$('#addLeagueBtn').onclick=addLeague;$('#addTeamBtn').onclick=addTeam;$('#addBowlerBtn').onclick=addBowler;$('#saveNightBtn').onclick=saveNight;$('#clearNightBtn').onclick=clearNight;$('#runOcrBtn').onclick=runOcr;$('#applyOcrBtn').onclick=applyOcr;$('#exportBtn').onclick=exportBackup;$('#importBtn').onclick=importBackup;
$('#scoreboardImage').onchange=()=>{const f=$('#scoreboardImage').files[0];if(!f)return;$('#imagePreview').src=URL.createObjectURL(f);$('#imagePreviewWrap').classList.remove('hidden');ocrResult=null;$('#applyOcrBtn').disabled=true;$('#ocrDetails').classList.add('hidden')};
$('#nightDate').value=new Date().toISOString().slice(0,10);
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').classList.remove('hidden')});$('#installBtn').onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#installBtn').classList.add('hidden')}};
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
renderAll();
