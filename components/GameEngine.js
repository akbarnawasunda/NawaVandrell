'use client';
import { useEffect, useRef, useState } from 'react';
import GameShell from '@/components/GameShell';
import { usePlayer } from '@/hooks/usePlayer';
import { useToast } from '@/context/ToastContext';
import Icon from '@/components/icons';

const TIME_LIMIT = { easy: 20, medium: 25, hard: 30 };
const BASE_POINT = { easy: 10, medium: 20, hard: 30 };
const TEXT_SUBMIT = ['angkaenigma', 'mathrush', 'emojistory'];
function norm(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,''); }

export default function GameEngine({ game }){
  const { addToast } = useToast();
  const player = usePlayer();
<<<<<<< HEAD
  const [displayName,setDisplayName]=useState('Game');
  const [phase,setPhase]=useState('pick');
  const [diff,setDiff]=useState('easy');
  const [item,setItem]=useState(null);
  const [answer,setAnswer]=useState('');
  const [timeLeft,setTimeLeft]=useState(0);
  const [result,setResult]=useState(null);
  const [hintShown,setHintShown]=useState(false);
  const [lastPts,setLastPts]=useState(0);
  const [score,setScore]=useState(0);
  const [streak,setStreak]=useState(0);
  const [tally,setTally]=useState({correct:0,total:0});
  const [taps,setTaps]=useState([]);
  const [built,setBuilt]=useState([]);
  const excludeRef=useRef([]); const lockRef=useRef(false);
  const builtRef=useRef([]);

  useEffect(()=>{
    fetch('/api/games?list=1&_t='+Date.now(),{cache:'no-store'}).then(r=>r.json()).then(list=>{
      const found=(Array.isArray(list)?list:[]).find(c=>c.slug===game);
      if(found) setDisplayName(found.name);
    }).catch(()=>{});
  },[game]);

  const nextItem=async(d)=>{
    lockRef.current=false; builtRef.current=[];
=======
  const [displayName, setDisplayName] = useState('Game');
  const [phase, setPhase] = useState('pick');
  const [diff, setDiff] = useState('easy');
  const [item, setItem] = useState(null);
  const [answer, setAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [result, setResult] = useState(null);
  const [hintShown, setHintShown] = useState(false);
  const [lastPts, setLastPts] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [tally, setTally] = useState({ correct: 0, total: 0 });
  const [taps, setTaps] = useState([]);
  const [built, setBuilt] = useState([]);
  const excludeRef = useRef([]);
  const lockRef = useRef(false);
  const builtRef = useRef([]);

  useEffect(() => {
    fetch('/api/games?list=1&_t=' + Date.now(), { cache: 'no-store' })
     .then((r) => r.json())
     .then((list) => {
        const found = (Array.isArray(list)? list : []).find((c) => c.slug === game);
        if (found) setDisplayName(found.name);
      })
     .catch(() => {});
  }, [game]);

  const nextItem = async (d) => {
    lockRef.current = false;
    builtRef.current = [];
>>>>>>> 035799c69e283fab67e8d25f073249cc9f5599a5
    setPhase('loading');
    try{
      const ex=excludeRef.current.slice(-60).join(',');
      const res=await fetch(`/api/games?cat=${game}&diff=${d}&exclude=${ex}&_t=${Date.now()}`,{cache:'no-store'});
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const it=await res.json();
      excludeRef.current.push(it.id);
<<<<<<< HEAD
      setItem(it); setAnswer(''); setResult(null); setHintShown(false); setTaps([]); setBuilt([]);
      setPhase(game==='memorymatrix'?'display':'play');
    }catch(err){ addToast(`Gagal: ${err.message}`,'error'); setPhase('pick'); }
  };

  useEffect(()=>{ if(phase!=='display') return; const t=setTimeout(()=>setPhase('play'),2000); return()=>clearTimeout(t); },[phase]);
  useEffect(()=>{
    if(phase!=='play'||!item) return;
    const limit=item.timeLimit||TIME_LIMIT[diff]||20; setTimeLeft(limit);
    const t=setInterval(()=>setTimeLeft(s=>Math.max(0,s-1)),1000); return()=>clearInterval(t);
  },[phase,item,diff]);
  useEffect(()=>{ if(phase==='play'&&timeLeft===0&&item) settle('timeout'); },[timeLeft,phase]);

  const checkAnswer=(userAns)=>{
    if(!item) return false;
    const ans=item.answer||item.a||item.word||item.w;
    if(ans && norm(userAns)===norm(ans)) return true;
    if(item.alt && item.alt.some(x=>norm(x)===norm(userAns))) return true;
    return false;
  };

  const settle=(outcome,userAns)=>{
    if(lockRef.current) return; lockRef.current=true;
    let ok=outcome==='correct';
    if(outcome==='auto') ok=checkAnswer(userAns);
    setResult(ok?'correct':outcome==='auto'?'wrong':outcome);
    setPhase('reveal');
    setTally(s=>({correct:s.correct+(ok?1:0),total:s.total+1}));
    if(ok){
      const bonus=hintShown?0:timeLeft;
      const pts=(BASE_POINT[diff]||10)+bonus;
      setLastPts(pts); setScore(s=>s+pts); setStreak(k=>k+1); player.addScore(pts);
      addToast(`BENAR! +${pts} poin`,'success');
    }else{ setStreak(0); }
  };

  const submitText=()=>{ if(!answer.trim()||phase!=='play') return; settle('auto',answer); };
  const pickOption=(opt)=>{ if(phase!=='play') return; settle('auto',opt); };
  const tapCell=(idx)=>{
    if(phase!=='play'||game!=='memorymatrix') return;
    setTaps(prev=>{
      if(prev.includes(idx)) return prev;
      const newTaps=[...prev,idx];
      const pattern=item.pattern||[];
      for(let i=0;i<newTaps.length;i++){ if(newTaps[i]!==pattern[i]){ setTimeout(()=>settle('wrong'),0); return newTaps; } }
      if(newTaps.length===pattern.length) setTimeout(()=>settle('correct'),0);
      return newTaps;
    });
  };
  const tapTile=(i)=>{
    if(phase!=='play'||game!=='susunkata') return;
    if(builtRef.current.includes(i)) return;
    const newBuilt=[...builtRef.current,i];
    builtRef.current=newBuilt;
    setBuilt(newBuilt);
    const letters=(item.scrambled||'').split('-');
    const word=newBuilt.map(x=>letters[x]).join('');
    if(word.length===letters.length) setTimeout(()=>settle('auto',word),30);
  };

  const limit=(item&&item.timeLimit)||TIME_LIMIT[diff]||20;
  const pct=Math.round((timeLeft/limit)*100);
  const barColor=pct>50?'var(--accent,#6366f1)':pct>25?'#fbbf24':'#f87171';

  const renderBody=()=>{
    if(!item) return null;
    switch(game){
      case 'angkaenigma': return <><p className="game-prompt">{(item.sequence||[]).join(', ')},...?</p><input className="input" value={answer} onChange={e=>setAnswer(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submitText()} placeholder="Angka selanjutnya..." autoFocus inputMode="numeric"/></>;
      case 'mathrush': return <><p className="game-prompt">{item.question} =?</p><input className="input" value={answer} onChange={e=>setAnswer(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submitText()} placeholder="Jawaban..." autoFocus inputMode="numeric"/></>;
      case 'emojistory': return <><p className="game-emoji">{item.emojis}</p><input className="input" value={answer} onChange={e=>setAnswer(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submitText()} placeholder="Judul / jawaban..." autoFocus/></>;
      case 'typingblitz': return <><p className="game-prompt">{item.word}</p><input className="input" value={answer} onChange={e=>{setAnswer(e.target.value); if(norm(e.target.value)===norm(item.word)) settle('auto',e.target.value);}} placeholder="Ketik kata di atas..." autoFocus/></>;
      case 'katasambung': return <><p className="game-prompt" style={{fontSize:16}}>{item.sentence}</p><div className="opt-grid">{(item.options||[]).map(opt=><button key={opt} type="button" className="btn btn-ghost" onClick={()=>pickOption(opt)}>{opt}</button>)}</div></>;
      case 'memorymatrix': { const [rows,cols]=(item.gridSize||'3x3').split('x').map(Number); const cells=[]; for(let i=1;i<=rows*cols;i++) cells.push(i); return <><p className="hint" style={{textAlign:'center'}}>{phase==='display'?'Ingat pola yang menyala...':'Tap kotak sesuai urutan!'}</p><div className="mm-grid" style={{gridTemplateColumns:`repeat(${cols},1fr)`}}>{cells.map(c=>{const lit=phase==='display'&&(item.pattern||[]).includes(c); const tapped=taps.includes(c); return <button key={c} type="button" className={`mm-cell ${lit?'lit':''} ${tapped?'tapped':''}`} onClick={()=>tapCell(c)}/>;})}</div></>; }
      case 'susunkata': { const letters=(item.scrambled||'').split('-'); const word=built.map(x=>letters[x]).join(''); return <><p className="game-prompt" style={{fontSize:22, letterSpacing:3}}>{word||'...'}</p><div className="tile-row">{letters.map((l,i)=><button key={i} type="button" className={`tile ${built.includes(i)?'used':''}`} onClick={()=>tapTile(i)}>{l}</button>)}</div><button type="button" className="btn btn-ghost" onClick={()=>{builtRef.current=[]; setBuilt([]);}}>Reset</button></>; }
      default: return <p className="hint">Game belum didukung</p>;
    }
  };

  return(
    <GameShell title={displayName} desc="Main sebelum waktu habis." icon="gamepad" slug={game} stats={[{label:'skor sesi',value:score},{label:'streak',value:streak},{label:'benar',value:`${tally.correct}/${tally.total}`}]}>
      {phase==='pick'?(<div className="panel"><p className="label" style={{marginBottom:10}}>Pilih tingkat kesulitan</p><div style={{display:'grid',gap:9}}>{['easy','medium','hard'].map(d=><button key={d} type="button" className="btn btn-ghost btn-full" onClick={()=>{setDiff(d); nextItem(d);}}>{d.toUpperCase()} · {TIME_LIMIT[d]}s · base {BASE_POINT[d]} poin</button>)}</div></div>):null}
      {phase==='loading'?(<div className="panel"><p className="hint">Ngambil soal...</p></div>):null}
      {(phase==='display'||phase==='play')&&item?(
        <div className="panel">
          {phase==='play'?(<><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}><span className="label">{diff} · sisa</span><strong style={{color:barColor,fontSize:18}}>{timeLeft}s</strong></div><div className="quiz-timer"><div className="quiz-timer-fill" style={{width:`${pct}%`,background:barColor}}/></div></>):null}
          {renderBody()}
          <div className="btn-row" style={{marginTop:12}}>
            {phase==='play'&&TEXT_SUBMIT.includes(game)?(<button type="button" className="btn btn-primary" onClick={submitText}><Icon name="check" size={16}/> Kunci</button>):null}
            {!hintShown&&item.hint?(<button type="button" className="btn btn-ghost" onClick={()=>setHintShown(true)}>Petunjuk</button>):null}
            <button type="button" className="btn btn-ghost" onClick={()=>settle('nyerah')}>Nyerah</button>
          </div>
          {hintShown&&item.hint?<p className="hint" style={{marginTop:10}}>Petunjuk: {item.hint} (bonus waktu hangus)</p>:null}
        </div>
      ):null}
      {phase==='reveal'?(
        <div className="panel">
          <p style={{fontWeight:800,fontSize:18,marginBottom:8,color:result==='correct'?'var(--accent-soft)':'#f87171'}}>{result==='correct'?`BENAR! +${lastPts} poin`:result==='timeout'?'WAKTU HABIS!':result==='nyerah'?'MENYERAH!':'SALAH!'}</p>
          <p style={{marginBottom:6}}>Jawaban: <strong style={{color:'var(--accent-soft)'}}>{item.answer||item.a||item.word}</strong></p>
          {item.hint?<p className="hint" style={{marginBottom:14}}>{item.hint}</p>:null}
          <div style={{display:'grid',gap:9}}>
            <button type="button" className="btn btn-primary btn-full" onClick={()=>nextItem(diff)}>Soal Berikutnya</button>
            <button type="button" className="btn btn-ghost btn-full" onClick={()=>{lockRef.current=false; setPhase('pick');}}>Ganti Kesulitan</button>
=======
      setItem(it);
      setAnswer('');
      setResult(null);
      setHintShown(false);
      setTaps([]);
      setBuilt([]);
      setPhase(game === 'memorymatrix'? 'display' : 'play');
    } catch (err) {
      addToast(`Gagal: ${err.message}`, 'error');
      setPhase('pick');
    }
  };

  useEffect(() => {
    if (phase!== 'display') return;
    const t = setTimeout(() => setPhase('play'), 2000);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase!== 'play' ||!item) return;
    const limit = item.timeLimit || TIME_LIMIT[diff] || 20;
    setTimeLeft(limit);
    const t = setInterval(() => setTimeLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [phase, item, diff]);

  useEffect(() => {
    if (phase === 'play' && timeLeft === 0 && item) settle('timeout');
  }, [timeLeft, phase]);

  const checkAnswer = (userAns) => {
    if (!item) return false;
    const ans = item.answer || item.a || item.word || item.w;
    if (ans && norm(userAns) === norm(ans)) return true;
    if (item.alt && item.alt.some((x) => norm(x) === norm(userAns))) return true;
    return false;
  };

  const settle = (outcome, userAns) => {
    if (lockRef.current) return;
    lockRef.current = true;
    let ok = outcome === 'correct';
    if (outcome === 'auto') ok = checkAnswer(userAns);
    setResult(ok? 'correct' : outcome === 'auto'? 'wrong' : outcome);
    setPhase('reveal');
    setTally((s) => ({ correct: s.correct + (ok? 1 : 0), total: s.total + 1 }));
    if (ok) {
      const bonus = hintShown? 0 : timeLeft;
      const pts = (BASE_POINT[diff] || 10) + bonus;
      setLastPts(pts);
      setScore((s) => s + pts);
      setStreak((k) => k + 1);
      player.addScore(pts);
      addToast(`BENAR! +${pts} poin`, 'success');
    } else {
      setStreak(0);
    }
  };

  const submitText = () => {
    if (!answer.trim() || phase!== 'play') return;
    settle('auto', answer);
  };

  const pickOption = (opt) => {
    if (phase!== 'play') return;
    settle('auto', opt);
  };

  const tapCell = (idx) => {
    if (phase!== 'play' || game!== 'memorymatrix') return;
    setTaps(prev => {
      if (prev.includes(idx)) return prev;
      const newTaps = [...prev, idx];
      const pattern = item.pattern || [];
      for (let i = 0; i < newTaps.length; i++) {
        if (newTaps[i]!== pattern[i]) { setTimeout(()=>settle('wrong'),0); return newTaps; }
      }
      if (newTaps.length === pattern.length) setTimeout(()=>settle('correct'),0);
      return newTaps;
    });
  };

  const tapTile = (i) => {
    if (phase!== 'play' || game!== 'susunkata') return;
    if (builtRef.current.includes(i)) return;
    const newBuilt = [...builtRef.current, i];
    builtRef.current = newBuilt;
    setBuilt(newBuilt);
    const letters = (item.scrambled || '').split('-');
    const word = newBuilt.map((x) => letters[x]).join('');
    if (word.length === letters.length) {
      setTimeout(()=>settle('auto', word), 30);
    }
  };

  const limit = (item && item.timeLimit) || TIME_LIMIT[diff] || 20;
  const pct = Math.round((timeLeft / limit) * 100);
  const barColor = pct > 50? 'var(--accent,#6366f1)' : pct > 25? '#fbbf24' : '#f87171';

  const renderBody = () => {
    if (!item) return null;
    switch (game) {
      case 'angkaenigma':
        return <><p className="game-prompt">{(item.sequence || []).join(', ')},...?</p><input className="input" value={answer} onChange={(e) => setAnswer(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitText()} placeholder="Angka selanjutnya..." autoFocus inputMode="numeric" /></>;
      case 'mathrush':
        return <><p className="game-prompt">{item.question} =?</p><input className="input" value={answer} onChange={(e) => setAnswer(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitText()} placeholder="Jawaban..." autoFocus inputMode="numeric" /></>;
      case 'emojistory':
        return <><p className="game-emoji">{item.emojis}</p><input className="input" value={answer} onChange={(e) => setAnswer(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitText()} placeholder="Judul / jawaban..." autoFocus /></>;
      case 'typingblitz':
        return <><p className="game-prompt">{item.word}</p><input className="input" value={answer} onChange={(e) => { setAnswer(e.target.value); if (norm(e.target.value) === norm(item.word)) settle('auto', e.target.value); }} placeholder="Ketik kata di atas..." autoFocus /></>;
      case 'katasambung':
        return <><p className="game-prompt" style={{ fontSize: 16 }}>{item.sentence}</p><div className="opt-grid">{(item.options || []).map((opt) => (<button key={opt} type="button" className="btn btn-ghost" onClick={() => pickOption(opt)}>{opt}</button>))}</div></>;
      case 'memorymatrix': {
        const [rows, cols] = (item.gridSize || '3x3').split('x').map(Number);
        const cells = [];
        for (let i = 1; i <= rows * cols; i++) cells.push(i);
        return <><p className="hint" style={{ textAlign: 'center' }}>{phase === 'display'? 'Ingat pola yang menyala...' : 'Tap kotak sesuai urutan!'}</p><div className="mm-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>{cells.map((c) => { const lit = phase === 'display' && (item.pattern || []).includes(c); const tapped = taps.includes(c); return <button key={c} type="button" className={`mm-cell ${lit? 'lit' : ''} ${tapped? 'tapped' : ''}`} onClick={() => tapCell(c)} />; })}</div></>;
      }
      case 'susunkata': {
        const letters = (item.scrambled || '').split('-');
        const word = built.map((x) => letters[x]).join('');
        return <><p className="game-prompt" style={{fontSize:22, letterSpacing:3}}>{word || '...'}</p><div className="tile-row">{letters.map((l, i) => (<button key={i} type="button" className={`tile ${built.includes(i)? 'used' : ''}`} onClick={() => tapTile(i)}>{l}</button>))}</div><button type="button" className="btn btn-ghost" onClick={() => { builtRef.current=[]; setBuilt([]); }}>Reset</button></>;
      }
      default:
        return <p className="hint">Game belum didukung</p>;
    }
  };

  return (
    <GameShell title={displayName} desc="Main sebelum waktu habis." icon="gamepad" slug={game}
      stats={[{ label: 'skor sesi', value: score },{ label: 'streak', value: streak },{ label: 'benar', value: `${tally.correct}/${tally.total}` }]}>
      {phase === 'pick'? (<div className="panel"><p className="label" style={{ marginBottom: 10 }}>Pilih tingkat kesulitan</p><div style={{ display: 'grid', gap: 9 }}>{['easy', 'medium', 'hard'].map((d) => (<button key={d} type="button" className="btn btn-ghost btn-full" onClick={() => { setDiff(d); nextItem(d); }}>{d.toUpperCase()} · {TIME_LIMIT[d]}s · base {BASE_POINT[d]} poin</button>))}</div></div>) : null}
      {phase === 'loading'? (<div className="panel"><p className="hint">Ngambil soal...</p></div>) : null}
      {(phase === 'display' || phase === 'play') && item? (
        <div className="panel">
          {phase === 'play'? (<><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}><span className="label">{diff} · sisa</span><strong style={{ color: barColor, fontSize: 18 }}>{timeLeft}s</strong></div><div className="quiz-timer"><div className="quiz-timer-fill" style={{ width: `${pct}%`, background: barColor }} /></div></>) : null}
          {renderBody()}
          <div className="btn-row" style={{ marginTop: 12 }}>
            {phase === 'play' && TEXT_SUBMIT.includes(game)? (<button type="button" className="btn btn-primary" onClick={submitText}><Icon name="check" size={16} /> Kunci</button>) : null}
            {!hintShown && item.hint? (<button type="button" className="btn btn-ghost" onClick={() => setHintShown(true)}>Petunjuk</button>) : null}
            <button type="button" className="btn btn-ghost" onClick={() => settle('nyerah')}>Nyerah</button>
          </div>
          {hintShown && item.hint? <p className="hint" style={{ marginTop: 10 }}>Petunjuk: {item.hint} (bonus waktu hangus)</p> : null}
        </div>
      ) : null}
      {phase === 'reveal'? (
        <div className="panel">
          <p style={{ fontWeight: 800, fontSize: 18, marginBottom: 8, color: result === 'correct'? 'var(--accent-soft)' : '#f87171' }}>{result === 'correct'? `BENAR! +${lastPts} poin` : result === 'timeout'? 'WAKTU HABIS!' : result === 'nyerah'? 'MENYERAH!' : 'SALAH!'}</p>
          <p style={{ marginBottom: 6 }}>Jawaban: <strong style={{ color: 'var(--accent-soft)' }}>{item.answer || item.a || item.word}</strong></p>
          {item.hint? <p className="hint" style={{ marginBottom: 14 }}>{item.hint}</p> : null}
          <div style={{ display: 'grid', gap: 9 }}>
            <button type="button" className="btn btn-primary btn-full" onClick={() => nextItem(diff)}>Soal Berikutnya</button>
            <button type="button" className="btn btn-ghost btn-full" onClick={() => { lockRef.current = false; setPhase('pick'); }}>Ganti Kesulitan</button>
>>>>>>> 035799c69e283fab67e8d25f073249cc9f5599a5
          </div>
        </div>
      ):null}
    </GameShell>
  );
}
