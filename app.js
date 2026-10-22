const STORE_KEY='leagueNightBowlingTracker.v1';
let activeStoreKey=STORE_KEY;
const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
let deferredPrompt=null, ocrResult=null;
let state=load();
function blankState(){return {version:1,seasons:[],selected:{seasonId:null,leagueId:null,teamId:null}}}
function load(){try{return JSON.parse(localStorage.getItem(STORE_KEY))||blankState()}catch{return blankState()}}
function persist(){localStorage.setItem(activeStoreKey,JSON.stringify(state));renderAll();window.dispatchEvent(new Event('bowling-data-changed'))}
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
  for(const prefix of ['night','history','dash']){
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
function rememberedScore(value){if(value===null||value===undefined||String(value).trim()==='')return null;const n=Number(value);return Number.isInteger(n)&&n>=0&&n<=300?n:null}
function entryScore(entry){return entry.absent?null:entry.totalOnly?rememberedScore(entry.manualTotal??entry.score):bowlingScore(entry.frames)}
function savedEntry(entry,game=entry.game){
 const totalOnly=!entry.absent&&!!entry.totalOnly;
 const handicap=Object.prototype.hasOwnProperty.call(entry,'handicap')?{pins:entry.handicap,average:entry.handicapAverage}:bowlerHandicap(entry.bowlerId);
 return {game,bowlerId:entry.bowlerId,name:entry.name,...(!entry.absent&&handicap&&Number.isFinite(handicap.pins)?{handicap:handicap.pins,handicapAverage:handicap.average}:{}),frames:entry.absent||totalOnly?Array(10).fill(''):[...entry.frames],score:entryScore(entry),...(entry.absent?{absent:true}:{}),...(totalOnly?{totalOnly:true}:{})};
}

function blankGames(team){return [1,2,3].map(game=>({game,bowlers:team.bowlers.map(b=>({bowlerId:b.id,name:b.name,frames:Array(10).fill('')}))}))}
let nightDraft=null;
const sessionDrafts=new Map();
function isPractice(){return $('#sessionType').value==='practice'}
function localToday(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function practiceBowler(){const team=currentTeam(),select=$('#practiceBowler');return team?.bowlers.find(b=>b.id===select.value)||team?.bowlers[0]}
function sessionRoster(){return isPractice()?[practiceBowler()].filter(Boolean):(currentTeam()?.bowlers||[])}
function newSessionDraft(team){const roster=sessionRoster();return {teamId:team.id,practice:isPractice(),practiceBowlerId:isPractice()?practiceBowler()?.id:null,date:localToday(),games:blankGames({bowlers:roster})}}
function draftKey(d){return [activeStoreKey,d.teamId,d.practice?'practice':'league',d.practiceBowlerId||''].join(':')}
function resetScanContext(){clearScanReview();scanFiles=[];$('#scoreboardImage').value='';$('#scanFileList').innerHTML='';$('#imagePreviewWrap').classList.add('hidden');$('#scanPhotoPreview').classList.add('hidden');$('#singleGameLabel').classList.remove('hidden');$('#scanFileList').classList.remove('hidden');$('#runOcrBtn').disabled=true;$('#ocrStatus').textContent=''}
function changeSession(){if(scanSession)return;ensureDraft();renderNightHeader();renderScoreSheet()}
function renderSessionControls(){const team=currentTeam(),select=$('#practiceBowler'),selected=select.value;select.innerHTML=optionHtml(team?.bowlers||[],selected,'Choose bowler');if(!team?.bowlers.some(b=>b.id===selected))select.value=team?.bowlers[0]?.id||'';$('#practiceBowlerLabel').classList.toggle('hidden',!isPractice());$('#practiceHelp').classList.toggle('hidden',!isPractice());$('#nightEyebrow').textContent=isPractice()?'PRACTICE SESSION':'LEAGUE NIGHT';$('#nightDateLabel').textContent=isPractice()?'Practice date':'League night date';$('#saveNightBtn').textContent=isPractice()?'Save Practice Games':'Save 3-Game League Night';$('#rememberOrderBtn').classList.toggle('hidden',isPractice())}
function findSavedSession(team,id){return [...(team?.nights||[]),...(team?.practiceSessions||[])].find(n=>n.id===id)}

function ensureDraft(){renderSessionControls();const t=currentTeam();if(!t){nightDraft=null;return}const desired=newSessionDraft(t);if(!nightDraft||draftKey(nightDraft)!==draftKey(desired)){
 if(nightDraft){nightDraft.date=$('#nightDate').value||nightDraft.date;sessionDrafts.set(draftKey(nightDraft),nightDraft)}
 nightDraft=sessionDrafts.get(draftKey(desired))||desired;sessionDrafts.delete(draftKey(desired));$('#nightDate').value=nightDraft.date||localToday();resetScanContext();
 }else{for(const g of nightDraft.games)g.bowlers=sessionRoster().map(b=>g.bowlers.find(x=>x.bowlerId===b.id)||{bowlerId:b.id,name:b.name,frames:Array(10).fill('')})}}
function renderScoreSheet(){ensureDraft();if($('#undoScanBtn'))$('#undoScanBtn').disabled=!!scanSession||!scanUndo||scanUndo.store!==activeStoreKey||scanUndo.teamId!==currentTeam()?.id;const el=$('#scoreSheet');const t=currentTeam(); if(!t){el.innerHTML='<div class="empty">Select a team first.</div>';return}if(!t.bowlers.length){el.innerHTML='<div class="empty">Add bowlers to this team first.</div>';return}
  const openGames=new Set([...el.querySelectorAll('[data-score-game][open]')].map(d=>+d.dataset.scoreGame));const hadPanels=!!el.querySelector('[data-score-game]');
  el.innerHTML=nightDraft.games.map(g=>`<details class="game-block score-game" data-score-game="${g.game}" ${openGames.has(g.game)||(!hadPanels&&g.game===1)?'open':''}><summary class="game-heading"><h3>Game ${g.game}</h3><span class="muted">${g.bowlers.length} bowler${g.bowlers.length===1?'':'s'}</span></summary><table class="score-table"><thead><tr><th>Bowler</th>${Array.from({length:10},(_,i)=>`<th>${i+1}</th>`).join('')}<th>Total</th></tr></thead><tbody>${g.bowlers.map(b=>`<tr><td class="name-cell">${esc(b.name)}<label class="small"><input type="checkbox" data-draft-absent="${g.game}:${b.bowlerId}" ${b.absent?'checked':''}> Absent (ABS)</label></td>${b.frames.map((f,i)=>`<td><input class="frame-input ${i===9?'tenth':''} ${b.ocrUncertain?.[i]?'ocr-uncertain':''}" title="${b.ocrUncertain?.[i]?'OCR uncertain — check this frame':''}" data-game="${g.game}" data-bowler="${b.bowlerId}" data-frame="${i}" value="${esc(f)}" ${b.absent?'disabled':''} maxlength="4" inputmode="text" autocomplete="off" spellcheck="false" aria-label="${esc(b.name)}, game ${g.game}, frame ${i+1}">${b.ocrSourceId?`<button type="button" class="frame-review-btn" data-review-frame="${g.game}:${b.bowlerId}:${i}" aria-label="Review ${esc(b.name)}, game ${g.game}, frame ${i+1}">${b.ocrUncertain?.[i]?'⚠ Review':'View'}</button>`:''}</td>`).join('')}<td class="score-total"><input class="game-total-input" data-total="${g.game}:${b.bowlerId}" type="number" min="0" max="300" step="1" inputmode="numeric" placeholder="Total" aria-label="${esc(b.name)}, game ${g.game}, total score" style="width:80px"><small data-total-note="${g.game}:${b.bowlerId}"></small></td></tr>`).join('')}</tbody></table></details>`).join('');
  $$('[data-score-game]').forEach(panel=>panel.addEventListener('toggle',()=>{if(panel.isConnected&&panel.open)$$('[data-score-game]').forEach(other=>{if(other!==panel)other.open=false})}));
  $$('[data-review-frame]').forEach(button=>button.onclick=()=>{const [game,id,frame]=button.dataset.reviewFrame.split(':');openFrameReview(+game,id,+frame)});
  $$('[data-total]').forEach(input=>input.oninput=()=>{const [game,id]=input.dataset.total.split(':');const b=nightDraft.games.find(g=>g.game===+game).bowlers.find(b=>b.bowlerId===id);b.manualTotal=input.value;b.totalOnly=input.value!=='';updateTotals()});
  $$('[data-draft-absent]').forEach(el=>el.onchange=()=>{const [game,id]=el.dataset.draftAbsent.split(':');nightDraft.games.find(g=>g.game===+game).bowlers.find(b=>b.bowlerId===id).absent=el.checked;renderScoreSheet()});
  $$('.frame-input').forEach(inp=>{inp.addEventListener('input',e=>{const g=nightDraft.games.find(x=>x.game===+inp.dataset.game);const b=g.bowlers.find(x=>x.bowlerId===inp.dataset.bowler);b.totalOnly=false;delete b.manualTotal;b.frames[+inp.dataset.frame]=normalizeFrame(inp.value);inp.value=b.frames[+inp.dataset.frame];if(b.ocrUncertain){b.ocrUncertain[+inp.dataset.frame]=parseFrame(inp.value,+inp.dataset.frame)===null;inp.classList.toggle('ocr-uncertain',b.ocrUncertain[+inp.dataset.frame]);}updateOcrFromScoreSheet(b,g.game,+inp.dataset.frame);updateTotals()});inp.addEventListener('focus',()=>inp.select())});updateTotals()}
function updateTotals(){if(!nightDraft)return;let valid=0,total=0;for(const g of nightDraft.games)for(const b of g.bowlers){
 total++;const score=entryScore(b),key=g.game+':'+b.bowlerId,input=$('[data-total="'+key+'"]'),note=$('[data-total-note="'+key+'"]');
 if(input){input.disabled=!!b.absent;if(document.activeElement!==input)input.value=b.absent?'':b.totalOnly?(b.manualTotal??b.score??''):(score??'');input.setAttribute('aria-invalid',String(!b.absent&&score===null&&!!b.totalOnly));}
 if(note){const handicap=isPractice()?null:bowlerHandicap(b.bowlerId);note.textContent=(b.absent?'ABS':b.totalOnly?(score===null?'Enter 0–300':'Total only'):'From frames, or enter a total')+(handicap&&score!==null&&!b.absent?' · Hcp '+(score+handicap.pins)+' (+'+handicap.pins+')':'')+(verificationText(b)?' · '+verificationText(b):'');note.classList.toggle('verification-mismatch',verificationMismatch(b));}if(input)input.classList.toggle('total-mismatch',verificationMismatch(b));
 if(b.absent||score!==null)valid++;
 }if(isPractice()){$('#nightValidation').textContent='Save 1–3 practice games. Leave unused games blank. Practice scores stay separate from league statistics.';return}$('#nightValidation').textContent=valid+' of '+total+' games complete, total only, or ABS. Total-only games exclude frame statistics.'}
function saveNight(){if(isPractice())return savePractice();const t=currentTeam();if(!t||!nightDraft)return toast('Select a team');const mismatches=nightDraft.games.flatMap(g=>g.bowlers.filter(verificationMismatch).map(b=>b.name+' G'+g.game));if(mismatches.length&&!confirm('Calculated scores differ from the scanned scoreboard total for '+mismatches.join(', ')+'. Save the entered frames anyway?'))return;const entries=[];for(const g of nightDraft.games){for(const b of g.bowlers){const score=entryScore(b);if(!b.absent&&score==null)return toast(`Finish or correct Game ${g.game} for ${b.name}`);entries.push(savedEntry(b,g.game))}}
  t.nights.push({id:uid(),date:$('#nightDate').value||localToday(),createdAt:new Date().toISOString(),entries});t.nights.sort((a,b)=>a.date.localeCompare(b.date));nightDraft=newSessionDraft(t);clearScanReview();persist();toast(bestNightNotice(t,t.nights.find(n=>n.entries===entries))||'League night saved')}
function statsArePractice(){return state.selected.statsSource==='practice'}
function statsSourceLabel(){return statsArePractice()?'Practice Sessions':'League Nights'}
function statsSessions(team,source=statsArePractice()?'practice':'league'){
 return (source==='practice'?team?.practiceSessions:team?.nights)||[];
}
function statisticsScore(entry){if(entry.absent)return null;return rememberedScore(entry.score)??entryScore(entry)}
function selectedStatsTeam(){const team=currentTeam();return team?{...team,nights:statsSessions(team).map(n=>({...n,entries:n.entries.map(e=>({...e,score:statisticsScore(e)}))}))}:null}
function savedStatsSelections(source=statsArePractice()?'practice':'league'){
 const found=[];for(const season of state.seasons)for(const league of season.leagues)for(const team of league.teams){
  const games=statsSessions(team,source).flatMap(n=>n.entries).filter(e=>statisticsScore(e)!==null).length;
  if(games)found.push({seasonId:season.id,leagueId:league.id,teamId:team.id,name:season.name+' · '+league.name+' · '+team.name,games});
 }return found;
}
function rememberStatsSelection(){
 if(!statsForTeam(selectedStatsTeam(),state.selected.bowlerId).games)return;
 const source=statsArePractice()?'practice':'league';state.selected.statsSelections??={};
 state.selected.statsSelections[source]={seasonId:state.selected.seasonId,leagueId:state.selected.leagueId,teamId:state.selected.teamId,bowlerId:state.selected.bowlerId};
}
function changeStatsSource(){
 rememberStatsSelection();const source=$('#statsSource').value;state.selected.statsSource=source;
 const available=savedStatsSelections(source),remembered=state.selected.statsSelections?.[source];
 const saved=remembered&&available.find(s=>s.teamId===remembered.teamId&&s.leagueId===remembered.leagueId&&s.seasonId===remembered.seasonId);
 if(saved)Object.assign(state.selected,remembered);
 else if(!statsSessions(currentTeam(),source).some(n=>n.entries.some(e=>statisticsScore(e)!==null))&&available.length===1){const saved=available[0];Object.assign(state.selected,{seasonId:saved.seasonId,leagueId:saved.leagueId,teamId:saved.teamId,bowlerId:null})}
 else if(!statsForTeam(selectedStatsTeam(),state.selected.bowlerId).games)state.selected.bowlerId=null;
 persist();
}
function renderStatsHelp(st){
 const root=$('#statsSelectionHelp');root.classList.toggle('hidden',st.games>0);if(st.games){root.innerHTML='';return}
 const team=currentTeam(),all=statsForTeam(selectedStatsTeam());
 if(all.games){root.innerHTML='<p>No '+esc(statsSourceLabel().toLowerCase())+' scores for this bowler in the current selection.</p><button id="showAllSavedBowlers" class="ghost">Show all bowlers with saved scores</button>';$('#showAllSavedBowlers').onclick=()=>{state.selected.bowlerId=null;persist()};return}
 const available=savedStatsSelections();
 root.innerHTML='<p>No '+esc(statsSourceLabel().toLowerCase())+' scores in the selected season, league and team.</p>'+(available.length?'<p>Saved scores are available here:</p>'+available.map((s,i)=>'<button class="ghost" data-saved-stats="'+i+'">'+esc(s.name)+' · '+s.games+' games</button>').join(' '):'<p>Check History and your Cloud Sync status if you expected saved games here.</p>');
 root.querySelectorAll('[data-saved-stats]').forEach(button=>button.onclick=()=>{const selection=available[+button.dataset.savedStats];Object.assign(state.selected,{seasonId:selection.seasonId,leagueId:selection.leagueId,teamId:selection.teamId,bowlerId:null});persist()});
}
function dashboardBowlers(t){
 const byId=new Map((t?.bowlers||[]).map(b=>[b.id,{id:b.id,name:b.name}]));
 for(const n of t?.nights||[])for(const e of n.entries)if(!byId.has(e.bowlerId))byId.set(e.bowlerId,{id:e.bowlerId,name:e.name});
 return [...byId.values()];
}
function statsForTeam(t,bowlerId=null){
 const nights=(t?.nights||[]).map(n=>({...n,entries:n.entries.filter(e=>!bowlerId||e.bowlerId===bowlerId)})).filter(n=>n.entries.length);
 const entries=nights.flatMap(n=>n.entries).filter(e=>!e.absent&&Number.isFinite(e.score)),scores=entries.filter(e=>!e.absent&&Number.isFinite(e.score)).map(e=>e.score),series=[];
 let strikes=0,spares=0,opens=0,frames=0;
 for(const n of nights){
  const by=new Map();
  for(const e of n.entries.filter(e=>!e.absent&&Number.isFinite(e.score))){if(!by.has(e.bowlerId))by.set(e.bowlerId,[]);by.get(e.bowlerId).push(e);}
  for(const games of by.values())if(games.length===3&&new Set(games.map(e=>e.game)).size===3)series.push(games.reduce((a,e)=>a+e.score,0));
 }
 for(const e of entries.filter(e=>!e.totalOnly))for(let i=0;i<10;i++){
  const rolls=parseFrame(e.frames?.[i],i);if(!rolls)continue;
  frames++;if(rolls[0]===10)strikes++;else if(rolls[0]+rolls[1]===10)spares++;else opens++;
 }
 const average=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
 return {entries,nights,games:scores.length,avg:average(scores),high:scores.length?Math.max(...scores):null,
 highSeries:series.length?Math.max(...series):null,avgSeries:average(series),strikes,spares,opens,frames,
 gameAverages:[1,2,3].map(game=>average(entries.filter(e=>e.game===game).map(e=>e.score)))};
}
function renderBowlerProgress(){
 const root=$('#bowlerProgress'),team=selectedStatsTeam(),id=state.selected.bowlerId;
 const bowler=dashboardBowlers(team).find(b=>b.id===id);
 if(!bowler){root.innerHTML='<div class="empty">Choose a bowler above to see their progress.</div>';return}
 const games=[...(team?.nights||[])].sort((a,b)=>a.date.localeCompare(b.date)||String(a.createdAt||'').localeCompare(String(b.createdAt||''))).flatMap(n=>n.entries.filter(e=>e.bowlerId===id&&Number.isFinite(e.score)).sort((a,b)=>a.game-b.game).map(e=>({date:n.date,game:e.game,score:e.score})));
 if(!games.length){root.innerHTML='<div class="empty">No saved games for '+esc(bowler.name)+' in this selection yet.</div>';return}
 const avg=games.reduce((sum,g)=>sum+g.score,0)/games.length;
 const w=Math.max(280,root.clientWidth||600),h=260,left=36,right=w-18,top=18,bottom=210;
 const x=i=>games.length===1?(left+right)/2:left+i*(right-left)/(games.length-1),y=s=>bottom-s/300*(bottom-top);
 const dateLabel=d=>new Date(d+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'});
 const ticks=[0,100,200,300].map(s=>'<line class="progress-grid" x1="'+left+'" x2="'+right+'" y1="'+y(s)+'" y2="'+y(s)+'"/><text x="'+(left-8)+'" y="'+(y(s)+4)+'" text-anchor="end">'+s+'</text>').join('');
 const labels=[...new Set([0,Math.floor((games.length-1)/2),games.length-1])].map(i=>'<text x="'+x(i)+'" y="234" text-anchor="'+(i===0?'start':i===games.length-1?'end':'middle')+'">'+esc(dateLabel(games[i].date))+'</text>').join('');
 root.innerHTML='<p class="muted small">'+esc(bowler.name)+' · '+games.length+' games · Selected season, league and team</p><div class="progress-legend"><span><i class="progress-score-key"></i>Game score</span><span><i class="progress-average-key"></i>Selected average: '+avg.toFixed(1)+'</span></div><svg class="progress-chart" viewBox="0 0 '+w+' '+h+'" role="group" aria-label="'+esc(bowler.name)+' game scores in date order, from 0 to 300. Selected average '+avg.toFixed(1)+'">'+ticks+'<line class="progress-average" x1="'+left+'" x2="'+right+'" y1="'+y(avg)+'" y2="'+y(avg)+'"/><polyline class="progress-line" points="'+games.map((g,i)=>x(i)+','+y(g.score)).join(' ')+'"/>'+games.map((g,i)=>'<g class="progress-point" role="button" tabindex="0" data-progress-game="'+i+'" aria-label="'+esc(formatDate(g.date))+', game '+g.game+', score '+g.score+'"><circle class="progress-hit" cx="'+x(i)+'" cy="'+y(g.score)+'" r="14"/><circle class="progress-dot" cx="'+x(i)+'" cy="'+y(g.score)+'" r="4"/></g>').join('')+labels+'<text x="'+((left+right)/2)+'" y="256" text-anchor="middle">Games in date order</text></svg><p id="progressDetail" class="progress-detail" aria-live="polite"></p><details class="progress-data"><summary>View all game scores</summary><table><thead><tr><th>Date</th><th>Game</th><th>Score</th></tr></thead><tbody>'+games.map(g=>'<tr><td>'+esc(formatDate(g.date))+'</td><td>'+g.game+'</td><td>'+g.score+'</td></tr>').join('')+'</tbody></table></details>';
 const select=i=>{const g=games[i];$('#progressDetail').textContent=formatDate(g.date)+' · Game '+g.game+' · Score '+g.score+' · '+(g.score>=avg?'+':'')+(g.score-avg).toFixed(1)+' vs. average';root.querySelectorAll('[data-progress-game]').forEach(el=>el.setAttribute('aria-pressed',String(+el.dataset.progressGame===i)))};
 root.querySelectorAll('[data-progress-game]').forEach(el=>{el.onclick=()=>select(+el.dataset.progressGame);el.onfocus=()=>select(+el.dataset.progressGame);el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(+el.dataset.progressGame)}}});select(games.length-1);
}

function personalBestData(team,bowlerId){
 const nights=[...(team?.nights||[])].sort((a,b)=>a.date.localeCompare(b.date)||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
 let highGame=null,highSeries=null;const achievements=new Map();
 for(const night of nights){
  const entries=night.entries.filter(e=>e.bowlerId===bowlerId).sort((a,b)=>a.game-b.game),marks=[];
  for(const e of entries)if(Number.isFinite(e.score)&&(!highGame||e.score>highGame.score)){
   marks.push({kind:'game',score:e.score,game:e.game,first:!highGame});highGame={score:e.score,date:night.date,game:e.game};
  }
  if(entries.length===3&&new Set(entries.map(e=>e.game)).size===3&&entries.every(e=>[1,2,3].includes(e.game)&&Number.isFinite(e.score))){
   const score=entries.reduce((sum,e)=>sum+e.score,0);
   if(!highSeries||score>highSeries.score){marks.push({kind:'series',score,first:!highSeries});highSeries={score,date:night.date}}
  }
  achievements.set(night.id,marks);
 }
 return {highGame,highSeries,achievements};
}
function renderPersonalBests(){
 const root=$('#personalBests'),team=selectedStatsTeam(),bowler=dashboardBowlers(team).find(b=>b.id===state.selected.bowlerId);
 if(!bowler){root.innerHTML='<div class="empty">Choose a bowler above to see their personal bests.</div>';return}
 const records=personalBestData(team,bowler.id);
 root.innerHTML='<p class="muted small">'+esc(bowler.name)+' · '+statsSourceLabel()+' · Selected season, league and team</p><div class="best-grid">'+[['High game',records.highGame],['High series',records.highSeries]].map(([label,record])=>'<div class="best-trophy"><span class="best-label">🏆 '+label+'</span><strong>'+ (record?.score??'—')+'</strong><span>'+(record?esc(formatDate(record.date))+(record.game?' · Game '+record.game:' · 3 games'):'No '+(label==='High game'?'saved games':'complete three-game series')+' yet')+'</span></div>').join('')+'</div><p class="muted small">Three-game records require three completed games in the same session. Ties keep the original record date.</p>';
}
function bestNightNotice(team,night){
 const previous={...team,nights:team.nights.filter(n=>n.id!==night.id)},notices=[];
 for(const id of new Set(night.entries.map(e=>e.bowlerId))){
  const entries=night.entries.filter(e=>e.bowlerId===id&&!e.absent),prior=personalBestData(previous,id),name=entries[0]?.name||'';
  const high=Math.max(...entries.map(e=>e.score));
  if(prior.highGame&&high>prior.highGame.score)notices.push(name+': new high game '+high);
  if(entries.length===3&&new Set(entries.map(e=>e.game)).size===3&&entries.every(e=>[1,2,3].includes(e.game))){const sum=entries.reduce((a,e)=>a+e.score,0);if(prior.highSeries&&sum>prior.highSeries.score)notices.push(name+': new high series '+sum)}
 }
 return notices.length?'🏆 '+notices.join(' · '):null;
}

function renderDashboard(){
 const s=currentSeason(),l=currentLeague(),t=selectedStatsTeam(),bowlers=dashboardBowlers(t);
 $('#statsSource').value=statsArePractice()?'practice':'league';
 if(!bowlers.some(b=>b.id===state.selected.bowlerId))state.selected.bowlerId=null;
 const id=state.selected.bowlerId,bowler=bowlers.find(b=>b.id===id);
 bindSelect($('#dashboardBowlerSelect'),bowlers,id,v=>{state.selected.bowlerId=v;persist()},'All team bowlers');
 $('#dashboardBowlerSelect').disabled=!bowlers.length;
 $('#dashTitle').textContent=bowler?bowler.name+' — '+t.name:t?t.name+' — '+l.name:'No team selected';
 $('#dashSubtitle').textContent=s?s.name+' season'+(bowler?' · '+l.name:'')+' · '+statsSourceLabel()+' · '+(bowler?'Individual bowler statistics':'All team bowlers'):'Create a season, league, and team to get started.';
 $('#downloadBowlerPdfBtn').disabled=!bowler||!statsForTeam(t,id).games;
 $('#shareBowlerPdfBtn').disabled=$('#downloadBowlerPdfBtn').disabled;
 const st=statsForTeam(t,id),decimal=value=>value===null?'—':value.toFixed(1);renderStatsHelp(st);rememberStatsSelection();
 const cards=items=>items.map(([label,value])=>'<div class="stat"><div class="value">'+value+'</div><div class="label">'+label+'</div></div>').join('');
 $('#statCards').innerHTML=cards([['Games',st.games],['Average',decimal(st.avg)],['High Game',st.high??'—'],['High Series',st.highSeries??'—']]);
 $('#bowlerStatCards').innerHTML=cards([['Average Series',decimal(st.avgSeries)],['Strikes',st.strikes],['Spares',st.spares],['Open Frames',st.opens]]);
 $('#gameAverageSummary').textContent=st.games?st.gameAverages.map((avg,i)=>'Game '+(i+1)+' average: '+decimal(avg)).join(' · ')+(st.frames?' · Strike rate: '+(100*st.strikes/st.frames).toFixed(1)+'% · Spare conversion: '+(st.frames>st.strikes?(100*st.spares/(st.frames-st.strikes)).toFixed(1)+'%':'—'):''):'Save '+(statsArePractice()?'practice games':'a league night')+' to see statistics.';
 renderPersonalBests();
 renderBowlerProgress();
 $('#recentNightsTitle').textContent=bowler?(statsArePractice()?'Practice games & series':'League games & series'):(statsArePractice()?'Recent practice sessions':'Recent league nights');
 const nights=[...st.nights].sort((a,b)=>b.date.localeCompare(a.date));
 if(bowler){
  $('#recentNights').innerHTML=nights.length?'<div class="history-grid"><div>Date</div><div>G1</div><div>G2</div><div>G3</div><div>Series</div>'+nights.map(n=>{
   const games=[1,2,3].map(g=>{const e=n.entries.find(e=>e.game===g);return e?.absent?'ABS':e?.score});
   return '<div>'+formatDate(n.date)+'</div>'+games.map(score=>'<div>'+(score??'—')+'</div>').join('')+'<div><strong>'+(games.every(score=>Number.isFinite(score))?games.reduce((a,b)=>a+b,0):'—')+'</strong></div>';
  }).join('')+'</div>':'<div class="empty">No saved games for this bowler in the selected season, league and team.</div>';
 }else{
  $('#recentNights').innerHTML=nights.length?nights.slice(0,5).map(n=>'<div class="recent-item"><span>'+formatDate(n.date)+'</span><strong>'+n.entries.length+' games logged</strong></div>').join(''):'<div class="empty">No '+(statsArePractice()?'practice sessions':'league nights')+' saved yet.</div>';
 }
 const highs=st.nights.flatMap(n=>n.entries.filter(e=>!e.absent&&Number.isFinite(e.score)).map(e=>({...e,date:n.date}))).sort((a,b)=>b.score-a.score).slice(0,5);
 $('#highScores').innerHTML=highs.length?highs.map(e=>'<div class="recent-item"><span>'+esc(e.name)+' · '+formatDate(e.date)+' · G'+e.game+'</span><strong>'+e.score+'</strong></div>').join(''):'<div class="empty">Scores will appear here.</div>';
}
function formatDate(d){return new Date(d+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}

let savedScoreEdit=null;
function savedScoreDirty(){return !!savedScoreEdit&&JSON.stringify(savedScoreEdit.entries)!==savedScoreEdit.originalEntries}
function closeSavedScoreEditor(force=false){
 if(!force&&savedScoreDirty()&&!confirm('Discard your unsaved score corrections?'))return;
 savedScoreEdit=null;$('#savedScoreDialog').close();
}
function openSavedScoreEditor(nightId){
 const team=currentTeam(),night=findSavedSession(team,nightId);if(!night)return;
 savedScoreEdit={teamId:team.id,nightId:night.id,practice:!!night.practice,originalEntries:JSON.stringify(night.entries),entries:JSON.parse(JSON.stringify(night.entries))};
 $('#savedScoreTitle').textContent=(night.practice?'Edit practice scores · ':'Edit scores · ')+formatDate(night.date);
 $('#savedScoreBody').innerHTML=[...new Set(savedScoreEdit.entries.map(e=>e.game))].sort((a,b)=>a-b).map(game=>'<section class="saved-game"><h3>Game '+game+'</h3>'+savedScoreEdit.entries.map((entry,index)=>{
  if(entry.game!==game)return '';
  entry.frames=Array.from({length:10},(_,frame)=>String(entry.frames?.[frame]||''));
  return '<div class="saved-bowler"><label class="small"><input type="checkbox" data-saved-absent="'+index+'" '+(entry.absent?'checked':'')+'> Absent (ABS)</label><div class="saved-bowler-heading"><strong>'+esc(entry.name)+'</strong><span data-saved-total="'+index+'"></span></div><label>Total score<input data-saved-manual="'+index+'" type="number" min="0" max="300" step="1" inputmode="numeric" value="'+(entry.totalOnly?entry.score:'')+'" placeholder="Enter total without frames"></label><div class="saved-frames">'+entry.frames.map((mark,frame)=>'<label><span>'+ (frame+1)+'</span><input class="saved-frame-input" data-saved-entry="'+index+'" data-saved-frame="'+frame+'" value="'+esc(mark)+'" maxlength="4" autocomplete="off" spellcheck="false" aria-label="'+esc(entry.name)+', game '+game+', frame '+(frame+1)+'"></label>').join('')+'</div><p class="muted small" data-saved-error="'+index+'"></p></div>';
 }).join('')+'</section>').join('');
 $$('[data-saved-manual]').forEach(input=>input.oninput=()=>{const entry=savedScoreEdit.entries[+input.dataset.savedManual];entry.manualTotal=input.value;entry.totalOnly=input.value!=='';updateSavedScoreTotals()});
 $$('[data-saved-absent]').forEach(el=>el.onchange=()=>{savedScoreEdit.entries[+el.dataset.savedAbsent].absent=el.checked;updateSavedScoreTotals()});
 $$('[data-saved-entry]').forEach(input=>input.oninput=()=>{const entry=savedScoreEdit.entries[+input.dataset.savedEntry];input.value=normalizeFrame(input.value);entry.totalOnly=false;delete entry.manualTotal;entry.frames[+input.dataset.savedFrame]=input.value;updateSavedScoreTotals()});
 updateSavedScoreTotals();$('#savedScoreDialog').showModal();
}
function updateSavedScoreTotals(){
 if(!savedScoreEdit)return;
 let invalid=0;
 savedScoreEdit.entries.forEach((entry,index)=>{
  const score=entryScore(entry),total=$('[data-saved-total="'+index+'"]'),error=$('[data-saved-error="'+index+'"]');
  total.textContent=entry.absent?'ABS — absent':'Total: '+(score??'—')+(entry.totalOnly?' · Total only':'');
  const manual=$('[data-saved-manual="'+index+'"]');manual.disabled=!!entry.absent;if(document.activeElement!==manual)manual.value=entry.totalOnly?(entry.manualTotal??entry.score??''):'';total.classList.toggle('invalid',score===null);
  error.textContent=!entry.absent&&score===null?'Finish the frames or enter a total score from 0 to 300.':'';
  $$('[data-saved-entry="'+index+'"]').forEach(input=>{input.disabled=!!entry.absent;input.setAttribute('aria-invalid',String(!entry.absent&&!entry.totalOnly&&parseFrame(entry.frames[+input.dataset.savedFrame],+input.dataset.savedFrame)===null))});
  if(!entry.absent&&score===null)invalid++;
 });
 $('#saveScoreChanges').disabled=invalid>0;
 $('#savedScoreStatus').textContent=invalid?invalid+' game'+(invalid===1?' needs':'s need')+' corrected frames before saving.':'All game scores are valid. Ready to save.';
}
function saveScoreChanges(){
 if(!savedScoreEdit)return;
 const team=currentTeam(),night=findSavedSession(team,savedScoreEdit.nightId);
 if(team?.id!==savedScoreEdit.teamId||!night||JSON.stringify(night.entries)!==savedScoreEdit.originalEntries){
  $('#savedScoreStatus').textContent='This saved night changed. Cancel and reopen Edit Scores to load the latest copy.';return;
 }
 const entries=savedScoreEdit.entries.map(entry=>savedEntry(savedScoreEdit.practice?{...entry,handicap:null}:entry));
 if(entries.some(entry=>!entry.absent&&entry.score===null)){updateSavedScoreTotals();return;}
 night.entries=entries;night.editedAt=new Date().toISOString();
 closeSavedScoreEditor(true);persist();toast('Saved scores updated');
}

function isValidNightDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+'T12:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value}
function renderHistory(){renderPracticeHistory();const t=currentTeam();const el=$('#historyList');if(!t||!t.nights.length){el.innerHTML='<div class="empty">No saved league nights for this team.</div>';return}el.innerHTML=[...t.nights].sort((a,b)=>b.date.localeCompare(a.date)).map(n=>{const ids=[...new Set(n.entries.map(e=>e.bowlerId))];const rows=ids.map(id=>{const es=n.entries.filter(e=>e.bowlerId===id).sort((a,b)=>a.game-b.game);const sum=es.length===3&&es.every(e=>!e.absent&&Number.isFinite(e.score))?es.reduce((a,b)=>a+b.score,0):'—';const marks=personalBestData(t,id).achievements.get(n.id)||[];return `<div>${esc(es[0]?.name||'')}${marks.map(m=>`<span class="best-badge">🏆 ${m.first?(m.kind==='game'?'First high game':'First high series'):m.kind==='game'?'New high game':'New high series'}: ${m.score}${m.game?' · G'+m.game:''}</span>`).join('')}</div>${[1,2,3].map(g=>`<div>${es.find(e=>e.game===g)?.absent?'ABS':es.find(e=>e.game===g)?.score??'—'}${es.find(e=>e.game===g)?.totalOnly?'<small> · Total only</small>':''}${handicapScoreLabel(es.find(e=>e.game===g))?'<small>'+handicapScoreLabel(es.find(e=>e.game===g))+'</small>':''}</div>`).join('')}<div><strong>${sum}</strong>${es.length===3&&es.every(e=>!e.absent&&Number.isFinite(e.handicap))?`<small>Hcp ${es.reduce((a,e)=>a+e.score+e.handicap,0)}</small>`:''}</div>`}).join('');return `<div class="history-night"><div class="history-head wrap"><strong>${formatDate(n.date)}</strong><div class="row wrap"><button class="ghost icon-btn" data-edit-scores="${esc(n.id)}">Edit Scores</button><button class="ghost icon-btn" data-edit-night="${esc(n.id)}" aria-expanded="false" aria-controls="date-editor-${esc(n.id)}">Edit Date</button><button class="ghost danger icon-btn" data-delete-night="${n.id}">Delete</button></div></div><form id="date-editor-${esc(n.id)}" class="hidden" data-date-editor="${esc(n.id)}" style="padding:.8rem"><label for="saved-date-${esc(n.id)}">League night date<input id="saved-date-${esc(n.id)}" type="date" value="${esc(n.date)}" required></label><div class="row wrap"><button class="primary" type="submit">Save Date</button><button class="ghost" type="button" data-cancel-date="${esc(n.id)}">Cancel</button></div></form><div class="history-grid"><div>Bowler</div><div>G1</div><div>G2</div><div>G3</div><div>Series</div>${rows}</div></div>`}).join('');$$('[data-edit-scores]').forEach(btn=>btn.onclick=()=>openSavedScoreEditor(btn.dataset.editScores));$$('[data-edit-night]').forEach(btn=>btn.onclick=()=>{const form=document.getElementById('date-editor-'+btn.dataset.editNight);const opening=form.classList.contains('hidden');form.classList.toggle('hidden',!opening);btn.setAttribute('aria-expanded',String(opening));if(opening)form.querySelector('input').focus()});
$$('[data-cancel-date]').forEach(btn=>btn.onclick=()=>{const form=btn.closest('form');form.classList.add('hidden');const edit=$$('[data-edit-night]').find(b=>b.dataset.editNight===btn.dataset.cancelDate);edit.setAttribute('aria-expanded','false');form.querySelector('input').value=t.nights.find(n=>n.id===btn.dataset.cancelDate).date;edit.focus()});
$$('[data-date-editor]').forEach(form=>form.onsubmit=e=>{e.preventDefault();const value=form.querySelector('input').value;if(!isValidNightDate(value))return toast('Choose a valid league night date');const night=t.nights.find(n=>n.id===form.dataset.dateEditor);if(!night)return;night.date=value;t.nights.sort((a,b)=>a.date.localeCompare(b.date));persist();toast('League night date updated')});
$$('[data-delete-night]').forEach(btn=>btn.onclick=()=>{if(confirm('Delete this league night?')){t.nights=t.nights.filter(n=>n.id!==btn.dataset.deleteNight);persist();toast('League night deleted')}})}
function tokenizeMarks(line){return line.toUpperCase().replace(/\|/g,' ').split(/\s+/).map(x=>x.replace(/[^X\-\/0-9]/g,'')).filter(Boolean)}
function levenshtein(a,b){a=a.toLowerCase();b=b.toLowerCase();const m=Array.from({length:b.length+1},(_,i)=>[i]);for(let j=0;j<=a.length;j++)m[0][j]=j;for(let i=1;i<=b.length;i++)for(let j=1;j<=a.length;j++)m[i][j]=b[i-1]===a[j-1]?m[i-1][j-1]:1+Math.min(m[i-1][j],m[i][j-1],m[i-1][j-1]);return m[b.length][a.length]}
function detectOcrRows(text){
 const t=currentTeam();if(!t)return[];
 const lines=text.split(/\n+/).map(x=>x.trim()).filter(Boolean),used=new Set();
 return sessionRoster().map(b=>{
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
  let frames=[],frameEnd=-1;
  for(let start=0;start+10<=tokens.length;start++){
   const candidate=tokens.slice(start,start+10);
   if(candidate.every((f,i)=>parseFrame(f,i)!==null)&&bowlingScore(candidate)!==null){frames=candidate;frameEnd=start+10;break;}
  }
  const trailing=tokens.at(-1),displayedTotal=frameEnd>=0&&tokens.length>frameEnd&&/^\d{1,3}$/.test(trailing)&&Number(trailing)<=300?Number(trailing):null;return {bowlerId:b.id,name:b.name,line:best.line,frames,displayedTotal,totalUncertain:false};
 });
}
function adjustScoreboardPixels(data,brightness,contrast){
 const out=new Uint8ClampedArray(data);
 for(let i=0;i<out.length;i+=4)for(let k=0;k<3;k++)out[i+k]=Math.max(0,Math.min(255,(out[i+k]-128)*contrast+128+brightness));
 return out;
}

async function prepareScoreboard(file,enhance,preserveSize=false){
 const url=URL.createObjectURL(file),img=new Image();
 try{
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('This photo format could not be opened. Please upload a JPG or PNG.'));img.src=url;});
  const canvas=document.createElement('canvas');
  const scale=Math.min(preserveSize?1:2,3200/Math.max(img.naturalWidth,img.naturalHeight));
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
const TOTAL_FONT=[{"char":"1","mask":"000000001111000000000111111110000001111111111000001111111111100011111111111110000011111111111000000111111111100000011111111110000001111111111000000111111111100000011111111110000001111111111000000111111111100000011111111110000001111111111000000111111111100000011111111110000001111111111000000111111111100000011111111110000011111111111100011111111111111101111111111111110001111111111110","aspect":0.41304347826086957},{"char":"2","mask":"000011111111000000111111111111001111111111111110111111000111111001110000001111100000000000111110000000000011111000000000011111100000000011111100000000011111100000000011111100000000011111100000000011111100000000011111100000000011111100000000011111100000000011111100000000001111110000000000111111000000000011111100000000001111111111111110111111111111111111111111111111110111111111111100","aspect":0.6808510638297872},{"char":"9","mask":"000011111111100000111111111111100111111111111110011111000011111101111100000111110111110000011111011111000001111111111100000111111111110000011111111111000001111111111100000111110111111111111111001111111111111100011111111111110000000000011111000000000001111100000000000111110000000000011111001100000001111101111100000111110111111111111111011111111111111000111111111111000000111111110000","aspect":0.625},{"char":"1","mask":"000000011111000000000111111100000000111111110000011111111111000011111111111100000111111111110000000111111111000000011111111100000001111111110000000111111111000000011111111100000001111111110000000111111111000000011111111100000000111111110000000011111111000000001111111100000000111111110000000011111111000000011111111110000011111111111100111111111111111011111111111111110000011111111100","aspect":0.391304347826087},{"char":"2","mask":"000000111110000000111111111111000111111111111110111110000011111001110000001111100000000000111110000000000011111000000000011111100000000011111100000000011111100000000011111100000000011111100000000011111100000000011111000000000011111000000000011111000000000001111100000000001111100000000000111110000000000011111100000000001111111111111110111111111111111101111111111111110111111111111100","aspect":0.6808510638297872},{"char":"9","mask":"000011111111100000111111111111100111111111111110011111000001111101111100000111110111110000011111011111000001111101111100000111110111110000011111111111000001111101111100000111110111111111111111001111111111111100011111111111110000000000011111000000000001111100000000000111110000000000011111001100000001111101111100000111110111111111111111001111111111111000011111111111000000011111110000","aspect":0.625},{"char":"1","mask":"000000001111000000000111111100000000111111110000011111111111000011111111111100000111111111110000000111111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111000000001111111110000011111111111000011111111111111001111111111111110000001111111100","aspect":0.391304347826087},{"char":"2","mask":"000111111111100001111111111111001111111001111110111100000011111000100000000111100000000000011110000000000011111000000000011111000000000011111000000000011111000000000011111000000000011111000000000011111000000000011111000000000011111000000000011111000000000001111000000000000111100000000000011110000000000011111000000000000111111011111100011111111111111001111111111111100001011011101000","aspect":0.6739130434782609},{"char":"9","mask":"000011111111100000111111111111000111111111111110111111000011111011111000000111111111100000011111111111000001111111111100000111111111110000011111111111000001111111111100000111110111111111111111011111111111111100111111111111110000011100111111000000000001111100000000000111110000000000011111000000000001111101111000000111111111110000011111011111111111111000111111111111000001111111111000","aspect":0.6304347826086957},{"char":"1","mask":"000000001110000000000011111100000000111111110000001111111111000011111111111100000011111111110000000111111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000011111111111110001111111111111100001111111111110","aspect":0.4},{"char":"2","mask":"000111111111100000111111111111001111110000111110111100000001111000000000000111100000000000011110000000000001111000000000001111000000000000111100000000001111100000000001111100000000011111100000000011111100000000011111100000000001111000000000011111000000000001111000000000000111100000000000011110000000000001111000000000000111100000000000011111111111111001111111111111110111111111111110","aspect":0.6666666666666666},{"char":"9","mask":"000011111111000000111111111111000111111101111110011110000001111011111000000111111111100000011111111110000001111111111000000111111111100000011111111110000001111111111100000111110111111111111111001111111111111100011111111111110000000000011111000000000001111100000000000011110000000000001111000000000000111101110000000111111111110000011111011111111111111000111111111111000001111111111000","aspect":0.6304347826086957},{"char":"1","mask":"000000001110000000000111111110000001111111111000000111111111100011111111111110001111111111111000001111111111100000011111111110000001111111111000000111111111100000011111111110000001111111111000000111111111100000011111111110000001111111111000000111111111100000011111111110000001111111111000000111111111100000011111111110000101111111111100011111111111111001111111111111100011111111111000","aspect":0.40425531914893614},{"char":"4","mask":"000000000001110000000000001111000000000011111100000000011111110000000011111111000000011111111100000011111111110000011111111111000011111111111100011111111111110011111100111111001111110011111100111111111111111011111111111111111111111111111111001111111111111000000000111111000000000001111100000000001111110000000000111111000000000001111100000000000111110000000000011111000000000000000000","aspect":0.6666666666666666},{"char":"7","mask":"011111111111111011111111111111111111111111111111001111000011111100000000000111110000000000011111000000000001111100000000001111110000000000111111000000000011111100000000011111100000000111111100000000111111100000000111111100000000111111100000000111111100000000111111100000000011111100000000001111110000000000111111000000000011111100000000001111110000000000111110000000000000111000000000","aspect":0.6382978723404256},{"char":"1","mask":"000000000111000000000111111100000000111111111000000111111111100011111111111110001111111111111000001111111111100000011111111110000001111111111000000111111111100000011111111110000000111111111000000011111111100000001111111110000000111111111000000011111111100000001111111110000000111111111000000011111111100000001111111110000001111111111100011111111111111100111111111111110000000100011100","aspect":0.3829787234042553},{"char":"4","mask":"000000000001100000000000001111000000000001111100000000001111110000000001111111000000011111111100000011111111110000011111111111000011111111111100011111101111110011111100011111001111110011111100111111001111110011111111111111101111111111111111011111111111111100000000111111000000000001111100000000000111110000000000111111000000000001111100000000000111110000000000011111000000000000111000","aspect":0.6739130434782609},{"char":"7","mask":"001111111111111011111111111111101111111111111111001110000011111100000000000111110000000000011111000000000001111100000000000111110000000000011111000000000011111100000000011111100000000111111100000000111111000000000111111100000000111111100000000111111000000000111111000000000011111100000000001111110000000000111111000000000011111100000000001111110000000000011110000000000000110000000000","aspect":0.6382978723404256},{"char":"1","mask":"000000000111000000000011111100000000111111110000000111111111100011111111111110000111111111111000001111111111100000001111111110000000111111110000000011111111100000001111111110000000111111111000000011111111100000001111111110000000111111111000000011111111100000001111111110000000111111111000000011111111100000001111111110000001111111111000011111111111111101111111111111110011111111111110","aspect":0.391304347826087},{"char":"4","mask":"000000000001100000000000001111000000000001111100000000001111110000000001111111000000001111111100000001111111110000011111111111000011111111111100001111100111110001111100011111001111110001111100111111001111110011111111111111101111111111111111011111111111111100000000111111000000000001111100000000000111110000000000011111000000000001111100000000000111110000000000011111000000000000110000","aspect":0.6739130434782609},{"char":"7","mask":"001111111111111001111111111111101111111111111110000000000001111100000000000111110000000000011111000000000001111000000000000111100000000000011110000000000011111000000000011111100000000111111000000000111111000000000111111000000000111111000000000111111000000000111111000000000011111000000000001111100000000000111110000000000011111000000000001111100000000000011110000000000000110000000000","aspect":0.6382978723404256},{"char":"1","mask":"000000000010000000000011111100000000111111110000000111111111000011111111111100000111111111110000000111111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111000000001111111100000000111111111000011111111111111100111111111111110011111111111110","aspect":0.391304347826087},{"char":"4","mask":"000000000000100000000000001111000000000001111100000000001111110000000011111111000000011111111100000011111111110000011111111111000011111011111100011111000111110011111000011111001111100001111100111110000111110011111101111111101111111111111111011111111111111000000000011111000000000001111100000000000111100000000000011111000000000001111100000000000111110000000000011110000000000000110000","aspect":0.6521739130434783},{"char":"7","mask":"000111111111111011111111111111111111111111111111000000000001111100000000000111110000000000011111000000000001111100000000000111110000000000011111000000000001111100000000011111100000000011111100000000011111100000000011111000000000111111000000000111111000000000111111000000000011111000000000001111100000000000111110000000000011111000000000001111100000000000111110000000000000110000000000","aspect":0.5957446808510638},{"char":"1","mask":"000000000111000000000011111100000000111111110000000111111111000011111111111100000111111111110000001111111111000000001111111100000001111111110000000111111111000000011111111100000001111111111000000111111111100000011111111110000001111111111000000111111111100000011111111110000001111111111000000111111111000000011111111100000001111111111000011111111111111011111111111111110011111111111110","aspect":0.391304347826087},{"char":"4","mask":"000000000001110000000000001111000000000001111100000000011111110000000011111111000000011111111100000011111111110000011111111111000011111111111100011111100111110011111100111111001111110011111100111111001111110011111111111111101111111111111111011111111111111000000000011111000000000001111100000000000111110000000000011111000000000001111100000000000111110000000000011111000000000000011000","aspect":0.6521739130434783},{"char":"8","mask":"000011111111100000111111111111100111111111111110111111000001111111111100000111111111110000011111111111000001111111111100000111110111110000011111011111111111111101111111111111100111111111111110011111100001111111111100000011111111110000011111011111000001111101111100000111110111110000011111011111000001111101111100000111110111111111111111001111111111111000011111111111000000000001100000","aspect":0.6382978723404256},{"char":"1","mask":"000000011111000000000111111100000000111111110000001111111111000011111111111100000111111111110000000011111111000000001111111100000000111111110000000011111111000000001111111100000001111111110000000111111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000111111111000000001111111100000001111111111000001111111111111011111111111111110001111111111110","aspect":0.4},{"char":"4","mask":"000000000001100000000000001111000000000001111100000000001111110000000001111111000000011111111100000011111111110000011111111111000011111111111100011111000111110011111100011111001111100011111100111111001111110011111111111111101111111111111111011111111111111000000000011111000000000000111100000000000011110000000000001111000000000001111100000000000111110000000000011111000000000000011000","aspect":0.6521739130434783},{"char":"8","mask":"000011111111100000011111111111000111111111111110011111000001111111111100000111111111100000011111011110000001111101111100000111110111110000011111011111111111111100111111111111100111111111111110011111111111111101111100000011110111110000001111011111000000111101111100000011110111110000001111011111000000111101111100000111110111110000011111011111111111111000011111111111000000111111111000","aspect":0.6521739130434783},{"char":"1","mask":"000000011111000000000111111100000001111111110000011111111111000011111111111100000011111111110000000111111111000000011111111100000001111111110000000111111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111000000001111111100000001111111110000011111111111111111111111111111110011111111111110","aspect":0.38636363636363635},{"char":"2","mask":"001111111111110001111111111111001111100000111110111100000011111000000000001111100000000000111110000000000001111000000000001111100000000011111100000000011111100000000011111100000000011111000000000011111000000000011111000000000011111000000000011111000000000011110000000000001111000000000000111100000000000011111000000000001111100000111100111111111111111101111111111111110011111111111110","aspect":0.6590909090909091},{"char":"5","mask":"111111111111111011111111111111100111100000000000011110000000000001111000000000000111100000000000111110000000000011111000000000001111100000000000111111111111110011111111111111100000001001111110000000000011111000000000000111100000000000011111000000000001111100000000000111110000000000011110001000000001111001110000000111101111110000111110011111111111111000111111111110000000111111100000","aspect":0.6590909090909091},{"char":"1","mask":"000000011111000000000011111100000000111111110000011111111111000001111111111100000011111111110000000111111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111000000001111111100000001111111110000011111111111111001111111111111110001111000111100","aspect":0.38636363636363635},{"char":"2","mask":"000111111111100001111111111111001111100000011110111100000001111000000000000111100000000000011110000000000001111000000000001111000000000001111000000000001111100000000011111000000000011111000000000011111000000000011111000000000011111000000000011111000000000011110000000000000111000000000000011100000000000001110000000000001111100000001100011111111111111101111111111111110000001111111110","aspect":0.6590909090909091},{"char":"5","mask":"011111111111111101111111111111110111100000000000011110000000000001111000000000000111100000000000011110000000000001111000000000001111100000000000111111111111110011111111111111000111111111111110000000000001111100000000000111110000000000011111000000000001111100000000000111110000000000011111000000000001111101110000000111111111100000011111011111110011111000111111111111000001111111111000","aspect":0.6511627906976745},{"char":"1","mask":"000000011110000000000111111000000001111111100000111111111110000011111111111000000111111111100000000111111110000000011111111000000001111111100000000111111110000000001111111000000000111111100000000011111110000000001111111000000000111111100000000011111110000000001111111000000000111111100000000011111110000000001111111000000000111111110000111111111111111011111111111111110000000000011000","aspect":0.36363636363636365},{"char":"2","mask":"000111111111100001111110011111001111000000011110011000000001111000000000000111100000000000011110000000000000111000000000001111000000000001111000000000001111000000000001111100000000001111000000000011111000000000011111000000000001111000000000001111000000000001110000000000000111000000000000011100000000000001110000000000000111000000000000011110000111111001111111111111110111111111111110","aspect":0.6744186046511628},{"char":"5","mask":"011111111111111101111111111111100111100000000000011110000000000001111000000000000111100000000000011110000000000001111000000000000111100000000000111111111111100001111111111111000011111111111110000000000000111100000000000011110000000000001111000000000000111100000000000011110000000000001111000000000000111101100000000011110111100000001111011111000011111000111111111111000000111111111000","aspect":0.6511627906976745},{"char":"1","mask":"000000011110000000000111111000000000111111100000011111111110000011111111110000000011111111100000000011111110000000001111111000000000111111100000000011111110000000001111111000000000111111100000000011111110000000001111111000000000111111100000000011111110000000001111111000000000111111100000000011111110000000001111111000000000111111100000011111111111111011111111111111110000000000011000","aspect":0.36363636363636365},{"char":"2","mask":"000111111111100001111100011111001111000000011110110000000001111000000000000111100000000000011110000000000001111000000000001111000000000001111000000000011111000000000001111000000000001111000000000001111000000000011110000000000011111000000000011111000000000011110000000000001111000000000000111100000000000011110000000000001111000000000000111100000001111011111111111111110111111111111110","aspect":0.6511627906976745},{"char":"5","mask":"111111111111111111111000011111101111000000000000111100000000000011110000000000001111000000000000111100000000000011110000000000001111000000000000111111111111100011111111111111000011111111111110000000000000111100000000000011110000000000001111000000000000111100000000000011110000000000001111000000000000111101100000000011111111000000001111011111000011111000111111111111000000111111110000","aspect":0.627906976744186},{"char":"1","mask":"000000011111000000001111111100000001111111110000011111111111000001111111111100000011111111110000000111111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111000000001111111100000001111111111000011111111111111111111111111111110001000000011000","aspect":0.4090909090909091},{"char":"2","mask":"001111111111110001111111111111100111100000011110011100000001111000000000000111100000000000011110000000000001111000000000011111000000000011111000000000011111000000000011111000000000011111000000000011111100000000011111100000000011111000000000011111000000000011111000000000001111100000000000111110000000000011111000000000001111100111111110011111111111111101111111111111110000000000111100","aspect":0.6818181818181818},{"char":"7","mask":"111111111111111101111111101111110000000000011111000000000001111100000000000111110000000000011111000000000001111100000000000111110000000000111111000000000111111000000001111110000000001111110000000000111110000000000111110000000001111110000000001111110000000000111110000000000011111000000000001111100000000000111110000000000011111000000000001111100000000000111110000000000000100000000000","aspect":0.6363636363636364},{"char":"1","mask":"000000011111000000000111111100000001111111110000011111111111000011111111111100000111111111110000000111111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111100000001111111100000000111111110000000011111111100000001111111110000000111111111000000011111111100000001111111110000001111111110000011111111111111011111111111111110111111111111111","aspect":0.37209302325581395},{"char":"2","mask":"001111111111100011111100011111101111000000011110011000000001111000000000000111100000000000011110000000000001111000000000011111000000000011111000000000011111000000000011111000000000011111000000000011111000000000011111000000000011111000000000011111000000000011110000000000001111000000000000111100000000000011110000000000001111000000000000111111111111111011111111111111110111111111111110","aspect":0.6744186046511628},{"char":"7","mask":"111111111111111101111100000111110000000000011111000000000001111100000000000111110000000000011111000000000001111100000000000111110000000000111110000000000111110000000000111110000000000111110000000000111110000000000111110000000001111110000000001111100000000000111110000000000011111000000000001111100000000000111110000000000011111000000000001111100000000000111110000000000000100000000000","aspect":0.6363636363636364},{"char":"1","mask":"000000011111000000000111111100000001111111110000011111111111000011111111111100000111111111110000000011111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000001111111111111011111111111111110111111000111111","aspect":0.37209302325581395},{"char":"2","mask":"001111111111100001111100001111101111000000011110001000000000111000000000000011100000000000001110000000000001111000000000001111000000000011111000000000011111000000000001111000000000011111000000000011111000000000011110000000000011111000000000011111000000000011110000000000000111000000000000011100000000000001110000000000000111000000000000111111111111111001111111111111110111111111111110","aspect":0.6744186046511628},{"char":"7","mask":"111111111111111000110000000111110000000000001111000000000000111100000000000111110000000000011111000000000001111100000000000011110000000000011110000000000011110000000000011111000000000111110000000000111110000000000111110000000000011110000000000111110000000000111110000000000011111000000000001111100000000000111110000000000011111000000000001111100000000000111110000000000001110000000000","aspect":0.6511627906976745},{"char":"1","mask":"000000011111000000000111111100000001111111110000111111111110000011111111111000000011111111100000000011111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000011111111111110011111111111111110000000000011110","aspect":0.3488372093023256},{"char":"2","mask":"001111111111100001111000001111000111000000001110000000000000111000000000000011100000000000001110000000000001111000000000001111000000000001111000000000011111000000000001111000000000001111000000000011110000000000011110000000000011111000000000011110000000000001110000000000000111000000000000011100000000000001110000000000000111000000000000011110011111111001111111111111110000000000001100","aspect":0.6744186046511628},{"char":"7","mask":"111111111111111000100000000111100000000000001110000000000000111000000000000011100000000000001110000000000000111000000000000011100000000000011110000000000011110000000000011110000000000011110000000000011110000000000011110000000000011110000000000111110000000000011110000000000011111000000000000111100000000000011110000000000001111000000000000111100000000000011110000000000001110000000000","aspect":0.6511627906976745},{"char":"2","mask":"001111111111110001111110011111100111100000011110001100000001111000000000000111100000000000011110000000000011111000000000011111000000000011111000000000011111000000000011111000000000011111000000000011111000000000011111000000000001111100000000001111000000000001111000000000000111100000000000111110000000000001111000000000000111100000000000011111111111111001111111111111110011111111111110","aspect":0.7209302325581395},{"char":"6","mask":"001111111111111001111100001111100111100000011110011110000000010001111000000000000111100000000000011110000000000001111000000000001111100001110000111111111111110011111111111111001111110000111110111110000001111111111000000111111111100000011111111110000001111111111000000111111111100000011111111110000001111111111000000111110111100000111111011111111111111000111111111111000000111111111000","aspect":0.6744186046511628},{"char":"5","mask":"111111111111111101111100000001100111100000000000011110000000000001111000000000000111100000000000011110000000000001111000000000000111110111110000011111111111110001111111111111100011000001111111000000000001111100000000000111110000000000011111000000000001111100000000000111110000000000011111011100000000111101111000000111110111110000111111011111111111111000011111111111000000111111110000","aspect":0.6744186046511628},{"char":"2","mask":"001111111111110001111100001111100111100000011110001000000001111000000000000111100000000000011110000000000001111000000000011111000000000011111000000000011111000000000011111000000000011111000000000011111000000000011110000000000011111000000000011111000000000001111000000000001111100000000000111110000000000011111000000000001111100000000000111111111111111001111111111111110011011111111110","aspect":0.6976744186046512},{"char":"6","mask":"011111111111110011111000001111101111100000011110111110000000000011111000000000001111100000000000111110000000000011111000000000001111100001110000111111111111110011111111111111001111100000111110111110000001111111111000000111111111100000011111111110000001111111111000000111111111100000011111111110000001111111111000000111111111100000011110011111111111111000111111111111000001110000100000","aspect":0.6511627906976745},{"char":"5","mask":"111111111111111111111000000000001111100000000000111110000000000011111000000000001111100000000000111110000000000011111000000000001111100011110000111111111111110011111111111111100000000000111110000000000001111100000000000111110000000000011111000000000001111100000000000111110000000000011111011100000001111101111000000111111111100000011111011111111111111000011111111110000000000100000000","aspect":0.6511627906976745},{"char":"2","mask":"001111111111110011111100001111101111000000011110000000000001111000000000000111100000000000011110000000000001111000000000001111000000000011111000000000011111000000000011111000000000011111000000000011111000000000011110000000000011111000000000011111000000000011110000000000001111100000000000111110000000000011111000000000001111100000000000111111111111111111111111111111110000000000000110","aspect":0.6511627906976745},{"char":"6","mask":"001111111111110001111000000111100111100000011110011110000000000001111000000000001111100000000000111100000000000011110000000000001111100000000000111111111111100011111111111111001111100000011110111110000001111111111000000111111111100000011111111110000001111111111000000111111111100000011111111100000001111111110000000111101111000000011110011110000011111000111111111111000001111111111000","aspect":0.6666666666666666},{"char":"5","mask":"111111111111111111111000000000001111100000000000111110000000000011111000000000001111100000000000111110000000000011111000000000001111100000000000111111111111100011111111111111000000000000011110000000000001111100000000000111110000000000011111000000000001111100000000000111110000000000011111000000000001111101110000000111110111100000011111011111000111111000111111111111000000111111111000","aspect":0.6666666666666666},{"char":"2","mask":"001111111111110011111000000111101111000000001110000000000000111000000000000011100000000000001110000000000001111000000000001111000000000001111000000000011110000000000011111000000000011111000000000011111000000000011110000000000011111000000000011110000000000011110000000000001111000000000000111100000000000011110000000000001111100000000000111110111111111011111111111111110000000000000100","aspect":0.6511627906976745},{"char":"6","mask":"001111111111110001111000000111100111000000001110011100000000000001110000000000000111000000000000011100000000000001110000000000000111000000000000011111111111100001111111111111000111100000011110011100000000111001110000000011110111000000001110011100000000111001110000000011100111000000001110011100000000111001110000000111101111000000011110011110000011111000111111111111000001111111111000","aspect":0.6666666666666666},{"char":"5","mask":"011111111111111101111000000000000111000000000000011100000000000001110000000000000111000000000000011100000000000001110000000000000111100000000000011111111111100011111111111111100000000000001111000000000000111100000000000011110000000000001111000000000000111100000000000011110000000000001111000000000000111101110000000011110111100000001111011111100011111000111111111111000000111111110000","aspect":0.6428571428571429},{"char":"1","mask":"000000001100000000000001000100000000010001110000000111111111000000111111111110001101111111111000011111111111100000011111111110000001111111111000000111111111100000011111111110000001111111111000000111111111100000011111111110000001111111111000000111111111100000011111111110000001111011111000000111111111100000011111111110000001111111111000000011111111111100000111110000010001111111111000","aspect":0.40425531914893614},{"char":"6","mask":"000011001111000000110111000010000100111110000010100111000110000010011000000000101001100000001000100110000000000010011000000000001001100000000000101111001111000011111111111110001111111111111100100110011111111010011000001111101001100000111110100110000011111010011000001111101001100000111110100110000011111010011000001101101001110000111111011111111000111000010001100010000000111111110000","aspect":0.6808510638297872},{"char":"0","mask":"000000111100000000000101011100000001111111111000001001111100110001001110011001100000110000110011100010000011001111001100000100111100110000010011110011000001001111001100000100110100110000010011010111000001001101011100000100110101110000010011010111000001001101001100000000110100110000010011010011000001001100100110010001100001001111001100000011101001100000000110001000000000000111000000","aspect":0.6595744680851063},{"char":"1","mask":"000000000001000000000010000100000000111011110000000111111111000001111111111100001111111111110000001111111111000000011111111100000001111111110000000111111111000000011111111100000001111111110000000111111111000000011111111100000001111111110000000111111111100000011111111110000001111011111000000111111111100000011111111110000001111111111000000011111111111100000111110000010001111011111000","aspect":0.41304347826086957},{"char":"6","mask":"000001000101000000010111100000000000111111000010000011000010000100001000000100101001100000000000100110000000000010011000000000001101100000000000110111000111000001111111111111000111111111111100010111000011111001001100000111100100110000011111010011000001111100001100000111110100110000011111010011000001111110001100000110110000110000011111001101111100111000010001100011000000111100110000","aspect":0.6595744680851063},{"char":"0","mask":"000000011100000000000101011000000001111111111000001001100100110001001100011001100000100000110011100010000001001101001000000100110100100000010011010010000001001101001100000100110100110000010011010111000001001101011100000100110101110000010011010110000001001101001000000000110100110000010011010011000001001100100110000001100001001101001100000011101001100000000110001000000000000110000000","aspect":0.6595744680851063},{"char":"1","mask":"000000010001000000000100011100000001111111110000001111111111000011011111111100000111111111110000000111111111000000011111111100000001111111110000000111111111000000011111111100000001111111110000000111111111000000011111111100000001111111110000000111111111000000011111111100000001111011110000000111111111000000011111111100000001111111111000000011111111111000000111110000010001000000111000","aspect":0.4222222222222222},{"char":"6","mask":"000000000001000000010111100000000100111111000010100110000010000110011000000000101001100000000000100110000000000010011000000000001001100000000000101110000111000011111111111110001111111111111100100110000011111010011000000111101001100000011110100110000001111010011000000111101001100000011110100110000001111010011000000110111001100000011111001111111100111000010001100011000000011000110000","aspect":0.6382978723404256},{"char":"0","mask":"000000111100000000000100011000000001011111111000001001000100110001001100001001101001100000010010100110000001001010011000000100101001100000010010100110000001001010011000000100101001100000010010100110000001001111011000000100110001100000010011010110000001001100011000000000110001100000000011000110000001001101001100001000100010011001000100000101111100100000001100000100000000000001100000","aspect":0.6521739130434783},{"char":"1","mask":"000000010001000000000100011100000001111111100000001111111111000011011111111100000011111111110000000111111111000000001111111100000000111111110000000011111111000000011111111100000001111111110000000111111111000000011111111100000001111111110000000011111111000000001111111100000000111011110000000011111111000000001111111100000000111111110000000111111111100000000111110000010000011111000100","aspect":0.4318181818181818},{"char":"6","mask":"000011111100100000101111100001000001110000100000100100000001000010010000000011001001000000000000100100000000000010010000000000001001000000000000101110000011000001111111111110000111111111111100100110000001111010011000000111101001100000011110100110000001111010011000000111101001100000011110100110000001111010011000000111101001100000011111010111000011111000010111010011000000101111101000","aspect":0.6666666666666666},{"char":"0","mask":"000000011000000000000101011100000001011111111000001001100100010001001100001100101001100000011001100100000001000110011000000100011001100000000001100110000000000110011000000000011001100000000001000110000000000101011000000000010001100000000001010110000000000100011000000000010001100000000001000110000000000101001100000100110010011000000100000101111100100000001110000100000000001001000000","aspect":0.6304347826086957},{"char":"1","mask":"000000010011000000000110011110000001110011110000001111111111000010000111111110001111111111110000000111111111000000011111111100000001111111110000000111111111000000011111111100000001111111111000000111111111100000011111111110000001111111111000000111111111100000011111111110000001111111111000000111111111100000011111111110000001111111111100000001111111001100000111110000000001111011111000","aspect":0.41304347826086957},{"char":"4","mask":"000000000010000000000000010011000000000011011000000000011111100000000011111110000000011111111000000011111111100000111111111110000110111011111000000111001101100010011000111110001011100011111000101110001111110010111111111111101011111111111111011111111111111000000000111110000000000011011000000000001101100000000000100010000000000010001000000000000000100000000000000010000000000000000000","aspect":0.6956521739130435},{"char":"9","mask":"000111111111100000111111110011000100111111110110100111000011001110011100001100111001100000010011100111000011001110011100001100111001110000010011100111000001001110011100000100110101111111110011001101111111001100011111111100110000000000010011000000000001001100000000000100110000000000010011000100000001001100000100000100010000011111110011001000000000011000011001100011000000011000000000","aspect":0.6458333333333334},{"char":"1","mask":"000000010011000000000110011100000001110011110000001111111111000010000111111100001111111111110000000111111111000000011111111100000001111111110000000111111111000000011111111100000001111111110000000111111111000000011111111100000001111111110000000111111111000000011111111100000001111111110000000111111111000000011111111100000001111111111000000001111111001100000111110000000000000001111000","aspect":0.41304347826086957},{"char":"4","mask":"000000000010000000000000010010000000000011011000000000011111100000000011111110000000011111111000000011111111100000011111111110000010111011111000011111001101100010011000111110001011100011111000101110001111100010111111111111101011111111111111011111111111111000110000111110000000000011011000000000001101100000000000100110000000000010001000000000000000100000000000000010000000000000001000","aspect":0.7111111111111111},{"char":"9","mask":"000000000011000000011111110010000110111111100110000111000011001010011000000100111001100000010010100110000001001110011000000100111001100000010011100110000001001110011000000100110001110000010011001111111111001100011111111100110000111000110011000000000001001100000000000100110000000000010011000000000001001100001000000100010000110000110001000001111100001000010000000001000000111111011000","aspect":0.6595744680851063},{"char":"1","mask":"000000010001000000000110001100000000110011110000000111111111000010000111111100000111111111110000000111111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111000000001111111100000000111111111100000001111111000100000111111000000000000000010000","aspect":0.391304347826087},{"char":"4","mask":"000000000010000000000000010010000000000001011000000000001111100000000001111110000000011111111000000011111111100000011111111110000010111011111000011111001101100010011000111110001011100011111000101110001111100010111111111111101011111111111111011111111111111000000000111110000000000011011000000000000101100000000000100110000000000010001000000000000000100000000000000010000000000000000000","aspect":0.7111111111111111},{"char":"9","mask":"000000000010000000011111110010000111111111100110100110000011001010011000000100101001100000010010100110000001001010011000000100101001100000010010100110000001001010011000000100111001100000010011011111111111001100011111111100110000110000010011000000000001001100000000000100110000000000010011000000000001001100000000000100010000100000010001010001111100001000110000000001000000111111010000","aspect":0.6382978723404256},{"char":"1","mask":"000000010001000000000110001100000000110011110000000111111111000000000111111100000111111111110000000011111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000111111111111000000011111000000000111001110100","aspect":0.4},{"char":"4","mask":"000000000000000000000000010010000000000001011000000000001111100000000001111110000000001111111000000011111111100000011110111110000010111001111000011111000101100010011000011110001011000001111000101110001111100010111001111111001011111111111111011111111111111000000000111110000000000001011000000000000101100000000000100110000000000000001000000000000000100000000000000010000000000000000000","aspect":0.6888888888888889},{"char":"9","mask":"000011111111100000111111110001000001111001110010100110000001000110010000000100011001000000010001100110000001001110011000000100111001100000010011100110000001101110011000000010110001110011111011011111111111001100011111111100110000000000000011000000000000001100000000000000010000000000000001000000000000100100000000000000010000110000010001010001111100001000010000000001000000111111000000","aspect":0.6304347826086957},{"char":"2","mask":"000011111111100000111111111111000000111111111110000011000011111000001000001111110000000000111111000000000011111100000000001111100000000001001100000000001001100000000000001100000000000001100000000011001100000000010001100000000010001100000000010001100000000010001100000000001000100000000000100111000000000010011100000000001001110000000000100111111110001001001111110000110001111111111110","aspect":0.6595744680851063},{"char":"2","mask":"000000000011000001100011110110000100111111111100000011000111111000001000001111100000000000111110000000000011111000000000001111100000000001001100000000001001100000000001001100000000000001100000000000001100000000010001100000000010001100000000010011100000000000011000000000001001100000000000100110000000000010011000000000001001110000001100110111111110000001001111111000000011101110011110","aspect":0.6595744680851063},{"char":"5","mask":"000000000000111001111110000000001101111110000000110111000111111011011000000000001101100000000000110110000000000011011000000000001101100000000000110111000000000011011111111111000111111111100110000000111111001100000000000100010000000000010001000000000000000100000000000000010000000000010001000000000001000100000000000100010000011000110001000000001000001000000000000001000000001111110000","aspect":0.6382978723404256},{"char":"2","mask":"000011111111100000111111111111000000111111111110000011000011111000000000000111100000000000111111000000000001111100000000001111100000000001001100000000001001100000000000001100000000000001100000000001001100000000000001100000000010001100000000010001100000000000001000000000000000100000000000100110000000000010011000000000001001110000000000100111111110001001001111110000110001001111111110","aspect":0.6595744680851063},{"char":"2","mask":"000011111111100001100111111111000000110111111110000010000011111000010000001111100000000000011110000000000011111000000000011111000000000011001000000000010011100000000010001000000000010001000000000000001100000000000001100000000010001100000000010011000000000000011000000000001001100000000000100110000000000000011000000000000001110000000100110111111110000001001111111000000011100000001100","aspect":0.6739130434782609},{"char":"5","mask":"000000000000011001111110000000000101111110000000010110000000000001011000000000000101100000000000010110000000000001011000000000000101100000000000110110000000000001011111111111000111111111100110000000111111001100000000000100010000000000010001000000000000000100000000000000010000000000000001000000000000000100000000000100010000010000110001000000001000001000000000000001000000000000110000","aspect":0.6382978723404256},{"char":"2","mask":"000111100111000000101111111111000001111111111110000010000011111000010000000111100000000000011110000000000001111000000000001111100000000001001100000000011001100000000010001100000000010001100000000010011100000000010001100000000010011000000000010011000000000000011000000000001001100000000000100110000000000010011000000000001001100000000000000111111110001000001101110000110000000011011100","aspect":0.6382978723404256},{"char":"2","mask":"000011111111100001001111111111001000110111111110000000000011111100000000000111110000000000011110000000000001111000000000001111100000000001001100000000000011100000000000001100000000010001000000000010001100000000010001100000000010001000000000000011000000000010011000000000001001000000000000100110000000000010111000000000001001100000000000100111111111000000011111111000000011000000000000","aspect":0.6304347826086957},{"char":"5","mask":"000000000000010010111110000000001001111110000000111110000000000011111000000000001011100000000000101110000000000010111000000000001011100000000000101110000000000010111111111110000101111111000110001111111110001000000000000000010000000000000001000000000000000100000000000000010000000000000001000000000000000100000000000000010000110000010001000000111100000000000000000001100000001110000000","aspect":0.6304347826086957},{"char":"2","mask":"000011000111100000101111111111000001111111111110000010000001111000010000000111110000000000011111000000000000111100000000000111110000000001000100000000001000100000000000001100000000000001100000000000001100000000000001100000000000001100000000000001100000000000011100000000000001000000000000100100000000000010011000000000001001100000000000100110011111111000011111111000000101111111110000","aspect":0.6304347826086957},{"char":"2","mask":"000011000111100001001111111111001000110001111110000000000001111000000000000111100000000000011110000000000001111000000000001111100000000001001100000000001000100000000001001100000000000001100000000000001100000000010001100000000010001000000000000011000000000000011000000000001001000000000000100100000000000010110000000000001001000000000000100111011111100000011111111100000111111111111001","aspect":0.6444444444444445},{"char":"5","mask":"011111111111100011111111000000001101111111111110111110000000000010011000000000001001100000000000101110000000000010111000000000001011100000000000101110000000000010111111111110000101111111000100000000000011001000000000000000010000000000000001000000000000000100000000000000010000000000000001000000000000000100000000000000010000100000000001000000111100000000000000000001000000001110000000","aspect":0.6444444444444445}];
const GRID_FONT=[{"char":"1","mask":"000000011110000000000011111000000001111111100000000111111110000011111111111000000110111111100000000001111110000000000111111000000000011111100000000001111110000000000111111000000000011111100000000001111110000000000111111000000000011111100000000001111110000000000111111000000000011111100000000001111110000000000111111000000000011111100000000011111110000011111111111111111111111111111110","aspect":0.4146341463414634},{"char":"2","mask":"001111111111110001111111111111101111000000001111011100000000111100000000000011110000000000001111000000000001111100000000000111100000000001111100000000001111100000000001111100000000001111100000000011111000000000011111000000000011111000000000011111000000000001111000000000000111100000000000011110000000000001111000000000000111100000000000011110000000000001111111111111100111111111111110","aspect":0.6585365853658537},{"char":"3","mask":"000111111111100001111111111111100111100000001111011100000000111100000000000011110000000000001111000000000000111100000000000011110000000000001111000000000011111000000001111111000000000111111110000000000001111000000000000011110000000000001111000000000000111100000000000011110000000000001111000000000000111100000000000011111111100000001111011110000000111000111111111111100001111111111000","aspect":0.6341463414634146},{"char":"4","mask":"000000000000110000000000001111000000000001101100000000001100110000000001100001000000001110000100000001111100110000001111010011000011111001101100011111000111110001111000011111001111100001111100111110000111110011111111111111111111111111111111011111111111111100000000011111000000000001111100000000000111110000000000011111000000000001111100000000000111110000000000011111000000000001111100","aspect":0.6585365853658537},{"char":"5","mask":"111111111111111011111111111111101111000000000000111100000000000011110000000000001111000000000000111100000000000011110000000000001111000000000000111100000000000011111111111111001111111111111110000000000001111000000000000011110000000000001111000000000000111100000000000011110000000000001111000000000000111111110000000011111111000000001111011110000001111000111111111111000001111111110000","aspect":0.6428571428571429},{"char":"6","mask":"001111111111110001111111111111100111100000001111011110000000111111111000000000000111100000000000111110000000000011111000000000001111100000000000111111111111100011111111111111001111111111111110111110000000111111111000000011111111100000001111111110000000111111111000000011111111100000001111111110000000111111111000000011110111100000001111011110000001111000111111111111000000111111111000","aspect":0.6585365853658537},{"char":"7","mask":"111111111111111111111111111111110000000000001111000000000000111100000000000011110000000000001111000000000000111100000000000011110000000000001111000000000001111000000000011111000000000011111000000000001111000000000001111000000000011110000000000011110000000000111111000000000011111000000000001111100000000000111110000000000011111000000000001111100000000000111110000000000011111000000000","aspect":0.6428571428571429},{"char":"8","mask":"000111111111100000111111111111101111100000001110111100000000111011110000000011101111000000001110111100000000111011110000000011101111000000001110011111111111111000111111111111000011111111111100011110000001111011110000000011111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111100000001110011110000001111000111111111111000001111111111000","aspect":0.6341463414634146},{"char":"9","mask":"001111111111110001111111111111101111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011111111000000001111111100000000111111110000000011110111111111111111001111111111111100001111111111110000000000001111000000000000111100000000000011110000000000001111000000000000111100110000000011111111100000011111011110000001111001111111111111000001111111111000","aspect":0.6585365853658537},{"char":"-","mask":"111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111","aspect":6.25},{"char":"/","mask":"000000000000011100000000000001110000000000001111000000000011110000000000001111000000000000111100000000000011110000000000001110000000000111110000000000011110000000000001111100000000000111000000000001111000000000001111100000000000111100000000000011110000000000011100000000000001110000000000001111000000000000111100000000000011110000000000111100000000000011100000000000001110000000000000","aspect":0.6578947368421053},{"char":"X","mask":"111100000000111111110000000011111111000000001111011100000000111000111100001111000011110000111100001111000011110000111100001111000011110000111100000111000011110000001111111100000000011111110000000001111111000000001111111100000011110000111100001111000011110000111100001111000011110000111100001111000011110000111100001111001111000000001110111100000000111111110000000011111111000000001111","aspect":0.625},{"char":"0","mask":"000000011111000000000011111110000000111110111100000011110001111000011111000111100001111000001111000111100000111100011110000011110001110000001111000111000000111100011100000011110001110000001111000111000000111100011100000011110001110000001111000111000000111100011100000011110001110000001111000111100000111100011110000011110001111000001111000011110001111000001111001111100000011111111100","aspect":0.8461538461538461}];

function straightenDigitalGrid(data,w,h){
 const bright=(x,y)=>{if(x<0||x>=w||y<0||y>=h)return false;const i=(Math.round(y)*w+Math.round(x))*4;return (data[i+1]>170&&data[i+2]>150)||(data[i]>170&&data[i+2]>170)};
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

// Includes normalized highlighted 8 glyphs from blue-purple digits on pink panels.
const SPLIT_FONT=[{"char":"6","features":"fd9632224555568afe8521124677789bfd8410037abccdddfd8410048bdeeffefd8410149cfffffffd8400149dfffffffd8300048ceffffffd7300026accdffffd73000258aacdeefd83000135789bcdfd830000246679bcfd830000245668abfd8300003555568afd8300003566567afd83000146666679fd83000147776679fd83000147886679fd83000147886579fd83000146776569fd83000135665569fd84000024554469fd94000024444469fe9631001222347affa743112223358a004abbaa99889aae005cccbbabaaccbe106cedbdffffffef105bddbcfffefede005bccbcfffffede004accbdfffffdee004abbacfffffdef004abcbcffffffff004abcbceedeffff004accacddcdeefe0049bcaccdcddeef0049bcbbcccccddf004accbbddccdddf004abccceeeeedef004accccfffeeeef004acdcdfffeeeef0049ddbcfeefedef005adcccefeeeddf005bccccefeeecdf005bccbcefefeddf005adcbcdfefeddf005adcbbeeeedcdf005cccabcccccbcf106cdccbcccccbdf"},{"char":"7","features":"cba6432000000001cbb8664310000002dcccbbaa73000002dddddddc95100002dddeeeeda5100002cdeffffeb6210003cdeffffeb6210013cdeffffea5210124cdeffffc84110135ddefffeb73110245ddefffda63111356ddefedb852222467dddedc7522336898ddddba5322458aaaddcb98522357abbadcca86311479cdcbccb96520259adedccca7420027bdfffdcba6320027cefffdcba6320038defffdcba5210038dffffddb95210048dffffdcba6431259deffeccbb744336adeffdb001dcba87899aaae002feddcbaaaabaf002feedefecbbbcf001eeeddffbbbabf001eddccfebababf001ddcccefbabbbf002edccdefcbbbbf002eddddfecbbbbf001eeddefdbbbbcf001eddefecbbbcdf001edeffcabbcdff001eeefebabbceff001fefebbbccefff001fffdbabdeefff001fffdabceefeef101fffcaadffddde101ffebaaeffccce101fcbbaafedcbcd100ecbbaafecccce000ecbbaafecbccd000ecbaabfdcbccd000fcbaacfeccccd100ecbaacfdcdcde100feeccdfeddcdd"},{"char":"7","features":"cba8542000000000cbb9764320000000ccddccba85200000cddeeedca7310000cdeffffdc8430000cdefffffd9540000cdefffffea640000ceffffffd9530001ceffffffc8420002cefffffeb7420013cefffffc96321134ceffffeb85332246cdefeda754334588cdeedc9533334699cdedcb74333468aadddca95323568abbdddb97421367accbddc965201489ceebdcc85310159adfecdcb74200259beffcccb7420026acfffcccb7431136bcfffcccb8543357bcffebccb8654458bcefeb0003aaa8999988890007ededddccbbbc0007ffeffffecbce1006ffdefffecbbd1007feddeffecbbd1007eeddeffebbbc1007eeddeffeabbb1007feedefecaabc1007ffeefedcaabd1006efeefedcaace1006eeefedcbaacf1005eeeeedcbabdf1005efeecbcccdef1006ffedcbccefef1006ffecbbcdffee1006fedcbbeeffee1007fecbbcefffee1007fecbbdffedef1007fecbbdffedef1007edccceffddef1006edccceffddef1007feccceffdeee1006feeddfffddee1007fffeefffedef"},{"char":"7","features":"cbba763100000000cccb875310000000ddddcba864210000cddddddb96320001cddeffedb8420001dddeffffd9530001cddeffffea630001cdefffffeb640001cdeeffffda631002cdeeffffd9531012cddefffeb8431123cddeffec97431235cddeedb864333568dddddca743334689ddddcb953234689addddba7422457abbdddca95212469cdcddcc97310257befeddcb86200258cffedccb86200268cfffdccb86200269dffedccb86200279dffedccb8631248aeffedccb8743358adffe00006765577787880001ceca9aaababb0001efeedefebcbd1000dfdddefecbbc1000dedcdefecbbc1000dedddefecbbc1001deddcdedbbac1001deeedfedbbbb1000efeeefecabab1000deefffdcabbc1001dfefffcbabbd1001effffebaabce1002ffffdcbbcdef0001fffdbbbcdfff0000fffcabbcdfee1001ffdcbbcdefed1001ffdcbbdeffed0001ffcbcceffddd1001ffccccffedcd1000efbcccffedcc1000efcbbbffddcc1100efccbbffdccc1100ffcbacffdccd1100efdbbdfedccd"},{"char":"7","features":"ba86332100000004bb97543200000014cccba98631000014cdddcba852000025cdefeec963000025ceffffeb74100135cefffffc84210135cefffffc95211246cefffffb74221357ceffffea63223467ceffffd953334578ceffed9642345789cdca985323569aaacdb966422367abbaccb853223579bccacca63212369bdddbcb95210247aceedbbb73000159ceffdbba7200015adeffdbba7200015aefffdbba6200016aefffebba7300025aefffdbba8532146aefffebba8643358adeffeb0048889aa998878d008bccecccccbabe00aeeefffccccbbf009ddcdffddccbcf009dcccefedccbcf009ccccdffdccbcf009cccccffcccbcf009dddbdffcccccf00addddefddccbdf009ddddffdcdccef00adddefdccccdff00addeffcccbceff00bfffdcbcbcdeef00bfffcbbcbceeee00bffebbbddddcee00cfedbcceeedcde00dfccbcdffecbdf00debbcbffedccdf00deabdcffdccdef01deabcbfedcddef01debcccffecddef01eebbbdffecdeee03ffdcdefffeedee03ffeeeeffeeddef"},{"char":"8","features":"ffb743233323349dffa532123221238dffa521123311127cffa521134311127cffa511135421127cffa510135421127cffa400135421127cff9300012110016cff9300011100016cff9300000000026cff9300000000026cff9300000000026cff9310011100027cff9310122200027cff9410234310027cff9410245421027dfe9411356521027dfe9411356521027dff9411256520028eff9410245420028eff9410134310038eff940012210014aeffa52123321146cfffb74334543358df008cbababbcbaaef008cccbbbbccbaef008ccbbcdeccbbef009ccbbeffdcbbff009ccbbfffedbbff009ccccfffedcbff009dcccfffedcbff00addccefecdcbff00adcbccddcccaff009dcbcccccccaff009cccccdccdcaff009ccccdcccccaff00accccccccdcaff00accccdddddcaff009cccceeeedcbef009cccceeeedcbff019ccccffeedcbff009ccbcdeeeddaef009bbbbdeddccbff009bbbbdeedccaff00ababbeedcccaef009cbbbefeccbaef00abbcccccccbdff00bdccbccddcbeff"},{"char":"7","features":"cca8520000000000dcb9742100000000eedca97653000001eeedcba985200001eeeeedcba7400001eeefffedc8510002eeefffffd9510002eeefffffea510013eeefffffd9500024eeeffffec8400135eeeffffca6300245eeefffeb95212356eeeeeca762235788eeeddb8542247899deddc96432368abadddca8532247accadddc96321259cddbddca7310137ceffcddca6310138cfffcedc96200038dfffcedc96200149dfffcedc9520015aefffcedc9642236adfffcedca754447adeffc0003cccbbaaab9ac0007eefefddddcce1007ffffffedeccd1007efeeffeddcbd1107eeddefedccbc1007edddeeecbbbc1007edccdeecbbab1008edccdeebccbd1008eccddfdbbbbd1008dccdeecbbbbd1007eddeeecbbbce1007fddeedbcccdf1008fffedbbcdeef1008fffdcbbceeff1008ffdccbbdeeff1009ffcbbccefeef1009febbbcceeddf1008fcbbbcefeddf1008fbbcccffeddf1008ebabbcffeddf1009fcbbbcffeddf1008fbbbcceffede1008fbbddefffedf1008fdceefffffff"},{"char":"7","features":"cca8654321000000dcb9875432000000ddccbaa975210000dddddccca8420000ddeeeefeca530000ddefffffeb641000edeffffffc741000edefffffeb640001eeefffffda530001eeefffffc9420002edeffffeb8320013edefffec96310124edeeddb853212367edddcc9642223578edddba853123589aeddca963213469bbeddc985211468bdcedcb86311268bffeedca75201369dffeedca75201379dfffedca6510148adfffedca6520248adfffedca7632359bdffeedcb874456abdffe2002ab98988999880000ffdcccbccbbb1000fffeffedcbbb1101fffefffecbbb1001ffedeefeabbb1001ffdddeeeabba1001ffddddddaabb1001ffddcdddbcbc1001ffdddeedbbbc1001ffdddeddbcbb1000eeddeeccbccb1000efdeedcccccc1000efffdcbbceef1000efffdbbbceef1000efddccccdfee1000efdcbcddeffe1000efcbabdeffed0000debaacefffee0000eebaadfffeee1000eebaadfffeee0000efbbadfffeed0000dfbbadfffede1010dfcbcefffeee1000efdccfffffff"},{"char":"8","features":"ffe920000122358affd7100123444579ffd5001457765567ffc5001568866567ffc4001578876557ffc5001467765557ffd5001356655567ffc5000245544568ffc5000123333468ffc5000001122468ffc5000001223468ffc5000123333568ffc5001456665567ffc5002568766567ffc5002678876567ffc5002678875557ffc5002679875557ffc5002578875557ffc5002467765557ffd8201233433468ffe9300012123579ffeb41000001369bfffeb86665568bdeffffdbbabaabcdef1007ffdddefefeff1007eeddeffffdef1006ffcddefeecbf2107efcdeeeeecbf2008dfcdeeedfcbf2007efcddedeecce2007efcddfffedde2008efcddfffeded2009efccdfeedcde2008efccdddddcce2007efccccdddcce2007efcddeddedce2009efddefeeecce2009eedeeffddcce2009efceeeeddcce2008efceeeedecce2009efdeeeedecce2009efdeeedeecce2009efddeffeedce2008ffdefffeedce2008ffddeffdcdcf2008ffdeeeecdeff1102eccbbbcbbdbc1100355555544403"},{"char":"8","features":"fd842111111138dffc742122221016cffb652245542114affa552356652103affa552356651003affa552356751003affa551246641103affb540134430104bffb630001110005bffb620000000005cfeb620000000005bfea630000010005bfea551133330004afd9551256641004afd95514676521039fe9552467651003afe9552467751003afe9552367751003afe9451255541104aff9551134431105bffb650022221218cffc75001112134aefffe843334467cffffffc9888889bffff1238ddaaadfe307d137ee85546ff825d03afd31101dfb13d04bfc30001bfb04c04bfb32111afc04c04bfb21211afc04c05afc11101cf903d04afc32002cf903d04bfb75224df705d1279caa78bfb406e3346dbaaacfd105f237ec76767ff805e02bfa33224efb15e03bfb41003ef905d03bfc41002df824c03bfb31002cf924c03bfb31002cf914c05afb31102bf805c069fb22001cf805d059fc32002cf705d04afb51004df605c028fb73248ef605c2527bccbcdf9106c35159bbbabd5008d"}];
SPLIT_FONT.push(...[{"char":"8","features":"fffd7311112345bfffeb8300011123bfffb96323431113afffa863467521029fff86638ba841007eff75439cca52007fff65439dda52008ffe6443adda52008ffe64438aa831008ffd6542689620009ffd7541344300009ffe7540010000008ffe7540000000008ffe7541011100008ffe7442456510008ffe7543688720018ffe74449cca40018ffe6544beec51018ffd6545beec61018ffd6544beec62018ffd6444bedb61008ffe5544addb51008ffe7543799841019fff864234331003af00000000000000120005fc77778863bf100ffe58aa8986ef110dfd5aba7764bf110ef97adb85009f100ef88ced85009f100ce66ced85009f100cf57ceb8300af100cf67cda7200af100cf66bc96100af100df736873200af100df701541200af100cf7004411009f110cf7014310009f100cf7179851009f100cf76bb973009f100cf78ced9400af100de89cce9400af100de89cce9300af100ee78bcf8300af100de7adef8200af000ee7acff9300af100df89ceda600bf100ffa69ab8700bf"},{"char":"8","features":"ffc83200012368dfffb62101124567cfff941025666567afff831037887766afff63105abb98769fff63106bdca876aeff62106bdca867aeff622059bb8767aeff622036775556aeff632014454446aeff631000011246aeff631000001246aeff621000002246aeff6210024544469fff6200379987679eff620049bb98679eff62005addb9778dff62106bedc9778dff62006cedc9777dff62006cedb9778dff62006acc98668dfe720048ba86668dff8210035455569effa52000001246bf0109b8324654436f001ffe96588866af011efa776887506f001ef9777886205f100cf9688a66106f000cf9379976206f000cfa279a86306f011dfa279a85407f002dfb057886307f002dfb046886308f003dfc004665209f002dfc000255009f001dfb000144009f000efb002554007f001ef9068864005f001de9379974005f001ee8388975005f001ee8078875001f001ee7168875001f002ee8179984001f003de949bb96003f016df948bb96005f016dfa579988106f007ffa54987640af"},{"char":"5","features":"75211100111235898511000012346899851200025789ab998512001489aabca984220047bdeefeba8422016adfffffcb8322016adfffffcb8323016adfffffcb83220058ceffffcb84220046bcefffcb8421001368acdeba8632000123579aa987431001123468999a864344310124999ccba9a963000289addccccb84000189affefffea6100179bffeffffb7100079bffeffffb7100179bffffffeb6100179aefeeffea6100179adeddeeda61001799bbaaaa9740001899b87544431000289000000000000001e012eb744554400ef008fd679bdddbaff008fc478ceeeb9ff008e807adca954ff109d506bc95300df109d407bb72000df11ae407bb64400df00ae607cba5101df00ae506acd7400df009e90469ab956df007da013466899ef008d9001133669ff006ea211430002ff00afea99850000ef007ec99ab70000ef007b9556b82000ef006b9404981001ff006b9504981101ff006ba646981001ff007ba647b82000ff008db878b93000ff00afdbbbb84001ff009fb89aa85001ff"},{"char":"8","features":"fffc5100001234aeffda7310111122bffea97423542223bfff9774478622129ffe67747bb952008ffe56549cdb63008ffd55538cec63008ffd45539ceb62009ffc45538ab942009ffc555369a731009ffc5652345400009ffc6651001100009ffc6651000000009ffd6651001100009ffd6553256520009ffc6653698730009ffc55548bcb51009ffc5654accc61009ffc5655addd62009ffc5654addd62008ffc4554addc61009ffc4654acdc61019ffd66547aa95201affd775334441102bf00000000000000120005fc77778863bf100ffe58aa8986ef110dfd5aba7764bf110ef97adb85009f100ef88ced85009f100ce66ced85009f100cf57ceb8300af100cf67cda7200af100cf66bc96100af100df736873200af100df701541200af100cf7004411009f110cf7014310009f100cf7179851009f100cf76bb973009f100cf78ced9400af100de89cce9400af100de89cce9300af100ee78bcf8300af100de7adef8200af000ee7acff9300af100df89ceda600bf100ffa69ab8700bf"},{"char":"8","features":"efc72000000147cfffa72101034568dfff831025677576affe731037888866afff51205acc9965afff41205addb975afff41205bddb976afff42204abc9777afff422016786656bfff422004565546bfff522000012245bfff422000001235bfff422000001345bffe421000355445affe420017aa87779ffe410049cb98778ffe42105bdcba779fff42105bddca777fff42105bddca777fff41105bddc9777ffe51005aedb9668ffe620048cb98669fff7110036566459fff952000001235cf0109b8324654436f001ffe96588866af011efa776887506f001ef9777886205f100cf9688a66106f000cf9379976206f000cfa279a86306f011dfa279a85407f002dfb057886307f002dfb046886308f003dfc004665209f002dfc000255009f001dfb000144009f000efb002554007f001ef9068864005f001de9379974005f001ee8388975005f001ee8078875001f001ee7168875001f002ee8179984001f003de949bb96003f016df948bb96005f016dfa579988106f007ffa54987640af"},{"char":"5","features":"751100000001248a84020000013468aa9413001368aaaaaa941300248aaaabaa94130058acddeeaa9323006aceffffba8323107adfffffba8324007acfffffba83230059bdffffba83230047abdfffba8422002379abddaa862310013457aaaa9744200112357aaa9a876343320125aaadcaaaaa840002aaaeebbbbaa60001aabffeeffea720009acffeffffa820009abffeffffa821009abffefffea820009abffdeffda820009aaeecddeca820019aaccaaaaa951001aaab997556420002aa000000000000001e012eb744554400ef008fd679bdddbaff008fc478ceeeb9ff008e807adca954ff109d506bc95300df109d407bb72000df11ae407bb64400df00ae607cba5101df00ae506acd7400df009e90469ab956df007da013466899ef008d9001133669ff006ea211430002ff00afea99850000ef007ec99ab70000ef007b9556b82000ef006b9404981001ff006b9504981101ff006ba646981001ff007ba647b82000ff008db878b93000ff00afdbbbb84001ff009fb89aa85001ff"},{"char":"8","features":"fffb30000000128dffd89411112233dfee9a9524652324dffe898558a83223bffd58859ddb62009ffd3874aefe7300affd3764affe7300affc2664aefd7301bffc26649cda5200bffc37638bc94100bffb476335651100bffc476201210000bffc476100100000bffc476200210001bffc466437762000bffc47747aa94100bffc3675adfd6101bffc3765cfff7201affb3766cfff7201affb3765cfff8201affb2665cfff7201bffc2765bffe7201bffc47648bcb6301bffd696345552102df00000000000000120005fc77778863bf100ffe58aa8986ef110dfd5aba7764bf110ef97adb85009f100ef88ced85009f100ce66ced85009f100cf57ceb8300af100cf67cda7200af100cf66bc96100af100df736873200af100df701541200af100cf7004411009f110cf7014310009f100cf7179851009f100cf76bb973009f100cf78ced9400af100de89cce9400af100de89cce9300af100ee78bcf8300af100de7adef8200af000ee7acff9300af100df89ceda600bf100ffa69ab8700bf"},{"char":"8","features":"eea42000000146efef883201034679ffee641026788687cfed432048aaa987bffe21206ceeba86cffe21206cffdb96cfee21206dffda97cfee22205bdea988cffe223027998767dffe223004676657dfee222000012356dfee222000001246dffe222000002356dfee222000466556cfee130028cb9888bfed11005bedb998afed12106dffdc88bfee12105dffec889fee12106dffeb988ffe12105dffeb989ffd22106cffda779ffd32005afdb977affe421004867756bfee852000101246ef0109b8324654436f001ffe96588866af011efa776887506f001ef9777886205f100cf9688a66106f000cf9379976206f000cfa279a86306f011dfa279a85407f002dfb057886307f002dfb046886308f003dfc004665209f002dfc000255009f001dfb000144009f000efb002554007f001ef9068864005f001de9379974005f001ee8388975005f001ee8078875001f001ee7168875001f002ee8179984001f003de949bb96003f016df948bb96005f016dfa579988106f007ffa54987640af"},{"char":"5","features":"740000000000149b94020000122358bb941400148bbbbbbb94141035bbbbbbbb9323107bbbcdeebb9234108bbeffffbb9234119bcfffffbb8135119bbfffffbb9234107bbdffffbb92340059bbdeffbb932310259bbbccbb96342002457abbbb9755200123479bbbab8a8454530126bbaebbbbbba50002bbbfebbbbbb81001bbcffdeeedba2001bbdffefffebb3001bbdffefffebb2101bbcffeeffeba3101bbcffddffdba3001bbbfebcddcba3001bbbdbbbbbbb72001bbac9b9777530002bb000000000000001e012eb744554400ef008fd679bdddbaff008fc478ceeeb9ff008e807adca954ff109d506bc95300df109d407bb72000df11ae407bb64400df00ae607cba5101df00ae506acd7400df009e90469ab956df007da013466899ef008d9001133669ff006ea211430002ff00afea99850000ef007ec99ab70000ef007b9556b82000ef006b9404981001ff006b9504981101ff006ba646981001ff007ba647b82000ff008db878b93000ff00afdbbbb84001ff009fb89aa85001ff"}]);
function highlightedRollFeatures(data,w,h,left,top,right,bottom){
 left=Math.round(left);top=Math.round(top);right=Math.round(right);bottom=Math.round(bottom);
 const values=[];let blue=0;
 for(let yy=0;yy<24;yy++)for(let xx=0;xx<16;xx++){
  const x=Math.min(right-1,left+Math.floor((xx+.5)*(right-left)/16)),y=Math.min(bottom-1,top+Math.floor((yy+.5)*(bottom-top)/24));
  if(x<0||x>=w||y<0||y>=h)return null;
  const i=(y*w+x)*4,r=data[i],g=data[i+1],b=data[i+2];
  if(b>140&&r<b*.9)blue++;
  values.push([r-b,g]);
 }
 if(blue/values.length<.30)return null;
 let features='';
 for(let axis=0;axis<2;axis++){
  const sorted=values.map(v=>v[axis]).sort((a,b)=>a-b),lo=sorted[Math.floor(sorted.length/10)],hi=sorted[Math.floor(sorted.length*9/10)];
  features+=values.map(v=>Math.max(0,Math.min(15,Math.round((v[axis]-lo)/Math.max(1,hi-lo)*15))).toString(16)).join('');
 }
 return features;
}
function readSplitFirstRoll(data,w,h,edge,top){
 const scale=w/973,end=edge-31*scale,features=highlightedRollFeatures(data,w,h,end-29*scale,top+5*scale,end,top+34*scale);
 if(!features)return null;
 const scores=SPLIT_FONT.map(t=>{let sum=0;for(let i=0;i<features.length;i++)sum+=Math.abs(parseInt(features[i],16)-parseInt(t.features[i],16));return {char:t.char,error:sum/features.length/15};}).sort((a,b)=>a.error-b.error);
 const best=scores[0],other=scores.find(s=>s.char!==best.char);
 return best.error<.12&&(!other||other.error-best.error>.025)?best.char:null;
}
function readSplitSecondRoll(data,w,edge,top){
 const scale=w/973,left=Math.round(edge-30*scale),right=Math.round(edge-3*scale),up=Math.round(top+4*scale),down=Math.round(top+38*scale);
 const lit=(x,y)=>{const i=(y*w+x)*4;return data[i+1]>85&&data[i+2]>150&&data[i]<data[i+2]*.75};
 let a=right,b=left,c=down,d=up;
 for(let y=up;y<down;y++)for(let x=left;x<right;x++)if(lit(x,y)){a=Math.min(a,x);b=Math.max(b,x+1);c=Math.min(c,y);d=Math.max(d,y+1);}
 if(b-a<3||d-c<2)return null;
 const aspect=(b-a)/(d-c);if(aspect>2.5)return '-';
 let mask='';
 for(let yy=0;yy<24;yy++)for(let xx=0;xx<16;xx++)mask+=lit(Math.min(b-1,a+Math.floor((xx+.5)*(b-a)/16)),Math.min(d-1,c+Math.floor((yy+.5)*(d-c)/24)))?'1':'0';
 let best=null;
 for(const t of GRID_FONT.filter(t=>/^[0-9/-]$/.test(t.char))){
  let diff=0;for(let i=0;i<mask.length;i++)if(mask[i]!==t.mask[i])diff++;
  const error=diff/mask.length+Math.min(.4,Math.abs(Math.log(aspect/t.aspect))*.15);
  if(!best||error<best.error)best={char:t.char,error};
 }
 return best.error<.28?best.char:null;
}

function distinguishFiveAndSix(mask,matches){
 const best=matches[0];if(best.char!=='5'&&best.char!=='6')return matches;
 const other=matches.find(m=>m.char===(best.char==='5'?'6':'5'));
 if(!other||Math.abs(other.error-best.error)>.065)return matches;
 // A six has a continuous lower-left stroke closing its bottom loop; a five does not.
 let leftRows=0;
 for(let y=13;y<=18;y++){let ink=0;for(let x=0;x<5;x++)if(mask[y*16+x]==='1')ink++;if(ink>=2)leftRows++;}
 const wanted=leftRows>=5?'6':leftRows<=1?'5':null;
 if(!wanted||wanted===best.char)return matches;
 const chosen=matches.find(m=>m.char===wanted);
 return [chosen,...matches.filter(m=>m!==chosen)];
}

function readFrameAtThreshold(lit,x0,x1,y0,y1,scale,frame){
 const runs=[];
 for(let x=x0;x<x1;x++){let n=0;for(let y=y0;y<y1;y++)if(lit(x,y))n++;if(n){if(!runs.length||x>runs.at(-1).at(-1)+1)runs.push([x]);else runs.at(-1).push(x);}}
 let marks='',error=0,count=0,margin=1;
 for(const run of runs){
  if(run.length<=8*scale)continue;
  const a=run[0],b=run.at(-1)+1;let c=y1,d=y0;
  for(let y=y0;y<y1;y++)for(let x=a;x<b;x++)if(lit(x,y)){c=Math.min(c,y);d=Math.max(d,y+1);}
  if(d<=c)continue;
  const aspect=(b-a)/(d-c);
  if(aspect>2.5){marks+='-';count++;continue;}
  let mask='';
  for(let yy=0;yy<24;yy++)for(let xx=0;xx<16;xx++)mask+=lit(Math.min(b-1,a+Math.floor((xx+.5)*(b-a)/16)),Math.min(d-1,c+Math.floor((yy+.5)*(d-c)/24)))?'1':'0';
  let matches=(frame===-1?[...TOTAL_FONT,...GRID_FONT.filter(t=>/^[0-9]$/.test(t.char))]:GRID_FONT).map(t=>{let differences=0;for(let i=0;i<mask.length;i++)if(mask[i]!==t.mask[i])differences++;return {char:t.char,error:differences/mask.length+Math.min(.4,Math.abs(Math.log(aspect/t.aspect))*.15)}}).sort((a,b)=>a.error-b.error);
  matches=distinguishFiveAndSix(mask,matches);
  if(matches[0].error>.28)return null;
  marks+=matches[0].char;error+=matches[0].error;count++;margin=Math.min(margin,(matches.find(m=>m.char!==matches[0].char)?.error??1)-matches[0].error);
 }
 if(frame===-1?!/^\d{1,3}$/.test(marks)||Number(marks)>300:parseFrame(marks,frame)===null)return null;
 return {mark:marks,error:error/Math.max(1,count),margin};
}

function readDisplayedGridTotal(data,w,h,left,right,top,bottom){
 const scale=w/1338,x0=Math.round(left)+Math.max(4,Math.round(6*scale)),x1=Math.round(right)-Math.max(4,Math.round(6*scale)),y0=Math.round(top)+Math.max(3,Math.round(5*scale)),y1=Math.round(bottom)-Math.max(4,Math.round(6*scale)),candidates=[];
 for(const threshold of [90,120,150,180]){
  const lit=(x,y)=>{const i=(y*w+x)*4,r=data[i],g=data[i+1],b=data[i+2];return (g>threshold&&b>threshold&&r<g*.95)||(r>threshold&&b>threshold&&g<r*.9)||(g>threshold&&g>r*1.15&&g>b*.9)};
  const reading=readFrameAtThreshold(lit,x0,x1,y0,y1,scale,-1);if(reading)candidates.push(reading);
 }
 candidates.sort((a,b)=>a.error-b.error);const best=candidates[0];if(!best||best.error>.24)return {displayedTotal:null,totalUncertain:true};
 return {displayedTotal:Number(best.mark),totalUncertain:best.error>.17||best.margin<.02||candidates.some(c=>c.mark!==best.mark)};
}
function digitalRowBands(ys,header,columns,lit,w,h){
 const base=ys[header+2]-ys[header+1],bands=[];
 let top=ys[header+1];
 // Check several frame dividers, not just the name-column border. A faded
 // border or a bright streak inside one row must not hide later bowlers.
 const supported=(a,b)=>columns.slice(1,-1).filter(x=>{
  let hits=0;for(const p of [.2,.35,.5,.65,.8]){
   const y=Math.round(a+(b-a)*p);if(y<0||y>=h)continue;
   if([-3,-2,-1,0,1,2,3].some(dx=>{const px=Math.round(x)+dx;return px>=0&&px<w&&lit(px,y)}))hits++;
  }return hits>=3;
 }).length>=8;
 for(let i=0;i<12;i++){
  const expected=top+base;if(expected>h-2)break;
  const candidates=ys.filter(y=>y-top>=base*.7&&y-top<=base*1.3);
  const bottom=candidates.sort((a,b)=>Math.abs(a-expected)-Math.abs(b-expected))[0]??expected;
  if(!supported(top,bottom))break;
  bands.push({top,bottom,inferred:!ys.some(y=>Math.abs(y-bottom)<1)});top=bottom;
 }
 return bands;
}
function readDigitalGrid(data,w,h,adjusted=false,expectedRows=0){
 let red=0,green=0;for(let i=0;i<data.length;i+=400){red+=data[i];green+=data[i+1];}const pink=red>green*1.15;
 const lit=(x,y)=>{const i=(y*w+x)*4;return adjusted?((data[i+1]>170&&data[i+2]>150)||(data[i]>170&&data[i+2]>170)):(data[i+1]>110&&data[i+2]>110&&data[i]<data[i+1]*.85)};
 const glyphLit=(x,y)=>{if(!pink)return lit(x,y);const i=(y*w+x)*4;return data[i+1]>85&&data[i+2]>150&&data[i]<data[i+2]*.9};
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
  if(xs.length===13||(xs.length===11&&xs[0]>w*.05&&xs[0]<w*.2&&xs.at(-1)>w*.75)){columns=xs.length===11?[0,...xs,w-1]:xs;header=i;break;}
 }
 if(!columns&&!adjusted)return readDigitalGrid(straightenDigitalGrid(data,w,h),w,h,true,expectedRows);
 if(!columns)throw new Error('Grid not found. Photograph the full digital scoreboard grid straight on with all frame columns visible. Try standard OCR for other displays.');
 const frameEdges=columns.slice(1,-1),rows=[];
 for(const {top,bottom,inferred} of digitalRowBands(ys,header,columns,lit,w,h)){
  const height=bottom-top;
  const frames=[],uncertainFrames=[],frameCrops=[];
  for(let f=0;f<10;f++){
   const scale=w/1338,x0=Math.round(frameEdges[f])+Math.max(3,Math.round(5*scale)),x1=Math.round(frameEdges[f+1])-Math.max(3,Math.round(4*scale));
   const y0=Math.round(top)+Math.max(3,Math.round(6*scale)),y1=Math.round(top+height*.43)-Math.max(2,Math.round(3*scale));
   const candidates=[],normal=readFrameAtThreshold(glyphLit,x0,x1,y0,y1,scale,f);
   if(normal)candidates.push(normal);
   if(!pink)for(const threshold of [120,140,160,180]){
    const shadeLit=(x,y)=>{const i=(y*w+x)*4;return data[i+1]>threshold&&data[i+2]>threshold&&data[i]<data[i+1]*.9};
    const result=readFrameAtThreshold(shadeLit,x0,x1,y0,y1,scale,f);if(result)candidates.push(result);
   }
   if(pink)for(const separation of [40,65,85,105,125,145]){
    const splitLit=(x,y)=>{const i=(y*w+x)*4;return data[i+2]>120&&data[i+2]-data[i]>separation};
    const result=readFrameAtThreshold(splitLit,x0,x1,y0,y1,scale,f);if(result)candidates.push(result);
   }
   candidates.sort((a,b)=>a.error-b.error);
   const selected=candidates[0];
   let mark=selected?.mark||'',lowConfidence=!selected||selected.error>.18||selected.margin<.025||candidates.some(c=>c.mark!==selected.mark);
   if(pink&&f<9&&(!mark||lowConfidence)){
    const first=readSplitFirstRoll(data,w,h,frameEdges[f+1],top);
    const second=first?readSplitSecondRoll(data,w,frameEdges[f+1],top):null;
    const candidate=first&&second?first+second:'';
    if(candidate&&parseFrame(candidate,f)!==null)mark=candidate;
   }
   frames.push(mark);uncertainFrames.push(inferred||!mark||lowConfidence);frameCrops.push({x:Math.max(0,(frameEdges[f]-5)/w),y:Math.max(0,(top-6)/h),w:Math.min(1,(frameEdges[f+1]-frameEdges[f]+10)/w),h:Math.min(1,(height*.55+12)/h)});
  }
  rows.push({bowlerId:'',name:'Scoreboard row '+(rows.length+1),line:'Check bowler assignment and highlighted frames on the score sheet.',frames,uncertain:uncertainFrames,frameCrops,...readDisplayedGridTotal(data,w,h,columns.at(-2),columns.at(-1),top,bottom)});
 }
 if(!rows.length)throw new Error('No bowler rows found in this grid.');
 if(expectedRows&&rows.length!==expectedRows)throw new Error('Found '+rows.length+' bowler rows, but '+expectedRows+' were selected. Include all rows and the bottom border in the photo.');
 return rows;
}
function renderOcrReview(rows,grid){
 rows.forEach((r,i)=>{r.frames=Array.from({length:10},(_,i)=>r.frames?.[i]||'');r.uncertain=Array.from({length:10},(_,f)=>r.uncertain?.[f]??(!grid||parseFrame(r.frames[f],f)===null));const team=currentTeam(),order=isPractice()?null:team.ocrOrder;const remembered=order?.length===rows.length&&new Set(order).size===order.length&&order.every(id=>team.bowlers.some(b=>b.id===id));if(isPractice()&&!r.bowlerId&&rows.length===1)r.bowlerId=practiceBowler()?.id||'';if(grid&&!r.bowlerId&&!isPractice()){if(remembered)r.bowlerId=order[i];else if(rows.length===team.bowlers.length)r.bowlerId=team.bowlers[i].id;}});
 $('#ocrDetected').innerHTML=rows.map((r,i)=>'<div class="game-block"><strong>'+esc(r.name)+'</strong>'+
 '<label>Bowler<select data-ocr-row="'+i+'"><option value="">Choose bowler for this row</option><option value="__skip__" '+(r.bowlerId==='__skip__'?'selected':'')+'>Skip this bowler</option>'+sessionRoster().map(b=>'<option value="'+esc(b.id)+'" '+(r.bowlerId===b.id?'selected':'')+'>'+esc(b.name)+'</option>').join('')+'</select></label>'+
 '<div data-ocr-row-details="'+i+'"><label class="small"><input type="checkbox" data-ocr-absent="'+i+'" '+(r.absent?'checked':'')+'> Absent (ABS) — no played score</label><p class="muted small">'+esc(r.line)+'</p><details class="ocr-frame-details"><summary>Detected frame marks</summary><div class="row wrap">'+r.frames.map((f,fi)=>'<label>Frame '+(fi+1)+'<input data-ocr-frame="'+i+':'+fi+'" value="'+esc(f)+'" maxlength="4" aria-label="'+esc(r.name)+', frame '+(fi+1)+'" style="width:65px"></label>').join('')+'</div></details><p class="small" data-ocr-feedback="'+i+'" role="status"></p></div></div>').join('');
 $$('[data-ocr-absent]').forEach(el=>el.onchange=()=>{ocrResult.rows[+el.dataset.ocrAbsent].absent=el.checked;updateOcrReview()});
 $$('[data-ocr-row]').forEach(el=>el.onchange=()=>{ocrResult.rows[+el.dataset.ocrRow].bowlerId=el.value;updateOcrReview()});
 $$('[data-ocr-frame]').forEach(el=>el.oninput=()=>{const [r,f]=el.dataset.ocrFrame.split(':').map(Number);el.value=normalizeFrame(el.value);ocrResult.rows[r].frames[f]=el.value;updateOcrReview()});
 updateOcrReview();
}
function ocrReviewIssues(){
 const rows=ocrResult?.rows||[],ids=new Set(),issues=[];
 rows.forEach((r,i)=>{
  if(r.bowlerId==='__skip__')return;
  if(!sessionRoster().some(b=>b.id===r.bowlerId)){issues.push({row:i,message:'Choose a bowler or select Skip this row.'});return}
  if(ids.has(r.bowlerId))issues.push({row:i,message:'This bowler is assigned twice. Choose a different bowler or skip this row.'});
  ids.add(r.bowlerId);
  if(!r.absent&&bowlingScore(r.frames)===null){const frame=r.frames.findIndex((f,i)=>parseFrame(f,i)===null);issues.push({row:i,frame:frame>=0?frame:0,message:'Correct frame '+(frame>=0?frame+1:1)+' or mark this bowler ABS.'})}
 });
 if(!rows.some(r=>r.bowlerId&&r.bowlerId!=='__skip__'))issues.push({row:0,message:'Choose a bowler to add scores automatically.'});
 return issues;
}
function updateOcrReview(){
 const rows=ocrResult?.rows||[],issues=ocrReviewIssues();
 $$('[data-ocr-row-details]').forEach(el=>el.classList.toggle('hidden',rows[+el.dataset.ocrRowDetails]?.bowlerId==='__skip__'));
 $$('[data-ocr-frame]').forEach(el=>{const row=+el.dataset.ocrFrame.split(':')[0];el.disabled=!!rows[row]?.absent||rows[row]?.bowlerId==='__skip__'});
 rows.forEach((r,i)=>{const el=$('[data-ocr-feedback="'+i+'"]');if(el)el.textContent=r.bowlerId==='__skip__'?'This row will be skipped.':issues.filter(x=>x.row===i).map(x=>x.message).join(' ')||'Added to score sheet. Review highlighted frames below.'});
 syncOcrToScoreSheet();
}
function ocrReadingQuality(rows){
 let valid=0,complete=0,certain=0;
 for(const row of rows){let count=0;for(let f=0;f<10;f++)if(parseFrame(row.frames?.[f],f)!==null){valid++;count++;if(!row.uncertain?.[f])certain++;}
 if(count===10&&bowlingScore(row.frames)!==null)complete++;}
 const verified=rows.filter(r=>r.displayedTotal!=null&&!r.totalUncertain&&bowlingScore(r.frames)===r.displayedTotal).length;return {valid,complete,rank:valid*100+complete*10+certain+verified*25,finished:rows.length>0&&complete===rows.length&&certain===rows.length*10};
}
function flagOcrDisagreements(best,readings){
 // Compare row positions only when the detected grid has the same row count.
 return best.rows.map((row,i)=>({...row,uncertain:Array.from({length:10},(_,f)=>!!row.uncertain?.[f]||parseFrame(row.frames?.[f],f)===null||readings.some(rows=>rows.length===best.rows.length&&rows[i].frames?.[f]&&parseFrame(rows[i].frames[f],f)!==null&&rows[i].frames[f]!==row.frames?.[f]))}));
}
async function findDigitalGridAutomatically(file,token=null){
 const original=await prepareScoreboard(file,false,true);
 const settings=[[0,1,'original colors'],[25,1,'brighter'],[-25,1,'darker'],[0,1.3,'higher contrast'],[25,1.3,'brighter with higher contrast'],[0,.8,'softer contrast'],[50,1,'extra brightness'],[-40,1.5,'darker with higher contrast'],[45,1.6,'stronger exposure recovery']];
 const unique=settings.filter((s,i,a)=>a.findIndex(t=>t[0]===s[0]&&t[1]===s[1])===i);
 let attempts=0,best=null;const readings=[];const fingerprints=new Map();
 for(const target of [...new Set([Math.min(1338,original.width),Math.min(1024,original.width)])]){
  const width=target,height=Math.round(original.height*width/original.width),canvas=document.createElement('canvas');
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(original,0,0,width,height);
  const raw=ctx.getImageData(0,0,width,height).data;
  for(const [brightness,contrast,label] of unique){
   assertScanActive(token);attempts++;if($('#ocrProgressBar'))$('#ocrProgressBar').style.width=Math.round(attempts/(unique.length*2)*100)+'%';$('#ocrStatus').textContent='Looking for scores… attempt '+attempts+' ('+label+'). Best reading: '+(best?.quality.valid||0)+' frames.';
   await new Promise(resolve=>setTimeout(resolve,0));
   const data=brightness===0&&contrast===1?raw:adjustScoreboardPixels(raw,brightness,contrast);
   try{
    const rows=token?await recognizeGridAsync(data,width,height,token):readDigitalGrid(data,width,height),quality=ocrReadingQuality(rows);assertScanActive(token);
    readings.push(rows);
    if(!best||quality.rank>best.quality.rank)best={rows,width,height,label,brightness,contrast,quality};
    const fingerprint=JSON.stringify(rows.map(r=>r.frames));fingerprints.set(fingerprint,(fingerprints.get(fingerprint)||0)+1);
    const allComplete=rows.length>0&&quality.complete===rows.length;
    const verified=allComplete&&rows.every(r=>r.displayedTotal!=null&&!r.totalUncertain&&bowlingScore(r.frames)===r.displayedTotal);
    if(quality.finished||verified||(allComplete&&fingerprints.get(fingerprint)>=2)){best.rows=flagOcrDisagreements(best,readings);return {...best,attempts};}
   }catch(error){assertScanActive(token);/* Try the next exposure or size when grid detection fails. */}
  }
 }
 if(best){best.rows=flagOcrDisagreements(best,readings);return {...best,attempts};}
 throw new Error('Grid and scores not found after '+attempts+' automatic size, brightness and contrast attempts. Include the full grid, photograph it straight on, or try standard OCR.');
}
async function readStandardScoresAutomatically(worker,file,token=null){
 const raw=await prepareScoreboard(file,false);
 const presets=[[null,null,'enhanced photo','6'],[0,1,'original photo','3'],[25,1,'brighter','6'],[-25,1,'darker','3'],[0,1.5,'higher contrast','6'],[25,1.4,'brighter with contrast','3'],[0,.75,'softer contrast','6'],[50,1.2,'extra brightness','3']];
 let best=null,attempts=0;
 for(const [brightness,contrast,label,layout] of presets){
  assertScanActive(token);attempts++;if($('#ocrProgressBar'))$('#ocrProgressBar').style.width=Math.round(attempts/presets.length*100)+'%';$('#ocrStatus').textContent='Trying '+label+' for scores… '+attempts+' of '+presets.length+'.';
  await new Promise(resolve=>setTimeout(resolve,0));
  let canvas;
  if(brightness===null)canvas=await prepareScoreboard(file,true);
  else{
   canvas=document.createElement('canvas');canvas.width=raw.width;canvas.height=raw.height;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(raw,0,0);
   if(brightness!==0||contrast!==1){const pixels=ctx.getImageData(0,0,raw.width,raw.height);pixels.data.set(adjustScoreboardPixels(pixels.data,brightness,contrast));ctx.putImageData(pixels,0,0);}
  }
  await worker.setParameters({tessedit_pageseg_mode:layout,preserve_interword_spaces:'1'});
  const result=await worker.recognize(canvas);assertScanActive(token);const text=result.data.text||'',rows=detectOcrRows(text),quality=ocrReadingQuality(rows);
  if(!best||quality.rank>best.quality.rank)best={text,rows,quality,label};
  if(quality.complete===rows.length&&rows.length&&quality.valid>0)break;
 }
 return {...best,attempts};
}

async function runOcr(){return runScanBatch()}
function syncOcrToScoreSheet(){
 if(!ocrResult||ocrResult.store!==activeStoreKey||ocrResult.teamId!==currentTeam()?.id||!nightDraft)return;
 const game=nightDraft.games.find(g=>g.game===ocrResult.game);if(!game)return;
 const counts=new Map();for(const row of ocrResult.rows)if(row.bowlerId&&row.bowlerId!=='__skip__')counts.set(row.bowlerId,(counts.get(row.bowlerId)||0)+1);
 // Restore the previous target when an OCR row is reassigned or skipped.
 for(const row of ocrResult.rows)if(row.appliedBowlerId&&(row.appliedBowlerId!==row.bowlerId||counts.get(row.bowlerId)!==1)){
  const previous=game.bowlers.find(b=>b.bowlerId===row.appliedBowlerId);
  if(previous&&JSON.stringify(previous)===row.lastApplied){for(const key of Object.keys(previous))delete previous[key];Object.assign(previous,JSON.parse(row.priorDraft));}
  row.appliedBowlerId=null;
 }
 for(const row of ocrResult.rows){
  if(counts.get(row.bowlerId)!==1)continue;
  const bowler=game.bowlers.find(b=>b.bowlerId===row.bowlerId);if(!bowler)continue;
  if(row.appliedBowlerId&&JSON.stringify(bowler)!==row.lastApplied)continue;
  if(!row.appliedBowlerId)row.priorDraft=JSON.stringify(bowler);
  bowler.totalOnly=false;delete bowler.manualTotal;bowler.absent=!!row.absent;
  bowler.frames=row.absent?Array(10).fill(''):[...row.frames];
  bowler.ocrSourceId=ocrResult.sourceId;bowler.ocrFrameCrops=row.frameCrops;bowler.ocrDisplayedTotal=row.totalUncertain?null:(row.displayedTotal??null);
  bowler.ocrUncertain=row.absent?Array(10).fill(false):row.frames.map((mark,i)=>!!row.uncertain?.[i]||parseFrame(mark,i)===null);
  row.appliedBowlerId=row.bowlerId;row.lastApplied=JSON.stringify(bowler);
 }
 renderScoreSheet();
}
function updateOcrFromScoreSheet(bowler,game,frame){
 if(!ocrResult||ocrResult.teamId!==currentTeam()?.id||ocrResult.game!==game)return;
 const row=ocrResult.rows.find(r=>r.appliedBowlerId===bowler.bowlerId);if(!row)return;
 row.frames[frame]=bowler.frames[frame];row.uncertain[frame]=!!bowler.ocrUncertain?.[frame];
 const input=$('[data-ocr-frame="'+ocrResult.rows.indexOf(row)+':'+frame+'"]');if(input)input.value=row.frames[frame];
 row.lastApplied=JSON.stringify(bowler);
}
function bowlerPdfData(){
 const team=selectedStatsTeam(),id=state.selected.bowlerId,bowler=dashboardBowlers(team).find(b=>b.id===id);
 if(!bowler)throw new Error('Choose an individual bowler on the dashboard first.');
 const stats=statsForTeam(team,id);
 if(!stats.games)throw new Error('Save '+(statsArePractice()?'practice games':'a league night')+' for this bowler before exporting.');
 return {source:statsArePractice()?'practice':'league',sourceLabel:statsSourceLabel(),bowler:bowler.name,season:currentSeason().name,league:currentLeague().name,team:team.name,stats,generated:new Date()};
}
function createBowlerPdf(model,PdfClass=window.jspdf.jsPDF){
 if(!window.bowlingPdfHeader)throw new Error('The PDF header did not load. Reload the page and try again.');
 const doc=new PdfClass({unit:'pt',format:'letter',compress:true});
 const M=42,W=528,BOTTOM=742;let y=42;
 const clean=value=>String(value??'-').replace(/[\u2010-\u2015]/g,'-').replace(/\u00b7/g,'/').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"');
 const number=value=>value===null?'-':Number(value).toFixed(1);
 const date=value=>new Date(value+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
 const label=(text,size=10,bold=false,color=[28,39,61])=>{doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(...color);};
 function paragraph(text,size=10,bold=false){
  label(text,size,bold);const lines=doc.splitTextToSize(clean(text),W);
  for(const line of lines){room(size+5);doc.text(line,M,y);y+=size+5;}
 }
 function newPage(){doc.addPage();doc.addImage(window.bowlingPdfHeader,'JPEG',M,26,264,88,'bowling-header','FAST');y=132;label('',10,true);doc.text(clean(model.bowler)+' - Bowling Report',M,y);y+=14;doc.setDrawColor(218,224,232);doc.line(M,y,M+W,y);y+=22;}
 function room(height){if(y+height>BOTTOM)newPage();}
 function section(title,height=35){room(height+10);y+=18;label('',12,true);doc.text(title,M,y);y+=17;}
 function tableHead(headers,widths){
  room(24);let x=M;doc.setFillColor(28,39,61);doc.rect(M,y,W,24,'F');label('',9,true,[255,255,255]);
  headers.forEach((header,i)=>{doc.text(header,x+widths[i]/2,y+16,{align:'center'});x+=widths[i];});y+=24;
 }
 function tableRow(cells,widths,height=23){
  room(height);let x=M;doc.setDrawColor(219,225,233);label('',9,false);
  cells.forEach((cell,i)=>{doc.rect(x,y,widths[i],height);doc.text(clean(cell),x+widths[i]/2,y+15,{align:'center'});x+=widths[i];});y+=height;
 }
 doc.addImage(window.bowlingPdfHeader,'JPEG',M,30,W,176,'bowling-header','FAST');y=226;
 label('',10,true,[182,42,109]);doc.text('STRIKESCAN / BOWLER REPORT',M,y);y+=26;
 paragraph(model.bowler,22,true);y+=3;
 paragraph('Season: '+model.season+'   |   League: '+model.league);
 paragraph('Team: '+model.team+'   |   '+model.sourceLabel);
 const handicapEntries=model.stats.entries.filter(e=>Number.isFinite(e.handicap));if(handicapEntries.length)paragraph('Recorded handicap: average '+(handicapEntries.reduce((sum,e)=>sum+e.score+e.handicap,0)/handicapEntries.length).toFixed(1)+' across '+handicapEntries.length+' games. Scratch scores shown in the tables.',9);
 const nights=[...model.stats.nights].sort((a,b)=>a.date.localeCompare(b.date)),st=model.stats;
 paragraph('Saved games: '+date(nights[0].date)+' to '+date(nights.at(-1).date),9);
 y+=8;
 const metrics=[['Games',st.games],['Game Average',number(st.avg)],['High Game',st.high],['High Series',st.highSeries??'-'],
 ['Average Series',number(st.avgSeries)],['Strikes',st.strikes],['Spares',st.spares],['Open Frames',st.opens]];
 room(105);
 metrics.forEach(([name,value],i)=>{
  const x=M+(i%4)*132,top=y+Math.floor(i/4)*51;
  doc.setFillColor(246,248,251);doc.setDrawColor(219,225,233);doc.roundedRect(x+2,top,128,45,5,5,'FD');
  label('',9,false,[84,96,116]);doc.text(name,x+12,top+15);
  label('',16,true);doc.text(String(value),x+12,top+34);
 });y+=109;
 paragraph(st.gameAverages.map((v,i)=>'Game '+(i+1)+' average: '+number(v)).join('   |   '),9);
 const strikeRate=st.frames?(100*st.strikes/st.frames).toFixed(1)+'%':'-';
 const spareRate=st.frames>st.strikes?(100*st.spares/(st.frames-st.strikes)).toFixed(1)+'%':'-';
 paragraph('Strike rate: '+strikeRate+'   |   Spare conversion: '+spareRate,9);
 paragraph('Rates count scoring frames; tenth-frame bonus rolls are excluded.',8);
 section('Game scores & three-game series',60);
 const summaryWidths=[152,88,88,88,112];
 tableHead(['Date','Game 1','Game 2','Game 3','Series'],summaryWidths);
 for(const n of nights){
  if(y+46>BOTTOM){newPage();tableHead(['Date','Game 1','Game 2','Game 3','Series'],summaryWidths);}
  const scores=[1,2,3].map(g=>{const e=n.entries.find(e=>e.game===g);return e?.absent?'ABS':e?.score});
  tableRow([date(n.date),...scores.map(v=>v??'-'),scores.every(v=>Number.isFinite(v))?scores.reduce((a,b)=>a+b,0):'-'],summaryWidths);
  if(n.entries.some(e=>Number.isFinite(e.handicap))){const adjusted=[1,2,3].map(game=>{const e=n.entries.find(e=>e.game===game);return !e?.absent&&Number.isFinite(e?.score)&&Number.isFinite(e?.handicap)?e.score+e.handicap:null});tableRow(['Handicap',...adjusted.map(v=>v??'-'),adjusted.every(Number.isFinite)?adjusted.reduce((a,b)=>a+b,0):'-'],summaryWidths);}
 }
 y+=14;paragraph('* Total only: remembered game score; frame marks and strike/spare rates are unavailable for that game.',8);
 section('Frame-by-frame game details',160);
 const frameWidths=[38,...Array(10).fill(44),50];
 for(const n of nights){
  room(125);y+=6;label('',11,true);doc.text(date(n.date),M,y);y+=13;
  tableHead(['Game',...Array.from({length:10},(_,i)=>String(i+1)),'Total'],frameWidths);
  for(const game of [1,2,3]){
   const entry=n.entries.find(e=>e.game===game);
   tableRow([String(game)+(entry?.totalOnly?'*':''),...Array.from({length:10},(_,i)=>entry?.absent?'ABS':entry?.totalOnly?'-':entry?.frames?.[i]||'-'),entry?.absent?'ABS':entry?.score??'-'],frameWidths,23);
  }y+=12;
 }
 const pageCount=doc.getNumberOfPages();
 for(let p=1;p<=pageCount;p++){
  doc.setPage(p);doc.setDrawColor(219,225,233);doc.line(M,754,M+W,754);
  label('',8,false,[100,111,130]);doc.text('StrikeScan / Generated '+model.generated.toLocaleDateString(),M,769);
  doc.text('Page '+p+' of '+pageCount,M+W,769,{align:'right'});
 }
 doc.setProperties({title:clean(model.bowler)+' - Bowling Stats and Games',subject:model.sourceLabel+' statistics and frame-by-frame game details',author:'StrikeScan'});
 return doc;
}
function bowlerPdfFilename(model){
 const safe=value=>String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9_-]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'Bowler';
 return safe(model.bowler)+'-'+safe(model.season)+'-'+(model.source==='practice'?'Practice':'League')+'-Bowling-Report.pdf';
}
function downloadBowlerPdf(){
 try{
  if(!window.jspdf?.jsPDF)throw new Error('The PDF component did not load. Reload the page and try again.');
  const model=bowlerPdfData();createBowlerPdf(model).save(bowlerPdfFilename(model));toast('Bowler PDF downloaded');
 }catch(e){console.error(e);toast(e.message||'Could not create the PDF');}
}
async function shareBowlerPdf(){
 try{
  if(!window.jspdf?.jsPDF)throw new Error('The PDF component did not load. Reload the page and try again.');
  const model=bowlerPdfData(),doc=createBowlerPdf(model),filename=bowlerPdfFilename(model);
  const file=new File([doc.output('blob')],filename,{type:'application/pdf'});
  if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:model.bowler+' bowling report'});}
  else{doc.save(filename);toast('PDF downloaded - attach it to your message or email.');}
 }catch(e){if(e.name==='AbortError')return;console.error(e);toast(e.message||'Could not share the PDF. Try Download Bowler PDF.');}
}

