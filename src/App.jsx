import { useState, useEffect, useRef, useCallback } from "react";

/* ─── Audio ─── */
let _ac = null;
function getCtx() {
  try {
    if (typeof window === "undefined") return null;
    if (!_ac) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; _ac = new A(); }
    if (_ac.state === "suspended") _ac.resume();
    return _ac;
  } catch(_){ return null; }
}
function beep(freq, type, dur, vol) {
  try {
    const ctx = getCtx(); if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = type||"square"; o.frequency.setValueAtTime(freq||440, ctx.currentTime);
    g.gain.setValueAtTime(vol||0.06, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+(dur||0.08));
    o.start(); o.stop(ctx.currentTime+(dur||0.08));
  } catch(_){}
}
const sfxClick  = () => beep(680,"square",0.04,0.03);
const sfxSelect = () => { beep(480,"sine",0.08,0.07); setTimeout(()=>beep(720,"sine",0.12,0.05),80); };
const sfxWhoosh = () => [160,260,420].forEach((f,i)=>setTimeout(()=>beep(f,"sine",0.1,0.04),i*50));
const sfxImpact = () => { beep(55,"sawtooth",0.18,0.08); setTimeout(()=>beep(90,"square",0.1,0.04),60); };
const sfxChime  = () => [528,660,792,1056].forEach((f,i)=>setTimeout(()=>beep(f,"sine",0.3,0.08),i*110));
const sfxBoot   = () => [120,180,240,180,360].forEach((f,i)=>setTimeout(()=>beep(f,"sine",0.14,0.06),i*140));

/* ─── useIsMobile ─── */
function useIsMobile() {
  const [mob, setMob] = useState(false);
  useEffect(() => {
    const check = () => setMob(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return mob;
}

/* ─── useSwipe ─── */
function useSwipe(onLeft, onRight) {
  const startX = useRef(null);
  const startY = useRef(null);
  return {
    onTouchStart: (e) => { startX.current = e.touches[0].clientX; startY.current = e.touches[0].clientY; },
    onTouchEnd: (e) => {
      if (startX.current === null) return;
      const dx = e.changedTouches[0].clientX - startX.current;
      const dy = e.changedTouches[0].clientY - startY.current;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
        if (dx < 0) onLeft(); else onRight();
      }
      startX.current = null; startY.current = null;
    },
  };
}

/* ─── Color palette: okicom blue/teal ─── */
const C = {
  blue:    "#1e40af",
  blueL:   "#3b82f6",
  teal:    "#0891b2",
  tealL:   "#22d3ee",
  amber:   "#d97706",
  amberL:  "#fbbf24",
  danger:  "#dc2626",
  bg:      "#f0f5fb",
  surface: "#ffffff",
  text:    "#0f172a",
  muted:   "#334155",
  dim:     "#64748b",
};

const V  = "'Share Tech Mono',monospace";
const VB = "'Inter','Noto Sans JP',sans-serif";

/* ─── Corners ─── */
function Corners({ color, size, t }) {
  const c = color||C.blue; const sz = size||24; const th = t||2;
  const s = {position:"absolute",width:sz,height:sz};
  const b = th+"px solid "+c;
  return <>
    <div style={{...s,top:0,left:0,borderTop:b,borderLeft:b}}/>
    <div style={{...s,top:0,right:0,borderTop:b,borderRight:b}}/>
    <div style={{...s,bottom:0,left:0,borderBottom:b,borderLeft:b}}/>
    <div style={{...s,bottom:0,right:0,borderBottom:b,borderRight:b}}/>
  </>;
}

/* ─── MiniDots ─── */
function MiniDots({ cur, total }) {
  return (
    <div style={{display:"flex",gap:4,alignItems:"center",flexWrap:"wrap",justifyContent:"center"}}>
      {Array.from({length:total}).map((_,i)=>(
        <div key={i} style={{
          width:i<cur?18:6,height:3,
          background:i<cur?C.blue:"rgba(30,64,175,0.15)",
          boxShadow:i<cur?"0 0 4px rgba(59,130,246,0.4)":"none",
          transition:"all .3s ease",borderRadius:2,
        }}/>
      ))}
    </div>
  );
}

/* ─── OkiBg ─── */
function OkiBg() {
  return (
    <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,background:"linear-gradient(155deg,#f8faff 0%,#eef4fb 55%,#e4eef8 100%)"}}/>
      <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(ellipse 60% 40% at 5% 95%,rgba(30,64,175,0.04) 0%,transparent 60%),radial-gradient(ellipse 50% 50% at 95% 5%,rgba(8,145,178,0.03) 0%,transparent 60%)"}}/>
      <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:.045}} viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
        <g fill="none" stroke="#1e40af">
          <path strokeWidth="1"   d="M-50,450 Q100,400 200,420 Q320,440 430,390 Q550,340 700,360 Q800,375 900,350"/>
          <path strokeWidth="0.8" d="M-50,380 Q80,330 180,355 Q310,380 420,320 Q540,260 680,290 Q780,310 900,280"/>
          <path strokeWidth="0.6" d="M-50,310 Q60,260 160,285 Q290,315 400,255 Q520,195 660,225 Q760,245 900,215"/>
          <path strokeWidth="0.4" d="M-50,500 Q120,465 230,480 Q360,498 460,455 Q580,410 720,428 Q820,440 900,420"/>
          {[0,200,400,600,800].map(x=><line key={x} x1={x} y1="0" x2={x} y2="600" strokeWidth="0.3" opacity="0.5"/>)}
          {[150,300,450].map(y=><line key={y} x1="0" y1={y} x2="800" y2={y} strokeWidth="0.3" opacity="0.5"/>)}
        </g>
      </svg>
    </div>
  );
}

/* ─── Shell ─── */
function Shell({ children }) {
  return (
    <div style={{height:"100%",overflowY:"auto",overflowX:"hidden",WebkitOverflowScrolling:"touch",boxSizing:"border-box"}}>
      <div style={{minHeight:"100%",padding:"clamp(1.2rem,3.5vw,3rem) clamp(1.5rem,6vw,8vw)",display:"flex",flexDirection:"column",justifyContent:"center",boxSizing:"border-box"}}>
        {children}
      </div>
    </div>
  );
}

/* ─── Label ─── */
function Label({ children }) {
  return (
    <div style={{fontFamily:V,fontSize:"clamp(.6rem,2vw,.7rem)",color:"rgba(30,64,175,.4)",letterSpacing:".18em",marginBottom:"clamp(.5rem,2vw,.75rem)",display:"flex",alignItems:"center",gap:".5rem"}}>
      <span style={{display:"inline-block",width:16,height:1,background:"rgba(30,64,175,.25)"}}/>
      {children}
      <span style={{display:"inline-block",width:16,height:1,background:"rgba(30,64,175,.25)"}}/>
    </div>
  );
}

