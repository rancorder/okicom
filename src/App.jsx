import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";

// ═══════════════════════════════════════════════════════════════════
// ─── THREE.JS INFRASTRUCTURE (dx-demo-v2-stable) ────────────────
// ═══════════════════════════════════════════════════════════════════

const sharedRenderer = { current: null };

function disposeLight(light) {
  if (light.shadow && light.shadow.map) {
    light.shadow.map.dispose();
    light.shadow.map = null;
  }
}

function disposeSceneOnly(scene) {
  const disposed = new WeakSet();
  const safe = obj => {
    if (!obj || disposed.has(obj)) return;
    disposed.add(obj);
    if (typeof obj.dispose === "function") obj.dispose();
  };
  const disposeMats = mats => {
    mats.forEach(m => {
      Object.values(m).forEach(v => { if (v && v.isTexture) safe(v); });
      safe(m);
    });
  };
  scene.traverse(obj => {
    if (obj.isLight) { disposeLight(obj); return; }
    if (obj.isLineSegments && !obj.userData.disposable) {
      safe(obj.geometry);
      const mats = obj.material ? (Array.isArray(obj.material) ? obj.material : [obj.material]) : [];
      disposeMats(mats); return;
    }
    if (!obj.userData.disposable) return;
    safe(obj.geometry);
    const mats = obj.material ? (Array.isArray(obj.material) ? obj.material : [obj.material]) : [];
    disposeMats(mats);
  });
  scene.clear();
}

function mkMesh(geo, mat) { const m = new THREE.Mesh(geo, mat); m.userData.disposable = true; return m; }
function mkLine(pts, mat) { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat); l.userData.disposable = true; return l; }
function mkPoints(geo, mat) { const p = new THREE.Points(geo, mat); p.userData.disposable = true; return p; }

function useOrbit(mountRef, active) {
  const s = useRef({ dragging: false, lx: 0, ly: 0, theta: 0.4, phi: 1.0, r: 20 });
  useEffect(() => {
    const el = mountRef.current;
    if (!active || !el) return;
    const dn = e => { s.current.dragging = true; s.current.lx = e.clientX; s.current.ly = e.clientY; };
    const up = () => { s.current.dragging = false; };
    const mv = e => {
      if (!s.current.dragging) return;
      s.current.theta -= (e.clientX - s.current.lx) * 0.008;
      s.current.phi = Math.max(0.18, Math.min(Math.PI / 2 - 0.04, s.current.phi - (e.clientY - s.current.ly) * 0.006));
      s.current.lx = e.clientX; s.current.ly = e.clientY;
    };
    const wh = e => { s.current.r = Math.max(6, Math.min(50, s.current.r + e.deltaY * 0.02)); };
    el.addEventListener("mousedown", dn);
    window.addEventListener("mouseup", up);
    window.addEventListener("mousemove", mv);
    el.addEventListener("wheel", wh, { passive: true });
    return () => {
      s.current.dragging = false;
      el.removeEventListener("mousedown", dn);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("mousemove", mv);
      el.removeEventListener("wheel", wh);
    };
  }, [active]);
  return s;
}

const T_WRAP = Math.PI * 2000;

function useThree(mountRef, active, setup, tick, orbitTarget = [0, 0, 0], initOrbit = { theta: 0.4, phi: 0.95, r: 20 }) {
  const orbitTargetRef = useRef(orbitTarget);
  const initOrbitRef = useRef(initOrbit);
  useEffect(() => { orbitTargetRef.current = orbitTarget; initOrbitRef.current = initOrbit; });
  const orbit = useOrbit(mountRef, active);
  useEffect(() => {
    if (!active || !mountRef.current) return;
    Object.assign(orbit.current, initOrbitRef.current);
    const W = mountRef.current.clientWidth, H = mountRef.current.clientHeight;
    if (!sharedRenderer.current) {
      const r = new THREE.WebGLRenderer({ antialias: true });
      r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.3;
      r.physicallyCorrectLights = true;
      r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
      sharedRenderer.current = r;
    }
    const renderer = sharedRenderer.current;
    renderer.setSize(W, H);
    const canvas = renderer.domElement;
    if (canvas.parentNode !== mountRef.current) {
      if (canvas.parentNode && canvas.parentNode.contains(canvas)) canvas.parentNode.removeChild(canvas);
      mountRef.current.appendChild(canvas);
    }
    const camera = new THREE.PerspectiveCamera(48, W / H, 0.1, 300);
    const scene = new THREE.Scene();
    // ── 環境反射マップ（sharedRendererに1度だけ生成・全Sceneで共有）──
    if (!sharedRenderer.envMap) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envScene = new THREE.Scene();
      envScene.background = new THREE.Color(0x303040);
      sharedRenderer.envMap = pmrem.fromScene(envScene).texture;
      pmrem.dispose();
    }
    scene.environment = sharedRenderer.envMap;
    const state = Object.assign({ alive: true }, setup(scene, camera, renderer));
    const onResize = () => {
      if (!mountRef.current) return;
      const nW = mountRef.current.clientWidth, nH = mountRef.current.clientHeight;
      camera.aspect = nW / nH; camera.updateProjectionMatrix(); renderer.setSize(nW, nH);
    };
    window.addEventListener("resize", onResize);
    let tickErrReported = false, rafId = null, alive = true, started = false;
    const animate = () => {
      if (!alive) return;
      rafId = requestAnimationFrame(animate);
      if (typeof state.t === "number" && state.t > T_WRAP) state.t -= T_WRAP;
      if (tick) { try { tick(state, scene, camera, renderer); } catch (err) { if (!tickErrReported) { console.warn("[useThree] tick error:", err); tickErrReported = true; } } }
      const o = orbit.current, tgt = orbitTargetRef.current;
      camera.position.set(o.r * Math.sin(o.theta) * Math.sin(o.phi), o.r * Math.cos(o.phi), o.r * Math.cos(o.theta) * Math.sin(o.phi));
      camera.lookAt(tgt[0], tgt[1], tgt[2]);
      renderer.render(scene, camera);
    };
    if (!started) { started = true; animate(); }
    return () => {
      alive = false; state.alive = false;
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      window.removeEventListener("resize", onResize);
      if (canvas.parentNode && canvas.parentNode.contains(canvas)) canvas.parentNode.removeChild(canvas);
      disposeSceneOnly(scene);
    };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ═══════════════════════════════════════════════════════════════════
// ─── 7 THREE.JS INDUSTRIAL SCENES ───────────────────────────────
// ═══════════════════════════════════════════════════════════════════

function GISScene({ active }) {
  const mountRef = useRef(null);
  useThree(mountRef, active, (scene) => {
    scene.background = new THREE.Color(0x1a2230);
    scene.fog = new THREE.FogExp2(0x1a2230, 0.020);
    const SEG = 120;
    const buildTerrain = () => {
      const g = new THREE.PlaneGeometry(22, 22, SEG, SEG); g.rotateX(-Math.PI / 2);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        pos.setY(i, Math.sin(x*.8)*1.3+Math.cos(z*.7)*.9+Math.sin(x*1.5+z*1.2)*.55+Math.cos(x*2.1-z*1.8)*.4+Math.sin(x*3.2+z*2.7)*.2);
      }
      g.computeVertexNormals();
      const cols=[], c1=new THREE.Color(0x1a6b8a), c2=new THREE.Color(0x2d9e6b), c3=new THREE.Color(0xe8c06a), c4=new THREE.Color(0xdddddd);
      for (let i=0; i<pos.count; i++) {
        const t=(pos.getY(i)+2)/5;
        const c=t<.3?c1.clone().lerp(c2,t/.3):t<.65?c2.clone().lerp(c3,(t-.3)/.35):c3.clone().lerp(c4,(t-.65)/.35);
        cols.push(c.r,c.g,c.b);
      }
      g.setAttribute("color",new THREE.Float32BufferAttribute(cols,3)); return g;
    };
    scene.add(mkMesh(buildTerrain(),new THREE.MeshLambertMaterial({vertexColors:true})));
    scene.add(mkMesh(buildTerrain(),new THREE.MeshBasicMaterial({color:0x00ffe0,wireframe:true,transparent:true,opacity:.07})));
    [[1,1],[-2,-1.5],[3,-2]].forEach(([x,z])=>{
      const pole=mkMesh(new THREE.CylinderGeometry(.03,.03,1.4,8),new THREE.MeshLambertMaterial({color:0xff4444}));
      pole.position.set(x,1.1,z); scene.add(pole);
      const flag=mkMesh(new THREE.BoxGeometry(.45,.28,.02),new THREE.MeshLambertMaterial({color:0xff8800}));
      flag.position.set(x+.22,1.8,z); scene.add(flag);
      const pl=new THREE.PointLight(0xff6600,.8,3); pl.position.set(x,1.9,z); scene.add(pl);
    });
    const sea=mkMesh(new THREE.PlaneGeometry(30,30),new THREE.MeshLambertMaterial({color:0x0d4f8a,transparent:true,opacity:.65}));
    sea.rotation.x=-Math.PI/2; sea.position.y=-2.05; scene.add(sea);
    scene.add(new THREE.AmbientLight(0xffffff,0.3));
    const hemi=new THREE.HemisphereLight(0xffffff,0x202040,1.0); scene.add(hemi);
    const sun=new THREE.DirectionalLight(0xffeedd,4); sun.position.set(10,15,8); sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-20; sun.shadow.camera.right=20; sun.shadow.camera.top=20; sun.shadow.camera.bottom=-20;
    scene.add(sun);
    const rim=new THREE.DirectionalLight(0x4466aa,2); rim.position.set(-8,6,-8); scene.add(rim);
    const grid=new THREE.GridHelper(22,22,0x00ffff,0x003344); grid.position.y=-2.1; grid.material.opacity=.25; grid.material.transparent=true; scene.add(grid);
    return {};
  }, null, [0,.5,0], {theta:.4,phi:1.0,r:20});
  return <div ref={mountRef} style={{width:"100%",height:"100%",cursor:"grab"}}/>;
}

function CIMScene({ active }) {
  const mountRef = useRef(null);
  useThree(mountRef, active, (scene) => {
    scene.background = new THREE.Color(0x1a2230);
    scene.fog = new THREE.Fog(0x1a2230,35,90);
    const floor=mkMesh(new THREE.PlaneGeometry(60,60),new THREE.MeshStandardMaterial({color:0x181e2a,roughness:.95}));
    floor.rotation.x=-Math.PI/2; scene.add(floor);
    const grid=new THREE.GridHelper(40,20,0x00aaff,0x003355); grid.material.opacity=.35; grid.material.transparent=true; scene.add(grid);
    [[10,8,3,1.5,0x334455],[9,7,3,4.5,0x3a4d60],[8,6,3,7.5,0x425670],[7,5,3,10.5,0x4a5f80]].forEach(([w,d,h,y,col])=>{
      const mesh=mkMesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color:col,roughness:.4,metalness:.5}));
      mesh.position.y=y; mesh.castShadow=true; mesh.receiveShadow=true; scene.add(mesh);
      for(let wx=-Math.floor(w/2)+1;wx<w/2;wx+=1.8){
        for(let wy=-.8;wy<=.8;wy+=1.2){
          const win=mkMesh(new THREE.BoxGeometry(.9,.6,.05),new THREE.MeshStandardMaterial({color:0xffd090,emissive:0xffa030,emissiveIntensity:.9,roughness:.1}));
          win.position.set(wx,y+wy,d/2+.01); scene.add(win);
        }
      }
    });
    const craneGroup=new THREE.Group(); scene.add(craneGroup);
    const craneBase=mkMesh(new THREE.CylinderGeometry(.2,.3,15,8),new THREE.MeshStandardMaterial({color:0xff8800,roughness:.6,metalness:.4}));
    craneBase.position.set(8,7.5,2); craneBase.castShadow=true; craneGroup.add(craneBase);
    const craneArm=mkMesh(new THREE.BoxGeometry(9,.22,.22),new THREE.MeshStandardMaterial({color:0xff8800,roughness:.6,metalness:.4}));
    craneArm.position.set(4,15.1,2); craneGroup.add(craneArm);
    const hook=mkMesh(new THREE.BoxGeometry(.4,.4,.4),new THREE.MeshStandardMaterial({color:0xaaaaaa,roughness:.4,metalness:.8}));
    hook.position.set(8,12,2); craneGroup.add(hook);
    for(let sy=0;sy<13;sy+=1.5){
      for(let sx=-5.2;sx<=5.2;sx+=2){
        const pole=mkMesh(new THREE.CylinderGeometry(.04,.04,1.5,6),new THREE.MeshStandardMaterial({color:0x667788,roughness:.9,metalness:.2}));
        pole.position.set(sx,sy+.75,4.25); scene.add(pole);
      }
      const bar=mkMesh(new THREE.BoxGeometry(10.4,.05,.05),new THREE.MeshStandardMaterial({color:0x889999,roughness:.9,metalness:.2}));
      bar.position.set(0,sy+1.5,4.25); scene.add(bar);
    }
    const sun=new THREE.DirectionalLight(0xfff5e0,4); sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048);
    sun.shadow.camera.left=-20; sun.shadow.camera.right=20; sun.shadow.camera.top=20; sun.shadow.camera.bottom=-20;
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0xffffff,0.3));
    const hemi=new THREE.HemisphereLight(0xffffff,0x202040,1.0); scene.add(hemi);
    const rim=new THREE.DirectionalLight(0x4466aa,2); rim.position.set(-10,6,-8); scene.add(rim);
    [[5,.3,3],[-5,.3,3],[5,.3,-3],[-5,.3,-3]].forEach(([x,y,z])=>{
      const pl=new THREE.PointLight(0xffaa44,2,8); pl.position.set(x,y,z); scene.add(pl);
      const bulb=mkMesh(new THREE.SphereGeometry(.12,8,8),new THREE.MeshStandardMaterial({color:0xffaa44,emissive:0xff8800,emissiveIntensity:2}));
      bulb.position.set(x,y,z); scene.add(bulb);
    });
    return {sun,craneArm,hook};
  }, (state)=>{
    if(!state.alive)return;
    const t=performance.now()*.001;
    state.sun.position.set(Math.cos(t*.3)*22,16+Math.sin(t*.2)*4,Math.sin(t*.3)*22);
    state.craneArm.rotation.y=Math.sin(t*.4)*.8;
    state.hook.position.set(8+Math.sin(t*.4)*3,11+Math.sin(t*.7)*1.5,2);
  }, [0,5,0], {theta:.6,phi:.88,r:24});
  return <div ref={mountRef} style={{width:"100%",height:"100%",cursor:"grab"}}/>;
}

