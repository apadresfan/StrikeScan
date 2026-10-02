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
// Digital turquoise scoreboard font samples; unknown glyphs stay blank for review.
const GRID_FONT=[{"char":"1","mask":"000000011110000000000011111000000001111111100000000111111110000011111111111000000110111111100000000001111110000000000111111000000000011111100000000001111110000000000111111000000000011111100000000001111110000000000111111000000000011111100000000001111110000000000111111000000000011111100000000001111110000000000111111000000000011111100000000011111110000011111111111111111111111111111110","aspect":0.4146341463414634},{"char":"2","mask":"001111111111110001111111111111101111000000001111011100000000111100000000000011110000000000001111000000000001111100000000000111100000000001111100000000001111100000000001111100000000001111100000000011111000000000011111000000000011111000000000011111000000000001111000000000000111100000000000011110000000000001111000000000000111100000000000011110000000000001111111111111100111111111111110","aspect":0.6585365853658537},{"char":"3","mask":"000111111111100001111111111111100111100000001111011100000000111100000000000011110000000000001111000000000000111100000000000011110000000000001111000000000011111000000001111111000000000111111110000000000001111000000000000011110000000000001111000000000000111100000000000011110000000000001111000000000000111100000000000011111111100000001111011110000000111000111111111111100001111111111000","aspect":0.6341463414634146},{"char":"4","mask":"000000000000110000000000001111000000000001101100000000001100110000000001100001000000001110000100000001111100110000001111010011000011111001101100011111000111110001111000011111001111100001111100111110000111110011111111111111111111111111111111011111111111111100000000011111000000000001111100000000000111110000000000011111000000000001111100000000000111110000000000011111000000000001111100","aspect":0.6585365853658537},{"char":"5","mask":"111111111111111011111111111111101111000000000000111100000000000011110000000000001111000000000000111100000000000011110000000000001111000000000000111100000000000011111111111111001111111111111110000000000001111000000000000011110000000000001111000000000000111100000000000011110000000000001111000000000000111111110000000011111111000000001111011110000001111000111111111111000001111111110000","aspect":0.6428571428571429},{"char":"6","mask":"001111111111110001111111111111100111100000001111011110000000111111111000000000000111100000000000111110000000000011111000000000001111100000000000111111111111100011111111111111001111111111111110111110000000111111111000000011111111100000001111111110000000111111111000000011111111100000001111111110000000111111111000000011110111100000001111011110000001111000111111111111000000111111111000","aspect":0.6585365853658537},{"char":"7","mask":"111111111111111111111111111111110000000000001111000000000000111100000000000011110000000000001111000000000000111100000000000011110000000000001111000000000001111000000000011111000000000011111000000000001111000000000001111000000000011110000000000011110000000000111111000000000011111000000000001111100000000000111110000000000011111000000000001111100000000000111110000000000011111000000000","aspect":0.6428571428571429},{"char":"8","mask":"000111111111100000111111111111101111100000001110111100000000111011110000000011101111000000001110111100000000111011110000000011101111000000001110011111111111111000111111111111000011111111111100011110000001111011110000000011111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111100000001110011110000001111000111111111111000001111111111000","aspect":0.6341463414634146},{"char":"9","mask":"001111111111110001111111111111101111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011110111111111111111001111111111111100001111111111110000000000001111000000000000111100000000000011110000000000001111000000000000111100110000000011111111100000011111011110000001111001111111111111000001111111111000","aspect":0.6585365853658537},{"char":"-","mask":"111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111","aspect":6.25},{"char":"/","mask":"000000000000011100000000000001110000000000001111000000000011110000000000001111000000000000111100000000000011110000000000001110000000000111110000000000011110000000000001111100000000000111000000000001111000000000001111100000000000111100000000000011110000000000011100000000000001110000000000001111000000000000111100000000000011110000000000111100000000000011100000000000001110000000000000","aspect":0.6578947368421053},{"char":"X","mask":"111100000000111111110000000011111111000000001111011100000000111000111100001111000011110000111100001111000011110000111100001111000011110000111100000111000011110000001111111100000000011111110000000001111111000000001111111100000011110000111100001111000011110000111100001111000011110000111100001111000011110000111100001111001111000000001110111100000000111111110000000011111111000000001111","aspect":0.625},{"char":"0","mask":"000000011111000000000011111110000000111110111100000011110001111000011111000111100001111000001111000111100000111100011110000011110001110000001111000111000000111100011100000011110001110000001111000111000000111100011100000011110001110000001111000111000000111100011100000011110001110000001111000111100000111100011110000011110001111000001111000011110001111000001111001111100000011111111100","aspect":0.8461538461538461}];