/* ═══════════════════ THREE.JS BOOT SCENE ═══════════════════ */
function ThreeBootScene() {
  const cvs = useRef(null);
  useEffect(() => {
    const el = cvs.current; if (!el) return;
    const w = el.parentElement.clientWidth;
    const h = el.parentElement.clientHeight;
    el.width = w; el.height = h;
    const ctx = el.getContext("2d");
    const nodes = Array.from({length:28}, (_,i) => ({
      x: Math.random()*w, y: Math.random()*h,
      vx: (Math.random()-.5)*.4, vy: (Math.random()-.5)*.4,
      r: Math.random()*3+2,
      opacity: Math.random()*.6+.3,
      pulse: Math.random()*Math.PI*2,
    }));
    const particles = Array.from({length:60}, ()=>({
      x: Math.random()*w, y: Math.random()*h,
      r: Math.random()*1.2+.4,
      speed: Math.random()*.6+.2,
      angle: Math.random()*Math.PI*2,
      opacity: Math.random()*.4+.1,
      life: Math.random(),
    }));
    let t=0, raf;
    const draw = () => {
      t+=0.016;
      ctx.clearRect(0,0,w,h);
      // connections
      nodes.forEach((a,ai) => nodes.forEach((b,bi) => {
        if (bi<=ai) return;
        const dx=b.x-a.x, dy=b.y-a.y, dist=Math.sqrt(dx*dx+dy*dy);
        if (dist<160) {
          const alpha=(1-dist/160)*0.18;
          const grad = ctx.createLinearGradient(a.x,a.y,b.x,b.y);
          grad.addColorStop(0,`rgba(59,130,246,${alpha})`);
          grad.addColorStop(.5,`rgba(8,145,178,${alpha*1.4})`);
          grad.addColorStop(1,`rgba(59,130,246,${alpha})`);
          ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y);
          ctx.strokeStyle=grad; ctx.lineWidth=.8; ctx.stroke();
        }
      }));
      // particles
      particles.forEach(p => {
        p.life += 0.004;
        if (p.life>1){p.life=0;p.x=Math.random()*w;p.y=Math.random()*h;}
        p.x += Math.cos(p.angle)*p.speed;
        p.y += Math.sin(p.angle)*p.speed;
        if(p.x<0)p.x=w; if(p.x>w)p.x=0;
        if(p.y<0)p.y=h; if(p.y>h)p.y=0;
        const alpha = Math.sin(p.life*Math.PI)*p.opacity;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        ctx.fillStyle=`rgba(8,145,178,${alpha})`; ctx.fill();
      });
      // nodes
      nodes.forEach(n => {
        n.x += n.vx; n.y += n.vy;
        if(n.x<0||n.x>w)n.vx*=-1; if(n.y<0||n.y>h)n.vy*=-1;
        n.pulse += 0.04;
        const glow = Math.sin(n.pulse)*.3+.7;
        const g = ctx.createRadialGradient(n.x,n.y,0,n.x,n.y,n.r*3.5);
        g.addColorStop(0,`rgba(59,130,246,${n.opacity*glow})`);
        g.addColorStop(1,`rgba(59,130,246,0)`);
        ctx.beginPath(); ctx.arc(n.x,n.y,n.r*3.5,0,Math.PI*2);
        ctx.fillStyle=g; ctx.fill();
        ctx.beginPath(); ctx.arc(n.x,n.y,n.r,0,Math.PI*2);
        ctx.fillStyle=`rgba(147,197,253,${n.opacity*glow})`; ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  },[]);
  return <canvas ref={cvs} style={{position:"absolute",top:0,left:0,display:"block"}}/>;
}

/* ═══════════════════ THREE.JS DX FLOW DEMO ═══════════════════ */
function ThreeDXFlowDemo({ isDX }) {
  const cvs = useRef(null);
  const isDXRef = useRef(isDX);
  useEffect(()=>{isDXRef.current=isDX;},[isDX]);

  useEffect(() => {
    const el = cvs.current; if (!el) return;
    const w = el.parentElement.clientWidth;
    const h = el.parentElement.clientHeight;
    el.width = w; el.height = h;
    const ctx = el.getContext("2d");

    const depts = [
      {label:"営業", color:"#3b82f6"},
      {label:"在庫", color:"#0891b2"},
      {label:"財務", color:"#7c3aed"},
      {label:"人事", color:"#059669"},
      {label:"現場", color:"#d97706"},
      {label:"顧客", color:"#dc2626"},
    ];
    const cx = w/2, cy = h/2;
    const R = Math.min(w,h)*0.33;
    const nodes = depts.map((d,i) => {
      const angle = (i/depts.length)*Math.PI*2 - Math.PI/2;
      return {...d, x: cx+R*Math.cos(angle), y: cy+R*Math.sin(angle), angle};
    });
    // center node for DX state
    const center = {label:"DX基盤", x:cx, y:cy, color:"#1e40af"};

    // particles along edges
    const edgeParticles = [];
    nodes.forEach((a,ai) => nodes.forEach((b,bi) => {
      if(bi<=ai) return;
      for(let p=0;p<3;p++) edgeParticles.push({
        from:ai, to:bi, t:Math.random(), speed:0.004+Math.random()*.004,
        color:a.color, alpha:0.7,
      });
    }));
    const hubParticles = nodes.map((n,i) => ({
      nodeIdx:i, t:Math.random(), speed:0.006+Math.random()*.006, toHub:Math.random()>.5,
    }));

    // chaos particles for before state
    const chaosParticles = Array.from({length:30},()=>({
      x:Math.random()*w, y:Math.random()*h,
      vx:(Math.random()-.5)*1.2, vy:(Math.random()-.5)*1.2,
      life:Math.random(), r:1.5,
      color:nodes[Math.floor(Math.random()*nodes.length)].color,
    }));

    let t=0, raf;
    const lerp = (a,b,t) => a+(b-a)*t;
    const draw = () => {
      t += 0.016;
      const dx = isDXRef.current;
      const fade = dx ? Math.min(t/1.5,1) : 1;
      ctx.clearRect(0,0,w,h);

      if (!dx) {
        // BEFORE: scattered, disconnected chaos
        // draw dim broken connections
        nodes.forEach((a,ai) => {
          if(ai>0 && Math.random()>.98) { // occasional failed connection flicker
            const b=nodes[(ai+1)%nodes.length];
            ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y);
            ctx.strokeStyle="rgba(239,68,68,0.15)"; ctx.setLineDash([4,8]); ctx.lineWidth=1; ctx.stroke();
            ctx.setLineDash([]);
          }
        });
        // chaos particles
        chaosParticles.forEach(p => {
          p.x+=p.vx; p.y+=p.vy;
          if(p.x<0)p.x=w; if(p.x>w)p.x=0;
          if(p.y<0)p.y=h; if(p.y>h)p.y=0;
          p.life+=0.01; if(p.life>1)p.life=0;
          const a=Math.sin(p.life*Math.PI)*0.5;
          ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
          ctx.fillStyle=p.color.replace(")",`,${a})`).replace("rgb","rgba"); ctx.fill();
        });
        // nodes isolated
        nodes.forEach(n => {
          ctx.beginPath(); ctx.arc(n.x,n.y,14,0,Math.PI*2);
          ctx.fillStyle="rgba(248,250,252,0.9)"; ctx.fill();
          ctx.strokeStyle="rgba(148,163,184,0.4)"; ctx.lineWidth=1.5; ctx.stroke();
          ctx.fillStyle="rgba(100,116,139,0.8)"; ctx.font=`bold 11px ${VB}`;
          ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.fillText(n.label,n.x,n.y);
          // "×" indicator
          ctx.fillStyle="rgba(239,68,68,0.7)"; ctx.font=`9px ${V}`;
          ctx.fillText("×",n.x+16,n.y-14);
        });
        // "データ孤立" label
        ctx.fillStyle="rgba(239,68,68,0.5)"; ctx.font=`bold 11px ${V}`;
        ctx.textAlign="center"; ctx.fillText("── 部門間の壁 ──",cx,cy);
      } else {
        // AFTER: unified hub-and-spoke with flowing particles
        // draw hub connections
        nodes.forEach((n,ni) => {
          const grad = ctx.createLinearGradient(n.x,n.y,cx,cy);
          grad.addColorStop(0,n.color.replace("#","")+`33`); // faint at node
          grad.addColorStop(0.5,`rgba(59,130,246,${0.3*fade})`);
          grad.addColorStop(1,`rgba(30,64,175,${0.35*fade})`);
          ctx.beginPath(); ctx.moveTo(n.x,n.y); ctx.lineTo(cx,cy);
          ctx.strokeStyle=`rgba(59,130,246,${0.25*fade})`; ctx.setLineDash([]); ctx.lineWidth=1.2; ctx.stroke();
        });
        // mesh connections (lighter)
        nodes.forEach((a,ai) => nodes.forEach((b,bi) => {
          if(bi<=ai) return;
          const dx2=b.x-a.x, dy2=b.y-a.y, dist=Math.sqrt(dx2*dx2+dy2*dy2);
          ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y);
          ctx.strokeStyle=`rgba(147,197,253,${0.1*fade})`; ctx.lineWidth=0.5; ctx.stroke();
        }));

        // hub particles
        hubParticles.forEach(p => {
          p.t += p.speed;
          if(p.t>1){p.t=0;p.toHub=!p.toHub;}
          const n=nodes[p.nodeIdx];
          const px = p.toHub ? lerp(n.x,cx,p.t) : lerp(cx,n.x,p.t);
          const py = p.toHub ? lerp(n.y,cy,p.t) : lerp(cy,n.y,p.t);
          const glow = ctx.createRadialGradient(px,py,0,px,py,5);
          glow.addColorStop(0,`rgba(147,197,253,${0.9*fade})`);
          glow.addColorStop(1,`rgba(59,130,246,0)`);
          ctx.beginPath(); ctx.arc(px,py,5,0,Math.PI*2);
          ctx.fillStyle=glow; ctx.fill();
          ctx.beginPath(); ctx.arc(px,py,2,0,Math.PI*2);
          ctx.fillStyle=`rgba(255,255,255,${0.9*fade})`; ctx.fill();
        });

        // nodes
        nodes.forEach((n,ni) => {
          const pulse = Math.sin(t*2+ni*1.2)*.3+.7;
          // glow
          const g=ctx.createRadialGradient(n.x,n.y,0,n.x,n.y,28);
          g.addColorStop(0,n.color+"55"); g.addColorStop(1,"transparent");
          ctx.beginPath(); ctx.arc(n.x,n.y,28,0,Math.PI*2);
          ctx.fillStyle=g; ctx.fill();
          // circle
          ctx.beginPath(); ctx.arc(n.x,n.y,16,0,Math.PI*2);
          ctx.fillStyle=n.color+"22"; ctx.fill();
          ctx.strokeStyle=n.color+`${Math.round(pulse*0x88).toString(16).padStart(2,"0")}`; ctx.lineWidth=2; ctx.stroke();
          ctx.fillStyle=C.text; ctx.font=`bold 11px ${VB}`;
          ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.fillText(n.label,n.x,n.y);
          // check mark
          ctx.fillStyle="#22c55e"; ctx.font=`10px ${V}`;
          ctx.fillText("✓",n.x+18,n.y-16);
        });

        // center hub
        const hubPulse = Math.sin(t*3)*.2+.8;
        const hg=ctx.createRadialGradient(cx,cy,0,cx,cy,36);
        hg.addColorStop(0,"rgba(30,64,175,0.35)"); hg.addColorStop(1,"transparent");
        ctx.beginPath(); ctx.arc(cx,cy,36,0,Math.PI*2); ctx.fillStyle=hg; ctx.fill();
        ctx.beginPath(); ctx.arc(cx,cy,22,0,Math.PI*2);
        ctx.fillStyle=`rgba(30,64,175,${0.15*hubPulse})`; ctx.fill();
        ctx.strokeStyle=`rgba(59,130,246,${0.7*hubPulse})`; ctx.lineWidth=2; ctx.stroke();
        ctx.fillStyle="#fff"; ctx.font=`bold 10px ${VB}`;
        ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("DX基盤",cx,cy);
      }

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  },[]);
  return <canvas ref={cvs} style={{position:"absolute",top:0,left:0,display:"block",width:"100%",height:"100%"}}/>;
}

/* ═══════════════════ THREE.JS KPI BARS ═══════════════════ */
function ThreeKPIScene({ industryKey }) {
  const cvs = useRef(null);
  const kpiRef = useRef([]);

  const KPI_DATA = {
    transport: [{label:"処理速度",before:35,after:88,color:"#3b82f6"},{label:"顧客満足",before:52,after:91,color:"#0891b2"},{label:"コスト",before:100,after:62,color:"#d97706",invert:true},{label:"工数",before:100,after:48,color:"#7c3aed",invert:true}],
    cleaning:  [{label:"探索時間",before:100,after:18,color:"#dc2626",invert:true},{label:"紛失率",before:100,after:8,color:"#d97706",invert:true},{label:"現場効率",before:42,after:87,color:"#0891b2"},{label:"リードタイム",before:100,after:60,color:"#7c3aed",invert:true}],
    school:    [{label:"情報精度",before:48,after:95,color:"#3b82f6"},{label:"事務工数",before:100,after:35,color:"#d97706",invert:true},{label:"指導品質",before:55,after:90,color:"#059669"},{label:"連携度",before:30,after:82,color:"#0891b2"}],
    care:      [{label:"検索時間",before:100,after:22,color:"#dc2626",invert:true},{label:"マッチング",before:40,after:88,color:"#3b82f6"},{label:"情報鮮度",before:35,after:96,color:"#059669"},{label:"満足度",before:50,after:89,color:"#0891b2"}],
    mfg:       [{label:"生産精度",before:55,after:92,color:"#3b82f6"},{label:"在庫ロス",before:100,after:38,color:"#d97706",invert:true},{label:"変更対応",before:30,after:85,color:"#059669"},{label:"工数",before:100,after:55,color:"#7c3aed",invert:true}],
    construction:[{label:"原価可視",before:15,after:95,color:"#3b82f6"},{label:"利益予測",before:20,after:88,color:"#059669"},{label:"判断速度",before:40,after:90,color:"#0891b2"},{label:"管理工数",before:100,after:45,color:"#d97706",invert:true}],
    sign:      [{label:"情報共有",before:20,after:92,color:"#3b82f6"},{label:"受注追跡",before:30,after:96,color:"#0891b2"},{label:"営業効率",before:45,after:88,color:"#059669"},{label:"属人化",before:100,after:25,color:"#dc2626",invert:true}],
  };
  const kpis = KPI_DATA[industryKey] || KPI_DATA["mfg"];

  useEffect(()=>{
    kpiRef.current = kpis.map(k=>({...k, current:k.before, target:k.after, t:0}));
  },[industryKey]);

  useEffect(() => {
    const el = cvs.current; if (!el) return;
    const w = el.parentElement.clientWidth;
    const h = el.parentElement.clientHeight;
    el.width = w; el.height = h;
    const ctx = el.getContext("2d");
    kpiRef.current = kpis.map(k=>({...k, current:k.before, target:k.after, t:0}));

    let raf;
    const barW = Math.min((w-80)/(kpis.length), 90);
    const barMaxH = h - 100;
    const baseY = h - 44;
    const startX = (w - barW*kpis.length)/2;

    const draw = () => {
      ctx.clearRect(0,0,w,h);
      // grid lines
      [25,50,75,100].forEach(pct=>{
        const y = baseY - barMaxH*pct/100;
        ctx.beginPath(); ctx.moveTo(30,y); ctx.lineTo(w-20,y);
        ctx.strokeStyle=`rgba(30,64,175,0.06)`; ctx.lineWidth=1; ctx.setLineDash([3,5]); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle="rgba(30,64,175,0.2)"; ctx.font=`9px ${V}`;
        ctx.textAlign="right"; ctx.fillText(pct+"%",26,y+3);
      });

      kpiRef.current.forEach((kpi,i) => {
        kpi.t = Math.min(kpi.t+0.018, 1);
        const ease = 1-Math.pow(1-kpi.t,3);
        kpi.current = kpi.before + (kpi.target - kpi.before)*ease;

        const x = startX + i*barW;
        const bw = barW*0.52;
        const bx = x+(barW-bw)/2;

        // before bar (dimmer)
        const beforeH = barMaxH*kpi.before/100;
        ctx.fillStyle="rgba(148,163,184,0.25)";
        ctx.fillRect(bx-bw*0.28, baseY-beforeH, bw*0.28, beforeH);

        // after/current bar
        const curH = barMaxH*kpi.current/100;
        const grad=ctx.createLinearGradient(0,baseY-curH,0,baseY);
        grad.addColorStop(0,kpi.color+"cc");
        grad.addColorStop(1,kpi.color+"44");
        ctx.fillStyle=grad;
        ctx.fillRect(bx, baseY-curH, bw, curH);

        // glow top
        const gg=ctx.createRadialGradient(bx+bw/2,baseY-curH,0,bx+bw/2,baseY-curH,18);
        gg.addColorStop(0,kpi.color+"55"); gg.addColorStop(1,"transparent");
        ctx.beginPath(); ctx.arc(bx+bw/2,baseY-curH,18,0,Math.PI*2);
        ctx.fillStyle=gg; ctx.fill();

        // value label
        const dispVal = kpi.invert
          ? Math.round(100-kpi.current+kpi.target-kpi.before)  // show improvement
          : Math.round(kpi.current);
        ctx.fillStyle=kpi.color; ctx.font=`bold 12px ${VB}`;
        ctx.textAlign="center";
        const valLabel = kpi.invert ? `-${100-Math.round(kpi.current)}%` : `${Math.round(kpi.current)}%`;
        ctx.fillText(valLabel, bx+bw/2, baseY-curH-6);

        // axis label
        ctx.fillStyle="rgba(15,23,42,0.5)"; ctx.font=`10px ${VB}`;
        ctx.fillText(kpi.label, x+barW/2, baseY+14);

        // improvement badge
        if (kpi.t>0.9) {
          const imp = kpi.invert ? Math.round(100-kpi.target)+"%" : "+"+Math.round(kpi.target-kpi.before)+"%";
          const badgeX = bx+bw/2;
          const badgeY = baseY-curH-26;
          ctx.fillStyle="#22c55e"; ctx.font=`bold 9px ${V}`;
          ctx.textAlign="center"; ctx.fillText(imp, badgeX, badgeY);
        }
      });

      // legend
      ctx.fillStyle="rgba(148,163,184,0.6)"; ctx.font=`9px ${V}`;
      ctx.textAlign="left"; ctx.fillText("▪ 導入前", 34, h-22);
      ctx.fillStyle="rgba(59,130,246,0.7)"; ctx.fillText("▪ DX後", 80, h-22);

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  },[industryKey]);
  return <canvas ref={cvs} style={{position:"absolute",top:0,left:0,display:"block",width:"100%",height:"100%"}}/>;
}

/* ═══════════════════ SLIDES ═══════════════════ */

/* S0: BOOT */
function S0_Boot() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    sfxBoot();
    const t1=setTimeout(()=>setPhase(1),700);
    const t2=setTimeout(()=>setPhase(2),1900);
    const t3=setTimeout(()=>setPhase(3),3200);
    return ()=>{clearTimeout(t1);clearTimeout(t2);clearTimeout(t3);};
  },[]);
  return (
    <div style={{position:"relative",height:"100%",overflow:"hidden",background:"#050e1f"}}>
      <ThreeBootScene/>
      <div style={{position:"absolute",inset:0,zIndex:1,background:"linear-gradient(to bottom,rgba(5,14,31,0.45) 0%,rgba(5,14,31,0.1) 40%,rgba(5,14,31,0.65) 100%)",pointerEvents:"none"}}/>
      <div style={{position:"absolute",inset:0,zIndex:2,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"clamp(1rem,4vw,2rem)",textAlign:"center",padding:"clamp(1rem,4vw,2rem)"}}>
        <div style={{opacity:phase>=1?0.8:0,transition:"opacity .8s",display:"flex",gap:3,alignItems:"flex-end"}}>
          {[14,20,28,36,28,20,14].map((h,i)=>(
            <div key={i} style={{width:3,height:h,background:"linear-gradient(to top,#3b82f6,#93c5fd)",borderRadius:"2px 2px 0 0",boxShadow:"0 0 6px #3b82f688"}}/>
          ))}
        </div>
        <div style={{fontFamily:V,fontSize:"clamp(.68rem,2vw,.82rem)",color:"rgba(147,197,253,0.6)",letterSpacing:".3em",opacity:phase>=1?1:0,transition:"opacity .6s"}}>
          OKICOM DX SYSTEM
        </div>
        <div style={{fontFamily:VB,fontSize:"clamp(1.6rem,4.5vw,5rem)",color:"#f0f9ff",fontWeight:700,lineHeight:1.2,opacity:phase>=2?1:0,transition:"opacity .8s,transform .8s",transform:phase>=2?"translateY(0)":"translateY(16px)",textShadow:"0 2px 32px rgba(0,0,0,0.7)"}}>
          ITで、<span style={{color:"#38bdf8",textShadow:"0 0 40px rgba(56,189,248,0.5)"}}>楽しい未来</span>を<br/>つくりこむ。
        </div>
        {phase>=3 && (
          <div style={{fontFamily:VB,color:"rgba(147,197,253,0.55)",fontSize:"clamp(.72rem,2.5vw,.85rem)",letterSpacing:".05em",display:"flex",alignItems:"center",gap:".75rem",animation:"fadeIn .8s ease"}}>
            <span style={{animation:"blink 1.5s step-end infinite",color:"#38bdf8"}}>▶</span>
            スワイプ または NEXT をタップ
          </div>
        )}
      </div>
    </div>
  );
}