function FisheryScene({ active }) {
  const mountRef = useRef(null);
  useThree(mountRef, active, (scene) => {
    scene.background = new THREE.Color(0x1a2230);
    scene.fog = new THREE.FogExp2(0x1a2230,.016);
    const SEG=80;
    const buildSeabed=()=>{
      const g=new THREE.PlaneGeometry(24,24,SEG,SEG); g.rotateX(-Math.PI/2);
      const sp=g.attributes.position;
      for(let i=0;i<sp.count;i++){
        const x=sp.getX(i),z=sp.getZ(i),d=Math.sqrt(x*x+z*z);
        sp.setY(i,-3+Math.sin(x*.6+1)*1.2+Math.cos(z*.5)*.8+Math.sin(d*.3)*.6);
      }
      g.computeVertexNormals();
      const sc=[],s1=new THREE.Color(0x0a3356),s2=new THREE.Color(0x1a6b8a),s3=new THREE.Color(0x2aaa6a);
      for(let i=0;i<sp.count;i++){
        const t=(sp.getY(i)+3)/3,c=t<.5?s1.clone().lerp(s2,t*2):s2.clone().lerp(s3,(t-.5)*2);
        sc.push(c.r,c.g,c.b);
      }
      g.setAttribute("color",new THREE.Float32BufferAttribute(sc,3)); return g;
    };
    scene.add(mkMesh(buildSeabed(),new THREE.MeshLambertMaterial({vertexColors:true})));
    scene.add(mkMesh(buildSeabed(),new THREE.MeshBasicMaterial({color:0x00aaff,wireframe:true,transparent:true,opacity:.05})));
    const wm=mkMesh(new THREE.PlaneGeometry(30,30),new THREE.MeshStandardMaterial({color:0x0a2244,transparent:true,opacity:.42,roughness:.1,metalness:.3}));
    wm.rotation.x=-Math.PI/2; wm.position.y=2.5; scene.add(wm);
    [[0,-1.5,0,0x00ff88,3],[5,-1,-3,0xffaa00,2.5],[-4,-2,3,0xff4444,2]].forEach(([x,y,z,col,r])=>{
      const zone=mkMesh(new THREE.CircleGeometry(r,32),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.25,side:THREE.DoubleSide}));
      zone.rotation.x=-Math.PI/2; zone.position.set(x,y+.05,z); scene.add(zone);
      const ring=mkMesh(new THREE.RingGeometry(r-.12,r,32),new THREE.MeshBasicMaterial({color:col,side:THREE.DoubleSide,transparent:true,opacity:.85}));
      ring.rotation.x=-Math.PI/2; ring.position.set(x,y+.1,z); scene.add(ring);
      const pl=new THREE.PointLight(col,.6,r*1.5); pl.position.set(x,y+.5,z); scene.add(pl);
    });
    const drone=new THREE.Group(); scene.add(drone);
    drone.add(mkMesh(new THREE.BoxGeometry(.42,.16,.42),new THREE.MeshStandardMaterial({color:0x334455,roughness:.4,metalness:.7})));
    const props=[];
    [[-1,1],[1,1],[-1,-1],[1,-1]].forEach(([xi,zi])=>{
      const p=mkMesh(new THREE.CylinderGeometry(.19,.19,.025,12),new THREE.MeshStandardMaterial({color:0x00aaff,transparent:true,opacity:.55}));
      p.position.set(xi*.38,.06,zi*.38); drone.add(p); props.push(p);
    });
    drone.add(mkMesh(new THREE.SphereGeometry(.07,8,8),new THREE.MeshStandardMaterial({color:0x00ffff,emissive:0x00ffff,emissiveIntensity:3})));
    const dl=new THREE.PointLight(0x00ffff,2.5,4); drone.add(dl);
    const pts=[]; for(let i=0;i<=200;i++){const a=(i/200)*Math.PI*4;pts.push(new THREE.Vector3(Math.sin(a)*7,2.8+Math.sin(a*.5)*.4,Math.sin(a*.5)*5));}
    scene.add(mkLine(pts,new THREE.LineBasicMaterial({color:0x00ffff,transparent:true,opacity:.35})));
    scene.add(new THREE.AmbientLight(0xffffff,0.3));
    const hemi=new THREE.HemisphereLight(0xffffff,0x202040,1.0); scene.add(hemi);
    const dirL=new THREE.DirectionalLight(0xddeeff,4); dirL.position.set(10,20,5); dirL.castShadow=true;
    dirL.shadow.mapSize.set(2048,2048); dirL.shadow.camera.left=-20; dirL.shadow.camera.right=20; dirL.shadow.camera.top=20; dirL.shadow.camera.bottom=-20;
    scene.add(dirL);
    const rim=new THREE.DirectionalLight(0x4466aa,2); rim.position.set(-8,6,-8); scene.add(rim);
    const caustic=new THREE.PointLight(0x0066ff,2,22); caustic.position.set(0,2,0); scene.add(caustic);
    return {drone,props,wm,caustic,t:0};
  }, (state)=>{
    if(!state.alive)return;
    state.t+=.008;
    if(state.t>Math.PI*4)state.t-=Math.PI*4;
    const a=state.t;
    state.drone.position.set(Math.sin(a)*7,2.8+Math.sin(a*.5)*.4,Math.sin(a*.5)*5);
    state.drone.rotation.y=Math.atan2(Math.cos(a)*7,Math.cos(a*.5)*5*.5);
    state.props.forEach(p=>p.rotation.y+=.35);
    state.wm.material.opacity=.4+Math.sin(state.t*.5)*.05;
    state.caustic.intensity=1.5+Math.sin(state.t*2)*.5;
  }, [0,0,0], {theta:-.3,phi:.82,r:24});
  return <div ref={mountRef} style={{width:"100%",height:"100%",cursor:"grab"}}/>;
}

function IoTScene({ active }) {
  const mountRef = useRef(null);
  useThree(mountRef, active, (scene) => {
    scene.background = new THREE.Color(0x1a2230);
    scene.fog = new THREE.Fog(0x1a2230,40,100);
    const floor=mkMesh(new THREE.PlaneGeometry(40,30),new THREE.MeshStandardMaterial({color:0x111820,roughness:.9}));
    floor.rotation.x=-Math.PI/2; scene.add(floor);
    const grid=new THREE.GridHelper(40,40,0x00ff88,0x002222); grid.material.opacity=.2; grid.material.transparent=true; scene.add(grid);
    const machines=[],alerts=[];
    [-8,-4,0,4,8].forEach((x,i)=>{
      const isAlert=i===2;
      const body=mkMesh(new THREE.BoxGeometry(3,1.5,6),new THREE.MeshStandardMaterial({color:isAlert?0x442200:0x1a2a3a,roughness:.5,metalness:.6}));
      body.position.set(x,.75,0); body.castShadow=true; body.receiveShadow=true; scene.add(body);
      const belt=mkMesh(new THREE.BoxGeometry(2.6,.12,5.6),new THREE.MeshStandardMaterial({color:0x223344,roughness:.8}));
      belt.position.set(x,1.52,0); scene.add(belt);
      const sCol=isAlert?0xff2200:0x00cc66; // 落ち着いた緑 (00ff88→00cc66)
      const sensor=mkMesh(new THREE.SphereGeometry(.15,12,12),new THREE.MeshStandardMaterial({color:sCol,emissive:sCol,emissiveIntensity:1.6})); // 2.5→1.6
      sensor.position.set(x,2.2,2.5); scene.add(sensor);
      const pl=new THREE.PointLight(sCol,isAlert?2.2:0.8,4); pl.position.set(x,2.2,2.5); scene.add(pl); // 3→2.2, 1.2→0.8
      const stack=mkMesh(new THREE.CylinderGeometry(.08,.08,1.2,8),new THREE.MeshStandardMaterial({color:0x445566,metalness:.7}));
      stack.position.set(x+1.3,2.1,2.8); scene.add(stack);
      machines.push({sensor,pl,isAlert,x});
      if(isAlert){
        const warn=mkMesh(new THREE.BoxGeometry(3.4,1.7,6.4),new THREE.MeshBasicMaterial({color:0xff3300,transparent:true,opacity:.08,side:THREE.DoubleSide}));
        warn.position.set(x,.85,0); scene.add(warn); alerts.push(warn);
      }
      for(let z=-2;z<=2;z+=1.3){
        const item=mkMesh(new THREE.BoxGeometry(.6,.4,.6),new THREE.MeshStandardMaterial({color:0x8899aa,roughness:.4,metalness:.5}));
        item.position.set(x,1.72,z); scene.add(item); machines.push({item,baseZ:z});
      }
    });
    for(let cx=-6;cx<=6;cx+=6){
      const rig=mkMesh(new THREE.BoxGeometry(.3,.3,.3),new THREE.MeshStandardMaterial({color:0x334455,metalness:.8}));
      rig.position.set(cx,5.5,0); scene.add(rig);
      const sl=new THREE.SpotLight(0xffffff,.8,12,Math.PI/6); sl.position.set(cx,5.5,0); scene.add(sl);
    }
    for(let px=-9;px<=9;px+=3){
      const pipe=mkMesh(new THREE.CylinderGeometry(.08,.08,30,8),new THREE.MeshStandardMaterial({color:0x334455,metalness:.7}));
      pipe.rotation.z=Math.PI/2; pipe.position.set(0,5,px*.5); scene.add(pipe);
    }
    scene.add(new THREE.AmbientLight(0xffffff,0.3));
    const hemi=new THREE.HemisphereLight(0xffffff,0x202040,1.0); scene.add(hemi);
    const ml=new THREE.DirectionalLight(0xfff5e0,4); ml.position.set(5,15,5); ml.castShadow=true;
    ml.shadow.mapSize.set(2048,2048); ml.shadow.camera.left=-20; ml.shadow.camera.right=20; ml.shadow.camera.top=20; ml.shadow.camera.bottom=-20;
    scene.add(ml);
    const rim=new THREE.DirectionalLight(0x4466aa,2); rim.position.set(-8,6,-8); scene.add(rim);
    return {machines,alerts,t:0};
  }, (state)=>{
    if(!state.alive)return;
    state.t+=.016;
    state.machines.forEach(m=>{
      if(m.item!==undefined){
        const raw=m.baseZ+state.t*1.2, range=8;
        m.item.position.z=((raw%range)+range)%range-4;
      }
      if(m.sensor&&m.isAlert){
        const pulse=.5+.5*Math.sin(state.t*8);
        m.sensor.material.emissiveIntensity=1+pulse*3;
        m.pl.intensity=1.5+pulse*3;
      }
    });
    state.alerts.forEach(a=>{a.material.opacity=.04+.06*Math.abs(Math.sin(state.t*4));});
  }, [0,2,0], {theta:.5,phi:.8,r:26});
  return <div ref={mountRef} style={{width:"100%",height:"100%",cursor:"grab"}}/>;
}

function LogisticsScene({ active }) {
  const mountRef = useRef(null);
  useThree(mountRef, active, (scene) => {
    scene.background = new THREE.Color(0x1a2230);
    scene.fog = new THREE.FogExp2(0x1a2230,.014);
    const road=mkMesh(new THREE.PlaneGeometry(30,30),new THREE.MeshStandardMaterial({color:0x0d1020,roughness:.95}));
    road.rotation.x=-Math.PI/2; scene.add(road);
    const grid=new THREE.GridHelper(30,15,0x1a2a4a,0x0a1525); grid.material.opacity=.6; grid.material.transparent=true; scene.add(grid);
    [[-6,0,-6,3,4,3],[-6,0,0,3,6,3],[-6,0,6,3,3,3],[0,0,-6,3,5,3],[6,0,-6,3,8,3],[6,0,0,3,4,3],[6,0,6,3,6,3],[0,0,6,3,3,3]].forEach(([x,,z,w,h,d])=>{
      const b=mkMesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color:0x1a2233,roughness:.4,metalness:.5}));
      b.position.set(x,h/2,z); b.castShadow=true; scene.add(b);
      for(let wy=.5;wy<h-1;wy+=1.2){
        const win=mkMesh(new THREE.BoxGeometry(w*.6,.5,.05),new THREE.MeshStandardMaterial({color:0xffd090,emissive:0xff8820,emissiveIntensity:Math.random()*.8+.2}));
        win.position.set(x,wy,z+d/2+.01); scene.add(win);
      }
    });
    const depot=mkMesh(new THREE.BoxGeometry(5,2,4),new THREE.MeshStandardMaterial({color:0x334455,roughness:.6,metalness:.4}));
    depot.position.set(0,1,0); scene.add(depot);
    const depotLight=new THREE.PointLight(0x00aaff,3,8); depotLight.position.set(0,3,0); scene.add(depotLight);
    const routeColors=[0x00ff88,0xff8800,0x00aaff,0xff44aa];
    const routes=[[{x:-6,z:-6},{x:-3,z:-6},{x:-3,z:0},{x:0,z:0}],[{x:6,z:0},{x:3,z:0},{x:0,z:0}],[{x:0,z:6},{x:0,z:3},{x:0,z:0}],[{x:6,z:-6},{x:3,z:-6},{x:0,z:-3},{x:0,z:0}]];
    routes.forEach((route,ri)=>{
      scene.add(mkLine(route.map(p=>new THREE.Vector3(p.x,.15,p.z)),new THREE.LineBasicMaterial({color:routeColors[ri],transparent:true,opacity:.6})));
    });
    const trucks=routes.map((route,ri)=>{
      const g=new THREE.Group();
      g.add(mkMesh(new THREE.BoxGeometry(.6,.4,.9),new THREE.MeshStandardMaterial({color:routeColors[ri],roughness:.4,metalness:.4})));
      const cab=mkMesh(new THREE.BoxGeometry(.6,.35,.4),new THREE.MeshStandardMaterial({color:routeColors[ri],roughness:.3}));
      cab.position.set(0,.17,.6); g.add(cab);
      const hl=new THREE.PointLight(routeColors[ri],2,3); g.add(hl);
      g.position.set(route[0].x,.3,route[0].z); scene.add(g);
      return {g,route,t:Math.random()};
    });
    [[-6,-6],[6,0],[0,6],[6,-6]].forEach(([x,z],i)=>{
      const marker=mkMesh(new THREE.ConeGeometry(.3,.8,8),new THREE.MeshStandardMaterial({color:routeColors[i],emissive:routeColors[i],emissiveIntensity:.5}));
      marker.position.set(x,.8,z); scene.add(marker);
      const pl=new THREE.PointLight(routeColors[i],1.5,4); pl.position.set(x,1.5,z); scene.add(pl);
    });
    scene.add(new THREE.AmbientLight(0xffffff,0.3));
    const hemi=new THREE.HemisphereLight(0xffffff,0x202040,1.0); scene.add(hemi);
    const sun=new THREE.DirectionalLight(0xffeedd,4); sun.position.set(10,20,5); sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-20; sun.shadow.camera.right=20; sun.shadow.camera.top=20; sun.shadow.camera.bottom=-20;
    scene.add(sun);
    const rim=new THREE.DirectionalLight(0x4466aa,2); rim.position.set(-8,6,-8); scene.add(rim);
    return {trucks};
  }, (state)=>{
    if(!state.alive)return;
    state.trucks.forEach(truck=>{
      truck.t+=.004; if(truck.t>=1)truck.t-=1;
      const route=truck.route,total=route.length-1;
      const seg=truck.t*total,idx=Math.min(Math.floor(seg),total-1),frac=seg-idx;
      const from=route[idx],to=route[idx+1]||route[idx];
      truck.g.position.set(from.x+(to.x-from.x)*frac,.3,from.z+(to.z-from.z)*frac);
      const dx=to.x-from.x,dz=to.z-from.z;
      if(dx||dz)truck.g.rotation.y=Math.atan2(dx,dz);
    });
  }, [0,2,0], {theta:.4,phi:.75,r:28});
  return <div ref={mountRef} style={{width:"100%",height:"100%",cursor:"grab"}}/>;
}

