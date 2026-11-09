import {initializeApp} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {getAuth,signInAnonymously,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import {getDatabase,ref,push,update,serverTimestamp} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";

const firebaseConfig=window.ABITECH_CONFIG.firebase;

const app=initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getDatabase(app);

let resolveReady,rejectReady;
window.firebaseReady=new Promise((resolve,reject)=>{
 resolveReady=resolve;
 rejectReady=reject;
});

function makeApi(user){
 return {
  uid:user.uid,
  async createLead(data){
   const leadRef=push(ref(db,`leads/${user.uid}`));
   await update(leadRef,{
    ...data,
    anonymousUid:user.uid,
    createdAt:serverTimestamp(),
    updatedAt:serverTimestamp()
   });
   return leadRef.key;
  },
  async updateLead(leadId,data){
   if(!leadId)throw new Error("Missing lead ID");
   await update(ref(db,`leads/${user.uid}/${leadId}`),{
    ...data,
    updatedAt:serverTimestamp()
   });
  },
  serverTime(){
   return serverTimestamp();
  }
 };
}

let settled=false;
onAuthStateChanged(auth,user=>{
 if(user && !settled){
  settled=true;
  const api=makeApi(user);
  window.abbieFirebase=api;
  window.abbieFirebaseReady=true;
  resolveReady(api);
  window.dispatchEvent(new CustomEvent("abbie-firebase-ready"));
 }
});

signInAnonymously(auth).catch(err=>{
 console.error("Firebase anonymous authentication failed:",err);
 window.abbieFirebaseError=err;
 window.dispatchEvent(new CustomEvent("abbie-firebase-error",{detail:{message:err?.message||String(err)}}));
 if(!settled){settled=true;rejectReady(err)}
});