/* S1: Q1 - opening question */
const DX_MOYAS = [
  {id:"a", icon:"😓", text:"業務効率化したいが、何から手をつければいいかわからない"},
  {id:"b", icon:"📊", text:"Excelや紙管理が限界で、でもシステム化する勇気がない"},
  {id:"c", icon:"🔄", text:"ツールを入れたのに、現場が使ってくれない"},
  {id:"d", icon:"💸", text:"コストをかけた割に、効果が見えない"},
  {id:"e", icon:"🧩", text:"部門ごとにシステムがバラバラで、情報が繋がっていない"},
  {id:"f", icon:"⏱️", text:"属人化が進んでいて、担当者が抜けると業務が止まる"},
  {id:"g", icon:"🤷", text:"ベンダーに任せたら、現場のことを分かってもらえなかった"},
];

function S1_Q1() {
  const [checks, setChecks] = useState({});
  const toggle = (id,e) => { e.stopPropagation(); sfxClick(); setChecks(p=>({...p,[id]:!p[id]})); };
  const count = Object.values(checks).filter(Boolean).length;
  return (
    <Shell>
      <Label>Q.01 ── DXのもやもや、言語化します</Label>
      <div style={{fontFamily:VB,fontSize:"clamp(1.1rem,3.5vw,2.8rem)",color:C.text,fontWeight:700,lineHeight:1.3,marginBottom:"clamp(.5rem,2vw,.75rem)"}}>
        当てはまるものを<br/><span style={{color:C.blue}}>タップしてください。</span>
      </div>
      {count>0&&(
        <div style={{fontFamily:V,fontSize:"clamp(.6rem,2vw,.7rem)",color:C.teal,letterSpacing:".1em",marginBottom:"clamp(.4rem,1.5vw,.6rem)",animation:"fadeIn .3s ease",display:"flex",alignItems:"center",gap:".4rem"}}>
          <span>✓</span>{count}項目 共感 ── その課題、一緒に解決できます
        </div>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:"clamp(.3rem,1.2vw,.45rem)"}}>
        {DX_MOYAS.map(m=>{
          const on = !!checks[m.id];
          return (
            <div key={m.id} onClick={(e)=>toggle(m.id,e)}
              style={{border:`1.5px solid ${on?"rgba(30,64,175,.45)":"rgba(30,64,175,.1)"}`,background:on?"rgba(30,64,175,.06)":"rgba(255,255,255,.7)",padding:"clamp(.55rem,2.2vw,.8rem) clamp(.75rem,3vw,1rem)",cursor:"pointer",transition:"all .2s",display:"flex",alignItems:"center",gap:".75rem",WebkitTapHighlightColor:"transparent",position:"relative"}}>
              <span style={{fontSize:"clamp(1rem,3.5vw,1.25rem)",flexShrink:0}}>{m.icon}</span>
              <span style={{fontFamily:VB,fontSize:"clamp(.75rem,2.7vw,.88rem)",color:on?C.blue:C.muted,fontWeight:on?600:400,lineHeight:1.5,flex:1}}>{m.text}</span>
              <span style={{fontFamily:V,fontSize:"clamp(.7rem,2.5vw,.8rem)",color:on?C.blue:"rgba(30,64,175,.2)",flexShrink:0,width:20,textAlign:"center",transition:"all .2s"}}>
                {on?"✓":"○"}
              </span>
            </div>
          );
        })}
      </div>
      {count>=2&&(
        <div key={count} style={{marginTop:"clamp(.6rem,2.5vw,.9rem)",fontFamily:VB,fontSize:"clamp(.78rem,2.8vw,.9rem)",color:C.blue,fontWeight:600,lineHeight:1.7,background:"rgba(30,64,175,.04)",border:"1px solid rgba(30,64,175,.12)",padding:"clamp(.65rem,2.5vw,.9rem)",animation:"fadeIn .4s ease"}}>
          ✦ その課題、okicomはまさに得意領域です。<br/>
          <span style={{color:C.dim,fontWeight:400}}>「何から始めるか」の整理から、一緒に進めましょう。</span>
        </div>
      )}
      <div style={{fontFamily:V,fontSize:"clamp(.58rem,2vw,.65rem)",color:"rgba(30,64,175,.22)",marginTop:"clamp(.4rem,1.5vw,.6rem)",letterSpacing:".1em"}}>
        ▸ 複数選択OK ── 正直に選んでください
      </div>
    </Shell>
  );
}