function straightenDigitalGrid(data,w,h){
 const bright=(x,y)=>{if(x<0||x>=w||y<0||y>=h)return false;const i=(Math.round(y)*w+Math.round(x))*4;return data[i+1]>170&&data[i+2]>150};
 const candidates=[],step=Math.max(2,Math.round(w/400)),samples=Math.floor(w*.96/step);
 for(let si=-20;si<=20;si++){
  const slope=si*.002;
  for(let y=0;y<h;y++){
   let count=0;
   for(let x=Math.round(w*.02);x<w*.98;x+=step)if(bright(x,Math.round(y+slope*(x-w/2))))count++;
   if(count>samples*.70)candidates.push({y,slope,score:count});
  }
 }
 candidates.sort((a,b)=>a.y-b.y);
 const groups=[];
 for(const c of candidates){if(!groups.length||c.y-groups.at(-1).at(-1).y>Math.max(5,h*.012))groups.push([c]);else groups.at(-1).push(c);}
 const lines=groups.map(g=>g.reduce((a,b)=>b.score>a.score?b:a));
 if(lines.length<5)return data;
 const out=new Uint8ClampedArray(data.length);
 let index=0;
 for(let y=0;y<h;y++){
  while(index<lines.length-2&&y>lines[index+1].y)index++;
  const a=lines[index],b=lines[index+1],t=Math.max(0,Math.min(1,(y-a.y)/(b.y-a.y))),slope=a.slope*(1-t)+b.slope*t;
  for(let x=0;x<w;x++){
   const sourceY=Math.round(y+slope*(x-w/2)),dest=(y*w+x)*4;
   if(sourceY>=0&&sourceY<h){const src=(sourceY*w+x)*4;out[dest]=data[src];out[dest+1]=data[src+1];out[dest+2]=data[src+2];out[dest+3]=255;}
   else out[dest+3]=255;
  }
 }
 return out;
}

