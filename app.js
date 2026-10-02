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
function blankGames(team){return [1,2,3].map(game=>({game,bowlers:team.bowlers.map(b=>({bowlerId:b.id,name:b.name,frames:Array(10).fill('')}))}))}
let nightDraft=null;
function ensureDraft(){const t=currentTeam();if(!t){nightDraft=null;return}if(!nightDraft||nightDraft.teamId!==t.id){nightDraft={teamId:t.id,games:blankGames(t)}}else{for(const g of nightDraft.games){g.bowlers=t.bowlers.map(b=>g.bowlers.find(x=>x.bowlerId===b.id)||{bowlerId:b.id,name:b.name,frames:Array(10).fill('')})}}}
function renderScoreSheet(){ensureDraft();const el=$('#scoreSheet');const t=currentTeam(); if(!t){el.innerHTML='<div class="empty">Select a team first.</div>';return}if(!t.bowlers.length){el.innerHTML='<div class="empty">Add bowlers to this team first.</div>';return}
  el.innerHTML=nightDraft.games.map(g=>`<div class="game-block"><div class="game-heading"><h3>Game ${g.game}</h3><span class="muted">${g.bowlers.length} bowlers</span></div><table class="score-table"><thead><tr><th>Bowler</th>${Array.from({length:10},(_,i)=>`<th>${i+1}</th>`).join('')}<th>Total</th></tr></thead><tbody>${g.bowlers.map(b=>`<tr><td class="name-cell">${esc(b.name)}</td>${b.frames.map((f,i)=>`<td><input class="frame-input ${i===9?'tenth':''}" data-game="${g.game}" data-bowler="${b.bowlerId}" data-frame="${i}" value="${esc(f)}" maxlength="4" inputmode="text" autocomplete="off" spellcheck="false" aria-label="${esc(b.name)}, game ${g.game}, frame ${i+1}"></td>`).join('')}<td class="score-total" data-total="${g.game}:${b.bowlerId}">—</td></tr>`).join('')}</tbody></table></div>`).join('');
  $$('.frame-input').forEach(inp=>{inp.addEventListener('input',e=>{const g=nightDraft.games.find(x=>x.game===+inp.dataset.game);const b=g.bowlers.find(x=>x.bowlerId===inp.dataset.bowler);b.frames[+inp.dataset.frame]=normalizeFrame(inp.value);inp.value=b.frames[+inp.dataset.frame];updateTotals()});inp.addEventListener('focus',()=>inp.select())});updateTotals()}
function updateTotals(){if(!nightDraft)return;let valid=0,total=0;for(const g of nightDraft.games){for(const b of g.bowlers){total++;const s=bowlingScore(b.frames);const el=document.querySelector(`[data-total="${g.game}:${b.bowlerId}"]`);if(el){el.textContent=s??'—';el.classList.toggle('valid',s!=null);el.classList.toggle('invalid',s==null&&b.frames.some(Boolean))}if(s!=null)valid++}}$('#nightValidation').textContent=`${valid} of ${total} bowler games complete and valid.`}
function saveNight(){const t=currentTeam();if(!t||!nightDraft)return toast('Select a team');const entries=[];for(const g of nightDraft.games){for(const b of g.bowlers){const score=bowlingScore(b.frames);if(score==null)return toast(`Finish or correct Game ${g.game} for ${b.name}`);entries.push({game:g.game,bowlerId:b.bowlerId,name:b.name,frames:[...b.frames],score})}}
  t.nights.push({id:uid(),date:$('#nightDate').value||new Date().toISOString().slice(0,10),createdAt:new Date().toISOString(),entries});t.nights.sort((a,b)=>a.date.localeCompare(b.date));nightDraft={teamId:t.id,games:blankGames(t)};persist();toast(bestNightNotice(t,t.nights.find(n=>n.entries===entries))||'League night saved')}