/* S2: INDUSTRY SELECT */
const INDUSTRIES = [
  {key:"transport",    label:"運送・物流",   icon:"🚚", sub:"基幹システム・配送管理"},
  {key:"cleaning",     label:"クリーニング・製造",icon:"🏭",sub:"在庫・進捗トラッキング"},
  {key:"school",       label:"教育・専門学校", icon:"🎓", sub:"学籍・カリキュラム管理"},
  {key:"care",         label:"介護・医療",    icon:"🏥", sub:"プラットフォーム・マッチング"},
  {key:"mfg",          label:"製造業",        icon:"⚙️", sub:"生産・在庫・原価管理"},
  {key:"construction", label:"建設・不動産",  icon:"🏗️", sub:"原価可視化・経営DX"},
  {key:"sign",         label:"小売・サービス業",icon:"🏪",sub:"営業管理・顧客情報"},
];

function S2_Industry({ industry, setIndustry }) {
  return (
    <Shell>
      <Label>INDUSTRY ── 御社の業界を選んでください</Label>
      <div style={{fontFamily:VB,fontSize:"clamp(1rem,3.2vw,2rem)",color:C.text,fontWeight:700,lineHeight:1.4,marginBottom:"clamp(.75rem,3vw,1.25rem)"}}>
        業界特有の課題を<br/><span style={{color:C.blue}}>一緒に確認します。</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"clamp(.35rem,1.5vw,.55rem)"}}>
        {INDUSTRIES.map(ind=>(
          <button key={ind.key} onClick={()=>{sfxSelect();setIndustry(ind.key);}}
            style={{border:`1.5px solid ${industry===ind.key?"rgba(30,64,175,.5)":"rgba(30,64,175,.15)"}`,background:industry===ind.key?"rgba(30,64,175,.07)":"rgba(255,255,255,.7)",color:industry===ind.key?C.blue:C.muted,fontFamily:VB,fontSize:"clamp(.78rem,2.8vw,.9rem)",fontWeight:industry===ind.key?700:500,padding:"clamp(.6rem,2.5vw,.9rem)",cursor:"pointer",textAlign:"left",WebkitTapHighlightColor:"transparent",transition:"all .2s",display:"flex",flexDirection:"column",gap:".2rem"}}>
            <span style={{fontSize:"clamp(.9rem,3.5vw,1.2rem)"}}>{ind.icon} {ind.label}</span>
            <span style={{fontFamily:V,fontSize:"clamp(.55rem,1.8vw,.62rem)",color:industry===ind.key?"rgba(30,64,175,.5)":"rgba(100,116,139,.4)",letterSpacing:".05em"}}>{ind.sub}</span>
          </button>
        ))}
      </div>
      {industry && (
        <div style={{fontFamily:V,fontSize:"clamp(.6rem,2vw,.7rem)",color:C.teal,letterSpacing:".1em",marginTop:"clamp(.75rem,3vw,1rem)",animation:"fadeIn .3s ease",display:"flex",gap:".5rem",alignItems:"center"}}>
          <span style={{color:C.teal}}>✓</span>
          {INDUSTRIES.find(i=>i.key===industry)?.label} を選択 ── 次のスライドで課題を確認
        </div>
      )}
    </Shell>
  );
}

