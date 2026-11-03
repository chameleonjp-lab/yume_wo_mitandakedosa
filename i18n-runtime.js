(function(global){
  'use strict';
  const KEY='yume_mitandakedosa_language_v1';
  const languages=Object.freeze([
    ['ja','日本語','ja-JP'],['en','English','en-US'],['es','Español','es-ES'],['pt-BR','Português (Brasil)','pt-BR'],
    ['zh-Hans','简体中文','zh-CN'],['fr','Français','fr-FR'],['de','Deutsch','de-DE'],['ko','한국어','ko-KR'],
    ['ru','Русский','ru-RU'],['it','Italiano','it-IT'],['zh-Hant','繁體中文','zh-TW'],['id','Bahasa Indonesia','id-ID'],
    ['tr','Türkçe','tr-TR'],['vi','Tiếng Việt','vi-VN'],['th','ไทย','th-TH']
  ].map(Object.freeze));
  function fromLocale(input){
    if(typeof input!=='string')return null;
    const parts=input.trim().toLowerCase().replaceAll('_','-').split('-');
    if(parts[0]==='zh'){if(parts.includes('hant'))return 'zh-Hant';if(parts.includes('hans'))return 'zh-Hans';return parts.some(p=>['tw','hk','mo'].includes(p))?'zh-Hant':'zh-Hans';}
    if(parts[0]==='pt')return 'pt-BR';
    return languages.some(l=>l[0]===parts[0])?parts[0]:null;
  }
  function createI18n({dictionary,storage,browserLanguages}){
    let language='en';
    try{const stored=storage.getItem(KEY);if(languages.some(l=>l[0]===stored))language=stored;else language=browserLanguages.map(fromLocale).find(Boolean)||'en';}
    catch(_){language=browserLanguages.map(fromLocale).find(Boolean)||'en';}
    function text(key,values={}){
      const translated=dictionary[language]&&dictionary[language][key];
      const value=typeof translated==='string'?translated:dictionary.en[key];
      if(typeof value!=='string')throw new Error('Unknown translation key: '+key);
      return value.replace(/\{([A-Za-z]+)\}/g,(_,name)=>Object.prototype.hasOwnProperty.call(values,name)?String(values[name]):'{'+name+'}');
    }
    function setLanguage(value){
      if(!languages.some(l=>l[0]===value))return false;
      language=value;
      try{storage.setItem(KEY,value);return true;}catch(_){return false;}
    }
    return Object.freeze({text,setLanguage,getLanguage:()=>language,getLocale:()=>languages.find(l=>l[0]===language)[2]});
  }
  global.YumeI18n=Object.freeze({languages,fromLocale,createI18n});
})(globalThis);