function dashboardBowlers(t){
 const byId=new Map((t?.bowlers||[]).map(b=>[b.id,{id:b.id,name:b.name}]));
 for(const n of t?.nights||[])for(const e of n.entries)if(!byId.has(e.bowlerId))byId.set(e.bowlerId,{id:e.bowlerId,name:e.name});
 return [...byId.values()];
}
function statsForTeam(t,bowlerId=null){
 const nights=(t?.nights||[]).map(n=>({...n,entries:n.entries.filter(e=>!bowlerId||e.bowlerId===bowlerId)})).filter(n=>n.entries.length);
 const entries=nights.flatMap(n=>n.entries),scores=entries.map(e=>e.score),series=[];
 let strikes=0,spares=0,opens=0,frames=0;
 for(const n of nights){
  const by=new Map();
  for(const e of n.entries){if(!by.has(e.bowlerId))by.set(e.bowlerId,[]);by.get(e.bowlerId).push(e);}
  for(const games of by.values())if(games.length===3&&new Set(games.map(e=>e.game)).size===3)series.push(games.reduce((a,e)=>a+e.score,0));
 }
 for(const e of entries)for(let i=0;i<10;i++){
  const rolls=parseFrame(e.frames?.[i],i);if(!rolls)continue;
  frames++;if(rolls[0]===10)strikes++;else if(rolls[0]+rolls[1]===10)spares++;else opens++;
 }
 const average=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
 return {entries,nights,games:scores.length,avg:average(scores),high:scores.length?Math.max(...scores):null,
 highSeries:series.length?Math.max(...series):null,avgSeries:average(series),strikes,spares,opens,frames,
 gameAverages:[1,2,3].map(game=>average(entries.filter(e=>e.game===game).map(e=>e.score)))};
}
function renderBowlerProgress(){
 const root=$('#bowlerProgress'),team=currentTeam(),id=state.selected.bowlerId;
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
 root.innerHTML='<p class="muted small">'+esc(bowler.name)+' · '+games.length+' games · Selected season, league and team</p><div class="progress-legend"><span><i class="progress-score-key"></i>Game score</span><span><i class="progress-average-key"></i>Season average: '+avg.toFixed(1)+'</span></div><svg class="progress-chart" viewBox="0 0 '+w+' '+h+'" role="group" aria-label="'+esc(bowler.name)+' game scores in date order, from 0 to 300. Season average '+avg.toFixed(1)+'">'+ticks+'<line class="progress-average" x1="'+left+'" x2="'+right+'" y1="'+y(avg)+'" y2="'+y(avg)+'"/><polyline class="progress-line" points="'+games.map((g,i)=>x(i)+','+y(g.score)).join(' ')+'"/>'+games.map((g,i)=>'<g class="progress-point" role="button" tabindex="0" data-progress-game="'+i+'" aria-label="'+esc(formatDate(g.date))+', game '+g.game+', score '+g.score+'"><circle class="progress-hit" cx="'+x(i)+'" cy="'+y(g.score)+'" r="14"/><circle class="progress-dot" cx="'+x(i)+'" cy="'+y(g.score)+'" r="4"/></g>').join('')+labels+'<text x="'+((left+right)/2)+'" y="256" text-anchor="middle">Games in date order</text></svg><p id="progressDetail" class="progress-detail" aria-live="polite"></p><details class="progress-data"><summary>View all game scores</summary><table><thead><tr><th>Date</th><th>Game</th><th>Score</th></tr></thead><tbody>'+games.map(g=>'<tr><td>'+esc(formatDate(g.date))+'</td><td>'+g.game+'</td><td>'+g.score+'</td></tr>').join('')+'</tbody></table></details>';
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
 const root=$('#personalBests'),team=currentTeam(),bowler=dashboardBowlers(team).find(b=>b.id===state.selected.bowlerId);
 if(!bowler){root.innerHTML='<div class="empty">Choose a bowler above to see their personal bests.</div>';return}
 const records=personalBestData(team,bowler.id);
 root.innerHTML='<p class="muted small">'+esc(bowler.name)+' · Selected season, league and team</p><div class="best-grid">'+[['High game',records.highGame],['High series',records.highSeries]].map(([label,record])=>'<div class="best-trophy"><span class="best-label">🏆 '+label+'</span><strong>'+ (record?.score??'—')+'</strong><span>'+(record?esc(formatDate(record.date))+(record.game?' · Game '+record.game:' · 3 games'):'No '+(label==='High game'?'saved games':'complete three-game series')+' yet')+'</span></div>').join('')+'</div><p class="muted small">New records are highlighted in History. Ties keep the original record date.</p>';
}
function bestNightNotice(team,night){
 const previous={...team,nights:team.nights.filter(n=>n.id!==night.id)},notices=[];
 for(const id of new Set(night.entries.map(e=>e.bowlerId))){
  const entries=night.entries.filter(e=>e.bowlerId===id),prior=personalBestData(previous,id),name=entries[0].name;
  const high=Math.max(...entries.map(e=>e.score));
  if(prior.highGame&&high>prior.highGame.score)notices.push(name+': new high game '+high);
  if(entries.length===3&&new Set(entries.map(e=>e.game)).size===3&&entries.every(e=>[1,2,3].includes(e.game))){const sum=entries.reduce((a,e)=>a+e.score,0);if(prior.highSeries&&sum>prior.highSeries.score)notices.push(name+': new high series '+sum)}
 }
 return notices.length?'🏆 '+notices.join(' · '):null;
}