/* S3: PAIN - industry specific */
const PAIN_DATA = {
  transport: {
    title:"基幹システムが会社の成長を止めている",
    pains:["新サービスを始めたくても古いシステムが追いつかない","毎日数万件の問い合わせを古いシステムで捌いている","部門間でデータが分断され、意思決定が遅い","IT部門と現場の間で課題認識がバラバラ"],
    detail:["新機能を追加しようとすると既存コードへの影響が読めず、開発が止まる。技術的負債が成長の天井になっている状態。","ピーク時の問い合わせ量にシステムが耐えられず、手作業で補っている現場。拡張しようにも古いアーキテクチャが壁になる。","営業データは営業部門、在庫データは倉庫、売上データは経理と三者三様。横断的な意思決定に数日かかることも。","現場は「使いにくい」、IT部門は「仕様通り作った」と平行線。要件定義の段階から両者を繋ぐ役割が必要。"],
  },
  cleaning: {
    title:"「今どこ？」が分からない管理の限界",
    pains:["制服・リネンの進捗が紙管理で現場に電話確認が絶えない","紛失が発生してもどこで失くしたか追えない","『探す仕事』に時間を取られ、本来の業務が後回し","在庫精度が低く、過剰発注や欠品が常態化"],
    detail:["伝票と台帳が一致しているか確認するだけで1日数時間。電話口で「ちょっと待ってください」と保留にする回数が多すぎる。","どの棚に置いたか、誰が持ち出したか追う手段がない。紛失判明まで数日かかり、顧客クレームに発展するケースも。","「探す」「確認する」「聞く」の連鎖が現場の時間を消費。本来やるべき品質管理や顧客対応が後回しになっている。","手書き台帳の誤記や転記漏れで実際の在庫数と帳簿が乖離。発注判断がいつも「感覚頼り」になっている。"],
  },
  school: {
    title:"Excel管理が教育品質を下げている",
    pains:["学生の履修状況をExcelで管理、把握と分析に時間がかかる","教職員によって情報精度にバラつきが出る","指導が属人的で担当者交代のたびに情報が失われる","レポート・分析作業に時間を取られ、指導に集中できない"],
    detail:["学生ごとのファイルを開いては閉じ、集計のたびにコピペ作業。進路相談の前日に徹夜で資料まとめという現場もある。","Aさんのシートは最新だがBさんのは1ヶ月前のまま、というズレが日常的に発生。誰かが直すと別の誰かのが古くなる。","「あの学生のことはCさんが詳しい」という属人管理。Cさんが退職すると指導履歴がゼロから。","月次レポートを作るために3時間、という状況が常態化。それよりも学生と話す時間に使いたいのが本音。"],
  },
  care: {
    title:"情報格差が「選べない介護」を生んでいる",
    pains:["施設情報が古くて空き状況など詳細が分からない","利用者も自治体も事業者探しに時間がかかりすぎる","マッチング精度が低く、再検索が繰り返される","事業者側も入力・更新の手間が大きく情報が陳腐化"],
    detail:["Webに掲載された情報が半年前のまま。電話してみたら「もう空きはありません」が繰り返される。情報の鮮度がゼロ。","地域の施設を一覧できる場所がない。行政の冊子、施設のWebサイト、口コミを何時間もかけて調べる必要がある。","介護度・エリア・費用・専門性の条件で絞っても「実態と違った」で再検索。ミスマッチが利用者の負担になっている。","担当者がExcelやメールで更新依頼を処理。更新作業が後回しになり、掲載情報が陳腐化するサイクルが止まらない。"],
  },
  mfg: {
    title:"変動前提の現場で計画が追いつかない",
    pains:["公共事業の予算・工期変更で生産計画を都度手作業修正","生産・販売・在庫の一元管理ができず情報が点在","急な変更への対応が属人的でミスが起きやすい","データが散在して経営判断のタイムラグが大きい"],
    detail:["発注変更の連絡が来るたびに、手作業でスプレッドシートを修正。変更の連鎖が読み切れず、資材の手配ミスが起きやすい。","生産は生産部門、在庫は倉庫部門、売上は営業部門で別々に管理。横断集計には各部門へのヒアリングが必要。","変更対応を熟知しているのが特定の担当者だけ。その人が不在だと誰も動けない状態が常態化している。","現場の実態が経営層に届くまでに数日。問題が判明したときにはすでに手遅れという判断の遅れが繰り返される。"],
  },
  construction: {
    title:"「今どれくらい儲かっているか」が分からない",
    pains:["紙の日報では案件の最終利益が竣工まで見えない","原価と人の稼働が別々に管理され合算に手間がかかる","現場の数字が経営層まで届くのに時間がかかりすぎる","勘と経験に頼った意思決定でチャンスを逃している"],
    detail:["着工から竣工まで数ヶ月。途中でコストが膨らんでいても、完工後の決算まで赤字案件だと気づかない構造がある。","材料費は購買部門、人件費は総務部門、外注費は現場担当と分散。月次合算するだけで丸一日かかる現場もある。","現場→所長→本社の報告ルートで情報が数日遅れ。問題が見えたときには取り返しのつかない段階のことが多い。","「前回もこのくらいでいけた」という感覚で見積もる。データで根拠を示せないため、値引き交渉で負けてしまう。"],
  },
  sign: {
    title:"営業力が「個人の頭の中」に止まっている",
    pains:["顧客情報・商談履歴・受注状況がスプレッドシート頼り","担当者が変わると過去の経緯が全部消える","経営者が営業状況をリアルタイムで把握できない","属人化した営業ノウハウが組織の資産にならない"],
    detail:["担当者ごとに異なるフォーマットのExcelが存在。集計のたびにコピペと目視確認。入力漏れもルールも人によってバラバラ。","引き継ぎ書を作っても「あのお客さんは○○が好きで…」という暗黙知が引き継げない。関係が一から構築し直しになる。","「今月の進捗どう？」と聞くたびに担当者に確認が必要。週次報告が来るまで経営者は数字の実態を知れない。","トップ営業の成功パターンが言語化されないまま。退職とともにノウハウが会社から消える繰り返し。"],
  },
};

function S3_Pain({ industry }) {
  const [open, setOpen] = useState({});
  const data = PAIN_DATA[industry] || PAIN_DATA["mfg"];
  const ind = INDUSTRIES.find(i=>i.key===industry) || INDUSTRIES[4];
  return (
    <Shell>
      <Label>PAIN ── {ind.icon} {ind.label}の課題</Label>
      <div style={{fontFamily:VB,fontSize:"clamp(1.1rem,3.2vw,2.5rem)",color:C.text,fontWeight:700,lineHeight:1.35,marginBottom:"clamp(.75rem,3vw,1.25rem)"}}>
        {data.title.split("").map((c,i)=>
          c==="「"||c==="」"||c==="「"||c==="」"?<span key={i} style={{color:C.amber}}>{c}</span>:<span key={i}>{c}</span>
        )}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:"clamp(.35rem,1.5vw,.5rem)"}}>
        {data.pains.map((pain,i)=>(
          <div key={i} onClick={(e)=>{e.stopPropagation();sfxClick();setOpen(p=>({...p,[i]:!p[i]}));}}
            style={{border:`1px solid ${open[i]?"rgba(30,64,175,.3)":"rgba(30,64,175,.1)"}`,background:open[i]?"rgba(30,64,175,.04)":"rgba(255,255,255,.6)",padding:"clamp(.65rem,2.5vw,.9rem) clamp(.75rem,3vw,1rem)",cursor:"pointer",transition:"all .2s",display:"flex",flexDirection:"column",gap:".4rem",WebkitTapHighlightColor:"transparent"}}>
            <div style={{display:"flex",alignItems:"center",gap:".75rem"}}>
              <span style={{color:C.amber,fontFamily:V,fontSize:"clamp(.7rem,2.5vw,.82rem)",flexShrink:0,width:20,textAlign:"center"}}>
                {open[i]?"▼":"▶"}
              </span>
              <span style={{fontFamily:VB,fontSize:"clamp(.78rem,2.8vw,.9rem)",color:open[i]?C.blue:C.muted,fontWeight:open[i]?600:500,lineHeight:1.4}}>{pain}</span>
            </div>
            {open[i]&&(
              <div style={{paddingLeft:"clamp(1.4rem,4vw,2.2rem)",fontFamily:VB,fontSize:"clamp(.72rem,2.5vw,.82rem)",color:C.dim,lineHeight:1.8,animation:"fadeIn .25s ease",borderLeft:"2px solid rgba(30,64,175,.15)",marginLeft:"calc(clamp(.7rem,2.5vw,.82rem) + 10px)"}}>
                {data.detail[i]}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{fontFamily:V,fontSize:"clamp(.58rem,2vw,.68rem)",color:"rgba(30,64,175,.25)",marginTop:"clamp(.5rem,2vw,.75rem)",letterSpacing:".1em"}}>
        ▸ 各項目をタップして展開 ── 御社の状況と照合してください
      </div>
    </Shell>
  );
}

/* S4: CASE - Before/Action/After */
const CASE_DATA = {
  transport:    {label:"大手運送業",before:"毎日数万件の問い合わせ処理に古い基幹システムが対応できず、新サービス展開が不可能な状態。IT部門と現場の認識ギャップも深刻。",action:"現場・IT部門・okicomの3者で「本当に困っている業務」を丁寧に整理。将来の拡張を前提に、基幹システムを一から再設計。",after:"最新環境へ無理なく移行。業務変更にも柔軟な基盤を確保。現在は請求業務まで広げる第2フェーズへ。会社の成長を止めない土台を構築。"},
  cleaning:     {label:"クリーニング業",before:"大量の制服・リネンの進捗・在庫が紙管理。「今どこ？」確認だけで時間が消え、紛失も発生。電話確認が絶えない状態。",action:"RFID技術を採用し、全物品の所在・工程進捗を誰でもリアルタイムに把握できる仕組みを構築。",after:"電話確認が激減し現場・営業が状況を即把握。ロス削減と業務スピード向上。「探す仕事」から「回す仕事」へ転換完了。"},
  school:       {label:"専門学校",before:"学生の履修・単位管理がExcel頼り。把握・分析に時間がかかり、教職員によって情報精度にバラつき。指導が属人的に。",action:"学生・カリキュラム・単位を一元管理できるシステムを構築。「見ればわかる」状態に整備。",after:"学生指導がスムーズに。分析・レポート作成が簡単に。職員間の情報共有が改善。教育品質を「感覚」から「見える化」へ転換。"},
  care:         {label:"介護事業者",before:"施設情報が古く空き状況等の詳細が不明。利用者・自治体とも事業者探しに多大な時間がかかり、マッチング精度が低い。",action:"沖縄特化の検索プラットフォームを構築。事業者と密に連携し常に最新情報を反映できる仕組みを整備。",after:"事業者を探す時間を大幅短縮。利用者と事業者のマッチング精度が向上。「選べない介護」から「選べる介護」へ。"},
  mfg:          {label:"製造業（公共事業）",before:"公共事業の予算・工期が頻繁に変わり、生産・在庫調整を都度手作業でやり直し。情報の散在で経営判断が遅れていた。",action:"発注状況を踏まえ生産・販売・在庫を一元管理するシステムを構築。変更が出てもすぐ修正できる仕組みを整備。",after:"生産数を最適化。急な変更にも柔軟に対応。「変わる前提」で回せる製造体制を実現。"},
  construction: {label:"建設会社",before:"紙の日報では最終決算まで案件が黒字かどうかわからない。原価・稼働が別管理で合算に手間がかかり、判断が感覚頼り。",action:"Webで原価と人の稼働を一元管理する仕組みをローコード開発で短期間に構築。リアルタイム原価可視化を実現。",after:"案件ごとの利益がリアルタイムで見える化。将来の収益予測が可能に。勘と経験から、データで判断する経営へ進化。"},
  sign:         {label:"看板製作業",before:"営業進捗・仕様・顧客情報が担当者の頭とスプレッドシートだけに存在。担当変更で情報消失、経営者はリアルタイム把握不可。",action:"顧客・営業・売上を一元管理する仕組みを導入。情報を共有化し、経営者のダッシュボードを整備。",after:"経営者がリアルタイムで状況把握。営業履歴が会社資産に蓄積。営業が「個人技」から「組織力」へと転換。"},
};

function S4_Case({ industry }) {
  const [step, setStep] = useState(0);
  const data = CASE_DATA[industry] || CASE_DATA["mfg"];
  const ind = INDUSTRIES.find(i=>i.key===industry) || INDUSTRIES[4];
  const steps = [
    {label:"BEFORE", color:C.danger, icon:"⚠", text:data.before},
    {label:"ACTION", color:C.teal,   icon:"⚡", text:data.action},
    {label:"AFTER",  color:"#16a34a", icon:"✓", text:data.after},
  ];
  return (
    <Shell>
      <Label>CASE ── {ind.icon} {ind.label} 導入事例</Label>
      <div style={{display:"flex",gap:"clamp(.3rem,1.5vw,.5rem)",marginBottom:"clamp(.75rem,3vw,1.25rem)"}}>
        {steps.map((s,i)=>(
          <button key={i} onClick={()=>{sfxSelect();setStep(i);}}
            style={{flex:1,border:`1.5px solid ${step===i?s.color+"66":"rgba(30,64,175,.12)"}`,background:step===i?s.color+"0e":"rgba(255,255,255,.6)",color:step===i?s.color:C.dim,fontFamily:V,fontSize:"clamp(.62rem,2.2vw,.72rem)",padding:"clamp(.45rem,2vw,.65rem)",cursor:"pointer",letterSpacing:".12em",WebkitTapHighlightColor:"transparent",transition:"all .2s",textAlign:"center"}}>
            {s.label}
          </button>
        ))}
      </div>
      {steps.map((s,i)=>step===i&&(
        <div key={i} style={{animation:"fadeIn .4s ease",position:"relative",padding:"clamp(1rem,4vw,1.5rem)",background:"rgba(255,255,255,.75)",border:`1px solid ${s.color}22`}}>
          <Corners color={s.color} size={18} t={1.5}/>
          <div style={{fontFamily:V,fontSize:"clamp(.65rem,2.5vw,.75rem)",color:s.color,letterSpacing:".15em",marginBottom:".75rem",display:"flex",alignItems:"center",gap:".5rem"}}>
            <span>{s.icon}</span>{s.label}
          </div>
          <div style={{fontFamily:VB,fontSize:"clamp(.85rem,3vw,1rem)",color:C.text,lineHeight:1.85,fontWeight:400}}>
            {s.text}
          </div>
          {i===2&&(
            <div style={{marginTop:"1rem",fontFamily:VB,fontSize:"clamp(.78rem,2.8vw,.88rem)",color:"#16a34a",fontWeight:600,borderLeft:"3px solid #16a34a",paddingLeft:".75rem"}}>
              👉 okicomが実現した変化
            </div>
          )}
        </div>
      ))}
      <div style={{fontFamily:V,fontSize:"clamp(.58rem,2vw,.68rem)",color:"rgba(30,64,175,.25)",marginTop:".75rem",letterSpacing:".1em"}}>
        ▸ BEFORE / ACTION / AFTER をタップして展開
      </div>
    </Shell>
  );
}

/* S5: DX FLOW DEMO */
function S5_DXDemo() {
  const [isDX, setIsDX] = useState(false);
  const [toggled, setToggled] = useState(false);
  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{padding:"clamp(.75rem,3vw,1.25rem) clamp(1.5rem,6vw,4rem)",flexShrink:0}}>
        <Label>DEMO 01 ── データフロー可視化</Label>
        <div style={{fontFamily:VB,fontSize:"clamp(.95rem,3vw,2rem)",color:C.text,fontWeight:700,lineHeight:1.3}}>
          {isDX ? <span><span style={{color:C.teal}}>DX導入後</span>：データが全社でつながる</span>
                : <span><span style={{color:C.danger}}>DX導入前</span>：部門ごとにデータが孤立</span>}
        </div>
      </div>
      <div style={{flex:1,position:"relative",minHeight:0}}>
        <ThreeDXFlowDemo isDX={isDX}/>
      </div>
      <div style={{padding:"clamp(.5rem,2vw,.75rem) clamp(1.5rem,6vw,4rem)",flexShrink:0,display:"flex",gap:"clamp(.5rem,2vw,.75rem)",alignItems:"center"}}>
        <button onClick={()=>{sfxSelect();setIsDX(v=>!v);setToggled(true);}}
          style={{flex:1,maxWidth:280,border:`1.5px solid ${isDX?C.teal:C.danger}`,background:isDX?"rgba(8,145,178,.08)":"rgba(220,38,38,.06)",color:isDX?C.teal:C.danger,fontFamily:V,fontSize:"clamp(.72rem,2.8vw,.85rem)",padding:"clamp(.6rem,2.5vw,.85rem)",cursor:"pointer",letterSpacing:".1em",WebkitTapHighlightColor:"transparent",transition:"all .3s"}}>
          {isDX?"← DX前を見る":"▶ DX後を見る"}
        </button>
        {toggled&&<div style={{fontFamily:VB,fontSize:"clamp(.7rem,2.5vw,.82rem)",color:C.dim,lineHeight:1.4}}>
          {isDX?"全部門がリアルタイムで連携。意思決定が加速。":"孤立したデータ。連携コストが膨大に。"}
        </div>}
      </div>
    </div>
  );
}