function HealthcareScene({ active }) {
  const mountRef = useRef(null);
  useThree(mountRef, active, (scene) => {
    scene.background = new THREE.Color(0x1a2230);
    scene.fog = new THREE.Fog(0x1a2230,30,80);
    const floor=mkMesh(new THREE.PlaneGeometry(30,20),new THREE.MeshStandardMaterial({color:0x0c1520,roughness:.7}));
    floor.rotation.x=-Math.PI/2; scene.add(floor);
    scene.add(new THREE.GridHelper(30,30,0x0a2030,0x051015));
    const vitals=[];
    [[-8,4],[-8,0],[-8,-4],[8,4],[8,0],[8,-4]].forEach(([x,z])=>{
      const bed=mkMesh(new THREE.BoxGeometry(2,.4,3.5),new THREE.MeshStandardMaterial({color:0x223344,roughness:.6}));
      bed.position.set(x,.2,z); scene.add(bed);
      const mat=mkMesh(new THREE.BoxGeometry(1.8,.25,3.3),new THREE.MeshStandardMaterial({color:0x334455,roughness:.8}));
      mat.position.set(x,.45,z); scene.add(mat);
      const mon=mkMesh(new THREE.BoxGeometry(.8,1,.05),new THREE.MeshStandardMaterial({color:0x111922}));
      mon.position.set(x+1.2,1.4,z); scene.add(mon);
      const screen=mkMesh(new THREE.PlaneGeometry(.7,.85),new THREE.MeshStandardMaterial({color:0x001122,emissive:0x002244,emissiveIntensity:.5})); // emissive色落ち着け・intensity .8→.5
      screen.position.set(x+1.2,1.4,z+.04); scene.add(screen);
      const pl=new THREE.PointLight(0x0088cc,.6,3); pl.position.set(x+1.2,1.8,z); scene.add(pl); // 00aaff→0088cc, .8→.6
      const stand=mkMesh(new THREE.CylinderGeometry(.03,.03,2,8),new THREE.MeshStandardMaterial({color:0x889999,metalness:.8}));
      stand.position.set(x-1.1,1,z); scene.add(stand);
      const bag=mkMesh(new THREE.BoxGeometry(.3,.5,.1),new THREE.MeshStandardMaterial({color:0x88ccdd,transparent:true,opacity:.7}));
      bag.position.set(x-1.1,2.1,z); scene.add(bag);
      scene.add(mkLine([new THREE.Vector3(x,1.5,z),new THREE.Vector3(0,2,0)],new THREE.LineBasicMaterial({color:0x0066aa,transparent:true,opacity:.3})));
      vitals.push({x,z,pl,phase:Math.random()*Math.PI*2});
    });
    const ns=mkMesh(new THREE.BoxGeometry(4,1.2,3),new THREE.MeshStandardMaterial({color:0x1a2a3a,roughness:.5,metalness:.4}));
    ns.position.set(0,.6,0); scene.add(ns);
    const nsLight=new THREE.PointLight(0x00ccaa,1.5,5); nsLight.position.set(0,2.5,0); scene.add(nsLight); // 00ffcc→00ccaa, 2→1.5, 6→5
    const waveGeo=new THREE.BufferGeometry();
    const wavePos=new Float32Array(200*3);
    const wavePosAttr=new THREE.BufferAttribute(wavePos,3);
    wavePosAttr.setUsage(THREE.DynamicDrawUsage);
    waveGeo.setAttribute("position",wavePosAttr);
    const waveLine=new THREE.Line(waveGeo,new THREE.LineBasicMaterial({color:0x00ff88}));
    waveLine.userData.disposable=true;
    waveLine.position.set(-3.5,1.35,1.5); waveLine.scale.set(.3,.2,.3); scene.add(waveLine);
    scene.add(new THREE.AmbientLight(0xffffff,0.3));
    const hemi=new THREE.HemisphereLight(0xffffff,0x202040,1.0); scene.add(hemi);
    const ml=new THREE.DirectionalLight(0xfff5e0,4); ml.position.set(5,15,3); ml.castShadow=true;
    ml.shadow.mapSize.set(2048,2048); ml.shadow.camera.left=-20; ml.shadow.camera.right=20; ml.shadow.camera.top=20; ml.shadow.camera.bottom=-20;
    scene.add(ml);
    const rim=new THREE.DirectionalLight(0x4466aa,2); rim.position.set(-8,6,-8); scene.add(rim);
    return {vitals,waveLine,wavePos,t:0};
  }, (state)=>{
    if(!state.alive)return;
    state.t+=.025;
    state.vitals.forEach(v=>{
      const hr=60+20*Math.sin(v.phase+state.t*2);
      v.pl.color.setHex(hr>90?0xff4444:0x00ff88);
      v.pl.intensity=.5+.5*Math.abs(Math.sin(v.phase+state.t*(hr/30)));
    });
    for(let i=0;i<200;i++){
      const phase=state.t*5+i*.1;
      const ecg=Math.sin(phase)*.1+(Math.abs(Math.sin(phase*5))<.15?1.5*Math.exp(-Math.pow(Math.sin(phase*5)/.15,2)):0);
      state.wavePos[i*3]=(i/200)*7-3.5; state.wavePos[i*3+1]=ecg*.4; state.wavePos[i*3+2]=0;
    }
    state.waveLine.geometry.attributes.position.needsUpdate=true;
  }, [0,1.5,0], {theta:.4,phi:.72,r:22});
  return <div ref={mountRef} style={{width:"100%",height:"100%",cursor:"grab"}}/>;
}

function AIAnalyticsScene({ active }) {
  const mountRef = useRef(null);
  useThree(mountRef, active, (scene) => {
    scene.background = new THREE.Color(0x1a2230);
    scene.fog = new THREE.FogExp2(0x1a2230,.018);
    const colors=[0x00aaff,0xff8800,0x00ff88,0xff44aa,0xaa44ff];
    const nodes=[];
    for(let i=0;i<40;i++){
      const col=colors[i%colors.length];
      const sphere=mkMesh(new THREE.SphereGeometry(i<5?.35:.18,16,16),new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:i<5?.5:.3,roughness:.2,metalness:.3})); // 0.8→0.5/0.3
      if(i<5)sphere.position.set(((i%3)-1)*3,(Math.floor(i/3)-1)*3,0);
      else sphere.position.set((Math.random()-.5)*14,(Math.random()-.5)*10,(Math.random()-.5)*14);
      scene.add(sphere);
      const pl=new THREE.PointLight(col,i<5?1.4:.45,i<5?4:2); pl.position.copy(sphere.position); scene.add(pl); // 2→1.4, 0.6→0.45
      nodes.push({mesh:sphere,pl,col,vel:new THREE.Vector3((Math.random()-.5)*.01,(Math.random()-.5)*.01,(Math.random()-.5)*.01),isCore:i<5});
    }
    const edgeLines=[];
    for(let i=0;i<nodes.length-1;i++){
      const count=nodes[i].isCore?6:2;
      for(let c=0;c<count;c++){
        const j=Math.floor(Math.random()*nodes.length);
        const pts=[nodes[i].mesh.position.clone(),nodes[j].mesh.position.clone()];
        const geo=new THREE.BufferGeometry().setFromPoints(pts);
        geo.attributes.position.setUsage(THREE.DynamicDrawUsage);
        const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color:0x0033aa,transparent:true,opacity:.4}));
        line.userData.disposable=true; scene.add(line);
        edgeLines.push({line,a:nodes[i],b:nodes[j]});
      }
    }
    const pCount=300;
    const pGeo=new THREE.BufferGeometry();
    const pPos=new Float32Array(pCount*3),pCol=new Float32Array(pCount*3);
    for(let i=0;i<pCount;i++){
      pPos[i*3]=(Math.random()-.5)*20; pPos[i*3+1]=(Math.random()-.5)*14; pPos[i*3+2]=(Math.random()-.5)*20;
      const pc=new THREE.Color(colors[i%colors.length]); pCol[i*3]=pc.r; pCol[i*3+1]=pc.g; pCol[i*3+2]=pc.b;
    }
    const pPosAttr=new THREE.BufferAttribute(pPos,3); pPosAttr.setUsage(THREE.DynamicDrawUsage);
    pGeo.setAttribute("position",pPosAttr); pGeo.setAttribute("color",new THREE.BufferAttribute(pCol,3));
    const particles=mkPoints(pGeo,new THREE.PointsMaterial({size:.1,vertexColors:true,transparent:true,opacity:.5})); // .12→.1, .7→.5
    scene.add(particles);
    scene.add(new THREE.AmbientLight(0xffffff,0.3));
    const hemi=new THREE.HemisphereLight(0xffffff,0x202040,1.0); scene.add(hemi);
    const dirL=new THREE.DirectionalLight(0xfff5e0,4); dirL.position.set(8,12,5); dirL.castShadow=true;
    dirL.shadow.mapSize.set(2048,2048); dirL.shadow.camera.left=-20; dirL.shadow.camera.right=20; dirL.shadow.camera.top=20; dirL.shadow.camera.bottom=-20;
    scene.add(dirL);
    const rim=new THREE.DirectionalLight(0x4466aa,2); rim.position.set(-8,6,-8); scene.add(rim);
    return {nodes,edgeLines,particles,pPos,t:0};
  }, (state)=>{
    if(!state.alive)return;
    state.t+=.012;
    state.nodes.forEach((n,i)=>{
      if(!n.isCore){
        n.mesh.position.addScaledVector(n.vel,1);
        if(Math.abs(n.mesh.position.x)>8)n.vel.x*=-1;
        if(Math.abs(n.mesh.position.y)>6)n.vel.y*=-1;
        if(Math.abs(n.mesh.position.z)>8)n.vel.z*=-1;
        n.pl.position.copy(n.mesh.position);
      } else {
        n.mesh.position.x=Math.sin(state.t*.5+i)*2;
        n.mesh.position.y=Math.cos(state.t*.4+i)*1.5;
        n.pl.position.copy(n.mesh.position);
      }
      n.mesh.material.emissiveIntensity=.3+.25*Math.sin(state.t*2.5+i); // .5+.5→.3+.25 (振れ幅も縮小)
    });
    state.edgeLines.forEach(({line,a,b})=>{
      const pos=line.geometry.attributes.position;
      pos.setXYZ(0,a.mesh.position.x,a.mesh.position.y,a.mesh.position.z);
      pos.setXYZ(1,b.mesh.position.x,b.mesh.position.y,b.mesh.position.z);
      pos.needsUpdate=true;
    });
    for(let i=0;i<300;i++){
      let ny=state.pPos[i*3+1]+.03; if(ny>7)ny=-7; state.pPos[i*3+1]=ny;
      state.pPos[i*3]+=Math.sin(state.t+i)*.01;
    }
    state.particles.geometry.attributes.position.needsUpdate=true;
    state.particles.rotation.y=state.t*.05;
  }, [0,0,0], {theta:.4,phi:.85,r:22});
  return <div ref={mountRef} style={{width:"100%",height:"100%",cursor:"grab"}}/>;
}

// ═══════════════════════════════════════════════════════════════════
// ─── OKICOM APP CODE ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════

/* ─── Audio ─── */
let _ac = null;
function getCtx() { try { if(typeof window==="undefined")return null; if(!_ac){const A=window.AudioContext||window.webkitAudioContext; if(!A)return null; _ac=new A();} if(_ac.state==="suspended")_ac.resume(); return _ac; } catch(_){return null;} }
function beep(freq,type,dur,vol) { try { const ctx=getCtx(); if(!ctx)return; const o=ctx.createOscillator(),g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type=type||"square"; o.frequency.setValueAtTime(freq||440,ctx.currentTime); g.gain.setValueAtTime(vol||0.06,ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+(dur||0.08)); o.start(); o.stop(ctx.currentTime+(dur||0.08)); } catch(_){} }
const sfxClick  = () => beep(680,"square",0.04,0.03);
const sfxSelect = () => { beep(480,"sine",0.08,0.07); setTimeout(()=>beep(720,"sine",0.12,0.05),80); };
const sfxWhoosh = () => [160,260,420].forEach((f,i)=>setTimeout(()=>beep(f,"sine",0.1,0.04),i*50));
const sfxImpact = () => { beep(55,"sawtooth",0.18,0.08); setTimeout(()=>beep(90,"square",0.1,0.04),60); };
const sfxChime  = () => [528,660,792,1056].forEach((f,i)=>setTimeout(()=>beep(f,"sine",0.3,0.08),i*110));
const sfxBoot   = () => [120,180,240,180,360].forEach((f,i)=>setTimeout(()=>beep(f,"sine",0.14,0.06),i*140));

function useIsMobile() {
  const [mob,setMob]=useState(false);
  useEffect(()=>{const check=()=>setMob(window.innerWidth<640); check(); window.addEventListener("resize",check); return()=>window.removeEventListener("resize",check);},[]);
  return mob;
}

function useSwipe(onLeft,onRight) {
  const startX=useRef(null),startY=useRef(null);
  return {
    onTouchStart:(e)=>{startX.current=e.touches[0].clientX; startY.current=e.touches[0].clientY;},
    onTouchEnd:(e)=>{
      if(startX.current===null)return;
      const dx=e.changedTouches[0].clientX-startX.current, dy=e.changedTouches[0].clientY-startY.current;
      if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>40){if(dx<0)onLeft(); else onRight();}
      startX.current=null; startY.current=null;
    },
  };
}

const C = { blue:"#1e40af", blueL:"#3b82f6", teal:"#0891b2", tealL:"#22d3ee", amber:"#d97706", amberL:"#fbbf24", danger:"#dc2626", bg:"#f0f5fb", surface:"#ffffff", text:"#0f172a", muted:"#334155", dim:"#64748b" };
const V  = "'Share Tech Mono',monospace";
const VB = "'Inter','Noto Sans JP',sans-serif";

function Corners({color,size,t}) {
  const c=color||C.blue,sz=size||24,th=t||2,s={position:"absolute",width:sz,height:sz},b=th+"px solid "+c;
  return <><div style={{...s,top:0,left:0,borderTop:b,borderLeft:b}}/><div style={{...s,top:0,right:0,borderTop:b,borderRight:b}}/><div style={{...s,bottom:0,left:0,borderBottom:b,borderLeft:b}}/><div style={{...s,bottom:0,right:0,borderBottom:b,borderRight:b}}/></>;
}

function MiniDots({cur,total}) {
  return (
    <div style={{display:"flex",gap:4,alignItems:"center",flexWrap:"wrap",justifyContent:"center"}}>
      {Array.from({length:total}).map((_,i)=>(
        <div key={i} style={{width:i<cur?18:6,height:3,background:i<cur?C.blue:"rgba(30,64,175,0.15)",boxShadow:i<cur?"0 0 4px rgba(59,130,246,0.4)":"none",transition:"all .3s ease",borderRadius:2}}/>
      ))}
    </div>
  );
}

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

function Shell({children}) {
  return (
    <div style={{height:"100%",overflowY:"auto",overflowX:"hidden",WebkitOverflowScrolling:"touch",boxSizing:"border-box"}}>
      <div style={{minHeight:"100%",padding:"clamp(1.2rem,3.5vw,3rem) clamp(1.5rem,6vw,8vw)",display:"flex",flexDirection:"column",justifyContent:"center",boxSizing:"border-box"}}>
        {children}
      </div>
    </div>
  );
}

function Label({children}) {
  return (
    <div style={{fontFamily:V,fontSize:"clamp(.6rem,2vw,.7rem)",color:"rgba(30,64,175,.4)",letterSpacing:".18em",marginBottom:"clamp(.5rem,2vw,.75rem)",display:"flex",alignItems:"center",gap:".5rem"}}>
      <span style={{display:"inline-block",width:16,height:1,background:"rgba(30,64,175,.25)"}}/>
      {children}
      <span style={{display:"inline-block",width:16,height:1,background:"rgba(30,64,175,.25)"}}/>
    </div>
  );
}