function renderDashboard(){
 const s=currentSeason(),l=currentLeague(),t=currentTeam(),bowlers=dashboardBowlers(t);
 if(!bowlers.some(b=>b.id===state.selected.bowlerId))state.selected.bowlerId=null;
 const id=state.selected.bowlerId,bowler=bowlers.find(b=>b.id===id);
 bindSelect($('#dashboardBowlerSelect'),bowlers,id,v=>{state.selected.bowlerId=v;persist()},'All team bowlers');
 $('#dashboardBowlerSelect').disabled=!bowlers.length;
 $('#dashTitle').textContent=bowler?bowler.name+' — '+t.name:t?t.name+' — '+l.name:'No team selected';
 $('#dashSubtitle').textContent=s?s.name+' season'+(bowler?' · '+l.name:'')+' · '+(bowler?'Individual bowler statistics':'All team bowlers'):'Create a season, league, and team to get started.';
 $('#downloadBowlerPdfBtn').disabled=!bowler||!statsForTeam(t,id).games;
 $('#shareBowlerPdfBtn').disabled=$('#downloadBowlerPdfBtn').disabled;
 const st=statsForTeam(t,id),decimal=value=>value===null?'—':value.toFixed(1);
 const cards=items=>items.map(([label,value])=>'<div class="stat"><div class="value">'+value+'</div><div class="label">'+label+'</div></div>').join('');
 $('#statCards').innerHTML=cards([['Games',st.games],['Average',decimal(st.avg)],['High Game',st.high??'—'],['High Series',st.highSeries??'—']]);
 $('#bowlerStatCards').innerHTML=cards([['Average Series',decimal(st.avgSeries)],['Strikes',st.strikes],['Spares',st.spares],['Open Frames',st.opens]]);
 $('#gameAverageSummary').textContent=st.games?st.gameAverages.map((avg,i)=>'Game '+(i+1)+' average: '+decimal(avg)).join(' · ')+(st.frames?' · Strike rate: '+(100*st.strikes/st.frames).toFixed(1)+'% · Spare conversion: '+(st.frames>st.strikes?(100*st.spares/(st.frames-st.strikes)).toFixed(1)+'%':'—'):''):'Save a league night to see statistics.';
 renderPersonalBests();
 renderBowlerProgress();
 $('#recentNightsTitle').textContent=bowler?'Games & series history':'Recent league nights';
 const nights=[...st.nights].sort((a,b)=>b.date.localeCompare(a.date));
 if(bowler){
  $('#recentNights').innerHTML=nights.length?'<div class="history-grid"><div>Date</div><div>G1</div><div>G2</div><div>G3</div><div>Series</div>'+nights.map(n=>{
   const games=[1,2,3].map(g=>n.entries.find(e=>e.game===g)?.score);
   return '<div>'+formatDate(n.date)+'</div>'+games.map(score=>'<div>'+(score??'—')+'</div>').join('')+'<div><strong>'+(games.every(score=>score!==undefined)?games.reduce((a,b)=>a+b,0):'—')+'</strong></div>';
  }).join('')+'</div>':'<div class="empty">No saved games for this bowler in the selected season, league and team.</div>';
 }else{
  $('#recentNights').innerHTML=nights.length?nights.slice(0,5).map(n=>'<div class="recent-item"><span>'+formatDate(n.date)+'</span><strong>'+n.entries.length+' games logged</strong></div>').join(''):'<div class="empty">No league nights saved yet.</div>';
 }
 const highs=st.nights.flatMap(n=>n.entries.map(e=>({...e,date:n.date}))).sort((a,b)=>b.score-a.score).slice(0,5);
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
 const team=currentTeam(),night=team?.nights.find(n=>n.id===nightId);if(!night)return;
 savedScoreEdit={teamId:team.id,nightId:night.id,originalEntries:JSON.stringify(night.entries),entries:JSON.parse(JSON.stringify(night.entries))};
 $('#savedScoreTitle').textContent='Edit scores · '+formatDate(night.date);
 $('#savedScoreBody').innerHTML=[...new Set(savedScoreEdit.entries.map(e=>e.game))].sort((a,b)=>a-b).map(game=>'<section class="saved-game"><h3>Game '+game+'</h3>'+savedScoreEdit.entries.map((entry,index)=>{
  if(entry.game!==game)return '';
  entry.frames=Array.from({length:10},(_,frame)=>String(entry.frames?.[frame]||''));
  return '<div class="saved-bowler"><div class="saved-bowler-heading"><strong>'+esc(entry.name)+'</strong><span data-saved-total="'+index+'"></span></div><div class="saved-frames">'+entry.frames.map((mark,frame)=>'<label><span>'+ (frame+1)+'</span><input class="saved-frame-input" data-saved-entry="'+index+'" data-saved-frame="'+frame+'" value="'+esc(mark)+'" maxlength="4" autocomplete="off" spellcheck="false" aria-label="'+esc(entry.name)+', game '+game+', frame '+(frame+1)+'"></label>').join('')+'</div><p class="muted small" data-saved-error="'+index+'"></p></div>';
 }).join('')+'</section>').join('');
 $$('[data-saved-entry]').forEach(input=>input.oninput=()=>{const entry=savedScoreEdit.entries[+input.dataset.savedEntry];input.value=normalizeFrame(input.value);entry.frames[+input.dataset.savedFrame]=input.value;updateSavedScoreTotals()});
 updateSavedScoreTotals();$('#savedScoreDialog').showModal();
}
function updateSavedScoreTotals(){
 if(!savedScoreEdit)return;
 let invalid=0;
 savedScoreEdit.entries.forEach((entry,index)=>{
  const score=bowlingScore(entry.frames),total=$('[data-saved-total="'+index+'"]'),error=$('[data-saved-error="'+index+'"]');
  total.textContent='Total: '+(score??'—');total.classList.toggle('invalid',score===null);
  error.textContent=score===null?'Finish or correct the frames for this game.':'';
  $$('[data-saved-entry="'+index+'"]').forEach(input=>input.setAttribute('aria-invalid',String(parseFrame(entry.frames[+input.dataset.savedFrame],+input.dataset.savedFrame)===null)));
  if(score===null)invalid++;
 });
 $('#saveScoreChanges').disabled=invalid>0;
 $('#savedScoreStatus').textContent=invalid?invalid+' game'+(invalid===1?' needs':'s need')+' corrected frames before saving.':'All game scores are valid. Ready to save.';
}
function saveScoreChanges(){
 if(!savedScoreEdit)return;
 const team=currentTeam(),night=team?.nights.find(n=>n.id===savedScoreEdit.nightId);
 if(team?.id!==savedScoreEdit.teamId||!night||JSON.stringify(night.entries)!==savedScoreEdit.originalEntries){
  $('#savedScoreStatus').textContent='This saved night changed. Cancel and reopen Edit Scores to load the latest copy.';return;
 }
 const entries=savedScoreEdit.entries.map(entry=>({...entry,frames:[...entry.frames],score:bowlingScore(entry.frames)}));
 if(entries.some(entry=>entry.score===null)){updateSavedScoreTotals();return;}
 night.entries=entries;night.editedAt=new Date().toISOString();
 closeSavedScoreEditor(true);persist();toast('Saved scores updated');
}

function isValidNightDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+'T12:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value}
function renderHistory(){const t=currentTeam();const el=$('#historyList');if(!t||!t.nights.length){el.innerHTML='<div class="empty">No saved league nights for this team.</div>';return}el.innerHTML=[...t.nights].sort((a,b)=>b.date.localeCompare(a.date)).map(n=>{const ids=[...new Set(n.entries.map(e=>e.bowlerId))];const rows=ids.map(id=>{const es=n.entries.filter(e=>e.bowlerId===id).sort((a,b)=>a.game-b.game);const sum=es.reduce((a,b)=>a+b.score,0);const marks=personalBestData(t,id).achievements.get(n.id)||[];return `<div>${esc(es[0]?.name||'')}${marks.map(m=>`<span class="best-badge">🏆 ${m.first?(m.kind==='game'?'First high game':'First high series'):m.kind==='game'?'New high game':'New high series'}: ${m.score}${m.game?' · G'+m.game:''}</span>`).join('')}</div>${[1,2,3].map(g=>`<div>${es.find(e=>e.game===g)?.score??'—'}</div>`).join('')}<div><strong>${sum}</strong></div>`}).join('');return `<div class="history-night"><div class="history-head wrap"><strong>${formatDate(n.date)}</strong><div class="row wrap"><button class="ghost icon-btn" data-edit-scores="${esc(n.id)}">Edit Scores</button><button class="ghost icon-btn" data-edit-night="${esc(n.id)}" aria-expanded="false" aria-controls="date-editor-${esc(n.id)}">Edit Date</button><button class="ghost danger icon-btn" data-delete-night="${n.id}">Delete</button></div></div><form id="date-editor-${esc(n.id)}" class="hidden" data-date-editor="${esc(n.id)}" style="padding:.8rem"><label for="saved-date-${esc(n.id)}">League night date<input id="saved-date-${esc(n.id)}" type="date" value="${esc(n.date)}" required></label><div class="row wrap"><button class="primary" type="submit">Save Date</button><button class="ghost" type="button" data-cancel-date="${esc(n.id)}">Cancel</button></div></form><div class="history-grid"><div>Bowler</div><div>G1</div><div>G2</div><div>G3</div><div>Series</div>${rows}</div></div>`}).join('');$$('[data-edit-scores]').forEach(btn=>btn.onclick=()=>openSavedScoreEditor(btn.dataset.editScores));$$('[data-edit-night]').forEach(btn=>btn.onclick=()=>{const form=document.getElementById('date-editor-'+btn.dataset.editNight);const opening=form.classList.contains('hidden');form.classList.toggle('hidden',!opening);btn.setAttribute('aria-expanded',String(opening));if(opening)form.querySelector('input').focus()});
$$('[data-cancel-date]').forEach(btn=>btn.onclick=()=>{const form=btn.closest('form');form.classList.add('hidden');const edit=$$('[data-edit-night]').find(b=>b.dataset.editNight===btn.dataset.cancelDate);edit.setAttribute('aria-expanded','false');form.querySelector('input').value=t.nights.find(n=>n.id===btn.dataset.cancelDate).date;edit.focus()});
$$('[data-date-editor]').forEach(form=>form.onsubmit=e=>{e.preventDefault();const value=form.querySelector('input').value;if(!isValidNightDate(value))return toast('Choose a valid league night date');const night=t.nights.find(n=>n.id===form.dataset.dateEditor);if(!night)return;night.date=value;t.nights.sort((a,b)=>a.date.localeCompare(b.date));persist();toast('League night date updated')});
$$('[data-delete-night]').forEach(btn=>btn.onclick=()=>{if(confirm('Delete this league night?')){t.nights=t.nights.filter(n=>n.id!==btn.dataset.deleteNight);persist();toast('League night deleted')}})}
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
function adjustScoreboardPixels(data,brightness,contrast){
 const out=new Uint8ClampedArray(data);
 for(let i=0;i<out.length;i+=4)for(let k=0;k<3;k++)out[i+k]=Math.max(0,Math.min(255,(out[i+k]-128)*contrast+128+brightness));
 return out;
}
function refreshPhotoAdjustments(){
 const b=+$('#ocrBrightness').value,c=+$('#ocrContrast').value;
 $('#brightnessValue').textContent=(b>=0?'+':'')+b;
 $('#contrastValue').textContent=c.toFixed(2)+'×';
 // CSS brightness is only a preview approximation; OCR uses the numeric pixel adjustment.
 $('#imagePreview').style.filter='contrast('+c+') brightness('+(1+b/128)+')';
 ocrResult=null;$('#applyOcrBtn').disabled=true;$('#ocrDetails').classList.add('hidden');
 $('#ocrStatus').textContent='Photo settings changed. Click Read Scoreboard to retry.';
}