/* S6: KPI DEMO */
function S6_KPIDemo({ industry }) {
  const [key, setKey] = useState(industry||"mfg");
  const ind = INDUSTRIES.find(i=>i.key===key)||INDUSTRIES[4];
  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{padding:"clamp(.75rem,3vw,1.25rem) clamp(1.5rem,6vw,4rem)",flexShrink:0}}>
        <Label>DEMO 02 ── DX導入効果 KPI可視化</Label>
        <div style={{fontFamily:VB,fontSize:"clamp(.95rem,3vw,1.8rem)",color:C.text,fontWeight:700,lineHeight:1.3,marginBottom:".5rem"}}>
          <span style={{color:C.blue}}>{ind.icon} {ind.label}</span> 業種の変化
        </div>
        <div style={{display:"flex",gap:".4rem",flexWrap:"wrap"}}>
          {INDUSTRIES.map(i=>(
            <button key={i.key} onClick={()=>{sfxClick();setKey(i.key);}}
              style={{fontFamily:V,fontSize:"clamp(.55rem,2vw,.65rem)",padding:".2rem .5rem",border:`1px solid ${key===i.key?"rgba(30,64,175,.45)":"rgba(30,64,175,.12)"}`,background:key===i.key?"rgba(30,64,175,.08)":"transparent",color:key===i.key?C.blue:"rgba(30,64,175,.35)",cursor:"pointer",letterSpacing:".06em",WebkitTapHighlightColor:"transparent",transition:"all .15s"}}>
              {i.icon}{i.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{flex:1,position:"relative",minHeight:0}}>
        <ThreeKPIScene industryKey={key}/>
      </div>
      <div style={{padding:"clamp(.35rem,1.5vw,.5rem) clamp(1.5rem,6vw,4rem)",flexShrink:0,fontFamily:V,fontSize:"clamp(.58rem,2vw,.65rem)",color:"rgba(30,64,175,.3)",letterSpacing:".1em"}}>
        ▸ 業種タブを切り替えてKPIの変化を確認 ── 数値はokicom実績の平均値
      </div>
    </div>
  );
}

/* S7: VALUE */
function S7_Value() {
  const [active, setActive] = useState(null);
  const vals = [
    {num:"01",title:"要件が固まっていなくてもOK",color:C.blue,detail:"「何から手をつければいいか分からない」という段階から伴走します。業務・課題の言語化からお手伝いします。"},
    {num:"02",title:"作り方の選択肢を縛らない",color:C.teal,detail:"スクラッチ開発・ローコード・パッケージ組み合わせ──御社の予算と規模感に合わせた「無理のない形」を柔軟に提案します。"},
    {num:"03",title:"営業と開発が最初から同席",color:"#7c3aed",detail:"営業担当だけで話が進み後から技術的矛盾が出るリスクをゼロに。現実的な落としどころを最初から提示します。"},
  ];
  return (
    <Shell>
      <Label>VALUE ── okicomが選ばれる3つの理由</Label>
      <div style={{fontFamily:VB,fontSize:"clamp(1.1rem,3.2vw,2.5rem)",color:C.text,fontWeight:700,lineHeight:1.35,marginBottom:"clamp(.75rem,3vw,1.25rem)"}}>
        「ツールを売る」のではなく、<br/><span style={{color:C.blue}}>業務を変える</span>パートナー。
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:"clamp(.4rem,1.5vw,.6rem)"}}>
        {vals.map((v,i)=>(
          <div key={i} onClick={()=>{sfxSelect();setActive(active===i?null:i);}}
            style={{border:`1.5px solid ${active===i?v.color+"55":"rgba(30,64,175,.1)"}`,background:active===i?v.color+"06":"rgba(255,255,255,.65)",padding:"clamp(.7rem,2.8vw,1rem) clamp(.75rem,3vw,1.1rem)",cursor:"pointer",transition:"all .2s",position:"relative"}}>
            {active===i&&<Corners color={v.color} size={14} t={1.2}/>}
            <div style={{display:"flex",alignItems:"center",gap:".75rem"}}>
              <span style={{fontFamily:V,fontSize:"clamp(.7rem,2.8vw,.85rem)",color:v.color,flexShrink:0}}>{v.num}</span>
              <span style={{fontFamily:VB,fontSize:"clamp(.85rem,3vw,1rem)",color:active===i?v.color:C.text,fontWeight:600}}>{v.title}</span>
              <span style={{marginLeft:"auto",fontFamily:V,fontSize:".8rem",color:v.color,opacity:.5}}>{active===i?"▼":"▶"}</span>
            </div>
            {active===i&&(
              <div style={{marginTop:".65rem",fontFamily:VB,fontSize:"clamp(.78rem,2.8vw,.9rem)",color:C.muted,lineHeight:1.8,animation:"fadeIn .3s ease"}}>
                {v.detail}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{marginTop:"clamp(.75rem,3vw,1.1rem)",fontFamily:V,fontSize:"clamp(.6rem,2vw,.7rem)",color:"rgba(30,64,175,.28)",letterSpacing:".1em"}}>
        ▸ 各項目をタップして詳細確認
      </div>
    </Shell>
  );
}

/* S8: SCOPE */
function S8_Scope() {
  const [active, setActive] = useState(0);
  const services = [
    {label:"システム受託開発",icon:"💻",color:C.blue,
      points:["業務フロー整理→要件定義→開発→保守までワンストップ","AI/RPA/ローコード/スクラッチを状況に合わせて選択","建設・不動産・航空・製造など業界特化に対応"],
      badge:"航空・建設・物流等 多業種実績"},
    {label:"広告運用・Web制作",icon:"📣",color:"#7c3aed",
      points:["Google/Yahoo!/SNS（Instagram・X・LINE・TikTok）対応","LP・動画・パンフレット制作をワンストップで提供","データ分析・SEO改善でROIを継続的に最大化"],
      badge:"デジタルマーケティング全対応"},
    {label:"ITインフラ・セキュリティ",icon:"🛡️",color:C.teal,
      points:["サーバー・クラウド・ネットワーク構築・保守","オンプレミス→クラウド移行支援","セキュリティ診断・対策・インシデント対応"],
      badge:"インフラ・クラウド・セキュリティ"},
    {label:"DX支援・RPA/AI導入",icon:"🤖",color:C.amber,
      points:["kintoneなどローコードツールを活用したスピードDX","RPA（自動化ロボット）による業務効率化","AIチャットボット・予測分析の業務組み込み"],
      badge:"ローコード・RPA・AI活用"},
  ];
  const sv = services[active];
  return (
    <Shell>
      <Label>SCOPE ── サービス領域</Label>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"clamp(.3rem,1.2vw,.45rem)",marginBottom:"clamp(.75rem,3vw,1.1rem)"}}>
        {services.map((s,i)=>(
          <button key={i} onClick={()=>{sfxSelect();setActive(i);}}
            style={{border:`1.5px solid ${active===i?s.color+"66":"rgba(30,64,175,.12)"}`,background:active===i?s.color+"09":"rgba(255,255,255,.65)",color:active===i?s.color:C.dim,fontFamily:VB,fontSize:"clamp(.7rem,2.5vw,.82rem)",fontWeight:active===i?700:500,padding:"clamp(.55rem,2.2vw,.8rem) clamp(.6rem,2.5vw,.9rem)",cursor:"pointer",textAlign:"left",WebkitTapHighlightColor:"transparent",transition:"all .2s",display:"flex",flexDirection:"column",gap:".25rem"}}>
            <span style={{fontSize:"clamp(.9rem,3.5vw,1.15rem)"}}>{s.icon}</span>
            <span style={{lineHeight:1.3}}>{s.label}</span>
          </button>
        ))}
      </div>
      <div key={active} style={{animation:"fadeIn .35s ease",border:`1px solid ${sv.color}22`,background:"rgba(255,255,255,.75)",padding:"clamp(.75rem,3vw,1.1rem)",position:"relative"}}>
        <Corners color={sv.color} size={16} t={1.2}/>
        <div style={{fontFamily:V,fontSize:"clamp(.58rem,1.8vw,.68rem)",color:sv.color,letterSpacing:".12em",marginBottom:".5rem"}}>{sv.badge}</div>
        <div style={{display:"flex",flexDirection:"column",gap:".45rem"}}>
          {sv.points.map((p,i)=>(
            <div key={i} style={{display:"flex",gap:".6rem",alignItems:"flex-start"}}>
              <span style={{color:sv.color,fontFamily:V,fontSize:".72rem",marginTop:".15rem",flexShrink:0}}>✓</span>
              <span style={{fontFamily:VB,fontSize:"clamp(.78rem,2.8vw,.9rem)",color:C.text,lineHeight:1.65}}>{p}</span>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

/* S9: FLOW */
function S9_Flow() {
  const [active, setActive] = useState(null);
  const steps = [
    {num:"01",label:"ヒアリング",detail:"WEB打ち合わせでご要望・課題・予算感を整理",icon:"💬"},
    {num:"02",label:"提案・見積",detail:"最適プランと見積もりを提示。費用感を早期に明示します",icon:"📋"},
    {num:"03",label:"ご契約",detail:"内容にご納得いただけたら契約締結。原則前払いですが相談可",icon:"📝"},
    {num:"04",label:"設計・開発",detail:"要件定義→設計→開発→テスト。広告は媒体選定・制作も並行",icon:"⚙️"},
    {num:"05",label:"納品・運用開始",detail:"本番リリース・操作説明。広告はレポートとPDCA開始",icon:"🚀"},
    {num:"06",label:"保守・改善",detail:"定期点検・保守・改善提案で効果を継続的に最大化",icon:"🔄"},
  ];
  return (
    <Shell>
      <Label>FLOW ── ご利用の流れ</Label>
      <div style={{fontFamily:VB,fontSize:"clamp(1rem,3vw,2rem)",color:C.text,fontWeight:700,lineHeight:1.35,marginBottom:"clamp(.75rem,3vw,1.1rem)"}}>
        まずは相談から。<br/><span style={{color:C.blue}}>決めるのは、あなたのペースで。</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"clamp(.3rem,1.2vw,.45rem)"}}>
        {steps.map((s,i)=>(
          <div key={i} onClick={()=>{sfxClick();setActive(active===i?null:i);}}
            style={{border:`1px solid ${active===i?"rgba(30,64,175,.35)":"rgba(30,64,175,.1)"}`,background:active===i?"rgba(30,64,175,.05)":"rgba(255,255,255,.65)",padding:"clamp(.55rem,2.2vw,.8rem)",cursor:"pointer",transition:"all .2s"}}>
            <div style={{display:"flex",alignItems:"center",gap:".5rem",marginBottom:active===i?".4rem":0}}>
              <span style={{fontFamily:V,fontSize:"clamp(.6rem,2.2vw,.7rem)",color:C.blue}}>{s.num}</span>
              <span style={{fontSize:"clamp(.9rem,3.5vw,1.1rem)"}}>{s.icon}</span>
              <span style={{fontFamily:VB,fontSize:"clamp(.75rem,2.8vw,.88rem)",color:active===i?C.blue:C.text,fontWeight:600}}>{s.label}</span>
            </div>
            {active===i&&<div style={{fontFamily:VB,fontSize:"clamp(.7rem,2.5vw,.82rem)",color:C.dim,lineHeight:1.6,animation:"fadeIn .3s ease"}}>{s.detail}</div>}
          </div>
        ))}
      </div>
      <div style={{fontFamily:V,fontSize:"clamp(.58rem,2vw,.68rem)",color:"rgba(30,64,175,.25)",marginTop:".6rem",letterSpacing:".1em"}}>
        ▸ 各ステップをタップして詳細確認
      </div>
    </Shell>
  );
}

/* S10: CLOSE */
function S10_Close() {
  const [q, setQ] = useState(null);
  const faqs = [
    {q:"要件が固まっていなくても相談できますか？",a:"はい、問題ありません。「何から手をつければいいか分からない」という段階から、業務整理を一緒に進めるケースが多いです。"},
    {q:"既存システムとの連携は可能ですか？",a:"API連携・データ移行・RPAブリッジなど柔軟に対応します。オンプレミス→クラウド移行支援も行います。"},
    {q:"開発期間はどのくらいですか？",a:"小規模ツール：1〜3か月、部門単位：3〜6か月、基幹システム：半年以上が目安。ローコード活用で短納期にも対応できます。"},
    {q:"AIの活用はできますか？",a:"社内生産性向上で活用実績あり。必要に応じてAIチャットボット・予測分析の業務組み込みもご提案可能です。"},
  ];
  return (
    <Shell>
      <Label>CLOSE ── 今日のまとめ</Label>
      <div style={{fontFamily:VB,fontSize:"clamp(1.1rem,3.2vw,2.5rem)",color:C.text,fontWeight:700,lineHeight:1.35,marginBottom:"clamp(.75rem,3vw,1.25rem)"}}>
        今日、<span style={{color:C.blue}}>何か気づきは</span><br/>ありましたか？
      </div>
      <div style={{fontFamily:VB,fontSize:"clamp(.78rem,2.8vw,.92rem)",color:C.dim,lineHeight:1.85,borderLeft:"2px solid rgba(30,64,175,.12)",paddingLeft:".9rem",marginBottom:"clamp(.75rem,3vw,1.1rem)"}}>
        最初から100点のシステムを目指す必要はありません。<br/>
        <strong style={{color:C.blue}}>「まずここを動くようにしよう」</strong>という<br/>小さな一歩から始め、運用しながら育てていきます。
      </div>
      <div style={{marginBottom:"clamp(.5rem,2vw,.75rem)",fontFamily:V,fontSize:"clamp(.62rem,2.2vw,.72rem)",color:"rgba(30,64,175,.4)",letterSpacing:".12em"}}>── よくある質問 ──</div>
      <div style={{display:"flex",flexDirection:"column",gap:"clamp(.3rem,1.2vw,.45rem)",marginBottom:"clamp(.75rem,3vw,1.1rem)"}}>
        {faqs.map((f,i)=>(
          <div key={i} onClick={()=>{sfxClick();setQ(q===i?null:i);}}
            style={{border:`1px solid ${q===i?"rgba(30,64,175,.3)":"rgba(30,64,175,.1)"}`,background:q===i?"rgba(30,64,175,.04)":"rgba(255,255,255,.65)",padding:"clamp(.5rem,2vw,.75rem)",cursor:"pointer",transition:"all .2s"}}>
            <div style={{fontFamily:VB,fontSize:"clamp(.75rem,2.7vw,.88rem)",color:q===i?C.blue:C.text,fontWeight:600,display:"flex",justifyContent:"space-between",gap:".5rem"}}>
              <span>{f.q}</span>
              <span style={{fontFamily:V,fontSize:".75rem",color:C.blue,flexShrink:0}}>{q===i?"▼":"▶"}</span>
            </div>
            {q===i&&<div style={{fontFamily:VB,fontSize:"clamp(.72rem,2.6vw,.85rem)",color:C.muted,lineHeight:1.7,marginTop:".5rem",animation:"fadeIn .3s ease"}}>{f.a}</div>}
          </div>
        ))}
      </div>
      <div style={{background:`linear-gradient(135deg,rgba(30,64,175,.07),rgba(8,145,178,.05))`,border:"1px solid rgba(30,64,175,.15)",padding:"clamp(.75rem,3vw,1.1rem)",position:"relative"}}>
        <Corners color={C.blue} size={14} t={1.2}/>
        <div style={{fontFamily:V,fontSize:"clamp(.58rem,2vw,.68rem)",color:C.teal,letterSpacing:".12em",marginBottom:".4rem"}}>CONTACT</div>
        {[["TEL","098-898-5335"],["URL","okicom.co.jp"],["受付","平日 9:00〜18:00"]].map(([k,v],i,arr)=>(
          <div key={k} style={{display:"flex",borderBottom:i<arr.length-1?"1px solid rgba(30,64,175,.06)":"none"}}>
            <div style={{fontFamily:V,fontSize:"clamp(.58rem,2vw,.68rem)",color:"rgba(30,64,175,.35)",padding:".3rem .5rem",minWidth:44,flexShrink:0,display:"flex",alignItems:"center"}}>{k}</div>
            <div style={{fontFamily:VB,fontSize:"clamp(.78rem,2.8vw,.9rem)",color:C.muted,padding:".3rem .5rem",display:"flex",alignItems:"center",fontWeight:500}}>{v}</div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* ═══════════════════ APP ═══════════════════ */
const TOTAL  = 11;
const LABELS = ["BOOT","Q.01","INDUSTRY","PAIN","CASE","DX-DEMO","KPI-DEMO","VALUE","SCOPE","FLOW","CLOSE"];

export default function App() {
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(1);
  const [industry, setIndustry] = useState("mfg");
  const isMobile = useIsMobile();

  const go = useCallback((next) => {
    if (next<0||next>=TOTAL) return;
    sfxClick(); sfxWhoosh(); setTimeout(sfxImpact,180);
    setDir(next>idx?1:-1); setTimeout(()=>setIdx(next),160);
  }, [idx]);

  useEffect(()=>{
    const h=(e)=>{
      if(["ArrowRight","ArrowDown"," "].includes(e.key)){e.preventDefault();go(idx+1);}
      if(["ArrowLeft","ArrowUp"].includes(e.key)){e.preventDefault();go(idx-1);}
    };
    window.addEventListener("keydown",h); return ()=>window.removeEventListener("keydown",h);
  },[go,idx]);

  useEffect(()=>{if(idx===TOTAL-1)setTimeout(sfxChime,300);},[idx]);

  const swipe = useSwipe(()=>go(idx+1),()=>go(idx-1));
  const anim  = dir===1?"slideInF .22s cubic-bezier(.16,1,.3,1)":"slideInB .22s cubic-bezier(.16,1,.3,1)";

  const handleAreaClick = (e)=>{ if(e.target.closest("button")||e.target.closest("a"))return; if(isMobile)go(idx+1); };

  const renderSlide = ()=>{ switch(idx){
    case 0: return <S0_Boot/>;
    case 1: return <S1_Q1/>;
    case 2: return <S2_Industry industry={industry} setIndustry={setIndustry}/>;
    case 3: return <S3_Pain industry={industry}/>;
    case 4: return <S4_Case industry={industry}/>;
    case 5: return <S5_DXDemo/>;
    case 6: return <S6_KPIDemo industry={industry}/>;
    case 7: return <S7_Value/>;
    case 8: return <S8_Scope/>;
    case 9: return <S9_Flow/>;
    case 10: return <S10_Close/>;
    default: return null;
  }};

  const css=`
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&family=Share+Tech+Mono&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    html,body,#root{width:100%;height:100%;overflow:hidden;cursor:default;background:#e4eef8;-webkit-text-size-adjust:100%}
    body{color:#0f172a;font-family:'Inter','Noto Sans JP',sans-serif;touch-action:pan-y;-webkit-font-smoothing:antialiased;font-weight:400}
    ::selection{background:#1e40af;color:#fff}
    button{-webkit-tap-highlight-color:transparent;touch-action:manipulation;font-family:'Inter','Noto Sans JP',sans-serif}
    @keyframes blink   {0%,100%{opacity:1}50%{opacity:0}}
    @keyframes fadeIn  {from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
    @keyframes slideInF{from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:translateX(0)}}
    @keyframes slideInB{from{opacity:0;transform:translateX(-24px)}to{opacity:1;transform:translateX(0)}}
    @keyframes pulse   {0%,100%{opacity:.5}50%{opacity:1}}
    ::-webkit-scrollbar{display:none}
    *{scrollbar-width:none}
  `;

  return (
    <div style={{width:"100vw",height:"100vh",background:"#dce8f5",overflow:"hidden",position:"relative"}}>
      <style dangerouslySetInnerHTML={{__html:css}}/>
      <OkiBg/>
      <div style={{position:"fixed",inset:0,zIndex:10,display:"flex",justifyContent:"center",alignItems:"stretch"}}>
        <div onClick={handleAreaClick} {...swipe} style={{width:"100%",maxWidth:1100,height:"100%",display:"flex",flexDirection:"column",position:"relative",boxShadow:"0 0 60px rgba(0,0,0,0.1)",background:C.bg}}>

          {/* TOP BAR */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"clamp(.4rem,2vw,.6rem) clamp(.75rem,3vw,1.25rem)",borderBottom:"1px solid rgba(30,64,175,.09)",background:"rgba(240,245,251,.97)",backdropFilter:"blur(8px)",fontFamily:V,fontSize:"clamp(.62rem,2.5vw,.72rem)",color:"rgba(30,64,175,.35)",letterSpacing:".12em",flexShrink:0,zIndex:20,gap:"clamp(.5rem,2vw,1rem)"}}>
            <div style={{display:"flex",gap:"clamp(.5rem,2vw,1.5rem)",alignItems:"center",minWidth:0}}>
              <span style={{color:C.blue,fontSize:"clamp(.8rem,3vw,.92rem)",fontWeight:700,letterSpacing:".08em",flexShrink:0}}>okicom</span>
              {!isMobile&&<span style={{color:"rgba(30,64,175,.28)"}}>DX_SYSTEM</span>}
              <span style={{color:C.teal,animation:"pulse 2.5s ease-in-out infinite",flexShrink:0,fontSize:".85em"}}>● LIVE</span>
            </div>
            <MiniDots cur={idx+1} total={TOTAL}/>
            <div style={{fontFamily:V,fontSize:"clamp(.62rem,2.5vw,.72rem)",color:"rgba(30,64,175,.25)",flexShrink:0}}>
              {String(idx+1).padStart(2,"0")}/{String(TOTAL).padStart(2,"0")}
              {!isMobile&&<span style={{color:"rgba(30,64,175,.2)",marginLeft:"1rem"}}>▸ {LABELS[idx]}</span>}
            </div>
          </div>

          {/* SLIDE */}
          <div key={idx} style={{flex:1,overflow:"hidden",animation:anim,minHeight:0}}>{renderSlide()}</div>

          {/* BOTTOM BAR */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"clamp(.35rem,1.8vw,.5rem) clamp(.75rem,3vw,2rem)",borderTop:"1px solid rgba(30,64,175,.07)",background:"rgba(240,245,251,.97)",backdropFilter:"blur(8px)",fontFamily:V,fontSize:"clamp(.58rem,2.2vw,.68rem)",color:"rgba(30,64,175,.24)",letterSpacing:".08em",flexShrink:0,zIndex:20,gap:"1rem"}}>
            {!isMobile?<span>株式会社okicom / 098-898-5335 / okicom.co.jp</span>:<span style={{color:"rgba(30,64,175,.2)"}}>← スワイプ →</span>}
            <div style={{display:"flex",gap:"clamp(.75rem,3vw,1.5rem)"}}>
              <button onClick={e=>{e.stopPropagation();go(idx-1);}} disabled={idx===0} style={{background:"none",border:"none",color:idx===0?"rgba(30,64,175,.12)":"rgba(30,64,175,.3)",cursor:idx===0?"default":"pointer",fontFamily:V,fontSize:"clamp(.75rem,3vw,.85rem)",letterSpacing:".08em",padding:"clamp(.35rem,1.8vw,.45rem) clamp(.45rem,2vw,.7rem)",minWidth:"clamp(44px,12vw,60px)",WebkitTapHighlightColor:"transparent"}}>◀ PREV</button>
              <button onClick={e=>{e.stopPropagation();go(idx+1);}} disabled={idx===TOTAL-1} style={{background:"none",border:"1px solid rgba(30,64,175,.18)",color:idx===TOTAL-1?"rgba(30,64,175,.12)":"rgba(30,64,175,.68)",cursor:idx===TOTAL-1?"default":"pointer",fontFamily:V,fontSize:"clamp(.75rem,3vw,.85rem)",letterSpacing:".08em",padding:"clamp(.35rem,1.8vw,.45rem) clamp(.45rem,2vw,.7rem)",minWidth:"clamp(44px,12vw,60px)",WebkitTapHighlightColor:"transparent"}}>NEXT ▶</button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