function readDigitalGrid(data,w,h,adjusted=false){
 const lit=(x,y)=>{const i=(y*w+x)*4;return data[i+1]>(adjusted?170:110)&&data[i+2]>(adjusted?150:110)&&(adjusted||data[i]<data[i+1]*.85)};
 function groups(values){const groups=[];for(const v of values){if(!groups.length||v>groups[groups.length-1].at(-1)+1)groups.push([v]);else groups.at(-1).push(v);}return groups.map(g=>(g[0]+g.at(-1))/2);}
 const yHits=[];
 for(let y=0;y<h;y++){let n=0;for(let x=Math.round(w*.02);x<w*.98;x++)if(lit(x,y))n++;if(n>w*.96*.70)yHits.push(y);}
 const ys=groups(yHits);let columns,header;
 for(let i=0;i<ys.length-2;i++){
  const span=ys[i+1]-ys[i],next=ys[i+2]-ys[i+1];
  if(span<20*h/775||span>next*.65)continue;
  const hits=[],a=Math.ceil(ys[i]+4),b=Math.floor(ys[i+2]-4);
  for(let x=0;x<w;x++){let n=0;for(let y=a;y<=b;y++)if(lit(x,y))n++;if(n>(b-a+1)*.92)hits.push(x);}
  const xs=groups(hits);
  if(xs.length===13){columns=xs;header=i;break;}
 }
 if(!columns&&!adjusted)return readDigitalGrid(straightenDigitalGrid(data,w,h),w,h,true);
 if(!columns)throw new Error('Grid not found. This reader needs the turquoise display shown in your sample, photographed straight on with the full grid visible. Try standard OCR for other displays.');
 const frameEdges=columns.slice(1,-1),rows=[];
 for(let r=header+1;r<ys.length-1;r++){
  const top=ys[r],bottom=ys[r+1],height=bottom-top;
  if(height<(ys[header+2]-ys[header+1])*.7)break;
  const middle=Math.round((top+bottom)/2),left=Math.round(columns[1]);
  if(![-2,-1,0,1,2].some(dx=>lit(left+dx,middle)))break;
  const frames=[];
  for(let f=0;f<10;f++){
   const scale=w/1338,x0=Math.round(frameEdges[f])+Math.max(3,Math.round(5*scale)),x1=Math.round(frameEdges[f+1])-Math.max(3,Math.round(4*scale));
   const y0=Math.round(top)+Math.max(3,Math.round(6*scale)),y1=Math.round(top+height*.43)-Math.max(2,Math.round(3*scale));
   const runs=[];
   for(let x=x0;x<x1;x++){
    let n=0;for(let y=y0;y<y1;y++)if(lit(x,y))n++;
    if(n){if(!runs.length||x>runs.at(-1).at(-1)+1)runs.push([x]);else runs.at(-1).push(x);}
   }
   let marks='',uncertain=false;
   for(const run of runs){
    if(run.length<=8*scale)continue;
    const a=run[0],b=run.at(-1)+1;let c=y1,d=y0;
    for(let y=y0;y<y1;y++)for(let x=a;x<b;x++)if(lit(x,y)){c=Math.min(c,y);d=Math.max(d,y+1);}
    if(d<=c)continue;
    let mask='';
    for(let yy=0;yy<24;yy++)for(let xx=0;xx<16;xx++)mask+=lit(Math.min(b-1,a+Math.floor((xx+.5)*(b-a)/16)),Math.min(d-1,c+Math.floor((yy+.5)*(d-c)/24)))?'1':'0';
    const aspect=(b-a)/(d-c);
    if(aspect>2.5){marks+='-';continue;}
    let best=null;
    for(const t of GRID_FONT){
     let differences=0;for(let i=0;i<mask.length;i++)if(mask[i]!==t.mask[i])differences++;
     const error=differences/mask.length+Math.min(.4,Math.abs(Math.log(aspect/t.aspect))*.15);
     if(!best||error<best.error)best={char:t.char,error};
    }
    if(best.error>.28){uncertain=true;break;}marks+=best.char;
   }
   frames.push(!uncertain&&parseFrame(marks,f)!==null?marks:'');
  }
  rows.push({bowlerId:'',name:'Scoreboard row '+(rows.length+1),line:'Assign this row to a bowler; check all frame marks.',frames});
 }
 if(!rows.length)throw new Error('No bowler rows found in this grid.');
 return rows;
}
function renderOcrReview(rows,grid){
 $('#ocrDetected').innerHTML=rows.map((r,i)=>'<div class="game-block"><strong>'+esc(r.name)+'</strong>'+
 (grid?'<label>Bowler<select data-ocr-row="'+i+'"><option value="">Choose bowler for this row</option>'+currentTeam().bowlers.map(b=>'<option value="'+b.id+'">'+esc(b.name)+'</option>').join('')+'</select></label>':'')+
 '<p class="muted small">'+esc(r.line)+'</p><div class="row wrap">'+r.frames.map((f,fi)=>'<label>Frame '+(fi+1)+'<input data-ocr-frame="'+i+':'+fi+'" value="'+esc(f)+'" maxlength="3" style="width:65px"></label>').join('')+'</div></div>').join('');
 $$('[data-ocr-row]').forEach(el=>el.onchange=()=>{const row=ocrResult.rows[+el.dataset.ocrRow];row.bowlerId=el.value;updateOcrApply();});
 $$('[data-ocr-frame]').forEach(el=>el.oninput=()=>{const [r,f]=el.dataset.ocrFrame.split(':').map(Number);ocrResult.rows[r].frames[f]=normalizeFrame(el.value);updateOcrApply();});
 updateOcrApply();
}
function updateOcrApply(){
 const valid=ocrResult?.rows.filter(r=>r.bowlerId&&bowlingScore(r.frames)!==null)||[];
 const ids=valid.map(r=>r.bowlerId);
 $('#applyOcrBtn').disabled=!valid.length||new Set(ids).size!==ids.length;
}

