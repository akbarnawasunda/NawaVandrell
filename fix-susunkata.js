const fs = require('fs');
const path = require('path');
const dir = 'data/games';
function shuffle(arr){
  let a=[...arr];
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  // pastikan gak balik jadi word asli
  return a;
}
fs.readdirSync(dir).filter(f=>f.startsWith('susunkata')).forEach(file=>{
  const fp = path.join(dir,file);
  let txt = fs.readFileSync(fp,'utf8');
  let changed=false;
  txt = txt.replace(/{[^}]*word:\s*'([^']+)'[^}]*scrambled:\s*'([^']+)'[^}]*}/g, (m, word, scr)=>{
    const cleanWord = word.replace(/[^A-Z]/gi,'').toUpperCase();
    const cleanScr = scr.replace(/-/g,'');
    if(cleanWord === cleanScr){ // gak diacak
      const letters = cleanWord.split('');
      let sh = shuffle(letters);
      let tries=0;
      while(sh.join('')===cleanWord && tries<10){ sh=shuffle(letters); tries++; }
      const newScr = sh.join('-');
      changed=true;
      return m.replace(scr, newScr);
    }
    return m;
  });
  if(changed){
    fs.writeFileSync(fp, txt);
    console.log('fixed', file);
  }
});
console.log('done');
