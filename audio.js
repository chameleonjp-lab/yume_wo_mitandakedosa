/* Synthesized effects only; audio failures never control gameplay. */
(function (global) {
  'use strict';
  const KEY='yume_mitandakedosa_audio_v1';
  const events=Object.freeze({
    select:[520,0.045,1],cancel:[280,0.05,1],start:[660,0.12,3],
    countdown:[440,0.05,2],hit:[110,0.12,5],break:[760,0.055,2],
    satellite:[980,0.09,3],pickup:[880,0.08,3],miss:[180,0.08,3],
    warning:[600,0.06,4],clear:[1040,0.18,6],retire:[260,0.12,6],best:[1320,0.16,6]
  });
  function createAudio({storage,createContext,now}) {
    let enabled=true,volume=0.3,context=null,hidden=false,lastGesture=null;
    const voices=new Set(),last=new Map();
    try {
      const saved=JSON.parse(storage.getItem(KEY));
      if(saved && typeof saved.enabled==='boolean' && typeof saved.volume==='number' && Number.isFinite(saved.volume) && saved.volume>=0 && saved.volume<=1){enabled=saved.enabled;volume=saved.volume;}
    } catch (_) {}
    function dispose(voice) {
      if(!voice)return;
      if(voice.osc){try{voice.osc.stop();}catch(_){}try{voice.osc.disconnect();}catch(_){}}
      if(voice.gain){try{voice.gain.disconnect();}catch(_){}}
      voices.delete(voice);
    }
    function stop() {
      for(const voice of [...voices])dispose(voice);
      voices.clear();last.clear();
    }
    function save(){try{storage.setItem(KEY,JSON.stringify({enabled,volume}));return true;}catch(_){return false;}}
    function setEnabled(value){enabled=Boolean(value);if(!enabled)stop();return save();}
    function setVolume(value){if(typeof value!=='number'||!Number.isFinite(value))return false;volume=Math.max(0,Math.min(1,value));if(volume===0)stop();return save();}
    function gesture(token){
      if(token!==undefined&&token===lastGesture)return;
      if(token!==undefined)lastGesture=token;
      if(!enabled||volume===0||hidden)return;
      try{
        if(!context)context=createContext();
        // Every fresh user gesture may retry a suspended context, even if an older resume never settled.
        if(context.state!=='running')Promise.resolve(context.resume()).catch(()=>{});
      }catch(_){}
    }
    function play(event){
      const spec=events[event];
      if(!spec||!enabled||volume===0||hidden||!context||context.state!=='running')return false;
      const time=now();if(time-(last.get(event)??-Infinity)<100)return false;
      for(const voice of voices)if(voice.priority>spec[2])return false;
      if(voices.size>=4)return false;
      let voice={osc:null,gain:null,priority:spec[2]};
      try{
        const osc=context.createOscillator();voice.osc=osc;
        const gain=context.createGain();voice.gain=gain;
        osc.type=event==='hit'||event==='miss'?'triangle':'sine';osc.frequency.setValueAtTime(spec[0],context.currentTime);
        gain.gain.setValueAtTime(0,context.currentTime);
        gain.gain.linearRampToValueAtTime(volume*0.06,context.currentTime+0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001,context.currentTime+spec[1]);
        osc.connect(gain);gain.connect(context.destination);
        voices.add(voice);
        osc.onended=()=>{voices.delete(voice);try{osc.disconnect();}catch(_){}try{gain.disconnect();}catch(_){}};
        osc.start();osc.stop(context.currentTime+spec[1]+0.01);last.set(event,time);return true;
      }catch(_){dispose(voice);return false;}
    }
    function visibility(value){hidden=Boolean(value);if(hidden){stop();try{if(context)Promise.resolve(context.suspend()).catch(()=>{});}catch(_){}}}
    return Object.freeze({gesture,play,setEnabled,setVolume,visibility,stop,getState:()=>({enabled,volume})});
  }
  global.YumeAudio=Object.freeze({createAudio,events});
})(globalThis);