async function runOcr(){
 const file=$('#scoreboardImage').files[0],team=currentTeam();
 if(!file)return toast('Choose a scoreboard photo first');
 if(!team?.bowlers.length)return toast('Select a team and add its bowlers first');
 if($('#ocrMode').value!=='digital'&&!window.Tesseract){$('#ocrStatus').textContent='The OCR download did not load. Connect to the internet and reload this page.';return;}
 const teamId=team.id,game=+$('#ocrGame').value;let worker;
 ocrResult=null;$('#applyOcrBtn').disabled=true;$('#ocrProgress').classList.remove('hidden');$('#ocrDetails').classList.add('hidden');$('#runOcrBtn').disabled=true;$('#ocrStatus').textContent='Loading the OCR engine…';
 try{
  if($('#ocrMode').value==='digital'){
   const original=await prepareScoreboard(file,false),ctx=original.getContext('2d');
   const rows=readDigitalGrid(ctx.getImageData(0,0,original.width,original.height).data,original.width,original.height);
   if(currentTeam()?.id!==teamId)throw new Error('The selected team changed. Read this photo again.');
   ocrResult={text:'Digital grid reader: each frame read separately.',rows,teamId,game};
   $('#ocrText').textContent=ocrResult.text;
   renderOcrReview(rows,true);
   $('#ocrDetails').classList.remove('hidden');$('#ocrDetails').open=true;
   $('#ocrStatus').textContent='Read '+rows.length+' scoreboard rows. Assign each row to a bowler and correct any blank or incorrect marks before applying Game '+game+'.';
   return;
  }
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
  renderOcrReview(rows,false);
  $('#ocrDetails').classList.remove('hidden');$('#ocrDetails').open=true;
  const count=rows.filter(r=>bowlingScore(r.frames)!==null).length;
  $('#applyOcrBtn').disabled=count===0;
  $('#ocrStatus').textContent=count?'Read '+count+' bowler rows for Game '+game+'. Review the marks before applying.':'Text was read, but no complete frame rows could be safely identified. Photograph only your team, straight on, with names and all 10 frames visible. Open the OCR text below to see what was read.';
 }catch(e){console.error(e);$('#ocrStatus').textContent='OCR could not finish: '+(e.message||'Check your internet connection and try a JPG or PNG photo.');}
 finally{if(worker)await worker.terminate().catch(()=>{});$('#runOcrBtn').disabled=false;$('#ocrProgress').classList.add('hidden');}
}
function applyOcr(){
 if(!ocrResult||!nightDraft)return;
 if($('#applyOcrBtn').disabled)return;
 if(ocrResult.teamId!==currentTeam()?.id)return toast('Read the photo again for this team');
 const game=nightDraft.games.find(g=>g.game===ocrResult.game);
 if(!game)return;
 if(game.bowlers.some(b=>b.frames.some(Boolean))&&!confirm('Replace detected bowlers’ marks in Game '+game.game+'?'))return;
 let filled=0;
 for(const row of ocrResult.rows){if(!row.bowlerId||bowlingScore(row.frames)===null)continue;const b=game.bowlers.find(b=>b.bowlerId===row.bowlerId);if(b){b.frames=[...row.frames];filled+=10;}}
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
