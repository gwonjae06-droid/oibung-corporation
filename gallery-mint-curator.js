/*
 * OIBUNG GALLERY - MINT CURATOR / organic 3D character sculpt.
 * Original hand-authored surface topology, not a primitive kit and
 * not an externally downloaded VRM. The original visitor reference:
 * mint long hair, closed smiling anime eyes, white blouse and red bow.
 * All curved character surfaces are real lit BufferGeometry meshes.
 * THREE is passed from the gallery so no second engine/CDN is needed.
 */
export function createMintCurator(THREE, options={}) {
  const mobile=Boolean(options.mobile);
  const costume=options.costume||'maid';
  const root=new THREE.Group();root.name='오이붕 갤러리 · 민트 3D 비서';
  const bob=new THREE.Group();root.add(bob);
  const head=new THREE.Group();head.position.set(0,2.025,.015);bob.add(head);
  const hairBack=new THREE.Group();head.add(hairBack);
  const bangs=new THREE.Group();head.add(bangs);
  const locks=[new THREE.Group(),new THREE.Group()];
  head.add(locks[0],locks[1]);
  const arms=[];
  const materials=[];
  const surface=(color,roughness=.79,metalness=0)=>{
    const material=new THREE.MeshStandardMaterial({
      color,roughness,metalness,side:THREE.DoubleSide,
      transparent:false
    });
    materials.push(material);return material;
  };
  const skin=surface(0xffe7d9,.94),skinShade=surface(0xf6cdbb,.92);
  const faceLine=surface(0x6c4348,.78),blush=surface(0xf7aeb4,.94);
  const white=surface(0xe8f5f7,.89),whiteShine=surface(0xfff9f0,.86);
  const skirt=surface(0x22293e,.93),navy=surface(0x171d33,.89);
  const ribbons=surface(0xd72d35,.67),ribbonShade=surface(0xad151e,.79);
  const mint=surface(0x9adbd4,.72),mintHighlight=surface(0xb3ebe2,.63);
  const mintShadow=surface(0x6cbab6,.74),mintDeep=surface(0x5aa5a5,.81);
  const whiteGold=surface(0xc3bec8,.60),eyeIris=surface(0x384e55,.57);
  const trim=surface(0xb6a1ba,.69),shoe=surface(0x22293b,.87);
  const eyeGlint=new THREE.MeshBasicMaterial({color:0xfffdfd});
  materials.push(eyeGlint);
  const accent=costume==='knight'?surface(0xa7aeba,.33,.66)
    :costume==='arena'?surface(0x47cfc5,.49,.16)
    :costume==='duelist'?surface(0x829bce,.48,.1)
    :costume==='commander'?surface(0xa8ad8b,.53,.18)
    :costume==='egypt'?surface(0xd9bb71,.39,.55):surface(0xe4f2f2,.69);
  const curvePath=points=>new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'catmullrom',.33);
  function mesh(parent,geometry,mat,name){
    geometry.computeVertexNormals();
    const obj=new THREE.Mesh(geometry,mat);
    obj.name=name||'sculpt';
    obj.castShadow=false;obj.receiveShadow=true;
    obj.frustumCulled=false;
    parent.add(obj);return obj;
  }
  // Lofted anatomy has shared vertices and continuously smooth normals.
  // ring = [y, x radius, z radius, center x, center z, x flatten]
  function loft(parent,rings,mat,segments=mobile?16:34,name='organic shell'){
    const pos=[],uv=[],idx=[];
    for(let j=0;j<rings.length;j++){
      const [y,rx,rz,cx=0,cz=0]=rings[j];
      for(let k=0;k<=segments;k++){
        const a=2*Math.PI*k/segments;
        const cs=Math.cos(a),sn=Math.sin(a);
        pos.push(cx+rx*cs,y,cz+rz*sn);
        uv.push(k/segments,j/(rings.length-1));
        if(j>0 && k>0){
          const current=j*(segments+1)+k;
          idx.push(current,current-1,current-segments-1,
                   current-1,current-segments-2,current-segments-1);
        }
      }
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    geo.setIndex(idx);
    return mesh(parent,geo,mat,name);
  }
  // Sweep along a single spline - continuous arms, legs and shoes;
  // unlike independent cylinders it has no visible seams at the joints.
  function sweep(parent,points,radii,mat,div=mobile?11:25,name='curved sculpt'){
    const path=curvePath(points),segments=mobile?10:18;
    const pos=[],uv=[],idx=[];
    for(let j=0;j<=div;j++){
      const t=j/div,p=path.getPoint(t),tan=path.getTangent(t).normalize();
      let cross=new THREE.Vector3(1,0,0);
      if(Math.abs(tan.dot(cross))>.85)cross.set(0,0,1);
      const u=new THREE.Vector3().crossVectors(tan,cross).normalize();
      const v=new THREE.Vector3().crossVectors(tan,u).normalize();
      const f=t*(radii.length-1),a=Math.min(radii.length-2,Math.floor(f));
      const r=THREE.MathUtils.lerp(radii[a],radii[a+1],f-a);
      for(let i=0;i<=segments;i++){
        const angle=i/segments*Math.PI*2;
        const q=p.clone().addScaledVector(u,Math.cos(angle)*r)
          .addScaledVector(v,Math.sin(angle)*r*.89);
        pos.push(q.x,q.y,q.z);
        uv.push(i/segments,t);
        if(j>0&&i>0){
          const n=j*(segments+1)+i;
          idx.push(n,n-1,n-segments-1,n-1,n-segments-2,n-segments-1);
        }
      }
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    geo.setIndex(idx);
    return mesh(parent,geo,mat,name);
  }
  // Sculpted hair blades: ribbon is a two-sided, volumetric, tapered strip,
  // sampled along a curved centreline; not a cylinder or cone.
  function strand(parent,pts,width,mat,twist=0,name='hair lock'){
    const path=curvePath(pts),div=mobile?11:23;
    const pos=[],uv=[],idx=[];
    for(let j=0;j<=div;j++){
      const t=j/div,p=path.getPoint(t),v=path.getTangent(t).normalize();
      let cross=new THREE.Vector3(v.y,-v.x,0).normalize();
      if(cross.lengthSq()<.12)cross.set(1,0,0);
      const fade=Math.max(.004,Math.pow(1-t,.65)*Math.sin((.13+t*.87)*Math.PI*.95));
      const w=width*fade;
      const wave=Math.sin(Math.PI*t)*twist;
      for(const level of [-1,1])for(const sign of [-1,1]){
        const q=p.clone().addScaledVector(cross,sign*w*.5);
        q.z+=level*(.012+.012*Math.sin(Math.PI*t))+wave*sign;
        pos.push(q.x,q.y,q.z);uv.push((sign+1)*.5,t);
      }
      if(j>0){
        const n=j*4,b=n-4;
        for(const [q,r] of [[0,1],[2,3],[0,2],[1,3]]){
          idx.push(b+q,b+r,n+q,b+r,n+r,n+q);
        }
      }
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    geo.setIndex(idx);
    return mesh(parent,geo,mat,name);
  }
  function faceStroke(parent,pts,r,mat,name){
    const geo=new THREE.TubeGeometry(curvePath(pts),mobile?8:16,r,mobile?5:8,false);
    const line=new THREE.Mesh(geo,mat);line.name=name;
    line.frustumCulled=false;parent.add(line);return line;
  }
  // One smooth head surface with a narrowing chin and full soft cheeks.
  // Local coordinates are relative to the neck, +Z is the face.
  loft(head,[
    [-.165,.027,.055,0,.019],[-.128,.106,.106,0,.026],
    [-.085,.160,.137,0,.026],[-.015,.205,.166,0,.015],
    [.080,.233,.184,0,.014],[.182,.248,.191,0,0],
    [.292,.243,.188,0,-.012],[.389,.212,.172,0,-.031],
    [.474,.166,.146,0,-.045],[.535,.075,.095,0,-.039],
    [.548,.007,.026,0,-.032]
  ],skin,undefined,'sculpted head · cheeks and chin');
  // Nose, ears and chin are small integrated surface protrusions.
  loft(head,[[-.043,.008,.014,0,.181],[.025,.028,.032,0,.183],[.056,.021,.035,0,.195],[.079,.009,.017,0,.188]],skinShade,18,'nose bridge');
  for(const s of [-1,1]){
    sweep(head,[[s*.213,.214,-.002],[s*.242,.195,.005],[s*.229,.101,.020]],
      [.041,.050,.034],skin,12,'sculpted ear');
    const x=s*.112;
    // expressive closed, smiling lashes matching the user's reference
    faceStroke(head,[
      [x-s*.079,.219,.161],[x-s*.046,.196,.180],
      [x,.190,.191],[x+s*.047,.207,.176],[x+s*.080,.221,.147]
    ],.007,faceLine,'smiling closed eye');
    faceStroke(head,[[x+s*.060,.211,.167],[x+s*.081,.235,.159]],.0038,faceLine,'outer lash');
    faceStroke(head,[[x-s*.050,.288,.168],[x,.292,.185],[x+s*.055,.281,.162]],.0036,mintDeep,'eyebrow');
    loft(head,[[.095,.015,.002,s*.133,.157],[.119,.057,.007,s*.133,.172],
      [.146,.067,.007,s*.133,.172],[.168,.030,.002,s*.133,.164]],
    blush,16,'cheek blush');
  }
  faceStroke(head,[[-.057,.029,.170],[-.027,.012,.182],[0,.008,.189],
     [.029,.012,.183],[.056,.030,.170]],.0048,faceLine,'gentle smile');
  // Scalp and large cohesive undercut hair mass, stylized with organic lofts.
  loft(hairBack,[
    [-.19,.116,.115,0,-.119],[-.03,.230,.169,0,-.055],
    [.10,.269,.206,0,-.027],[.30,.274,.206,0,-.040],
    [.46,.235,.181,0,-.053],[.565,.146,.128,0,-.071],
    [.598,.022,.029,0,-.063]
  ],mint,undefined,'continuous mint hair cap');
  // Long rear hair curtains, flowing below shoulders and tapering at the waist.
  for(const s of [-1,1]){
    const outer=new THREE.Group();hairBack.add(outer);
    for(let i=0;i<(mobile?9:17);i++){
      const t=i/(mobile?8:16);
      const rootX=s*(.040+.214*t);
      const outerX=s*(.075+.235*t);
      const phase=i*.52+(s+1)*.76;
      const endX=outerX+s*(.036+.022*Math.sin(phase));
      const yEnd=-.61-(i%4)*.047-.08*Math.sin(Math.PI*t);
      strand(outer,[
        [rootX,.507,-.10],
        [rootX+s*.04,.256,-.194],
        [outerX,.005,-.211],
        [outerX+s*.031,-.322,-.174],
        [endX,yEnd,-.118+.025*Math.sin(phase)]
      ],.059+(i%3)*.007,i%6===0?mintHighlight:i%3===0?mintShadow:mint,
      Math.sin(phase)*.006,'long textured hair strand');
    }
  }
  // Thick silky side-locks in FRONT of both shoulders (reference silhouette).
  for(const s of [-1,1]){
    const g=locks[s===-1?0:1];g.position.set(s*.184,.339,.052);
    for(let i=0;i<(mobile?7:13);i++){
      const t=i/(mobile?6:12),mx=s*(.036+.100*t);
      const end=s*(.062+.148*t);
      strand(g,[
        [s*(.014+t*.075),.127,.033],
        [s*(.064+t*.076),-.012,.113],
        [mx,-.285,.159],
        [end,-.490,.142],
        [end+s*.028,-.740-.020*(i%3),.104]
      ],.063+(i%4)*.009,i%5===0?mintHighlight:i%3===0?mintShadow:mint,
      -.009*s,'front shoulder hair lock');
    }
  }
  // Detailed anime bangs. Separate tapered layered surfaces follow the
  // curvature of forehead and leave the eyes just visible.
  for(let i=0;i<(mobile?12:21);i++){
    const t=i/(mobile?11:20);
    const a=-.224+.448*t;
    const asym=.028*Math.sin(i*2.11);
    const tipY=.20+.095*Math.abs(t-.5)+asym;
    strand(bangs,[
      [a*.61,.575,-.021],
      [a*.9,.465,.116],
      [a,.340,.184],
      [a*.94+(.5-t)*.022,tipY,.198],
      [a*.91,tipY-.075,.201]
    ],.049+(i%5)*.006,i%4===0?mintHighlight:i%6===0?mintShadow:mint,
    .002,'sculpted fringe');
  }
  // Neck leads into a flowing sleeveless blouse with scalloped hem, NOT a box.
  loft(bob,[
    [1.824,.067,.070,0,.012],[1.905,.069,.074,0,.008],
    [2.007,.065,.066,0,.010]
  ],skin,undefined,'neck');
  loft(bob,[
    [.925,.265,.154,0,.011],[.976,.290,.164,0,.008],
    [1.034,.270,.159,0,.012],[1.14,.235,.139,0,0],
    [1.30,.220,.134,0,-.010],[1.48,.239,.151,0,-.013],
    [1.60,.258,.157,0,-.017],[1.74,.279,.143,0,-.014],
    [1.816,.230,.119,0,-.008],[1.871,.094,.078,0,0]
  ],white,undefined,'continuous flowing sleeveless blouse');
  // Pleated soft ruffled hem: smooth ring surface with sinusoidal contour.
  const hemRings=[];
  for(let j=0;j<5;j++){
    const y=.925+j*.024;
    hemRings.push([y,.263+j*.006,.154+j*.006]);
  }
  loft(bob,hemRings,whiteShine,38,'blouse hem');
  // Collar petals are tapered surfaces following the shoulder line.
  strand(bob,[[-.012,1.864,.085],[-.142,1.842,.115],[-.182,1.738,.139]],
    .138,whiteShine,0,'collar left');
  strand(bob,[[.012,1.864,.085],[.142,1.842,.115],[.182,1.738,.139]],
    .138,whiteShine,0,'collar right');
  // Two tiny buttons down the shirt.
  const buttonMat=surface(0xa4b9c6,.46);
  for(let y=1.635;y>1.36;y-=.12){
    sweep(bob,[[0,y,.160],[0,y-.005,.169]],[.011,.011],buttonMat,3,'shirt button');
  }
  // Dark blue skirt hem with ruffled contours and continuous body garment.
  loft(bob,[
    [.71,.233,.186,0,-.014],[.775,.254,.204,0,-.010],
    [.85,.254,.183,0,-.006],[.921,.252,.153,0,0]
  ],skirt,undefined,'navy skirt');
  // Legs and arms are continuous swept anatomical surfaces, wrists included.
  for(const s of [-1,1]){
    sweep(bob,[[s*.130,.763,0],[s*.145,.526,-.009],[s*.159,.303,.012],
      [s*.154,.142,.013],[s*.155,.093,.025]], [.119,.106,.082,.074,.067],
    skin,undefined,'sculpted leg');
    sweep(bob,[[s*.157,.121,.022],[s*.165,.086,.072],[s*.167,.062,.142]],
      [.083,.083,.096],shoe,14,'soft shoes');
    const shoulder=new THREE.Group();shoulder.position.set(s*.274,1.763,0);
    bob.add(shoulder);arms.push({side:s,shoulder,base:s===1?-.055:.055});
    sweep(shoulder,[[0,0,0],[s*.061,-.151,-.007],[s*.070,-.324,.008],
      [s*.086,-.482,.055],[s*.077,-.643,.055],[s*.079,-.713,.065]],
      [.096,.085,.068,.061,.046,.043],skin,undefined,'continuous sculpted arm');
    // Graceful mitten-like hand connected at the wrist.
    sweep(shoulder,[[s*.079,-.704,.065],[s*.080,-.748,.076],
      [s*.080,-.817,.067]], [.046,.046,.032],skin,9,'hand');
    for(let finger=0;finger<3;finger++){
      const d=(finger-1)*.020;
      sweep(shoulder,[[s*.079+d,-.785,.080],[s*.079+d,-.855,.095]],
        [.013,.008],skin,7,'fingers');
    }
  }
  // Curvy silk red ribbon bow at neck, modeled as thick folded cloth.
  const ribbonBody=new THREE.Group();ribbonBody.position.set(0,1.772,.162);bob.add(ribbonBody);
  for(const s of [-1,1]){
    strand(ribbonBody,[[0,.0,.025],[s*.068,.038,.049],[s*.155,.067,.046],
      [s*.160,-.011,.061],[s*.055,-.004,.046]],.069,ribbons,0,'red collar bow loop');
    strand(ribbonBody,[[s*.021,-.019,.044],[s*.037,-.128,.072],
      [s*.027,-.301,.084],[s*.037,-.400,.075]],.038,ribbons,.002,'red bow tail');
  }
  sweep(ribbonBody,[[0,-.006,.057],[0,-.018,.076]],[.033,.031],ribbonShade,7,'bow knot');
  // White oversized head bow follows the sculpted scalp.
  const topper=new THREE.Group();topper.position.set(0,.605,-.014);head.add(topper);
  for(const s of [-1,1]){
    strand(topper,[[0,0,.0],[s*.085,.074,.013],[s*.185,.081,.002],
      [s*.236,.020,.011],[s*.121,-.005,.029]],.138,whiteShine,0,'white hair bow');
    strand(topper,[[s*.028,.009,.01],[s*.154,-.042,.057],
      [s*.231,-.050,-.002]],.039,whiteGold,0,'bow fold');
  }
  sweep(topper,[[0,0,.02],[0,.015,.041]],[.050,.042],whiteGold,7,'hair bow knot');
  // Wardrobe silhouettes retain the reference's softness. Additional small
  // tailoring identifies the game without replacing the whole body.
  if(costume==='knight'){
    for(const s of [-1,1]){
      strand(bob,[[s*.245,1.82,-.006],[s*.30,1.79,.115],
        [s*.365,1.67,.035]],.19,accent,0,'soft knight shoulder armour');
      strand(bob,[[s*.035,1.65,.162],[s*.093,1.43,.173],
        [s*.166,1.18,.140]],.037,accent,0,'cuirass seam');
    }
  } else if(costume==='maid'){
    // White ruffle and satin trim are integrated with the top and hair bow.
    for(const s of [-1,1]){
      strand(bob,[[s*.252,1.69,.068],[s*.279,1.56,.132],
        [s*.263,1.48,.145]],.077,whiteShine,0,'maid frill');
    }
  } else if(costume==='arena' || costume==='duelist'){
    for(const s of [-1,1]){
      strand(bob,[[s*.228,1.785,.063],[s*.208,1.55,.170],
        [s*.133,1.21,.160]],.045,accent,0,'arena piping');
    }
  }else{
    for(const s of [-1,1]){
      strand(bob,[[s*.14,1.79,.13],[s*.16,1.57,.162],
        [s*.21,1.31,.118]],.037,accent,0,'curator trim');
    }
  }
  // One continuous character rotation / hierarchical micro-rig.
  function animate(time,phase=0){
    const t=time*.001+phase;
    const breathing=Math.sin(t*1.47);
    bob.position.y=Math.sin(t*.73)*.008;
    bob.rotation.z=Math.sin(t*.40)*.008;
    head.rotation.y=Math.sin(t*.55)*.044;
    head.rotation.x=Math.sin(t*.43)*.015;
    head.rotation.z=Math.sin(t*.51)*.022;
    hairBack.rotation.z=Math.sin(t*.82)*.025;
    hairBack.rotation.x=Math.sin(t*.69)*.017;
    bangs.rotation.z=Math.sin(t*.61)*.007;
    for(let i=0;i<2;i++){
      locks[i].rotation.z=Math.sin(t*.69+i*.77)*(i===0?-.031:.031);
      locks[i].rotation.x=Math.sin(t*.51+i*.43)*.023;
    }
    arms.forEach(({side,shoulder,base},i)=>{
      shoulder.rotation.z=base+Math.sin(t*.73+i*1.13)*.015;
    });
  }
  // Mesh count and GPU cost scale with device class; exact topology is kept.
  return {
    group:root,
    animate,
    dispose(){
      root.traverse(obj=>{
        if(obj.isMesh)obj.geometry?.dispose?.();
      });
      materials.forEach(m=>m.dispose?.());
    }
  };
}