/* ─── ThreeBootScene (2D canvas) ─── */
function ThreeBootScene() {
  const cvs=useRef(null);
  useEffect(()=>{
    const el=cvs.current; if(!el)return;
    const w=el.parentElement.clientWidth,h=el.parentElement.clientHeight;
    el.width=w; el.height=h;
    const ctx=el.getContext("2d");
    const nodes=Array.from({length:28},(_,i)=>({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-.5)*.4,vy:(Math.random()-.5)*.4,r:Math.random()*3+2,opacity:Math.random()*.6+.3,pulse:Math.random()*Math.PI*2}));
    const particles=Array.from({length:60},()=>({x:Math.random()*w,y:Math.random()*h,r:Math.random()*1.2+.4,speed:Math.random()*.6+.2,angle:Math.random()*Math.PI*2,opacity:Math.random()*.4+.1,life:Math.random()}));
    let t=0,raf;
    const draw=()=>{
      t+=0.016; ctx.clearRect(0,0,w,h);
      nodes.forEach((a,ai)=>nodes.forEach((b,bi)=>{
        if(bi<=ai)return;
        const dx=b.x-a.x,dy=b.y-a.y,dist=Math.sqrt(dx*dx+dy*dy);
        if(dist<160){const alpha=(1-dist/160)*0.18; const grad=ctx.createLinearGradient(a.x,a.y,b.x,b.y); grad.addColorStop(0,`rgba(59,130,246,${alpha})`); grad.addColorStop(.5,`rgba(8,145,178,${alpha*1.4})`); grad.addColorStop(1,`rgba(59,130,246,${alpha})`); ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.strokeStyle=grad; ctx.lineWidth=.8; ctx.stroke();}
      }));
      particles.forEach(p=>{
        p.life+=0.004; if(p.life>1){p.life=0;p.x=Math.random()*w;p.y=Math.random()*h;}
        p.x+=Math.cos(p.angle)*p.speed; p.y+=Math.sin(p.angle)*p.speed;
        if(p.x<0)p.x=w; if(p.x>w)p.x=0; if(p.y<0)p.y=h; if(p.y>h)p.y=0;
        const a=Math.sin(p.life*Math.PI)*p.opacity;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fillStyle=`rgba(8,145,178,${a})`; ctx.fill();
      });
      nodes.forEach(n=>{
        n.x+=n.vx; n.y+=n.vy; if(n.x<0||n.x>w)n.vx*=-1; if(n.y<0||n.y>h)n.vy*=-1;
        n.pulse+=0.04; const glow=Math.sin(n.pulse)*.3+.7;
        const g=ctx.createRadialGradient(n.x,n.y,0,n.x,n.y,n.r*3.5);
        g.addColorStop(0,`rgba(59,130,246,${n.opacity*glow})`); g.addColorStop(1,`rgba(59,130,246,0)`);
        ctx.beginPath(); ctx.arc(n.x,n.y,n.r*3.5,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
        ctx.beginPath(); ctx.arc(n.x,n.y,n.r,0,Math.PI*2); ctx.fillStyle=`rgba(147,197,253,${n.opacity*glow})`; ctx.fill();
      });
      raf=requestAnimationFrame(draw);
    };
    draw(); return()=>cancelAnimationFrame(raf);
  },[]);
  return <canvas ref={cvs} style={{position:"absolute",top:0,left:0,display:"block"}}/>;
}

/* ─── ThreeDXFlowDemo (2D canvas) ─── */
/* 思想: 「未来誇示」ではなく「現状の詰まりが解消される過程」を体感させる */
function ThreeDXFlowDemo({isDX}) {
  const cvs=useRef(null), isDXRef=useRef(isDX);
  useEffect(()=>{isDXRef.current=isDX;},[isDX]);
  useEffect(()=>{
    const el=cvs.current; if(!el)return;
    const w=el.parentElement.clientWidth,h=el.parentElement.clientHeight;
    el.width=w; el.height=h;
    const ctx=el.getContext("2d");
    const depts=[{label:"営業",color:"#3b82f6"},{label:"在庫",color:"#0891b2"},{label:"財務",color:"#7c3aed"},{label:"人事",color:"#059669"},{label:"現場",color:"#d97706"},{label:"顧客",color:"#dc2626"}];
    const cx=w/2,cy=h/2,R=Math.min(w,h)*0.33;
    // ノードにアラート状態を持たせる
    const nodes=depts.map((d,i)=>{
      const angle=(i/depts.length)*Math.PI*2-Math.PI/2;
      return{...d,x:cx+R*Math.cos(angle),y:cy+R*Math.sin(angle),angle,
        alertT:1+Math.random()*3, alertActive:Math.random()>.6};
    });

    // DX後: 均一速度パーティクル（整理された流れ）
    const hubParticles=nodes.map((n)=>({nodeIdx:nodes.indexOf(n),t:Math.random(),speed:0.007,toHub:Math.random()>.5}));

    // DX前: 遅延パケット（途中で消える）
    const delayedPackets=[];
    nodes.forEach((a,ai)=>nodes.forEach((b,bi)=>{
      if(bi<=ai)return;
      for(let p=0;p<2;p++) delayedPackets.push({
        ai,bi,t:Math.random(),speed:0.002+Math.random()*.0025,
        delay:Math.random()*2.5, life:1,dying:false,
        dieAt:0.25+Math.random()*.45, // 途中で消える地点
        isDashed:Math.random()>.45,
      });
    }));
    // ゆらぎパラメータ
    const connWobble=delayedPackets.map(()=>({phase:Math.random()*Math.PI*2,spd:(Math.random()-.5)*.07}));

    let t=0,fadeT=0,raf,lastDX=isDXRef.current;
    const lerp=(a,b,t)=>a+(b-a)*t;

    const draw=()=>{
      t+=0.013; // 全体速度を少し落とす
      const dx=isDXRef.current;
      if(dx!==lastDX){fadeT=0;lastDX=dx;} fadeT+=0.013;
      const fade=dx?Math.min(fadeT/1.8,1):1;
      ctx.clearRect(0,0,w,h);

      if(!dx){
        // ════════════════════════════════════════
        // DX前: 構造的混乱
        // ════════════════════════════════════════

        // ゆらぎ付き点線接続（不安定な線）
        delayedPackets.forEach((p,pi)=>{
          const cw=connWobble[pi];
          cw.phase+=cw.spd;
          const a=nodes[p.ai], b=nodes[p.bi];
          const midX=(a.x+b.x)/2+Math.sin(cw.phase)*10;
          const midY=(a.y+b.y)/2+Math.cos(cw.phase*1.4)*7;
          ctx.beginPath(); ctx.moveTo(a.x,a.y);
          ctx.quadraticCurveTo(midX,midY,b.x,b.y);
          if(p.isDashed) ctx.setLineDash([3,9]);
          ctx.strokeStyle=`rgba(148,163,184,0.16)`;
          ctx.lineWidth=0.7; ctx.stroke(); ctx.setLineDash([]);
        });

        // 遅延パケット（途中で消えるデータ表現）
        delayedPackets.forEach(p=>{
          p.delay-=0.013; if(p.delay>0)return;
          p.t+=p.speed;
          if(p.t>=p.dieAt&&!p.dying){p.dying=true;}
          if(p.dying){
            p.life-=0.035;
            if(p.life<0){p.t=0;p.dying=false;p.life=1;p.delay=1.2+Math.random()*2;p.dieAt=0.25+Math.random()*.45;}
          }
          if(p.t>1){p.t=0;p.delay=0.8+Math.random()*1.8;}
          const n1=nodes[p.ai], n2=nodes[p.bi];
          const px=lerp(n1.x,n2.x,p.t), py=lerp(n1.y,n2.y,p.t);
          const alpha=Math.min(p.life,1)*0.65*(p.dying?1:Math.min(p.t*4,1));
          if(alpha<0.01)return;
          ctx.beginPath(); ctx.arc(px,py,2.2,0,Math.PI*2);
          ctx.fillStyle=`rgba(239,68,68,${alpha})`; ctx.fill();
          // 消える瞬間にリップル
          if(p.dying&&p.life>0.4&&p.life<0.8){
            ctx.beginPath(); ctx.arc(px,py,5*(1-p.life+0.4),0,Math.PI*2);
            ctx.strokeStyle=`rgba(239,68,68,${(0.8-p.life)*.4})`; ctx.lineWidth=0.8; ctx.stroke();
          }
        });

        // ノード描画（アラート状態あり）
        nodes.forEach(n=>{
          n.alertT-=0.013;
          if(n.alertT<0){
            n.alertActive=!n.alertActive;
            n.alertT=n.alertActive ? 0.6+Math.random()*1.2 : 2.5+Math.random()*3;
          }
          ctx.beginPath(); ctx.arc(n.x,n.y,14,0,Math.PI*2);
          ctx.fillStyle=n.alertActive?"rgba(254,226,226,0.9)":"rgba(248,250,252,0.86)";
          ctx.fill();
          ctx.strokeStyle=n.alertActive?"rgba(239,68,68,0.48)":"rgba(148,163,184,0.28)";
          ctx.lineWidth=n.alertActive?2:1.2; ctx.stroke();
          ctx.fillStyle=n.alertActive?"rgba(185,28,28,0.9)":"rgba(100,116,139,0.75)";
          ctx.font=`bold 11px ${VB}`; ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.fillText(n.label,n.x,n.y);
          if(n.alertActive){
            const pulse=0.55+0.45*Math.sin(t*9);
            ctx.fillStyle=`rgba(220,38,38,${pulse})`; ctx.font=`bold 11px ${V}`;
            ctx.fillText("！",n.x+18,n.y-15);
          } else {
            ctx.fillStyle="rgba(148,163,184,0.4)"; ctx.font=`9px ${V}`;
            ctx.fillText("×",n.x+16,n.y-14);
          }
        });

        // 中央ラベル
        ctx.fillStyle="rgba(185,28,28,0.38)"; ctx.font=`bold 10px ${V}`;
        ctx.textAlign="center"; ctx.fillText("── 情報が止まっている ──",cx,cy);

      } else {
        // ════════════════════════════════════════
        // DX後: 整理された流れ（完璧ではなく、整流された状態）
        // ════════════════════════════════════════

        // シンプルなスポーク線（グラデーションなし）
        nodes.forEach(n=>{
          ctx.beginPath(); ctx.moveTo(n.x,n.y); ctx.lineTo(cx,cy);
          ctx.strokeStyle=`rgba(100,150,210,${0.2*fade})`;
          ctx.setLineDash([]); ctx.lineWidth=1; ctx.stroke();
        });
        // 薄いメッシュ
        nodes.forEach((a,ai)=>nodes.forEach((b,bi)=>{
          if(bi<=ai)return;
          ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y);
          ctx.strokeStyle=`rgba(147,197,253,${0.06*fade})`; ctx.lineWidth=0.4; ctx.stroke();
        }));

        // 均一速度パーティクル（整理された流れ）
        hubParticles.forEach(p=>{
          p.t+=p.speed; // 全粒子同速
          if(p.t>1){p.t=0;p.toHub=!p.toHub;}
          const n=nodes[p.nodeIdx];
          const px=p.toHub?lerp(n.x,cx,p.t):lerp(cx,n.x,p.t);
          const py=p.toHub?lerp(n.y,cy,p.t):lerp(cy,n.y,p.t);
          // グローなし・小さいドット
          ctx.beginPath(); ctx.arc(px,py,2,0,Math.PI*2);
          ctx.fillStyle=`rgba(130,180,240,${0.68*fade})`; ctx.fill();
        });

        // ノード: 落ち着いた発光（グロー削減）
        nodes.forEach((n,ni)=>{
          const pulse=Math.sin(t*1.3+ni*1.1)*.12+.88; // 控えめな拍動
          ctx.beginPath(); ctx.arc(n.x,n.y,16,0,Math.PI*2);
          ctx.fillStyle=n.color+"14"; ctx.fill();
          // グローなし・リング1本
          ctx.strokeStyle=n.color+`${Math.round(pulse*0x55).toString(16).padStart(2,"0")}`;
          ctx.lineWidth=1.5; ctx.stroke();
          ctx.fillStyle=C.text; ctx.font=`bold 11px ${VB}`;
          ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(n.label,n.x,n.y);
          ctx.fillStyle="#4ade80"; ctx.font=`10px ${V}`; ctx.fillText("✓",n.x+18,n.y-16);
        });

        // 中央ハブ: シンプルなリング
        const hubPulse=Math.sin(t*1.8)*.08+.92;
        ctx.beginPath(); ctx.arc(cx,cy,22,0,Math.PI*2);
        ctx.fillStyle=`rgba(30,64,175,${0.1*hubPulse})`; ctx.fill();
        ctx.strokeStyle=`rgba(100,150,210,${0.5*hubPulse})`; ctx.lineWidth=1.2; ctx.stroke();
        ctx.fillStyle=C.muted; ctx.font=`bold 10px ${VB}`;
        ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("整理済",cx,cy);
      }
      raf=requestAnimationFrame(draw);
    };
    draw(); return()=>cancelAnimationFrame(raf);
  },[]);
  return <canvas ref={cvs} style={{position:"absolute",top:0,left:0,display:"block",width:"100%",height:"100%"}}/>;
}