function exportBackup(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`bowling-tracker-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href)}
function importBackup(){const f=$('#importFile').files[0];if(!f)return toast('Choose a backup file');const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(reader.result);if(!data.seasons)throw new Error('Invalid');if(confirm('Replace current bowling data with this backup?')){state=data;nightDraft=null;sessionDrafts.clear();persist();toast('Backup imported')}}catch{toast('That file is not a valid bowling backup')}};reader.readAsText(f)}
function openScoreGame(game){$('#scoreSheetPanel').open=true;$$('[data-score-game]').forEach(panel=>panel.open=+panel.dataset.scoreGame===+game)}
function clearNight(){const t=currentTeam();if(!t)return;if(confirm('Clear the current unsaved score sheet?')){nightDraft=newSessionDraft(t);clearScanReview();renderScoreSheet()}}
function renderNightHeader(){if(!currentTeam())$('#sessionSettings').open=true;const s=currentSeason(),l=currentLeague(),t=currentTeam();$('#nightSelection').textContent=t?`${s.name} · ${l.name} · ${t.name}`:'Choose a league and team'}
function renderAll(){ensureSelection();if(ocrResult&&(ocrResult.store!==activeStoreKey||ocrResult.teamId!==currentTeam()?.id))clearScanReview();renderSelectors();renderBowlers();renderDashboard();renderHistory();renderNightHeader();renderScoreSheet();renderHandicapSettings();renderHandicapSummary()}
function savePractice(){
 const t=currentTeam();if(!t||!practiceBowler()||!nightDraft)return toast('Choose a bowler first');
 const date=$('#nightDate').value;if(!isValidNightDate(date))return toast('Choose a valid practice date');
 const entries=[];
 for(const g of nightDraft.games)for(const b of g.bowlers){
  if(b.absent)continue;
  if(!b.totalOnly&&!b.frames.some(Boolean))continue;
  if(entryScore(b)===null)return toast('Finish or correct practice Game '+g.game+' before saving');
  entries.push(savedEntry({...b,handicap:null},g.game));
 }
 if(!entries.length)return toast('Scan or enter at least one practice game');
 if(nightDraft.games.some(g=>g.bowlers.some(verificationMismatch))&&!confirm('A practice score differs from the photographed total. Save the entered frames anyway?'))return;
 (t.practiceSessions??=[]).push({id:uid(),practice:true,date,createdAt:new Date().toISOString(),entries});
 nightDraft=newSessionDraft(t);nightDraft.date=date;clearScanReview();persist();toast(entries.length+' practice game'+(entries.length===1?'':'s')+' saved');
}
function renderPracticeHistory(){
 const t=currentTeam(),sessions=t?.practiceSessions||[],select=$('#practiceHistoryBowler'),selected=select.value;
 const people=new Map((t?.bowlers||[]).map(b=>[b.id,b]));for(const n of sessions)for(const e of n.entries)if(!people.has(e.bowlerId))people.set(e.bowlerId,{id:e.bowlerId,name:e.name});
 select.innerHTML=optionHtml([...people.values()],selected,'All bowlers');if(people.has(selected))select.value=selected;
 const id=select.value,visible=sessions.map(n=>({...n,entries:n.entries.filter(e=>!id||e.bowlerId===id)})).filter(n=>n.entries.length).sort((a,b)=>b.date.localeCompare(a.date)||String(b.createdAt).localeCompare(String(a.createdAt)));
 const scores=visible.flatMap(n=>n.entries).filter(e=>!e.absent&&Number.isFinite(e.score)).map(e=>e.score);
 $('#practiceStats').textContent=scores.length?scores.length+' practice games · Average '+(scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1)+' · High game '+Math.max(...scores):'No practice games saved for this selection yet.';
 const root=$('#practiceHistoryList');root.innerHTML=visible.map(n=>'<section class="history-night"><div class="history-head wrap"><strong>Practice · '+esc(formatDate(n.date))+'</strong><div class="row wrap"><button class="ghost icon-btn" data-practice-edit="'+esc(n.id)+'">Edit Scores</button><button class="ghost icon-btn" data-practice-date-toggle="'+esc(n.id)+'">Edit Date</button><button class="ghost danger icon-btn" data-practice-delete="'+esc(n.id)+'">Delete</button></div></div><form class="practice-session hidden" data-practice-date="'+esc(n.id)+'"><label>Practice date<input type="date" required value="'+esc(n.date)+'"></label><button class="primary">Save Date</button></form><div class="practice-session">'+n.entries.map(e=>'<details><summary><strong>'+esc(e.name)+' · Game '+e.game+' · '+(e.absent?'ABS':e.score)+'</strong>'+(e.totalOnly?' · Total only':' · View frames')+'</summary>'+(e.totalOnly||e.absent?'':'<p class="practice-marks">'+e.frames.map((f,i)=>'F'+(i+1)+': <strong>'+esc(f)+'</strong>').join(' &nbsp; ')+'</p>')+'</details>').join('')+'</div></section>').join('');
 root.querySelectorAll('[data-practice-edit]').forEach(b=>b.onclick=()=>openSavedScoreEditor(b.dataset.practiceEdit));
 root.querySelectorAll('[data-practice-date-toggle]').forEach(b=>b.onclick=()=>root.querySelector('[data-practice-date="'+b.dataset.practiceDateToggle+'"]').classList.toggle('hidden'));
 root.querySelectorAll('[data-practice-date]').forEach(form=>form.onsubmit=e=>{e.preventDefault();const date=form.querySelector('input').value;if(!isValidNightDate(date))return toast('Choose a valid practice date');const n=t.practiceSessions.find(n=>n.id===form.dataset.practiceDate);if(n){n.date=date;persist();toast('Practice date updated')}});
 root.querySelectorAll('[data-practice-delete]').forEach(b=>b.onclick=()=>{if(confirm('Delete this practice session?')){t.practiceSessions=t.practiceSessions.filter(n=>n.id!==b.dataset.practiceDelete);persist();toast('Practice session deleted')}});
}

function showView(name){document.body.classList.toggle('scan-view',name==='night');$$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));$$('.tab').forEach(t=>t.classList.toggle('active',t.dataset.view===name));window.scrollTo({top:0,behavior:'smooth'})}
let scanFiles=[], scanResults=new Map(), scanSources=new Map(), scanUndo=null, scanSession=null, frameReview=null;
const cloneData=value=>JSON.parse(JSON.stringify(value));
function assertScanActive(token){if(token&&(token.cancelled||token.store!==activeStoreKey||token.teamId!==currentTeam()?.id||token.draft!==nightDraft))throw new Error('SCAN_CANCELLED')}
function cancelScan(){if(!scanSession)return;scanSession.cancelled=true;scanSession.cancelPending?.();scanSession.gridWorker?.terminate();scanSession.textWorker?.terminate().catch(()=>{});$('#ocrStatus').textContent='Cancelling scan…'}
function setScanBusy(busy){for(const id of ['runOcrBtn','scoreboardImage','ocrMode','ocrGame','saveNightBtn','clearNightBtn','sessionType','practiceBowler','scoreboardRowCount'])$('#'+id).disabled=busy;$$('[data-scan-file]').forEach(el=>el.disabled=busy);$('#cancelScanBtn').classList.toggle('hidden',!busy);$('#ocrProgress').classList.toggle('hidden',!busy);$('#undoScanBtn').disabled=busy||!scanUndo||scanUndo.store!==activeStoreKey||scanUndo.teamId!==currentTeam()?.id;$('#undoScanBtn').classList.toggle('hidden',!scanUndo);if(!busy)$('#runOcrBtn').disabled=!scanFiles.length;}
function selectScanFiles(){
 if(scanSession)return;
 const files=[...$('#scoreboardImage').files];$('#runOcrBtn').disabled=!files.length||files.length>3;$('#singleGameLabel').classList.toggle('hidden',files.length>1);$('#scanFileList').classList.toggle('hidden',files.length<2);if(files.length>3){$('#scoreboardImage').value='';scanFiles=[];$('#scanFileList').innerHTML='';toast('Choose up to three photos at a time.');return}
 scanFiles=files.map((file,i)=>({file,game:files.length===1?+$('#ocrGame').value:i+1,sourceId:uid()}));
 $('#scanFileList').innerHTML=scanFiles.map((item,i)=>'<label>'+esc(item.file.name)+'<select data-scan-file="'+i+'">'+[1,2,3].map(g=>'<option value="'+g+'" '+(g===item.game?'selected':'')+'>Game '+g+'</option>').join('')+'</select></label>').join('');
 $$('[data-scan-file]').forEach(el=>el.onchange=()=>scanFiles[+el.dataset.scanFile].game=+el.value);
 if(scanFiles.length){showScanSource(scanFiles[0]);$('#ocrStatus').textContent='Check the game number for each photo, then read the scoreboard.';}
}
function showScanSource(item){let source=scanSources.get(item.sourceId);if(!source){source={url:URL.createObjectURL(item.file),file:item.file};scanSources.set(item.sourceId,source)}$('#imagePreview').src=source.url;$('#imagePreviewWrap').classList.remove('hidden');$('#scanPhotoPreview').classList.remove('hidden')}
function renderScanReviewPicker(){const selected=ocrResult?.game;$('#ocrReviewGame').innerHTML=[...scanResults.keys()].sort().map(g=>'<option value="'+g+'" '+(g===selected?'selected':'')+'>Review Game '+g+'</option>').join('');$('#scanReviewControls').classList.toggle('hidden',!scanResults.size)}
function chooseScanReview(game){ocrResult=scanResults.get(+game)||null;if(!ocrResult||ocrResult.store!==activeStoreKey||ocrResult.teamId!==currentTeam()?.id){clearScanReview();return;}$('#ocrText').textContent=ocrResult.text;const source=scanSources.get(ocrResult.sourceId);if(source){$('#imagePreview').src=source.url;$('#imagePreviewWrap').classList.remove('hidden')}renderOcrReview(ocrResult.rows,ocrResult.grid);openScoreGame(ocrResult.game);$('#ocrDetails').classList.remove('hidden');$('#ocrDetails').open=true;renderScanReviewPicker()}
function rememberBowlerOrder(){if(isPractice())return;const team=currentTeam();if(!team||!ocrResult)return;const ids=ocrResult.rows.map(r=>r.bowlerId);if(ids.some(id=>!team.bowlers.some(b=>b.id===id))||new Set(ids).size!==ids.length)return toast('Assign each row to a different bowler before remembering its order.');team.ocrOrder=[...ids];persist();toast('Bowler order remembered for this team.')}
function undoLastScan(){if(!scanUndo||scanUndo.store!==activeStoreKey||scanUndo.teamId!==currentTeam()?.id)return;if(!confirm('Restore the score sheet from before the last scan? Corrections made since that scan will also be undone.'))return;nightDraft=cloneData(scanUndo.draft);scanUndo=null;scanResults.clear();ocrResult=null;$('#ocrDetails').classList.add('hidden');renderScanReviewPicker();renderScoreSheet();$('#undoScanBtn').disabled=true;$('#undoScanBtn').classList.add('hidden');toast('Score sheet restored to before the last scan.')}
function clearScanReview(){scanResults.clear();ocrResult=null;scanUndo=null;$('#ocrDetails').classList.add('hidden');renderScanReviewPicker();$('#undoScanBtn').disabled=true;$('#undoScanBtn').classList.add('hidden')}
function verificationText(b){const score=entryScore(b);if(b.absent||b.totalOnly)return '';if(b.ocrDisplayedTotal==null)return b.ocrSourceId?'Scoreboard total unreadable — check the photo.':'';return score===null?'Scoreboard total '+b.ocrDisplayedTotal+' · finish highlighted frames':score===b.ocrDisplayedTotal?'Verified: '+score+' matches scoreboard':'Check total: frames '+score+' / scoreboard '+b.ocrDisplayedTotal;}
function verificationMismatch(b){return !b.absent&&!b.totalOnly&&b.ocrDisplayedTotal!=null&&entryScore(b)!==null&&entryScore(b)!==b.ocrDisplayedTotal}
async function openFrameReview(game,bowlerId,frame){
 const b=nightDraft?.games.find(g=>g.game===game)?.bowlers.find(b=>b.bowlerId===bowlerId);if(!b)return;
 frameReview={draft:nightDraft,game,bowlerId,frame};$('#frameReviewTitle').textContent=b.name+' · Game '+game+' · Frame '+(frame+1);$('#frameReviewInput').value=b.frames[frame]||'';$('#frameReviewStatus').textContent='';$('#frameReviewPhoto').classList.add('hidden');$('#frameReviewNoPhoto').textContent='';$('#frameReviewDialog').showModal();
 const source=scanSources.get(b.ocrSourceId),bounds=b.ocrFrameCrops?.[frame];if(!source){$('#frameReviewNoPhoto').textContent='No scan photo is available for this frame.';return}
 try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=source.url});if(frameReview?.draft!==nightDraft||frameReview?.frame!==frame||frameReview?.bowlerId!==bowlerId)return;const canvas=$('#frameReviewPhoto'),ctx=canvas.getContext('2d');const crop=bounds||{x:0,y:0,w:1,h:1};const x=Math.max(0,crop.x),y=Math.max(0,crop.y),w=Math.min(crop.w,1-x),h=Math.min(crop.h,1-y);canvas.width=800;canvas.height=Math.min(600,Math.max(180,Math.round(800*h*img.naturalHeight/(w*img.naturalWidth))));ctx.drawImage(img,x*img.naturalWidth,y*img.naturalHeight,w*img.naturalWidth,h*img.naturalHeight,0,0,canvas.width,canvas.height);canvas.classList.remove('hidden');if(!bounds)$('#frameReviewNoPhoto').textContent='Standard OCR: full photo shown. Locate the selected frame.';}catch{$('#frameReviewNoPhoto').textContent='The scan photo could not be opened.';}
}
function saveFrameReview(){if(!frameReview||frameReview.draft!==nightDraft)return;const {game,bowlerId,frame}=frameReview,mark=normalizeFrame($('#frameReviewInput').value);if(parseFrame(mark,frame)===null){$('#frameReviewStatus').textContent='Enter a valid frame mark, such as 9/, 8-, or X. The tenth frame may need a bonus roll.';return}const b=nightDraft.games.find(g=>g.game===game)?.bowlers.find(b=>b.bowlerId===bowlerId);if(!b)return;b.totalOnly=false;delete b.manualTotal;b.frames[frame]=mark;b.ocrUncertain??=Array(10).fill(false);b.ocrUncertain[frame]=false;updateOcrFromScoreSheet(b,game,frame);$('#frameReviewDialog').close();frameReview=null;renderScoreSheet()}
function gridWorkerSource(){return 'const TOTAL_FONT='+JSON.stringify(TOTAL_FONT)+';const GRID_FONT='+JSON.stringify(GRID_FONT)+';const SPLIT_FONT='+JSON.stringify(SPLIT_FONT)+';'+[normalizeFrame,parseFrame,bowlingScore,straightenDigitalGrid,highlightedRollFeatures,readSplitFirstRoll,readSplitSecondRoll,distinguishFiveAndSix,readFrameAtThreshold,readDisplayedGridTotal,digitalRowBands,readDigitalGrid].map(fn=>fn.toString()).join('\n')+'\nonmessage=e=>{try{postMessage({rows:readDigitalGrid(new Uint8ClampedArray(e.data.data),e.data.w,e.data.h,false,e.data.expectedRows)})}catch(error){postMessage({error:error.message})}}';}
async function recognizeGridAsync(data,w,h,token){assertScanActive(token);if(typeof Worker==='undefined')return readDigitalGrid(data,w,h,false,token.expectedRows);if(!token.gridWorker){const url=URL.createObjectURL(new Blob([gridWorkerSource()],{type:'text/javascript'}));token.gridWorker=new Worker(url);URL.revokeObjectURL(url)}return new Promise((resolve,reject)=>{token.cancelPending=()=>reject(new Error('SCAN_CANCELLED'));token.gridWorker.onmessage=e=>{token.cancelPending=null;e.data.error?reject(new Error(e.data.error)):resolve(e.data.rows)};token.gridWorker.onerror=()=>{token.cancelPending=null;reject(new Error('The scan worker could not start. Reload the page and retry.'))};const copy=new Uint8ClampedArray(data);token.gridWorker.postMessage({data:copy.buffer,w,h,expectedRows:token.expectedRows},[copy.buffer])})}
async function runScanBatch(){
 if(scanSession)return;const team=currentTeam();if(!scanFiles.length)return toast('Choose one to three scoreboard photos.');if(!team?.bowlers.length)return toast('Choose a team and add its bowlers first.');if(new Set(scanFiles.map(i=>i.game)).size!==scanFiles.length)return toast('Assign a different game number to each photo.');if($('#ocrMode').value==='standard'&&!window.Tesseract)return toast('The OCR component has not loaded. Connect and reload the page.');ensureDraft();
 const targets=new Set(scanFiles.map(i=>i.game));if(nightDraft.games.some(g=>targets.has(g.game)&&g.bowlers.some(b=>b.absent||b.totalOnly||b.frames.some(Boolean)))&&!confirm('Replace scanned bowlers in the selected games? You can use Undo Last Scan afterwards.'))return;
 scanUndo={store:activeStoreKey,teamId:team.id,draft:cloneData(nightDraft)};const token={store:activeStoreKey,teamId:team.id,draft:nightDraft,expectedRows:+$('#scoreboardRowCount').value||0,cancelled:false};scanSession=token;setScanBusy(true);let completed=0;
 try{for(const item of [...scanFiles]){assertScanActive(token);$('#ocrStatus').textContent='Reading Game '+item.game+'…';const grid=$('#ocrMode').value==='digital';let result;
   if(grid)result=await findDigitalGridAutomatically(item.file,token);
   else{if(!token.textWorker)token.textWorker=await Tesseract.createWorker('eng',1,{logger:m=>{if(scanSession===token&&!token.cancelled)$('#ocrStatus').textContent='Game '+item.game+' · '+m.status+' '+Math.round((m.progress||0)*100)+'%'}});assertScanActive(token);result=await readStandardScoresAutomatically(token.textWorker,item.file,token);}
   assertScanActive(token);showScanSource(item);ocrResult={text:grid?'Game '+item.game+': '+result.quality.valid+' readable frames after '+result.attempts+' attempts. Check assignments and total verification.':result.text,rows:result.rows,store:activeStoreKey,teamId:team.id,game:item.game,sourceId:item.sourceId,grid};scanResults.set(item.game,ocrResult);$('#ocrText').textContent=ocrResult.text;renderOcrReview(ocrResult.rows,grid);renderScanReviewPicker();$('#ocrDetails').classList.remove('hidden');$('#ocrDetails').open=true;openScoreGame(item.game);completed++;
  }$('#ocrStatus').textContent='Finished '+completed+' photo'+(completed===1?'':'s')+'. Scores are on the sheet. Check amber frames, bowler assignments, and scoreboard totals.';
 }catch(error){if(error.message==='SCAN_CANCELLED'||token.cancelled)$('#ocrStatus').textContent='Scan cancelled. '+completed+' completed game(s) kept on the sheet. Undo Last Scan restores the previous sheet.';else{$('#ocrStatus').textContent='Scan stopped: '+error.message+'. '+completed+' completed game(s) kept. Use Undo Last Scan to restore the previous sheet.';console.error(error)}}finally{token.gridWorker?.terminate();if(token.textWorker)await token.textWorker.terminate().catch(()=>{});scanSession=null;setScanBusy(false)}
}

function leagueHandicapConfig(){return currentLeague()?.handicap||{enabled:false,base:200,percent:90,rounding:'floor'}}
function bowlerHandicap(bowlerId){const config=leagueHandicapConfig();if(!config.enabled)return null;const bowler=currentTeam()?.bowlers.find(b=>b.id===bowlerId),average=bowler?.handicapAverage??statsForTeam(currentTeam(),bowlerId).avg;if(!Number.isFinite(average))return null;const raw=Math.max(0,(config.base-average)*config.percent/100);return {pins:Math[config.rounding||'floor'](raw),average,config:cloneData(config)}}
function handicapScoreLabel(entry){return Number.isFinite(entry?.handicap)&&Number.isFinite(entry?.score)&&!entry.absent?'Hcp '+(entry.score+entry.handicap)+' (+'+entry.handicap+')':''}
function renderHandicapSettings(){const config=leagueHandicapConfig();$('#handicapEnabled').checked=!!config.enabled;$('#handicapBase').value=config.base;$('#handicapPercent').value=config.percent;$('#handicapRounding').value=config.rounding;$('#handicapForm').classList.toggle('hidden',!currentLeague());$('#handicapAverages').innerHTML=(currentTeam()?.bowlers||[]).map(b=>'<label>'+esc(b.name)+' · average<input data-handicap-average="'+esc(b.id)+'" type="number" min="0" max="300" step="0.1" value="'+(b.handicapAverage??'')+'" placeholder="Use tracked season average"></label>').join('');}
function saveHandicapSettings(event){event.preventDefault();const league=currentLeague();if(!league)return;const base=Number($('#handicapBase').value),percent=Number($('#handicapPercent').value),rounding=$('#handicapRounding').value;if(!Number.isFinite(base)||base<0||base>300||!Number.isFinite(percent)||percent<0||percent>100||!['floor','round','ceil'].includes(rounding))return toast('Use a base from 0–300 and a percentage from 0–100.');const averages=$$('[data-handicap-average]').map(input=>({id:input.dataset.handicapAverage,value:input.value===''?null:Number(input.value)}));if(averages.some(a=>a.value!==null&&(!Number.isFinite(a.value)||a.value<0||a.value>300)))return toast('Bowler averages must be between 0 and 300.');league.handicap={enabled:$('#handicapEnabled').checked,base,percent,rounding};for(const a of averages){const bowler=currentTeam()?.bowlers.find(b=>b.id===a.id);if(bowler)bowler.handicapAverage=a.value;}persist();toast('Handicap settings saved. Saved games retain their recorded handicap.')}
function renderHandicapSummary(){if(statsArePractice()){$('#handicapSummary').textContent='';$('#handicapSummary').classList.add('hidden');return}const id=state.selected.bowlerId,config=leagueHandicapConfig(),handicap=id?bowlerHandicap(id):null;const entries=statsForTeam(currentTeam(),id).entries.filter(e=>Number.isFinite(e.handicap));$('#handicapSummary').textContent=!config.enabled?'':(handicap?'Current handicap: +'+handicap.pins+' per game from average '+handicap.average.toFixed(1)+'. ':id?'Enter an average or save games to calculate a handicap. ':'Choose a bowler for their current handicap. ')+(entries.length?'Recorded handicap average: '+(entries.reduce((sum,e)=>sum+e.score+e.handicap,0)/entries.length).toFixed(1)+' across '+entries.length+' games. ':'')+'Formula: '+config.percent+'% of '+config.base+', rounded '+({floor:'down',round:'to nearest',ceil:'up'}[config.rounding])+'.';$('#handicapSummary').classList.toggle('hidden',!config.enabled)}

$$('.tab').forEach(b=>b.onclick=()=>showView(b.dataset.view));$$('[data-go]').forEach(b=>b.onclick=()=>showView(b.dataset.go));
$('#statsSource').onchange=changeStatsSource;
$('#manualScoreBtn').onclick=()=>{openScoreGame(1);$('#scoreSheetPanel').scrollIntoView({behavior:'smooth',block:'start'})};
$('#downloadBowlerPdfBtn').onclick=downloadBowlerPdf;
$('#shareBowlerPdfBtn').onclick=shareBowlerPdf;
$('#addSeasonBtn').onclick=addSeason;$('#addLeagueBtn').onclick=addLeague;$('#addTeamBtn').onclick=addTeam;$('#addBowlerBtn').onclick=addBowler;$('#saveNightBtn').onclick=saveNight;$('#clearNightBtn').onclick=clearNight;$('#runOcrBtn').onclick=runOcr;$('#exportBtn').onclick=exportBackup;$('#importBtn').onclick=importBackup;
$('#scoreboardImage').onchange=selectScanFiles;
$('#ocrGame').onchange=()=>{if(scanFiles.length===1){scanFiles[0].game=+$('#ocrGame').value;const select=$('[data-scan-file="0"]');if(select)select.value=$('#ocrGame').value}};
$('#cancelScanBtn').onclick=cancelScan;$('#undoScanBtn').onclick=undoLastScan;$('#ocrReviewGame').onchange=()=>chooseScanReview($('#ocrReviewGame').value);$('#rememberOrderBtn').onclick=rememberBowlerOrder;$('#handicapForm').onsubmit=saveHandicapSettings;$('#saveFrameReview').onclick=saveFrameReview;$('#closeFrameReview').onclick=()=>{$('#frameReviewDialog').close();frameReview=null};$('#frameReviewDialog').addEventListener('cancel',()=>frameReview=null);
$('#saveScoreChanges').onclick=saveScoreChanges;$('#cancelScoreChanges').onclick=()=>closeSavedScoreEditor();$('#savedScoreDialog').addEventListener('cancel',event=>{event.preventDefault();closeSavedScoreEditor()});
$('#nightDate').value=localToday();
$('#sessionType').onchange=changeSession;$('#practiceBowler').onchange=changeSession;$('#practiceHistoryBowler').onchange=renderPracticeHistory;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').classList.remove('hidden')});$('#installBtn').onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#installBtn').classList.add('hidden')}};
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
window.bowlingCloud={
 payload:()=>JSON.stringify({version:1,seasons:state.seasons}),
 hasDraft:()=>[...sessionDrafts.values()].some(d=>d.games.some(g=>g.bowlers.some(b=>b.absent||b.totalOnly||b.frames.some(Boolean))))||!!savedScoreEdit||!!nightDraft?.games.some(g=>g.bowlers.some(b=>b.absent||b.totalOnly||b.frames.some(Boolean))),
 local:()=>JSON.parse(localStorage.getItem(STORE_KEY)||JSON.stringify(blankState())),
 scope:userId=>{activeStoreKey=userId?STORE_KEY+'.account.'+userId:STORE_KEY;try{const accountData=localStorage.getItem(activeStoreKey);const originalData=localStorage.getItem(STORE_KEY);const original=originalData?JSON.parse(originalData):null;state=accountData?JSON.parse(accountData):(userId&&Array.isArray(original?.seasons)&&original.seasons.length?cloneData(original):blankState());if(!Array.isArray(state?.seasons))state=blankState();if(!state.selected)state.selected=blankState().selected;}catch{state=blankState()}nightDraft=null;sessionDrafts.clear();renderAll()},
 replace:payload=>{const data=JSON.parse(payload);if(!Array.isArray(data.seasons))throw Error('Invalid cloud data');state={version:1,seasons:data.seasons,selected:state.selected||blankState().selected};nightDraft=null;sessionDrafts.clear();localStorage.setItem(activeStoreKey,JSON.stringify(state));renderAll()},
 backup:()=>{localStorage.setItem(activeStoreKey+'.beforeCloudReplace',JSON.stringify(state));exportBackup()}
};
renderAll();


let progressResizeTimer;window.addEventListener('resize',()=>{clearTimeout(progressResizeTimer);progressResizeTimer=setTimeout(renderBowlerProgress,120)});