async function prepareScoreboard(file,enhance,preserveSize=false){
 const url=URL.createObjectURL(file),img=new Image();
 try{
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('This photo format could not be opened. Please upload a JPG or PNG.'));img.src=url;});
  const canvas=document.createElement('canvas');
  const scale=Math.min(preserveSize?1:2,3200/Math.max(img.naturalWidth,img.naturalHeight));
  canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);
  const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
  const brightness=+$('#ocrBrightness').value,contrast=+$('#ocrContrast').value;
  if(brightness!==0||contrast!==1){const image=ctx.getImageData(0,0,canvas.width,canvas.height);image.data.set(adjustScoreboardPixels(image.data,brightness,contrast));ctx.putImageData(image,0,0);}
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

const SPLIT_FONT=[{"char":"6","features":"fd9632224555568afe8521124677789bfd8410037abccdddfd8410048bdeeffefd8410149cfffffffd8400149dfffffffd8300048ceffffffd7300026accdffffd73000258aacdeefd83000135789bcdfd830000246679bcfd830000245668abfd8300003555568afd8300003566567afd83000146666679fd83000147776679fd83000147886679fd83000147886579fd83000146776569fd83000135665569fd84000024554469fd94000024444469fe9631001222347affa743112223358a004abbaa99889aae005cccbbabaaccbe106cedbdffffffef105bddbcfffefede005bccbcfffffede004accbdfffffdee004abbacfffffdef004abcbcffffffff004abcbceedeffff004accacddcdeefe0049bcaccdcddeef0049bcbbcccccddf004accbbddccdddf004abccceeeeedef004accccfffeeeef004acdcdfffeeeef0049ddbcfeefedef005adcccefeeeddf005bccccefeeecdf005bccbcefefeddf005adcbcdfefeddf005adcbbeeeedcdf005cccabcccccbcf106cdccbcccccbdf"},{"char":"7","features":"cba6432000000001cbb8664310000002dcccbbaa73000002dddddddc95100002dddeeeeda5100002cdeffffeb6210003cdeffffeb6210013cdeffffea5210124cdeffffc84110135ddefffeb73110245ddefffda63111356ddefedb852222467dddedc7522336898ddddba5322458aaaddcb98522357abbadcca86311479cdcbccb96520259adedccca7420027bdfffdcba6320027cefffdcba6320038defffdcba5210038dffffddb95210048dffffdcba6431259deffeccbb744336adeffdb001dcba87899aaae002feddcbaaaabaf002feedefecbbbcf001eeeddffbbbabf001eddccfebababf001ddcccefbabbbf002edccdefcbbbbf002eddddfecbbbbf001eeddefdbbbbcf001eddefecbbbcdf001edeffcabbcdff001eeefebabbceff001fefebbbccefff001fffdbabdeefff001fffdabceefeef101fffcaadffddde101ffebaaeffccce101fcbbaafedcbcd100ecbbaafecccce000ecbbaafecbccd000ecbaabfdcbccd000fcbaacfeccccd100ecbaacfdcdcde100feeccdfeddcdd"},{"char":"7","features":"cba8542000000000cbb9764320000000ccddccba85200000cddeeedca7310000cdeffffdc8430000cdefffffd9540000cdefffffea640000ceffffffd9530001ceffffffc8420002cefffffeb7420013cefffffc96321134ceffffeb85332246cdefeda754334588cdeedc9533334699cdedcb74333468aadddca95323568abbdddb97421367accbddc965201489ceebdcc85310159adfecdcb74200259beffcccb7420026acfffcccb7431136bcfffcccb8543357bcffebccb8654458bcefeb0003aaa8999988890007ededddccbbbc0007ffeffffecbce1006ffdefffecbbd1007feddeffecbbd1007eeddeffebbbc1007eeddeffeabbb1007feedefecaabc1007ffeefedcaabd1006efeefedcaace1006eeefedcbaacf1005eeeeedcbabdf1005efeecbcccdef1006ffedcbccefef1006ffecbbcdffee1006fedcbbeeffee1007fecbbcefffee1007fecbbdffedef1007fecbbdffedef1007edccceffddef1006edccceffddef1007feccceffdeee1006feeddfffddee1007fffeefffedef"},{"char":"7","features":"cbba763100000000cccb875310000000ddddcba864210000cddddddb96320001cddeffedb8420001dddeffffd9530001cddeffffea630001cdefffffeb640001cdeeffffda631002cdeeffffd9531012cddefffeb8431123cddeffec97431235cddeedb864333568dddddca743334689ddddcb953234689addddba7422457abbdddca95212469cdcddcc97310257befeddcb86200258cffedccb86200268cfffdccb86200269dffedccb86200279dffedccb8631248aeffedccb8743358adffe00006765577787880001ceca9aaababb0001efeedefebcbd1000dfdddefecbbc1000dedcdefecbbc1000dedddefecbbc1001deddcdedbbac1001deeedfedbbbb1000efeeefecabab1000deefffdcabbc1001dfefffcbabbd1001effffebaabce1002ffffdcbbcdef0001fffdbbbcdfff0000fffcabbcdfee1001ffdcbbcdefed1001ffdcbbdeffed0001ffcbcceffddd1001ffccccffedcd1000efbcccffedcc1000efcbbbffddcc1100efccbbffdccc1100ffcbacffdccd1100efdbbdfedccd"},{"char":"7","features":"ba86332100000004bb97543200000014cccba98631000014cdddcba852000025cdefeec963000025ceffffeb74100135cefffffc84210135cefffffc95211246cefffffb74221357ceffffea63223467ceffffd953334578ceffed9642345789cdca985323569aaacdb966422367abbaccb853223579bccacca63212369bdddbcb95210247aceedbbb73000159ceffdbba7200015adeffdbba7200015aefffdbba6200016aefffebba7300025aefffdbba8532146aefffebba8643358adeffeb0048889aa998878d008bccecccccbabe00aeeefffccccbbf009ddcdffddccbcf009dcccefedccbcf009ccccdffdccbcf009cccccffcccbcf009dddbdffcccccf00addddefddccbdf009ddddffdcdccef00adddefdccccdff00addeffcccbceff00bfffdcbcbcdeef00bfffcbbcbceeee00bffebbbddddcee00cfedbcceeedcde00dfccbcdffecbdf00debbcbffedccdf00deabdcffdccdef01deabcbfedcddef01debcccffecddef01eebbbdffecdeee03ffdcdefffeedee03ffeeeeffeeddef"},{"char":"8","features":"ffb743233323349dffa532123221238dffa521123311127cffa521134311127cffa511135421127cffa510135421127cffa400135421127cff9300012110016cff9300011100016cff9300000000026cff9300000000026cff9300000000026cff9310011100027cff9310122200027cff9410234310027cff9410245421027dfe9411356521027dfe9411356521027dff9411256520028eff9410245420028eff9410134310038eff940012210014aeffa52123321146cfffb74334543358df008cbababbcbaaef008cccbbbbccbaef008ccbbcdeccbbef009ccbbeffdcbbff009ccbbfffedbbff009ccccfffedcbff009dcccfffedcbff00addccefecdcbff00adcbccddcccaff009dcbcccccccaff009cccccdccdcaff009ccccdcccccaff00accccccccdcaff00accccdddddcaff009cccceeeedcbef009cccceeeedcbff019ccccffeedcbff009ccbcdeeeddaef009bbbbdeddccbff009bbbbdeedccaff00ababbeedcccaef009cbbbefeccbaef00abbcccccccbdff00bdccbccddcbeff"},{"char":"7","features":"cca8520000000000dcb9742100000000eedca97653000001eeedcba985200001eeeeedcba7400001eeefffedc8510002eeefffffd9510002eeefffffea510013eeefffffd9500024eeeffffec8400135eeeffffca6300245eeefffeb95212356eeeeeca762235788eeeddb8542247899deddc96432368abadddca8532247accadddc96321259cddbddca7310137ceffcddca6310138cfffcedc96200038dfffcedc96200149dfffcedc9520015aefffcedc9642236adfffcedca754447adeffc0003cccbbaaab9ac0007eefefddddcce1007ffffffedeccd1007efeeffeddcbd1107eeddefedccbc1007edddeeecbbbc1007edccdeecbbab1008edccdeebccbd1008eccddfdbbbbd1008dccdeecbbbbd1007eddeeecbbbce1007fddeedbcccdf1008fffedbbcdeef1008fffdcbbceeff1008ffdccbbdeeff1009ffcbbccefeef1009febbbcceeddf1008fcbbbcefeddf1008fbbcccffeddf1008ebabbcffeddf1009fcbbbcffeddf1008fbbbcceffede1008fbbddefffedf1008fdceefffffff"},{"char":"7","features":"cca8654321000000dcb9875432000000ddccbaa975210000dddddccca8420000ddeeeefeca530000ddefffffeb641000edeffffffc741000edefffffeb640001eeefffffda530001eeefffffc9420002edeffffeb8320013edefffec96310124edeeddb853212367edddcc9642223578edddba853123589aeddca963213469bbeddc985211468bdcedcb86311268bffeedca75201369dffeedca75201379dfffedca6510148adfffedca6520248adfffedca7632359bdffeedcb874456abdffe2002ab98988999880000ffdcccbccbbb1000fffeffedcbbb1101fffefffecbbb1001ffedeefeabbb1001ffdddeeeabba1001ffddddddaabb1001ffddcdddbcbc1001ffdddeedbbbc1001ffdddeddbcbb1000eeddeeccbccb1000efdeedcccccc1000efffdcbbceef1000efffdbbbceef1000efddccccdfee1000efdcbcddeffe1000efcbabdeffed0000debaacefffee0000eebaadfffeee1000eebaadfffeee0000efbbadfffeed0000dfbbadfffede1010dfcbcefffeee1000efdccfffffff"}];
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