/* ─── ThreeKPIScene (2D canvas) ─── */
/* 思想: 改善幅の誇示ではなく「改善プロセスの体感」 */
/* フェーズ1(t<0.4): 揺れ=現状の不安定さ / フェーズ2(t>=0.4): 安定へ収束 */
function ThreeKPIScene({industryKey}) {
  const cvs=useRef(null), kpiRef=useRef([]);
  // changeWord: 数値ではなく「何が変わるか」の構造変化ワード
  const KPI_DATA={
    transport:[
      {label:"処理速度",before:35,after:88,color:"#3b82f6",changeWord:"判断時間短縮"},
      {label:"顧客満足",before:52,after:91,color:"#0891b2",changeWord:"対応漏れ解消"},
      {label:"コスト",before:100,after:62,color:"#d97706",invert:true,changeWord:"属人依存解消"},
      {label:"工数",before:100,after:48,color:"#7c3aed",invert:true,changeWord:"確認工数削減"},
    ],
    cleaning:[
      {label:"探索時間",before:100,after:18,color:"#dc2626",invert:true,changeWord:"探索ゼロ化"},
      {label:"紛失率",before:100,after:8,color:"#d97706",invert:true,changeWord:"追跡の可視化"},
      {label:"現場効率",before:42,after:87,color:"#0891b2",changeWord:"判断時間短縮"},
      {label:"リードタイム",before:100,after:60,color:"#7c3aed",invert:true,changeWord:"確認工数削減"},
    ],
    school:[
      {label:"情報精度",before:48,after:95,color:"#3b82f6",changeWord:"情報の統一化"},
      {label:"事務工数",before:100,after:35,color:"#d97706",invert:true,changeWord:"確認工数削減"},
      {label:"指導品質",before:55,after:90,color:"#059669",changeWord:"指導の標準化"},
      {label:"連携度",before:30,after:82,color:"#0891b2",changeWord:"連携の可視化"},
    ],
    care:[
      {label:"検索時間",before:100,after:22,color:"#dc2626",invert:true,changeWord:"探索工数削減"},
      {label:"マッチング",before:40,after:88,color:"#3b82f6",changeWord:"精度の構造化"},
      {label:"情報鮮度",before:35,after:96,color:"#059669",changeWord:"鮮度の仕組み化"},
      {label:"満足度",before:50,after:89,color:"#0891b2",changeWord:"体験品質向上"},
    ],
    mfg:[
      {label:"生産精度",before:55,after:92,color:"#3b82f6",changeWord:"判断時間短縮"},
      {label:"在庫ロス",before:100,after:38,color:"#d97706",invert:true,changeWord:"在庫の可視化"},
      {label:"変更対応",before:30,after:85,color:"#059669",changeWord:"変更即対応化"},
      {label:"工数",before:100,after:55,color:"#7c3aed",invert:true,changeWord:"属人依存解消"},
    ],
    construction:[
      {label:"原価可視",before:15,after:95,color:"#3b82f6",changeWord:"原価が見える"},
      {label:"利益予測",before:20,after:88,color:"#059669",changeWord:"判断の根拠化"},
      {label:"判断速度",before:40,after:90,color:"#0891b2",changeWord:"報告ラグ解消"},
      {label:"管理工数",before:100,after:45,color:"#d97706",invert:true,changeWord:"属人依存解消"},
    ],
    sign:[
      {label:"情報共有",before:20,after:92,color:"#3b82f6",changeWord:"情報の共有化"},
      {label:"受注追跡",before:30,after:96,color:"#0891b2",changeWord:"追跡の可視化"},
      {label:"営業効率",before:45,after:88,color:"#059669",changeWord:"確認工数削減"},
      {label:"属人化",before:100,after:25,color:"#dc2626",invert:true,changeWord:"属人依存解消"},
    ],
  };
  const kpis=KPI_DATA[industryKey]||KPI_DATA["mfg"];
  useEffect(()=>{kpiRef.current=kpis.map(k=>({...k,current:k.before,t:0,shakePhase:Math.random()*Math.PI*2}));},[industryKey]);
  useEffect(()=>{
    const el=cvs.current; if(!el)return;
    const w=el.parentElement.clientWidth,h=el.parentElement.clientHeight;
    el.width=w; el.height=h;
    const ctx=el.getContext("2d");
    kpiRef.current=kpis.map(k=>({...k,current:k.before,t:0,shakePhase:Math.random()*Math.PI*2}));
    let globalT=0,raf;
    const barW=Math.min((w-80)/(kpis.length),90), barMaxH=h-110, baseY=h-50, startX=(w-barW*kpis.length)/2;

    const draw=()=>{
      globalT+=0.012; // 少し遅めに
      ctx.clearRect(0,0,w,h);

      // グリッド線
      [25,50,75,100].forEach(pct=>{
        const y=baseY-barMaxH*pct/100;
        ctx.beginPath(); ctx.moveTo(30,y); ctx.lineTo(w-20,y);
        ctx.strokeStyle=`rgba(30,64,175,0.05)`; ctx.lineWidth=1; ctx.setLineDash([3,6]); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle="rgba(30,64,175,0.18)"; ctx.font=`9px ${V}`; ctx.textAlign="right"; ctx.fillText(pct+"%",26,y+3);
      });

      kpiRef.current.forEach((kpi,i)=>{
        kpi.t=Math.min(kpi.t+0.012,1);
        kpi.shakePhase+=0.18;

        // ─── フェーズ分岐 ───
        const SHAKE_END=0.38, SETTLE_START=0.42;
        let displayVal;
        let isShaking=false;

        if(kpi.t<SHAKE_END){
          // フェーズ1: 揺れ（現状の不安定さ）
          isShaking=true;
          const shake=Math.sin(kpi.shakePhase*3.5)*4+Math.sin(kpi.shakePhase*7)*2;
          displayVal=kpi.before+shake;
        } else if(kpi.t<SETTLE_START){
          // フェーズ1→2 移行（短い安定化）
          const blend=(kpi.t-SHAKE_END)/(SETTLE_START-SHAKE_END);
          const shake=Math.sin(kpi.shakePhase*3.5)*4*(1-blend);
          const ease=1-Math.pow(1-((kpi.t-SHAKE_END)/(1-SHAKE_END)),3);
          displayVal=kpi.before+(kpi.after-kpi.before)*ease*blend+shake;
        } else {
          // フェーズ2: 安定収束
          const progress=(kpi.t-SETTLE_START)/(1-SETTLE_START);
          const ease=1-Math.pow(1-progress,3);
          displayVal=kpi.before+(kpi.after-kpi.before)*ease;
        }
        kpi.current=displayVal;

        const x=startX+i*barW, bw=barW*0.52, bx=x+(barW-bw)/2;

        // BEFORE 棒（手入力風スタイル: 薄く・若干ずれた位置）
        const beforeH=barMaxH*kpi.before/100;
        const beforeOff=isShaking?Math.sin(kpi.shakePhase)*1.5:0; // 揺れ中は棒もわずかに揺れる
        ctx.fillStyle="rgba(148,163,184,0.18)";
        ctx.fillRect(bx-bw*0.3+beforeOff,baseY-beforeH,bw*0.28,beforeH);
        // BEFORE 値: 手入力風フォント（V=モノスペース）
        ctx.fillStyle="rgba(148,163,184,0.55)"; ctx.font=`10px ${V}`;
        ctx.textAlign="center";
        const beforeLabel=kpi.before+"%";
        ctx.fillText(beforeLabel, bx-bw*0.16+beforeOff, baseY-beforeH-5);

        // AFTER/現在進行棒
        const curH=Math.max(0,barMaxH*kpi.current/100);
        const barOff=isShaking?Math.sin(kpi.shakePhase*2.1)*2:0;
        // フェーズ1では赤みがかった色、フェーズ2は通常色
        const shakeBlend=Math.max(0,1-kpi.t/SHAKE_END);
        const r=parseInt(kpi.color.slice(1,3),16), g=parseInt(kpi.color.slice(3,5),16), b=parseInt(kpi.color.slice(5,7),16);
        const rr=Math.round(r+(220-r)*shakeBlend), rg=Math.round(g+(50-g)*shakeBlend), rb=Math.round(b+(50-b)*shakeBlend);
        const barColor=`rgb(${rr},${rg},${rb})`;
        ctx.fillStyle=barColor+"bb";
        ctx.fillRect(bx+barOff,baseY-curH,bw,curH);

        // 頂点ライン（安定フェーズのみ：細い水平線）
        if(kpi.t>SETTLE_START){
          const stab=(kpi.t-SETTLE_START)/(1-SETTLE_START);
          ctx.fillStyle=barColor+`${Math.round(stab*0x44).toString(16).padStart(2,"0")}`;
          ctx.fillRect(bx+barOff-2,baseY-curH,bw+4,1.5);
        }

        // 現在値ラベル（フェーズ2でのみ構造化フォント表示）
        if(kpi.t>SETTLE_START){
          const vLabel=kpi.invert?`-${100-Math.round(kpi.current)}%`:`${Math.round(kpi.current)}%`;
          ctx.fillStyle=kpi.color; ctx.font=`bold 11px ${VB}`; // VB=構造化フォント
          ctx.textAlign="center"; ctx.fillText(vLabel,bx+bw/2,baseY-curH-6);
        } else {
          // フェーズ1: 手入力風（V）で不安定な数値
          const rawV=Math.round(kpi.current);
          ctx.fillStyle=`rgba(148,163,184,0.7)`; ctx.font=`9px ${V}`;
          ctx.textAlign="center"; ctx.fillText(rawV+"%",bx+bw/2,baseY-curH-5);
        }

        // 軸ラベル
        ctx.fillStyle="rgba(15,23,42,0.45)"; ctx.font=`10px ${VB}`;
        ctx.textAlign="center"; ctx.fillText(kpi.label,x+barW/2,baseY+14);

        // 構造変化ワードバッジ（数値誇示ではなく変化の名前）
        if(kpi.t>0.88){
          const badgeAlpha=(kpi.t-0.88)/0.12;
          ctx.fillStyle=`rgba(34,197,94,${badgeAlpha*0.85})`;
          ctx.font=`bold 8px ${VB}`; ctx.textAlign="center";
          ctx.fillText(kpi.changeWord, bx+bw/2, baseY-curH-20);
        }
      });

      // 凡例: BEFOREは手入力調
      ctx.fillStyle="rgba(148,163,184,0.5)"; ctx.font=`9px ${V}`;
      ctx.textAlign="left"; ctx.fillText("| 導入前",32,h-28);
      ctx.fillStyle="rgba(59,130,246,0.65)"; ctx.font=`9px ${VB}`;
      ctx.fillText("▌ 整理後",78,h-28);

      // フェーズ説明
      const allT=kpiRef.current.reduce((s,k)=>s+k.t,0)/kpiRef.current.length;
      const phaseLabel=allT<0.38?"揺れている状態":allT<0.55?"整理が始まる":"構造が安定した";
      ctx.fillStyle=`rgba(30,64,175,${Math.min(allT*2,0.28)})`; ctx.font=`8px ${V}`;
      ctx.textAlign="right"; ctx.fillText(phaseLabel,w-22,h-28);

      raf=requestAnimationFrame(draw);
    };
    draw(); return()=>cancelAnimationFrame(raf);
  },[industryKey]);
  return <canvas ref={cvs} style={{position:"absolute",top:0,left:0,display:"block",width:"100%",height:"100%"}}/>;
}

// ═══════════════════════════════════════════════════════════════════
// ─── S5: 3D INDUSTRY DEMO (NEW — replaces ThreeDXFlowDemo slide) ─
// ═══════════════════════════════════════════════════════════════════

const INDUSTRY_TO_SCENE = {
  transport:    "logistics",
  cleaning:     "iot",
  school:       "health",
  care:         "health",
  mfg:          "iot",
  construction: "cim",
  sign:         "ai",
};

const DX_TABS = [
  { id:"gis",       icon:"⛰",  label:"GIS地形",  badge:"建設・土木",   desc:"地形データを3D可視化。測量結果と工事計画を同じ画面で比較。現地に行かなくても状況が把握できる。",     Scene:GISScene       },
  { id:"cim",       icon:"🏗",  label:"CIM建設",  badge:"建設・不動産",  desc:"建設現場の進捗をリアルタイムで把握。誰がどこで詰まっているかが見える。報告を待たずに判断できる。",  Scene:CIMScene       },
  { id:"fishery",   icon:"🌊",  label:"水産DX",   badge:"水産・農業",   desc:"ドローンで海域データを収集・可視化。勘に頼っていた判断に、根拠となるデータが加わる。",               Scene:FisheryScene   },
  { id:"iot",       icon:"🏭",  label:"IoT監視",  badge:"製造業",      desc:"センサーで現場をリアルタイム監視。止まっている箇所が見える。問題が起きてから動くのをやめられる。",     Scene:IoTScene       },
  { id:"logistics", icon:"🚛",  label:"物流整流", badge:"物流・運送",   desc:"配送状況を一画面で把握。誰が詰まっているか分かる。経験頼りのルート判断を構造化する。",               Scene:LogisticsScene },
  { id:"health",    icon:"🏥",  label:"医療DX",   badge:"医療・介護",   desc:"患者状態をリアルタイム集約。確認のための移動・電話が減る。スタッフが判断に集中できる状態をつくる。",  Scene:HealthcareScene},
  { id:"ai",        icon:"📊",  label:"AI解析",   badge:"全業種共通",   desc:"データをリアルタイム分析。判断が遅れる理由が分かる。属人化していた意思決定を構造に変える。",           Scene:AIAnalyticsScene},
];

