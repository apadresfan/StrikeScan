import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,signOut,sendPasswordResetEmail} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {getFirestore,doc,onSnapshot,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const firebaseConfig={apiKey:'AIzaSyAEIOlRPRYHlwI6V_kM5zQwAgJYoaqD7jE',authDomain:'strikescan-b14c1.firebaseapp.com',projectId:'strikescan-b14c1',storageBucket:'strikescan-b14c1.firebasestorage.app',messagingSenderId:'426833380651',appId:'1:426833380651:web:dc4feff3b32d3ea7c4716e'};
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const bridge=window.bowlingCloud,el=id=>document.getElementById(id);
let user=null,unsubscribe=null,remote=null,received=false,busy=false,timer=null,epoch=0;
let meta={revision:0,baseline:null};
const metaKey=()=> 'strikescan.cloud.'+user.uid;
const dirty=()=>bridge.payload()!==meta.baseline;
function saveMeta(){if(user)localStorage.setItem(metaKey(),JSON.stringify(meta))}
function status(message){el('cloudStatus').textContent=message}
function conflict(show){el('cloudConflict').classList.toggle('hidden',!show)}
function errorMessage(error){
 const code=error.code||'';
 if(code.includes('operation-not-allowed')||code.includes('configuration-not-found'))return 'Enable Email/Password in Firebase Authentication, then try again.';
 if(code.includes('permission-denied'))return 'Cloud access is blocked. Publish the StrikeScan Firestore rules, then press Sync now.';
 if(code.includes('invalid-credential')||code.includes('wrong-password')||code.includes('user-not-found'))return 'The email or password was not accepted.';
 if(code.includes('email-already-in-use'))return 'That email already has an account. Use Sign in instead.';
 if(code.includes('weak-password'))return 'Choose a password with at least 6 characters.';
 if(code.includes('invalid-email'))return 'Enter a valid email address.';
 if(code.includes('too-many-requests'))return 'Too many attempts. Please try again later.';
 if(code.includes('unavailable')||code.includes('network-request-failed'))return 'Offline or cloud unavailable. Your saved changes are kept on this device. Try Sync now when connected.';
 return 'Cloud could not finish: '+(error.message||'Please try again.');
}
function reconcile(){
 if(!user||!received||busy)return;
 if(!remote){
  if(dirty())schedule();else status('Connected. Save a league night or upload your existing scores.');
  return;
 }
 if(remote.revision===meta.revision){
  if(dirty())schedule();else {conflict(false);status('Synced across your devices.');}
  return;
 }
 if(remote.payload===bridge.payload()){
  meta={revision:remote.revision,baseline:remote.payload};saveMeta();conflict(false);status('Synced across your devices.');return;
 }
 if(dirty()||bridge.hasDraft()){
  conflict(true);status('Another device has newer scores. Choose which copy to keep below.');return;
 }
 try{bridge.replace(remote.payload);meta={revision:remote.revision,baseline:remote.payload};saveMeta();conflict(false);status('Latest scores downloaded from the cloud.');}
 catch(error){status(errorMessage(error))}
}
function listen(){
 if(unsubscribe)unsubscribe();received=false;remote=null;
 const generation=epoch;
 unsubscribe=onSnapshot(doc(db,'users',user.uid,'bowling','state'),{includeMetadataChanges:true},snapshot=>{
  if(generation!==epoch||snapshot.metadata.fromCache)return;
  received=true;remote=snapshot.exists()?snapshot.data():null;reconcile();
 },error=>{if(generation===epoch)status(errorMessage(error))});
}
function schedule(){clearTimeout(timer);timer=setTimeout(()=>sync(),700)}
async function sync(){
 if(!user)return status('Sign in to sync your saved games.');
 if(!navigator.onLine)return status('Offline. Saved changes will sync when you reconnect.');
 if(!received){status('Connecting to your cloud scores…');listen();return;}
 if(busy)return;
 if(remote&&remote.revision!==meta.revision){reconcile();return;}
 if(!dirty())return reconcile();
 const payload=bridge.payload(),expected=meta.revision,generation=epoch,owner=user.uid;
 if(new TextEncoder().encode(payload).length>900000)return status('This scorebook is too large to sync. Download a backup and contact us to expand cloud storage.');
 busy=true;status('Syncing saved scores…');
 try{
  const revision=await runTransaction(db,async transaction=>{
   const ref=doc(db,'users',owner,'bowling','state'),snapshot=await transaction.get(ref);
   const current=snapshot.exists()?snapshot.data().revision:0;
   if(current!==expected){const error=Error('Cloud changed');error.code='sync/conflict';throw error;}
   transaction.set(ref,{payload,revision:current+1,updatedAt:serverTimestamp()});return current+1;
  });
  if(generation!==epoch)return;
  meta={revision,baseline:payload};saveMeta();
  if(!remote||remote.revision<=revision)remote={payload,revision};conflict(false);status(dirty()?'More saved changes waiting to sync…':'Synced across your devices.');
 }catch(error){
  if(generation!==epoch)return;
  if(error.code==='sync/conflict'){conflict(true);status('Another device saved scores first. Choose a copy below.');listen();}
  else status(errorMessage(error));
 }finally{if(generation===epoch){busy=false;if(remote&&remote.revision!==meta.revision)reconcile();else if(dirty()&&navigator.onLine&&meta.baseline===payload)schedule();}}
}
async function authenticate(create){
 if(bridge.hasDraft()&&!confirm('Signing in changes scorebooks. Discard the unfinished score sheet?'))return;
 const email=el('cloudEmail').value.trim(),password=el('cloudPassword').value;
 if(!email||!password)return status('Enter your email and password.');
 el('cloudSignIn').disabled=el('cloudCreateAccount').disabled=true;status(create?'Creating your account…':'Signing in…');
 try{await (create?createUserWithEmailAndPassword:signInWithEmailAndPassword)(auth,email,password);el('cloudPassword').value='';}
 catch(error){status(errorMessage(error))}
 finally{el('cloudSignIn').disabled=el('cloudCreateAccount').disabled=false}
}
el('cloudSignIn').onclick=()=>authenticate(false);
el('cloudCreateAccount').onclick=()=>authenticate(true);
el('cloudResetPassword').onclick=async()=>{
 const email=el('cloudEmail').value.trim();if(!email)return status('Enter your email first.');
 try{await sendPasswordResetEmail(auth,email);status('Password reset requested. Check your email.')}catch(error){status(errorMessage(error))}
};
el('cloudSignOut').onclick=async()=>{
 if(busy)return status('Wait for syncing to finish before signing out.');
 if((dirty()||bridge.hasDraft())&&!confirm('Some changes are not synced. They stay on this device. Sign out anyway?'))return;
 try{await signOut(auth)}catch(error){status(errorMessage(error))}
};
el('cloudSyncNow').onclick=()=>{if(!received)listen();else sync()};
el('cloudUploadLocal').onclick=()=>{
 if(!received)return status('Wait until the cloud connects before uploading.');
 const data=bridge.local();
 if(!data.seasons?.length)return status('There are no original device scores to upload. Import a backup if needed.');
 if(!confirm('Upload the original scores from this device to your account? This replaces the account’s current scorebook. A backup will download first.'))return;
 bridge.backup();bridge.replace(JSON.stringify({version:1,seasons:data.seasons}));
 meta.revision=remote?.revision||0;saveMeta();conflict(false);schedule();
};
el('cloudUseRemote').onclick=()=>{
 if(!remote)return status('Reconnect with Sync now first.');
 if(!confirm('Use the cloud scorebook instead of this device’s copy? A backup of this device will download first. Unfinished frames will be discarded.'))return;
 bridge.backup();bridge.replace(remote.payload);meta={revision:remote.revision,baseline:remote.payload};saveMeta();conflict(false);status('Cloud scores loaded.');
};
el('cloudKeepDevice').onclick=()=>{
 if(!received)return status('Reconnect with Sync now first.');
 if(!confirm('Replace the cloud scorebook with this device’s saved scores? Other devices will receive this copy.'))return;
 meta.revision=remote?.revision||0;meta.baseline=remote?.payload||null;saveMeta();conflict(false);sync();
};
window.addEventListener('bowling-data-changed',()=>{
 if(user){saveMeta();if(received&&remote&&remote.revision!==meta.revision)reconcile();else schedule();}
});
window.addEventListener('online',()=>{if(user){status('Reconnecting…');listen()}});
window.addEventListener('offline',()=>{if(user)status('Offline. Saved changes stay on this device until you reconnect.')});
onAuthStateChanged(auth,next=>{
 epoch++;clearTimeout(timer);if(unsubscribe)unsubscribe();unsubscribe=null;busy=false;received=false;remote=null;user=next;
 bridge.scope(user?.uid||null);conflict(false);
 el('cloudLogin').classList.toggle('hidden',!!user);el('cloudAccount').classList.toggle('hidden',!user);
 if(!user){status('Sign in to sync. Your original device scores are available while signed out.');return;}
 el('cloudUser').textContent=user.email;
 try{meta=JSON.parse(localStorage.getItem(metaKey()))||{revision:0,baseline:bridge.payload()}}catch{meta={revision:0,baseline:bridge.payload()}}
 status('Connecting to your cloud scores…');listen();
});