function readDigitalGrid(data,w,h,adjusted=false){
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
 if(!columns&&!adjusted)return readDigitalGrid(straightenDigitalGrid(data,w,h),w,h,true);
 if(!columns)throw new Error('Grid not found. Photograph the full digital scoreboard grid straight on with all frame columns visible. Try standard OCR for other displays.');
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
    let n=0;for(let y=y0;y<y1;y++)if(glyphLit(x,y))n++;
    if(n){if(!runs.length||x>runs.at(-1).at(-1)+1)runs.push([x]);else runs.at(-1).push(x);}
   }
   let marks='',uncertain=false;
   for(const run of runs){
    if(run.length<=8*scale)continue;
    const a=run[0],b=run.at(-1)+1;let c=y1,d=y0;
    for(let y=y0;y<y1;y++)for(let x=a;x<b;x++)if(glyphLit(x,y)){c=Math.min(c,y);d=Math.max(d,y+1);}
    if(d<=c)continue;
    let mask='';
    for(let yy=0;yy<24;yy++)for(let xx=0;xx<16;xx++)mask+=glyphLit(Math.min(b-1,a+Math.floor((xx+.5)*(b-a)/16)),Math.min(d-1,c+Math.floor((yy+.5)*(d-c)/24)))?'1':'0';
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
   let mark=!uncertain&&parseFrame(marks,f)!==null?marks:'';
   if(pink&&f<9&&!mark){
    const first=readSplitFirstRoll(data,w,h,frameEdges[f+1],top);
    const second=first?readSplitSecondRoll(data,w,frameEdges[f+1],top):null;
    const candidate=first&&second?first+second:'';
    if(candidate&&parseFrame(candidate,f)!==null)mark=candidate;
   }
   frames.push(mark);
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
   const original=await prepareScoreboard(file,false,true),ctx=original.getContext('2d');
   let pixels=ctx.getImageData(0,0,original.width,original.height).data;
   let rows=readDigitalGrid(pixels,original.width,original.height);
   if(rows.some(r=>r.frames.some(f=>!f))){
    $('#ocrStatus').textContent='Retrying faint marks with extra contrast…';
    try{
     const retry=readDigitalGrid(adjustScoreboardPixels(pixels,0,1.25),original.width,original.height);
     if(retry.length===rows.length)rows=rows.map((r,ri)=>({...r,frames:r.frames.map((f,fi)=>{
      const other=retry[ri].frames[fi];return f&&other&&f!==other?'':f||other||'';
     })}));
    }catch(e){/* Keep the original reading when extra contrast hides grid lines. */}
   }
   if(currentTeam()?.id!==teamId)throw new Error('The selected team changed. Read this photo again.');
   ocrResult={text:'Digital grid reader: check all marks. Highlighted first-ball marks are read separately. Verify all detected values.',rows,teamId,game};
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
function bowlerPdfData(){
 const team=currentTeam(),id=state.selected.bowlerId,bowler=dashboardBowlers(team).find(b=>b.id===id);
 if(!bowler)throw new Error('Choose an individual bowler on the dashboard first.');
 const stats=statsForTeam(team,id);
 if(!stats.games)throw new Error('Save a league night for this bowler before exporting.');
 return {bowler:bowler.name,season:currentSeason().name,league:currentLeague().name,team:team.name,stats,generated:new Date()};
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
 paragraph('Team: '+model.team);
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
  if(y+23>BOTTOM){newPage();tableHead(['Date','Game 1','Game 2','Game 3','Series'],summaryWidths);}
  const scores=[1,2,3].map(g=>n.entries.find(e=>e.game===g)?.score);
  tableRow([date(n.date),...scores.map(v=>v??'-'),scores.every(v=>v!==undefined)?scores.reduce((a,b)=>a+b,0):'-'],summaryWidths);
 }
 section('Frame-by-frame game details',160);
 const frameWidths=[38,...Array(10).fill(44),50];
 for(const n of nights){
  room(125);y+=6;label('',11,true);doc.text(date(n.date),M,y);y+=13;
  tableHead(['Game',...Array.from({length:10},(_,i)=>String(i+1)),'Total'],frameWidths);
  for(const game of [1,2,3]){
   const entry=n.entries.find(e=>e.game===game);
   tableRow([game,...Array.from({length:10},(_,i)=>entry?.frames?.[i]||'-'),entry?.score??'-'],frameWidths,23);
  }y+=12;
 }
 const pageCount=doc.getNumberOfPages();
 for(let p=1;p<=pageCount;p++){
  doc.setPage(p);doc.setDrawColor(219,225,233);doc.line(M,754,M+W,754);
  label('',8,false,[100,111,130]);doc.text('StrikeScan / Generated '+model.generated.toLocaleDateString(),M,769);
  doc.text('Page '+p+' of '+pageCount,M+W,769,{align:'right'});
 }
 doc.setProperties({title:clean(model.bowler)+' - Bowling Stats and Games',subject:'Bowler statistics and frame-by-frame league game details',author:'StrikeScan'});
 return doc;
}
function bowlerPdfFilename(model){
 const safe=value=>String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9_-]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'Bowler';
 return safe(model.bowler)+'-'+safe(model.season)+'-Bowling-Report.pdf';
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
function importBackup(){const f=$('#importFile').files[0];if(!f)return toast('Choose a backup file');const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(reader.result);if(!data.seasons)throw new Error('Invalid');if(confirm('Replace current bowling data with this backup?')){state=data;nightDraft=null;persist();toast('Backup imported')}}catch{toast('That file is not a valid bowling backup')}};reader.readAsText(f)}
function clearNight(){const t=currentTeam();if(!t)return;if(confirm('Clear the current unsaved score sheet?')){nightDraft={teamId:t.id,games:blankGames(t)};renderScoreSheet()}}
function renderNightHeader(){const s=currentSeason(),l=currentLeague(),t=currentTeam();$('#nightSelection').textContent=t?`${s.name} · ${l.name} · ${t.name}`:'Choose a league and team'}
function renderAll(){ensureSelection();renderSelectors();renderBowlers();renderDashboard();renderHistory();renderNightHeader();renderScoreSheet()}
function showView(name){$$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));$$('.tab').forEach(t=>t.classList.toggle('active',t.dataset.view===name));window.scrollTo({top:0,behavior:'smooth'})}
$$('.tab').forEach(b=>b.onclick=()=>showView(b.dataset.view));$$('[data-go]').forEach(b=>b.onclick=()=>showView(b.dataset.go));
$('#downloadBowlerPdfBtn').onclick=downloadBowlerPdf;
$('#shareBowlerPdfBtn').onclick=shareBowlerPdf;
$('#addSeasonBtn').onclick=addSeason;$('#addLeagueBtn').onclick=addLeague;$('#addTeamBtn').onclick=addTeam;$('#addBowlerBtn').onclick=addBowler;$('#saveNightBtn').onclick=saveNight;$('#clearNightBtn').onclick=clearNight;$('#runOcrBtn').onclick=runOcr;$('#applyOcrBtn').onclick=applyOcr;$('#exportBtn').onclick=exportBackup;$('#importBtn').onclick=importBackup;
$('#scoreboardImage').onchange=()=>{const f=$('#scoreboardImage').files[0];if(!f)return;$('#imagePreview').src=URL.createObjectURL(f);$('#imagePreviewWrap').classList.remove('hidden');ocrResult=null;$('#applyOcrBtn').disabled=true;$('#ocrDetails').classList.add('hidden')};
$('#ocrBrightness').oninput=refreshPhotoAdjustments;
$('#ocrContrast').oninput=refreshPhotoAdjustments;
$('#resetPhotoAdjustments').onclick=()=>{$('#ocrBrightness').value='0';$('#ocrContrast').value='1';refreshPhotoAdjustments();};
$('#saveScoreChanges').onclick=saveScoreChanges;$('#cancelScoreChanges').onclick=()=>closeSavedScoreEditor();$('#savedScoreDialog').addEventListener('cancel',event=>{event.preventDefault();closeSavedScoreEditor()});
$('#nightDate').value=new Date().toISOString().slice(0,10);
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').classList.remove('hidden')});$('#installBtn').onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#installBtn').classList.add('hidden')}};
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
window.bowlingCloud={
 payload:()=>JSON.stringify({version:1,seasons:state.seasons}),
 hasDraft:()=>!!savedScoreEdit||!!nightDraft?.games.some(g=>g.bowlers.some(b=>b.frames.some(Boolean))),
 local:()=>JSON.parse(localStorage.getItem(STORE_KEY)||JSON.stringify(blankState())),
 scope:userId=>{activeStoreKey=userId?STORE_KEY+'.account.'+userId:STORE_KEY;try{state=JSON.parse(localStorage.getItem(activeStoreKey))||blankState()}catch{state=blankState()}nightDraft=null;renderAll()},
 replace:payload=>{const data=JSON.parse(payload);if(!Array.isArray(data.seasons))throw Error('Invalid cloud data');state={version:1,seasons:data.seasons,selected:state.selected||blankState().selected};nightDraft=null;localStorage.setItem(activeStoreKey,JSON.stringify(state));renderAll()},
 backup:()=>{localStorage.setItem(activeStoreKey+'.beforeCloudReplace',JSON.stringify(state));exportBackup()}
};
renderAll();


let progressResizeTimer;window.addEventListener('resize',()=>{clearTimeout(progressResizeTimer);progressResizeTimer=setTimeout(renderBowlerProgress,120)});