function S5_3DIndustryDemo({ industry }) {
  const initId = INDUSTRY_TO_SCENE[industry] || "iot";
  const [sceneId, setSceneId] = useState(initId);
  const [autoSelected, setAutoSelected] = useState(true);

  useEffect(() => {
    const next = INDUSTRY_TO_SCENE[industry] || "iot";
    setSceneId(next);
    setAutoSelected(true);
  }, [industry]);

  const current = DX_TABS.find(t => t.id === sceneId) || DX_TABS[3];

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", overflow:"hidden", background:"#030810" }}>

      {/* ── TOP LABEL BAR ── */}
      <div style={{ padding:"8px 16px 0", flexShrink:0, background:"rgba(3,8,16,0.98)", borderBottom:"1px solid #ffffff08" }}>
        <div style={{ fontFamily:V, fontSize:"clamp(.55rem,1.8vw,.65rem)", color:"rgba(30,64,175,.35)", letterSpacing:".18em", marginBottom:6, display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ display:"inline-block", width:14, height:1, background:"rgba(30,64,175,.25)" }}/>
          DEMO 01 ── 業種別「今の現場」を3Dで可視化
          {autoSelected && (
            <span style={{ background:"rgba(30,64,175,.15)", border:"1px solid rgba(30,64,175,.25)", borderRadius:3, padding:"1px 6px", fontSize:".9em", color:"rgba(30,170,255,.6)", letterSpacing:".08em" }}>
              ✦ 選択業種に自動マッチ
            </span>
          )}
        </div>

        {/* ── TAB BAR ── */}
        <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
          {DX_TABS.map(tab => (
            <button key={tab.id} onClick={() => { sfxSelect(); setSceneId(tab.id); setAutoSelected(false); }}
              style={{
                background: sceneId===tab.id
                  ? "linear-gradient(135deg,#0d2a4a,#071828)"
                  : "rgba(255,255,255,0.04)",
                border: sceneId===tab.id
                  ? "1px solid #00ccff88"
                  : "1px solid rgba(255,255,255,0.12)",
                borderBottom: sceneId===tab.id ? "1px solid #030810" : "1px solid rgba(255,255,255,0.12)",
                borderRadius:"4px 4px 0 0", padding:"5px 10px", cursor:"pointer",
                color: sceneId===tab.id ? "#00eeff" : "#8ab0cc",
                textShadow: sceneId===tab.id
                  ? "0 0 8px #00ccff, 0 0 18px #0088ff99"
                  : "none",
                boxShadow: sceneId===tab.id
                  ? "0 0 10px #00aaff33, inset 0 1px 0 rgba(0,200,255,0.15)"
                  : "none",
                fontFamily:V, fontSize:"clamp(.55rem,1.6vw,.65rem)", letterSpacing:".06em",
                whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:4,
                transition:"all .2s", WebkitTapHighlightColor:"transparent",
              }}>
              <span>{tab.icon}</span>
              <span style={{ display: "var(--tab-label-display, inline)" }}>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── 3D SCENE AREA ── */}
      <div style={{ flex:1, position:"relative", minHeight:0 }}>
        {DX_TABS.map(tab => sceneId === tab.id ? (
          <div key={tab.id} style={{ position:"absolute", inset:0 }}>
            <tab.Scene active={true}/>
          </div>
        ) : null)}

        {/* ── OVERLAY BADGE (bottom-left) ── */}
        <div style={{
          position:"absolute", bottom:12, left:12, zIndex:10,
          background:"rgba(3,8,20,0.88)", border:"1px solid rgba(30,100,175,.2)",
          borderLeft:"3px solid rgba(30,100,175,.6)",
          borderRadius:4, padding:"8px 12px", maxWidth:280,
          backdropFilter:"blur(4px)",
        }}>
          <div style={{ fontFamily:V, fontSize:"clamp(.52rem,1.6vw,.62rem)", color:"rgba(0,170,255,.5)", letterSpacing:".12em", marginBottom:3 }}>
            {current.icon} {current.badge}
          </div>
          <div style={{ fontFamily:VB, fontSize:"clamp(.65rem,2vw,.78rem)", color:"rgba(200,220,255,.7)", lineHeight:1.6 }}>
            {current.desc}
          </div>
        </div>

        {/* ── OPERATION HINT (bottom-right) ── */}
        <div style={{ position:"absolute", bottom:12, right:12, zIndex:10, fontFamily:V, fontSize:"clamp(.48rem,1.4vw,.58rem)", color:"rgba(30,80,140,.3)", letterSpacing:".1em", textAlign:"right", lineHeight:2 }}>
          <div>ドラッグ → 視点変更</div>
          <div>タブ → 業種切替</div>
        </div>
      </div>

      {/* ── BOTTOM STRIP ── */}
      <div style={{ padding:"5px 16px", flexShrink:0, background:"rgba(3,8,16,0.98)", borderTop:"1px solid #ffffff06", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontFamily:V, fontSize:"clamp(.5rem,1.5vw,.6rem)", color:"rgba(0,170,255,.2)", letterSpacing:".1em" }}>
          ▸ タブで業種切替 ── 「止まっている箇所」を視覚で確認
        </div>
        <div style={{ fontFamily:V, fontSize:"clamp(.5rem,1.5vw,.6rem)", color:"rgba(0,255,136,.25)", letterSpacing:".06em" }}>
          ● LIVE
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ─── ORIGINAL OKICOM SLIDES (unchanged) ──────────────────────────
// ═══════════════════════════════════════════════════════════════════

/* S0: BOOT */
function S0_Boot() {
  const [phase,setPhase]=useState(0);
  useEffect(()=>{
    sfxBoot();
    const t1=setTimeout(()=>setPhase(1),700),t2=setTimeout(()=>setPhase(2),1900),t3=setTimeout(()=>setPhase(3),3200);
    return()=>{clearTimeout(t1);clearTimeout(t2);clearTimeout(t3);};
  },[]);
  return (
    <div style={{position:"relative",height:"100%",overflow:"hidden",background:"#050e1f"}}>
      <ThreeBootScene/>
      <div style={{position:"absolute",inset:0,zIndex:1,background:"linear-gradient(to bottom,rgba(5,14,31,0.45) 0%,rgba(5,14,31,0.1) 40%,rgba(5,14,31,0.65) 100%)",pointerEvents:"none"}}/>
      <div style={{position:"absolute",inset:0,zIndex:2,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"clamp(1rem,4vw,2rem)",textAlign:"center",padding:"clamp(1rem,4vw,2rem)"}}>
        <div style={{opacity:phase>=1?0.8:0,transition:"opacity .8s",display:"flex",gap:3,alignItems:"flex-end"}}>
          {[14,20,28,36,28,20,14].map((h,i)=>(<div key={i} style={{width:3,height:h,background:"linear-gradient(to top,#3b82f6,#93c5fd)",borderRadius:"2px 2px 0 0",boxShadow:"0 0 6px #3b82f688"}}/>))}
        </div>
        <div style={{fontFamily:V,fontSize:"clamp(.68rem,2vw,.82rem)",color:"rgba(147,197,253,0.6)",letterSpacing:".3em",opacity:phase>=1?1:0,transition:"opacity .6s"}}>OKICOM DX SYSTEM</div>
        <div style={{fontFamily:VB,fontSize:"clamp(1.6rem,4.5vw,5rem)",color:"#f0f9ff",fontWeight:700,lineHeight:1.2,opacity:phase>=2?1:0,transition:"opacity .8s,transform .8s",transform:phase>=2?"translateY(0)":"translateY(16px)",textShadow:"0 2px 32px rgba(0,0,0,0.7)"}}>
          ITで、<span style={{color:"#38bdf8",textShadow:"0 0 40px rgba(56,189,248,0.5)"}}>楽しい未来</span>を<br/>つくりこむ。
        </div>
        {phase>=3&&(<div style={{fontFamily:VB,color:"rgba(147,197,253,0.55)",fontSize:"clamp(.72rem,2.5vw,.85rem)",letterSpacing:".05em",display:"flex",alignItems:"center",gap:".75rem",animation:"fadeIn .8s ease"}}><span style={{animation:"blink 1.5s step-end infinite",color:"#38bdf8"}}>▶</span>スワイプ または NEXT をタップ</div>)}
      </div>
    </div>
  );
}

/* S1: Q1 */
const DX_MOYAS=[
  {id:"a",icon:"😓",text:"業務効率化したいが、何から手をつければいいかわからない"},
  {id:"b",icon:"📊",text:"Excelや紙管理が限界で、でもシステム化する勇気がない"},
  {id:"c",icon:"🔄",text:"ツールを入れたのに、現場が使ってくれない"},
  {id:"d",icon:"💸",text:"コストをかけた割に、効果が見えない"},
  {id:"e",icon:"🧩",text:"部門ごとにシステムがバラバラで、情報が繋がっていない"},
  {id:"f",icon:"⏱️",text:"属人化が進んでいて、担当者が抜けると業務が止まる"},
  {id:"g",icon:"🤷",text:"ベンダーに任せたら、現場のことを分かってもらえなかった"},
];
function S1_Q1() {
  const [checks,setChecks]=useState({});
  const toggle=(id,e)=>{e.stopPropagation();sfxClick();setChecks(p=>({...p,[id]:!p[id]}));};
  const count=Object.values(checks).filter(Boolean).length;
  return (
    <Shell>
      <Label>Q.01 ── DXのもやもや、言語化します</Label>
      <div style={{fontFamily:VB,fontSize:"clamp(1.1rem,3.5vw,2.8rem)",color:C.text,fontWeight:700,lineHeight:1.3,marginBottom:"clamp(.5rem,2vw,.75rem)"}}>当てはまるものを<br/><span style={{color:C.blue}}>タップしてください。</span></div>
      {count>0&&(<div style={{fontFamily:V,fontSize:"clamp(.6rem,2vw,.7rem)",color:C.teal,letterSpacing:".1em",marginBottom:"clamp(.4rem,1.5vw,.6rem)",animation:"fadeIn .3s ease",display:"flex",alignItems:"center",gap:".4rem"}}><span>✓</span>{count}項目 共感 ── その課題、一緒に解決できます</div>)}
      <div style={{display:"flex",flexDirection:"column",gap:"clamp(.3rem,1.2vw,.45rem)"}}>
        {DX_MOYAS.map(m=>{const on=!!checks[m.id]; return (
          <div key={m.id} onClick={(e)=>toggle(m.id,e)} style={{border:`1.5px solid ${on?"rgba(30,64,175,.45)":"rgba(30,64,175,.1)"}`,background:on?"rgba(30,64,175,.06)":"rgba(255,255,255,.7)",padding:"clamp(.55rem,2.2vw,.8rem) clamp(.75rem,3vw,1rem)",cursor:"pointer",transition:"all .2s",display:"flex",alignItems:"center",gap:".75rem",WebkitTapHighlightColor:"transparent",position:"relative"}}>
            <span style={{fontSize:"clamp(1rem,3.5vw,1.25rem)",flexShrink:0}}>{m.icon}</span>
            <span style={{fontFamily:VB,fontSize:"clamp(.75rem,2.7vw,.88rem)",color:on?C.blue:C.muted,fontWeight:on?600:400,lineHeight:1.5,flex:1}}>{m.text}</span>
            <span style={{fontFamily:V,fontSize:"clamp(.7rem,2.5vw,.8rem)",color:on?C.blue:"rgba(30,64,175,.2)",flexShrink:0,width:20,textAlign:"center",transition:"all .2s"}}>{on?"✓":"○"}</span>
          </div>
        );})}
      </div>
      {count>=2&&(<div key={count} style={{marginTop:"clamp(.6rem,2.5vw,.9rem)",fontFamily:VB,fontSize:"clamp(.78rem,2.8vw,.9rem)",color:C.blue,fontWeight:600,lineHeight:1.7,background:"rgba(30,64,175,.04)",border:"1px solid rgba(30,64,175,.12)",padding:"clamp(.65rem,2.5vw,.9rem)",animation:"fadeIn .4s ease"}}>✦ その課題、okicomはまさに得意領域です。<br/><span style={{color:C.dim,fontWeight:400}}>「何から始めるか」の整理から、一緒に進めましょう。</span></div>)}
      <div style={{fontFamily:V,fontSize:"clamp(.58rem,2vw,.65rem)",color:"rgba(30,64,175,.22)",marginTop:"clamp(.4rem,1.5vw,.6rem)",letterSpacing:".1em"}}>▸ 複数選択OK ── 正直に選んでください</div>
    </Shell>
  );
}

/* S2: INDUSTRY SELECT */
const INDUSTRIES=[
  {key:"transport",   label:"運送・物流",      icon:"🚚",sub:"基幹システム・配送管理"},
  {key:"cleaning",    label:"クリーニング・製造",icon:"🏭",sub:"在庫・進捗トラッキング"},
  {key:"school",      label:"教育・専門学校",   icon:"🎓",sub:"学籍・カリキュラム管理"},
  {key:"care",        label:"介護・医療",       icon:"🏥",sub:"プラットフォーム・マッチング"},
  {key:"mfg",         label:"製造業",          icon:"⚙️",sub:"生産・在庫・原価管理"},
  {key:"construction",label:"建設・不動産",     icon:"🏗️",sub:"原価可視化・経営DX"},
  {key:"sign",        label:"小売・サービス業", icon:"🏪",sub:"営業管理・顧客情報"},
];
function S2_Industry({industry,setIndustry}) {
  return (
    <Shell>
      <Label>INDUSTRY ── 御社の業界を選んでください</Label>
      <div style={{fontFamily:VB,fontSize:"clamp(1rem,3.2vw,2rem)",color:C.text,fontWeight:700,lineHeight:1.4,marginBottom:"clamp(.75rem,3vw,1.25rem)"}}>業界特有の課題を<br/><span style={{color:C.blue}}>一緒に確認します。</span></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"clamp(.35rem,1.5vw,.55rem)"}}>
        {INDUSTRIES.map(ind=>(
          <button key={ind.key} onClick={()=>{sfxSelect();setIndustry(ind.key);}}
            style={{border:`1.5px solid ${industry===ind.key?"rgba(30,64,175,.5)":"rgba(30,64,175,.15)"}`,background:industry===ind.key?"rgba(30,64,175,.07)":"rgba(255,255,255,.7)",color:industry===ind.key?C.blue:C.muted,fontFamily:VB,fontSize:"clamp(.78rem,2.8vw,.9rem)",fontWeight:industry===ind.key?700:500,padding:"clamp(.6rem,2.5vw,.9rem)",cursor:"pointer",textAlign:"left",WebkitTapHighlightColor:"transparent",transition:"all .2s",display:"flex",flexDirection:"column",gap:".2rem"}}>
            <span style={{fontSize:"clamp(.9rem,3.5vw,1.2rem)"}}>{ind.icon} {ind.label}</span>
            <span style={{fontFamily:V,fontSize:"clamp(.55rem,1.8vw,.62rem)",color:industry===ind.key?"rgba(30,64,175,.5)":"rgba(100,116,139,.4)",letterSpacing:".05em"}}>{ind.sub}</span>
          </button>
        ))}
      </div>
      {industry&&(<div style={{fontFamily:V,fontSize:"clamp(.6rem,2vw,.7rem)",color:C.teal,letterSpacing:".1em",marginTop:"clamp(.75rem,3vw,1rem)",animation:"fadeIn .3s ease",display:"flex",gap:".5rem",alignItems:"center"}}><span style={{color:C.teal}}>✓</span>{INDUSTRIES.find(i=>i.key===industry)?.label} を選択 ── 次のスライドで課題を確認</div>)}
    </Shell>
  );
}

/* S3: PAIN */
const PAIN_DATA={
  transport:{title:"基幹システムが会社の成長を止めている",pains:["新サービスを始めたくても古いシステムが追いつかない","毎日数万件の問い合わせを古いシステムで捌いている","部門間でデータが分断され、意思決定が遅い","IT部門と現場の間で課題認識がバラバラ"],detail:["新機能を追加しようとすると既存コードへの影響が読めず、開発が止まる。技術的負債が成長の天井になっている状態。","ピーク時の問い合わせ量にシステムが耐えられず、手作業で補っている現場。拡張しようにも古いアーキテクチャが壁になる。","営業データは営業部門、在庫データは倉庫、売上データは経理と三者三様。横断的な意思決定に数日かかることも。","現場は「使いにくい」、IT部門は「仕様通り作った」と平行線。要件定義の段階から両者を繋ぐ役割が必要。"]},
  cleaning:{title:"「今どこ？」が分からない管理の限界",pains:["制服・リネンの進捗が紙管理で現場に電話確認が絶えない","紛失が発生してもどこで失くしたか追えない","『探す仕事』に時間を取られ、本来の業務が後回し","在庫精度が低く、過剰発注や欠品が常態化"],detail:["伝票と台帳が一致しているか確認するだけで1日数時間。電話口で「ちょっと待ってください」と保留にする回数が多すぎる。","どの棚に置いたか、誰が持ち出したか追う手段がない。紛失判明まで数日かかり、顧客クレームに発展するケースも。","「探す」「確認する」「聞く」の連鎖が現場の時間を消費。本来やるべき品質管理や顧客対応が後回しになっている。","手書き台帳の誤記や転記漏れで実際の在庫数と帳簿が乖離。発注判断がいつも「感覚頼り」になっている。"]},
  school:{title:"Excel管理が教育品質を下げている",pains:["学生の履修状況をExcelで管理、把握と分析に時間がかかる","教職員によって情報精度にバラつきが出る","指導が属人的で担当者交代のたびに情報が失われる","レポート・分析作業に時間を取られ、指導に集中できない"],detail:["学生ごとのファイルを開いては閉じ、集計のたびにコピペ作業。進路相談の前日に徹夜で資料まとめという現場もある。","Aさんのシートは最新だがBさんのは1ヶ月前のまま、というズレが日常的に発生。誰かが直すと別の誰かのが古くなる。","「あの学生のことはCさんが詳しい」という属人管理。Cさんが退職すると指導履歴がゼロから。","月次レポートを作るために3時間、という状況が常態化。それよりも学生と話す時間に使いたいのが本音。"]},
  care:{title:"情報格差が「選べない介護」を生んでいる",pains:["施設情報が古くて空き状況など詳細が分からない","利用者も自治体も事業者探しに時間がかかりすぎる","マッチング精度が低く、再検索が繰り返される","事業者側も入力・更新の手間が大きく情報が陳腐化"],detail:["Webに掲載された情報が半年前のまま。電話してみたら「もう空きはありません」が繰り返される。情報の鮮度がゼロ。","地域の施設を一覧できる場所がない。行政の冊子、施設のWebサイト、口コミを何時間もかけて調べる必要がある。","介護度・エリア・費用・専門性の条件で絞っても「実態と違った」で再検索。ミスマッチが利用者の負担になっている。","担当者がExcelやメールで更新依頼を処理。更新作業が後回しになり、掲載情報が陳腐化するサイクルが止まらない。"]},
  mfg:{title:"変動前提の現場で計画が追いつかない",pains:["公共事業の予算・工期変更で生産計画を都度手作業修正","生産・販売・在庫の一元管理ができず情報が点在","急な変更への対応が属人的でミスが起きやすい","データが散在して経営判断のタイムラグが大きい"],detail:["発注変更の連絡が来るたびに、手作業でスプレッドシートを修正。変更の連鎖が読み切れず、資材の手配ミスが起きやすい。","生産は生産部門、在庫は倉庫部門、売上は営業部門で別々に管理。横断集計には各部門へのヒアリングが必要。","変更対応を熟知しているのが特定の担当者だけ。その人が不在だと誰も動けない状態が常態化している。","現場の実態が経営層に届くまでに数日。問題が判明したときにはすでに手遅れという判断の遅れが繰り返される。"]},
  construction:{title:"「今どれくらい儲かっているか」が分からない",pains:["紙の日報では案件の最終利益が竣工まで見えない","原価と人の稼働が別々に管理され合算に手間がかかる","現場の数字が経営層まで届くのに時間がかかりすぎる","勘と経験に頼った意思決定でチャンスを逃している"],detail:["着工から竣工まで数ヶ月。途中でコストが膨らんでいても、完工後の決算まで赤字案件だと気づかない構造がある。","材料費は購買部門、人件費は総務部門、外注費は現場担当と分散。月次合算するだけで丸一日かかる現場もある。","現場→所長→本社の報告ルートで情報が数日遅れ。問題が見えたときには取り返しのつかない段階のことが多い。","「前回もこのくらいでいけた」という感覚で見積もる。データで根拠を示せないため、値引き交渉で負けてしまう。"]},
  sign:{title:"営業力が「個人の頭の中」に止まっている",pains:["顧客情報・商談履歴・受注状況がスプレッドシート頼り","担当者が変わると過去の経緯が全部消える","経営者が営業状況をリアルタイムで把握できない","属人化した営業ノウハウが組織の資産にならない"],detail:["担当者ごとに異なるフォーマットのExcelが存在。集計のたびにコピペと目視確認。入力漏れもルールも人によってバラバラ。","引き継ぎ書を作っても「あのお客さんは○○が好きで…」という暗黙知が引き継げない。関係が一から構築し直しになる。","「今月の進捗どう？」と聞くたびに担当者に確認が必要。週次報告が来るまで経営者は数字の実態を知れない。","トップ営業の成功パターンが言語化されないまま。退職とともにノウハウが会社から消える繰り返し。"]},
};
function S3_Pain({industry}) {
  const [open,setOpen]=useState({});
  const data=PAIN_DATA[industry]||PAIN_DATA["mfg"];
  const ind=INDUSTRIES.find(i=>i.key===industry)||INDUSTRIES[4];
  return (
    <Shell>
      <Label>PAIN ── {ind.icon} {ind.label}の課題</Label>
      <div style={{fontFamily:VB,fontSize:"clamp(1.1rem,3.2vw,2.5rem)",color:C.text,fontWeight:700,lineHeight:1.35,marginBottom:"clamp(.75rem,3vw,1.25rem)"}}>
        {data.title.split("").map((c,i)=>c==="「"||c==="」"?<span key={i} style={{color:C.amber}}>{c}</span>:<span key={i}>{c}</span>)}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:"clamp(.35rem,1.5vw,.5rem)"}}>
        {data.pains.map((pain,i)=>(
          <div key={i} onClick={(e)=>{e.stopPropagation();sfxClick();setOpen(p=>({...p,[i]:!p[i]}));}}
            style={{border:`1px solid ${open[i]?"rgba(30,64,175,.3)":"rgba(30,64,175,.1)"}`,background:open[i]?"rgba(30,64,175,.04)":"rgba(255,255,255,.6)",padding:"clamp(.65rem,2.5vw,.9rem) clamp(.75rem,3vw,1rem)",cursor:"pointer",transition:"all .2s",display:"flex",flexDirection:"column",gap:".4rem",WebkitTapHighlightColor:"transparent"}}>
            <div style={{display:"flex",alignItems:"center",gap:".75rem"}}>
              <span style={{color:C.amber,fontFamily:V,fontSize:"clamp(.7rem,2.5vw,.82rem)",flexShrink:0,width:20,textAlign:"center"}}>{open[i]?"▼":"▶"}</span>
              <span style={{fontFamily:VB,fontSize:"clamp(.78rem,2.8vw,.9rem)",color:open[i]?C.blue:C.muted,fontWeight:open[i]?600:500,lineHeight:1.4}}>{pain}</span>
            </div>
            {open[i]&&(<div style={{paddingLeft:"clamp(1.4rem,4vw,2.2rem)",fontFamily:VB,fontSize:"clamp(.72rem,2.5vw,.82rem)",color:C.dim,lineHeight:1.8,animation:"fadeIn .25s ease",borderLeft:"2px solid rgba(30,64,175,.15)",marginLeft:"calc(clamp(.7rem,2.5vw,.82rem) + 10px)"}}>{data.detail[i]}</div>)}
          </div>
        ))}
      </div>
      <div style={{fontFamily:V,fontSize:"clamp(.58rem,2vw,.68rem)",color:"rgba(30,64,175,.25)",marginTop:"clamp(.5rem,2vw,.75rem)",letterSpacing:".1em"}}>▸ 各項目をタップして展開 ── 御社の状況と照合してください</div>
    </Shell>
  );
}

/* S4: CASE */
const CASE_DATA={
  transport:{label:"大手運送業",before:"毎日数万件の問い合わせ処理に古い基幹システムが対応できず、新サービス展開が不可能な状態。IT部門と現場の認識ギャップも深刻。",action:"現場・IT部門・okicomの3者で「本当に困っている業務」を丁寧に整理。将来の拡張を前提に、基幹システムを一から再設計。",after:"最新環境へ無理なく移行。業務変更にも柔軟な基盤を確保。現在は請求業務まで広げる第2フェーズへ。会社の成長を止めない土台を構築。"},
  cleaning:{label:"クリーニング業",before:"大量の制服・リネンの進捗・在庫が紙管理。「今どこ？」確認だけで時間が消え、紛失も発生。電話確認が絶えない状態。",action:"RFID技術を採用し、全物品の所在・工程進捗を誰でもリアルタイムに把握できる仕組みを構築。",after:"電話確認が激減し現場・営業が状況を即把握。ロス削減と業務スピード向上。「探す仕事」から「回す仕事」へ転換完了。"},
  school:{label:"専門学校",before:"学生の履修・単位管理がExcel頼り。把握・分析に時間がかかり、教職員によって情報精度にバラつき。指導が属人的に。",action:"学生・カリキュラム・単位を一元管理できるシステムを構築。「見ればわかる」状態に整備。",after:"学生指導がスムーズに。分析・レポート作成が簡単に。職員間の情報共有が改善。教育品質を「感覚」から「見える化」へ転換。"},
  care:{label:"介護事業者",before:"施設情報が古く空き状況等の詳細が不明。利用者・自治体とも事業者探しに多大な時間がかかり、マッチング精度が低い。",action:"沖縄特化の検索プラットフォームを構築。事業者と密に連携し常に最新情報を反映できる仕組みを整備。",after:"事業者を探す時間を大幅短縮。利用者と事業者のマッチング精度が向上。「選べない介護」から「選べる介護」へ。"},
  mfg:{label:"製造業（公共事業）",before:"公共事業の予算・工期が頻繁に変わり、生産・在庫調整を都度手作業でやり直し。情報の散在で経営判断が遅れていた。",action:"発注状況を踏まえ生産・販売・在庫を一元管理するシステムを構築。変更が出てもすぐ修正できる仕組みを整備。",after:"生産数を最適化。急な変更にも柔軟に対応。「変わる前提」で回せる製造体制を実現。"},
  construction:{label:"建設会社",before:"紙の日報では最終決算まで案件が黒字かどうかわからない。原価・稼働が別管理で合算に手間がかかり、判断が感覚頼り。",action:"Webで原価と人の稼働を一元管理する仕組みをローコード開発で短期間に構築。リアルタイム原価可視化を実現。",after:"案件ごとの利益がリアルタイムで見える化。将来の収益予測が可能に。勘と経験から、データで判断する経営へ進化。"},
  sign:{label:"看板製作業",before:"営業進捗・仕様・顧客情報が担当者の頭とスプレッドシートだけに存在。担当変更で情報消失、経営者はリアルタイム把握不可。",action:"顧客・営業・売上を一元管理する仕組みを導入。情報を共有化し、経営者のダッシュボードを整備。",after:"経営者がリアルタイムで状況把握。営業履歴が会社資産に蓄積。営業が「個人技」から「組織力」へと転換。"},
};
function S4_Case({industry}) {
  const [step,setStep]=useState(0);
  const data=CASE_DATA[industry]||CASE_DATA["mfg"];
  const ind=INDUSTRIES.find(i=>i.key===industry)||INDUSTRIES[4];
  const steps=[{label:"BEFORE",color:C.danger,icon:"⚠",text:data.before},{label:"ACTION",color:C.teal,icon:"⚡",text:data.action},{label:"AFTER",color:"#16a34a",icon:"✓",text:data.after}];
  return (
    <Shell>
      <Label>CASE ── {ind.icon} {ind.label} 導入事例</Label>
      <div style={{display:"flex",gap:"clamp(.3rem,1.5vw,.5rem)",marginBottom:"clamp(.75rem,3vw,1.25rem)"}}>
        {steps.map((s,i)=>(<button key={i} onClick={()=>{sfxSelect();setStep(i);}} style={{flex:1,border:`1.5px solid ${step===i?s.color+"66":"rgba(30,64,175,.12)"}`,background:step===i?s.color+"0e":"rgba(255,255,255,.6)",color:step===i?s.color:C.dim,fontFamily:V,fontSize:"clamp(.62rem,2.2vw,.72rem)",padding:"clamp(.45rem,2vw,.65rem)",cursor:"pointer",letterSpacing:".12em",WebkitTapHighlightColor:"transparent",transition:"all .2s",textAlign:"center"}}>{s.label}</button>))}
      </div>
      {steps.map((s,i)=>step===i&&(
        <div key={i} style={{animation:"fadeIn .4s ease",position:"relative",padding:"clamp(1rem,4vw,1.5rem)",background:"rgba(255,255,255,.75)",border:`1px solid ${s.color}22`}}>
          <Corners color={s.color} size={18} t={1.5}/>
          <div style={{fontFamily:V,fontSize:"clamp(.65rem,2.5vw,.75rem)",color:s.color,letterSpacing:".15em",marginBottom:".75rem",display:"flex",alignItems:"center",gap:".5rem"}}><span>{s.icon}</span>{s.label}</div>
          <div style={{fontFamily:VB,fontSize:"clamp(.85rem,3vw,1rem)",color:C.text,lineHeight:1.85,fontWeight:400}}>{s.text}</div>
          {i===2&&(<div style={{marginTop:"1rem",fontFamily:VB,fontSize:"clamp(.78rem,2.8vw,.88rem)",color:"#16a34a",fontWeight:600,borderLeft:"3px solid #16a34a",paddingLeft:".75rem"}}>👉 okicomが実現した変化</div>)}
        </div>
      ))}
      <div style={{fontFamily:V,fontSize:"clamp(.58rem,2vw,.68rem)",color:"rgba(30,64,175,.25)",marginTop:".75rem",letterSpacing:".1em"}}>▸ BEFORE / ACTION / AFTER をタップして展開</div>
    </Shell>
  );
}

/* S6: KPI DEMO */
function S6_KPIDemo({industry}) {
  const [key,setKey]=useState(industry||"mfg");
  const ind=INDUSTRIES.find(i=>i.key===key)||INDUSTRIES[4];
  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{padding:"clamp(.75rem,3vw,1.25rem) clamp(1.5rem,6vw,4rem)",flexShrink:0}}>
        <Label>DEMO 02 ── DX導入で「何が変わるか」を構造で見る</Label>
        <div style={{fontFamily:VB,fontSize:"clamp(.95rem,3vw,1.8rem)",color:C.text,fontWeight:700,lineHeight:1.3,marginBottom:".5rem"}}><span style={{color:C.blue}}>{ind.icon} {ind.label}</span> 業種の変化</div>
        <div style={{display:"flex",gap:".4rem",flexWrap:"wrap"}}>
          {INDUSTRIES.map(i=>(<button key={i.key} onClick={()=>{sfxClick();setKey(i.key);}} style={{fontFamily:V,fontSize:"clamp(.55rem,2vw,.65rem)",padding:".2rem .5rem",border:`1px solid ${key===i.key?"rgba(30,64,175,.45)":"rgba(30,64,175,.12)"}`,background:key===i.key?"rgba(30,64,175,.08)":"transparent",color:key===i.key?C.blue:"rgba(30,64,175,.35)",cursor:"pointer",letterSpacing:".06em",WebkitTapHighlightColor:"transparent",transition:"all .15s"}}>{i.icon}{i.label}</button>))}
        </div>
      </div>
      <div style={{flex:1,position:"relative",minHeight:0}}><ThreeKPIScene industryKey={key}/></div>
      <div style={{padding:"clamp(.35rem,1.5vw,.5rem) clamp(1.5rem,6vw,4rem)",flexShrink:0,fontFamily:V,fontSize:"clamp(.58rem,2vw,.65rem)",color:"rgba(30,64,175,.3)",letterSpacing:".1em"}}>▸ 棒グラフの「揺れ → 安定」が、構造改善の体感です</div>
    </div>
  );
}

/* S7: VALUE */
function S7_Value() {
  const [active,setActive]=useState(null);
  const vals=[
    {num:"01",title:"要件が固まっていなくてもOK",color:C.blue,detail:"「何から手をつければいいか分からない」という段階から伴走します。業務・課題の言語化からお手伝いします。"},
    {num:"02",title:"作り方の選択肢を縛らない",color:C.teal,detail:"スクラッチ開発・ローコード・パッケージ組み合わせ──御社の予算と規模感に合わせた「無理のない形」を柔軟に提案します。"},
    {num:"03",title:"営業と開発が最初から同席",color:"#7c3aed",detail:"営業担当だけで話が進み後から技術的矛盾が出るリスクをゼロに。現実的な落としどころを最初から提示します。"},
    {num:"04",title:"PoCで終わらせない設計",color:C.amber,detail:"小さく始められる設計にする。止められる設計にする。段階的拡張を前提に構築する──試して終わりにならないための仕組みをはじめから組み込みます。"},
  ];
  return (
    <Shell>
      <Label>VALUE ── okicomが選ばれる4つの理由</Label>
      <div style={{fontFamily:VB,fontSize:"clamp(1.1rem,3.2vw,2.5rem)",color:C.text,fontWeight:700,lineHeight:1.35,marginBottom:"clamp(.75rem,3vw,1.25rem)"}}>「ツールを売る」のではなく、<br/><span style={{color:C.blue}}>業務を変える</span>パートナー。</div>
      <div style={{display:"flex",flexDirection:"column",gap:"clamp(.4rem,1.5vw,.6rem)"}}>
        {vals.map((v,i)=>(<div key={i} onClick={()=>{sfxSelect();setActive(active===i?null:i);}} style={{border:`1.5px solid ${active===i?v.color+"55":"rgba(30,64,175,.1)"}`,background:active===i?v.color+"06":"rgba(255,255,255,.65)",padding:"clamp(.7rem,2.8vw,1rem) clamp(.75rem,3vw,1.1rem)",cursor:"pointer",transition:"all .2s",position:"relative"}}>
          {active===i&&<Corners color={v.color} size={14} t={1.2}/>}
          <div style={{display:"flex",alignItems:"center",gap:".75rem"}}>
            <span style={{fontFamily:V,fontSize:"clamp(.7rem,2.8vw,.85rem)",color:v.color,flexShrink:0}}>{v.num}</span>
            <span style={{fontFamily:VB,fontSize:"clamp(.85rem,3vw,1rem)",color:active===i?v.color:C.text,fontWeight:600}}>{v.title}</span>
            <span style={{marginLeft:"auto",fontFamily:V,fontSize:".8rem",color:v.color,opacity:.5}}>{active===i?"▼":"▶"}</span>
          </div>
          {active===i&&(<div style={{marginTop:".65rem",fontFamily:VB,fontSize:"clamp(.78rem,2.8vw,.9rem)",color:C.muted,lineHeight:1.8,animation:"fadeIn .3s ease"}}>{v.detail}</div>)}
        </div>))}
      </div>
      <div style={{marginTop:"clamp(.75rem,3vw,1.1rem)",fontFamily:V,fontSize:"clamp(.6rem,2vw,.7rem)",color:"rgba(30,64,175,.28)",letterSpacing:".1em"}}>▸ 各項目をタップして詳細確認</div>
    </Shell>
  );
}

/* S8: SCOPE */
function S8_Scope() {
  const [active,setActive]=useState(0);
  const services=[
    {label:"システム受託開発",icon:"💻",color:C.blue,points:["業務フロー整理→要件定義→開発→保守までワンストップ","AI/RPA/ローコード/スクラッチを状況に合わせて選択","建設・不動産・航空・製造など業界特化に対応"],badge:"航空・建設・物流等 多業種実績"},
    {label:"広告運用・Web制作",icon:"📣",color:"#7c3aed",points:["Google/Yahoo!/SNS（Instagram・X・LINE・TikTok）対応","LP・動画・パンフレット制作をワンストップで提供","データ分析・SEO改善でROIを継続的に最大化"],badge:"デジタルマーケティング全対応"},
    {label:"ITインフラ・セキュリティ",icon:"🛡️",color:C.teal,points:["サーバー・クラウド・ネットワーク構築・保守","オンプレミス→クラウド移行支援","セキュリティ診断・対策・インシデント対応"],badge:"インフラ・クラウド・セキュリティ"},
    {label:"DX支援・RPA/AI導入",icon:"🤖",color:C.amber,points:["kintoneなどローコードツールを活用したスピードDX","RPA（自動化ロボット）による業務効率化","AIチャットボット・予測分析の業務組み込み"],badge:"ローコード・RPA・AI活用"},
  ];
  const sv=services[active];
  return (
    <Shell>
      <Label>SCOPE ── サービス領域</Label>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"clamp(.3rem,1.2vw,.45rem)",marginBottom:"clamp(.75rem,3vw,1.1rem)"}}>
        {services.map((s,i)=>(<button key={i} onClick={()=>{sfxSelect();setActive(i);}} style={{border:`1.5px solid ${active===i?s.color+"66":"rgba(30,64,175,.12)"}`,background:active===i?s.color+"09":"rgba(255,255,255,.65)",color:active===i?s.color:C.dim,fontFamily:VB,fontSize:"clamp(.7rem,2.5vw,.82rem)",fontWeight:active===i?700:500,padding:"clamp(.55rem,2.2vw,.8rem) clamp(.6rem,2.5vw,.9rem)",cursor:"pointer",textAlign:"left",WebkitTapHighlightColor:"transparent",transition:"all .2s",display:"flex",flexDirection:"column",gap:".25rem"}}><span style={{fontSize:"clamp(.9rem,3.5vw,1.15rem)"}}>{s.icon}</span><span style={{lineHeight:1.3}}>{s.label}</span></button>))}
      </div>
      <div key={active} style={{animation:"fadeIn .35s ease",border:`1px solid ${sv.color}22`,background:"rgba(255,255,255,.75)",padding:"clamp(.75rem,3vw,1.1rem)",position:"relative"}}>
        <Corners color={sv.color} size={16} t={1.2}/>
        <div style={{fontFamily:V,fontSize:"clamp(.58rem,1.8vw,.68rem)",color:sv.color,letterSpacing:".12em",marginBottom:".5rem"}}>{sv.badge}</div>
        <div style={{display:"flex",flexDirection:"column",gap:".45rem"}}>
          {sv.points.map((p,i)=>(<div key={i} style={{display:"flex",gap:".6rem",alignItems:"flex-start"}}><span style={{color:sv.color,fontFamily:V,fontSize:".72rem",marginTop:".15rem",flexShrink:0}}>✓</span><span style={{fontFamily:VB,fontSize:"clamp(.78rem,2.8vw,.9rem)",color:C.text,lineHeight:1.65}}>{p}</span></div>))}
        </div>
      </div>
    </Shell>
  );
}

/* S9: FLOW */
function S9_Flow() {
  const [active,setActive]=useState(null);
  const steps=[
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
      <div style={{fontFamily:VB,fontSize:"clamp(1rem,3vw,2rem)",color:C.text,fontWeight:700,lineHeight:1.35,marginBottom:"clamp(.75rem,3vw,1.1rem)"}}>まずは相談から。<br/><span style={{color:C.blue}}>決めるのは、あなたのペースで。</span></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"clamp(.3rem,1.2vw,.45rem)"}}>
        {steps.map((s,i)=>(<div key={i} onClick={()=>{sfxClick();setActive(active===i?null:i);}} style={{border:`1px solid ${active===i?"rgba(30,64,175,.35)":"rgba(30,64,175,.1)"}`,background:active===i?"rgba(30,64,175,.05)":"rgba(255,255,255,.65)",padding:"clamp(.55rem,2.2vw,.8rem)",cursor:"pointer",transition:"all .2s"}}>
          <div style={{display:"flex",alignItems:"center",gap:".5rem",marginBottom:active===i?".4rem":0}}>
            <span style={{fontFamily:V,fontSize:"clamp(.6rem,2.2vw,.7rem)",color:C.blue}}>{s.num}</span>
            <span style={{fontSize:"clamp(.9rem,3.5vw,1.1rem)"}}>{s.icon}</span>
            <span style={{fontFamily:VB,fontSize:"clamp(.75rem,2.8vw,.88rem)",color:active===i?C.blue:C.text,fontWeight:600}}>{s.label}</span>
          </div>
          {active===i&&<div style={{fontFamily:VB,fontSize:"clamp(.7rem,2.5vw,.82rem)",color:C.dim,lineHeight:1.6,animation:"fadeIn .3s ease"}}>{s.detail}</div>}
        </div>))}
      </div>
      <div style={{fontFamily:V,fontSize:"clamp(.58rem,2vw,.68rem)",color:"rgba(30,64,175,.25)",marginTop:".6rem",letterSpacing:".1em"}}>▸ 各ステップをタップして詳細確認</div>
    </Shell>
  );
}

/* S10: CLOSE */
function S10_Close() {
  const [q,setQ]=useState(null);
  const faqs=[
    {q:"要件が固まっていなくても相談できますか？",a:"はい、問題ありません。「何から手をつければいいか分からない」という段階から、業務整理を一緒に進めるケースが多いです。"},
    {q:"既存システムとの連携は可能ですか？",a:"API連携・データ移行・RPAブリッジなど柔軟に対応します。オンプレミス→クラウド移行支援も行います。"},
    {q:"開発期間はどのくらいですか？",a:"小規模ツール：1〜3か月、部門単位：3〜6か月、基幹システム：半年以上が目安。ローコード活用で短納期にも対応できます。"},
    {q:"AIの活用はできますか？",a:"社内生産性向上で活用実績あり。必要に応じてAIチャットボット・予測分析の業務組み込みもご提案可能です。"},
  ];
  return (
    <Shell>
      <Label>CLOSE ── 今日のまとめ</Label>
      <div style={{fontFamily:VB,fontSize:"clamp(1.1rem,3.2vw,2.5rem)",color:C.text,fontWeight:700,lineHeight:1.35,marginBottom:"clamp(.75rem,3vw,1.25rem)"}}>今日、<span style={{color:C.blue}}>何か気づきは</span><br/>ありましたか？</div>
      <div style={{fontFamily:VB,fontSize:"clamp(.78rem,2.8vw,.92rem)",color:C.dim,lineHeight:1.85,borderLeft:"2px solid rgba(30,64,175,.12)",paddingLeft:".9rem",marginBottom:"clamp(.75rem,3vw,1.1rem)"}}>最初から100点のシステムを目指す必要はありません。<br/><strong style={{color:C.blue}}>「まずここを動くようにしよう」</strong>という<br/>小さな一歩から始め、運用しながら育てていきます。</div>
      <div style={{marginBottom:"clamp(.5rem,2vw,.75rem)",fontFamily:V,fontSize:"clamp(.62rem,2.2vw,.72rem)",color:"rgba(30,64,175,.4)",letterSpacing:".12em"}}>── よくある質問 ──</div>
      <div style={{display:"flex",flexDirection:"column",gap:"clamp(.3rem,1.2vw,.45rem)",marginBottom:"clamp(.75rem,3vw,1.1rem)"}}>
        {faqs.map((f,i)=>(<div key={i} onClick={()=>{sfxClick();setQ(q===i?null:i);}} style={{border:`1px solid ${q===i?"rgba(30,64,175,.3)":"rgba(30,64,175,.1)"}`,background:q===i?"rgba(30,64,175,.04)":"rgba(255,255,255,.65)",padding:"clamp(.5rem,2vw,.75rem)",cursor:"pointer",transition:"all .2s"}}>
          <div style={{fontFamily:VB,fontSize:"clamp(.75rem,2.7vw,.88rem)",color:q===i?C.blue:C.text,fontWeight:600,display:"flex",justifyContent:"space-between",gap:".5rem"}}><span>{f.q}</span><span style={{fontFamily:V,fontSize:".75rem",color:C.blue,flexShrink:0}}>{q===i?"▼":"▶"}</span></div>
          {q===i&&<div style={{fontFamily:VB,fontSize:"clamp(.72rem,2.6vw,.85rem)",color:C.muted,lineHeight:1.7,marginTop:".5rem",animation:"fadeIn .3s ease"}}>{f.a}</div>}
        </div>))}
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

// ═══════════════════════════════════════════════════════════════════
// ─── APP ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════

const TOTAL  = 11;
const LABELS = ["BOOT","Q.01","INDUSTRY","PAIN","CASE","3D-DEMO","KPI","VALUE","SCOPE","FLOW","CLOSE"];

export default function App() {
  const [idx,setIdx]=useState(0);
  const [dir,setDir]=useState(1);
  const [industry,setIndustry]=useState("mfg");
  const isMobile=useIsMobile();

  const go=useCallback((next)=>{
    if(next<0||next>=TOTAL)return;
    sfxClick(); sfxWhoosh(); setTimeout(sfxImpact,180);
    setDir(next>idx?1:-1); setTimeout(()=>setIdx(next),160);
  },[idx]);

  useEffect(()=>{
    const h=(e)=>{
      if(["ArrowRight","ArrowDown"," "].includes(e.key)){e.preventDefault();go(idx+1);}
      if(["ArrowLeft","ArrowUp"].includes(e.key)){e.preventDefault();go(idx-1);}
    };
    window.addEventListener("keydown",h); return()=>window.removeEventListener("keydown",h);
  },[go,idx]);

  useEffect(()=>{if(idx===TOTAL-1)setTimeout(sfxChime,300);},[idx]);

  const swipe=useSwipe(()=>go(idx+1),()=>go(idx-1));
  const anim=dir===1?"slideInF .22s cubic-bezier(.16,1,.3,1)":"slideInB .22s cubic-bezier(.16,1,.3,1)";

  const handleAreaClick=(e)=>{
    // S5はインタラクティブなので自動ネクストを無効化
    if(idx===5)return;
    if(e.target.closest("button")||e.target.closest("a"))return;
    if(isMobile)go(idx+1);
  };

  const renderSlide=()=>{switch(idx){
    case 0:  return <S0_Boot/>;
    case 1:  return <S1_Q1/>;
    case 2:  return <S2_Industry industry={industry} setIndustry={setIndustry}/>;
    case 3:  return <S3_Pain industry={industry}/>;
    case 4:  return <S4_Case industry={industry}/>;
    case 5:  return <S5_3DIndustryDemo industry={industry}/>;   // ← NEW
    case 6:  return <S6_KPIDemo industry={industry}/>;
    case 7:  return <S7_Value/>;
    case 8:  return <S8_Scope/>;
    case 9:  return <S9_Flow/>;
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
        <div onClick={handleAreaClick} {...swipe} style={{width:"100%",maxWidth:1100,height:"100%",display:"flex",flexDirection:"column",position:"relative",boxShadow:"0 0 60px rgba(0,0,0,0.1)",background:idx===5?"#030810":C.bg,transition:"background .4s"}}>

          {/* TOP BAR */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"clamp(.4rem,2vw,.6rem) clamp(.75rem,3vw,1.25rem)",borderBottom:`1px solid ${idx===5?"rgba(255,255,255,0.05)":"rgba(30,64,175,.09)"}`,background:idx===5?"rgba(3,8,20,0.98)":"rgba(240,245,251,.97)",backdropFilter:"blur(8px)",fontFamily:V,fontSize:"clamp(.62rem,2.5vw,.72rem)",color:idx===5?"rgba(0,170,255,.3)":"rgba(30,64,175,.35)",letterSpacing:".12em",flexShrink:0,zIndex:20,gap:"clamp(.5rem,2vw,1rem)",transition:"all .4s"}}>
            <div style={{display:"flex",gap:"clamp(.5rem,2vw,1.5rem)",alignItems:"center",minWidth:0}}>
              <span style={{color:idx===5?"#00aaff":C.blue,fontSize:"clamp(.8rem,3vw,.92rem)",fontWeight:700,letterSpacing:".08em",flexShrink:0}}>okicom</span>
              {!isMobile&&<span style={{color:idx===5?"rgba(0,170,255,.2)":"rgba(30,64,175,.28)"}}>DX_SYSTEM</span>}
              <span style={{color:C.teal,animation:"pulse 2.5s ease-in-out infinite",flexShrink:0,fontSize:".85em"}}>● LIVE</span>
            </div>
            <MiniDots cur={idx+1} total={TOTAL}/>
            <div style={{fontFamily:V,fontSize:"clamp(.62rem,2.5vw,.72rem)",color:idx===5?"rgba(0,170,255,.2)":"rgba(30,64,175,.25)",flexShrink:0}}>
              {String(idx+1).padStart(2,"0")}/{String(TOTAL).padStart(2,"0")}
              {!isMobile&&<span style={{marginLeft:"1rem",opacity:.6}}>▸ {LABELS[idx]}</span>}
            </div>
          </div>

          {/* SLIDE */}
          <div key={idx} style={{flex:1,overflow:"hidden",animation:anim,minHeight:0}}>{renderSlide()}</div>

          {/* BOTTOM BAR */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"clamp(.35rem,1.8vw,.5rem) clamp(.75rem,3vw,2rem)",borderTop:`1px solid ${idx===5?"rgba(255,255,255,0.04)":"rgba(30,64,175,.07)"}`,background:idx===5?"rgba(3,8,20,0.98)":"rgba(240,245,251,.97)",backdropFilter:"blur(8px)",fontFamily:V,fontSize:"clamp(.58rem,2.2vw,.68rem)",color:idx===5?"rgba(0,170,255,.2)":"rgba(30,64,175,.24)",letterSpacing:".08em",flexShrink:0,zIndex:20,gap:"1rem",transition:"all .4s"}}>
            {!isMobile?<span>株式会社okicom / 098-898-5335 / okicom.co.jp</span>:<span style={{opacity:.5}}>← スワイプ →</span>}
            <div style={{display:"flex",gap:"clamp(.75rem,3vw,1.5rem)"}}>
              <button onClick={e=>{e.stopPropagation();go(idx-1);}} disabled={idx===0} style={{background:"none",border:"none",color:idx===0?(idx===5?"rgba(0,170,255,.08)":"rgba(30,64,175,.12)"):(idx===5?"rgba(0,170,255,.3)":"rgba(30,64,175,.3)"),cursor:idx===0?"default":"pointer",fontFamily:V,fontSize:"clamp(.75rem,3vw,.85rem)",letterSpacing:".08em",padding:"clamp(.35rem,1.8vw,.45rem) clamp(.45rem,2vw,.7rem)",minWidth:"clamp(44px,12vw,60px)",WebkitTapHighlightColor:"transparent"}}>◀ PREV</button>
              <button onClick={e=>{e.stopPropagation();go(idx+1);}} disabled={idx===TOTAL-1} style={{background:"none",border:`1px solid ${idx===TOTAL-1?(idx===5?"rgba(0,170,255,.08)":"rgba(30,64,175,.06)"):(idx===5?"rgba(0,170,255,.25)":"rgba(30,64,175,.18)")}`,color:idx===TOTAL-1?(idx===5?"rgba(0,170,255,.08)":"rgba(30,64,175,.12)"):(idx===5?"rgba(0,170,255,.6)":"rgba(30,64,175,.68)"),cursor:idx===TOTAL-1?"default":"pointer",fontFamily:V,fontSize:"clamp(.75rem,3vw,.85rem)",letterSpacing:".08em",padding:"clamp(.35rem,1.8vw,.45rem) clamp(.45rem,2vw,.7rem)",minWidth:"clamp(44px,12vw,60px)",WebkitTapHighlightColor:"transparent"}}>NEXT ▶</button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
