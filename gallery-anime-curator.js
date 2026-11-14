/*
 * Oibung Gallery - fully 3D anime curator (no sprite, texture billboard or
 * rigged third-party asset). Original hand-built geometry for mobile WebGL.
 *
 * Character direction: local +Z is forward, Y is vertical, foot origin at 0.
 * Visual reference: long flowing blonde hair, delicate anime-style features,
 * fitted black sleeveless mock-neck outfit and adult human proportions.
 * The six optional costumes share one consistent face and silhouette.
 */
export function createAnimeCurator(THREE, options = {}) {
  const { costume='knight', mobile=false } = options;
  const root = new THREE.Group();
  root.name = 'Oibung 3D Curator - ' + costume;
  const character = new THREE.Group();
  root.add(character);
  const headRig = new THREE.Group();
  headRig.position.set(0,2.07,0.025);
  character.add(headRig);
  const chestRig = new THREE.Group();
  character.add(chestRig);
  const hairRig = new THREE.Group();
  headRig.add(hairRig);
  const movingLocks=[];
  const details=[];
  const mat = (color, roughness=.8, metalness=0) =>
    new THREE.MeshStandardMaterial({color,roughness,metalness});
  const skin=mat(0xf4d7c9,.88), skinShade=mat(0xe7c5b4,.9);
  const skinPink=mat(0xdba7a1,.9), lips=mat(0xbe8282,.8);
  const eyeWhite=mat(0xfff5e9,.53), iris=mat(0xb38e91,.47);
  const pupil=mat(0x211d28,.28), lash=mat(0x3b2a31,.5);
  const gleam=new THREE.MeshBasicMaterial({color:0xfffdf4});
  const hair=mat(0xf4c978,.62),hairLight=mat(0xffe5a9,.56),hairDark=mat(0xd8a955,.7);
  const cloth=mat(0x201b20,.86), rib=mat(0x302a30,.87), seam=mat(0x5a4547,.84);
  const trouser=mat(0x14151c,.86), boots=mat(0x17171a,.62);
  const metal=mat(0xb2a6a2,.29,.79), gold=mat(0xd6ac64,.32,.78);
  const silver=mat(0xcad0d2,.3,.76), darkMetal=mat(0x545866,.43,.65);
  const white=mat(0xf3ebdc,.9), pearl=mat(0xf9f3e8,.56), pink=mat(0xb56b88,.75);
  const teal=mat(0x3b8c95,.55), blue=mat(0x51728a,.72), green=mat(0x3a6655,.77);
  const other=[];
  const sphereGeometry=new THREE.SphereGeometry(1,mobile?12:24,mobile?10:18);
  const cylinderGeo=(top,bottom,length,segments=mobile?9:14)=>
    new THREE.CylinderGeometry(top,bottom,length,segments);
  function sphere(parent,m,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0){
    const obj=new THREE.Mesh(sphereGeometry,m);
    obj.position.set(x,y,z);obj.scale.set(sx,sy,sz);
    obj.rotation.set(rx,ry,rz);parent.add(obj);return obj;
  }
  function box(parent,m,x,y,z,w,h,d,rx=0,ry=0,rz=0){
    const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
    o.position.set(x,y,z);o.rotation.set(rx,ry,rz);parent.add(o);return o;
  }
  function cone(parent,m,x,y,z,top,bottom,height,segments=12){
    const o=new THREE.Mesh(cylinderGeo(top,bottom,height,segments),m);
    o.position.set(x,y,z);parent.add(o);return o;
  }
  function segment(parent,m,start,end,r0,r1=r0){
    const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end);
    const length=a.distanceTo(b);
    const o=new THREE.Mesh(cylinderGeo(r1,r0,length),m);
    o.position.copy(a).add(b).multiplyScalar(.5);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());
    parent.add(o);return o;
  }
  function curve(parent,m,pts,radius=.010){
    const path=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p)));
    const o=new THREE.Mesh(new THREE.TubeGeometry(path,mobile?8:14,radius,mobile?4:7,false),m);
    parent.add(o);return o;
  }
  function taperLock(parent,m,pts,radius,segments=mobile?10:19){
    const points=pts.map(p=>new THREE.Vector3(...p));
    const path=new THREE.CatmullRomCurve3(points);
    const frames=path.computeFrenetFrames(segments,false);
    const verts=[],normal=[],indices=[];
    const sides=mobile?5:7;
    for(let k=0;k<=segments;k++){
      const t=k/segments,center=path.getPointAt(t);
      const r=radius*(.16 + .84*Math.pow(Math.sin(Math.PI*Math.pow(t,.76)),.62))*(1-.56*t);
      for(let i=0;i<=sides;i++){
        const a=i/sides*Math.PI*2,offset=frames.normals[k].clone().multiplyScalar(Math.cos(a)*r);
        offset.addScaledVector(frames.binormals[k],Math.sin(a)*r*.52);
        const p=center.clone().add(offset);
        verts.push(p.x,p.y,p.z);
        let n=offset.normalize();
        normal.push(n.x,n.y,n.z);
        if(k<segments && i<sides){
          const start=k*(sides+1)+i;
          indices.push(start,start+sides+1,start+1,start+1,start+sides+1,start+sides+2);
        }
      }
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
    geo.setAttribute('normal',new THREE.Float32BufferAttribute(normal,3));
    geo.setIndex(indices);
    const o=new THREE.Mesh(geo,m);parent.add(o);return o;
  }
  // Shape-sculpted elliptical silhouette avoids a collection of disconnected
  // primitives and supports smooth shading from pelvis to shoulders.
  function loft(parent,m,rings,sides=mobile?12:28){
    const verts=[],uv=[],indices=[];
    rings.forEach((r,j)=>{
      for(let i=0;i<=sides;i++){
        const a=i/sides*Math.PI*2;
        const x=Math.cos(a)*r[1],z=Math.sin(a)*r[2]+(r[3]||0);
        verts.push(x,r[0],z);uv.push(i/sides,j/(rings.length-1));
      }
    });
    for(let j=0;j<rings.length-1;j++)for(let i=0;i<sides;i++){
      const a=j*(sides+1)+i,b=a+sides+1;
      indices.push(a,b,a+1,a+1,b,b+1);
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    geo.setIndex(indices);geo.computeVertexNormals();
    const obj=new THREE.Mesh(geo,m);obj.material.side=THREE.DoubleSide;parent.add(obj);
    return obj;
  }
  // Long-legged adult proportions, approximate 7.3-head anime silhouette.
  // Shoes, boots, fitted trousers and subtle tailored waist detail.
  for(const side of [-1,1]){
    const x=side*.145;
    sphere(character,trouser,x,1.005,0,.157,.208,.177);
    segment(character,trouser,[x,1.00,0],[side*.16,.58,.014],.146,.118);
    sphere(character,trouser,side*.16,.59,.015,.127,.116,.130);
    segment(character,trouser,[side*.16,.58,.02],[side*.172,.155,-.018],.111,.071);
    sphere(character,boots,side*.173,.146,.04,.095,.145,.117);
    box(character,boots,side*.173,.07,.112,.202,.14,.36);
    box(character,darkMetal,side*.173,.075,.278,.205,.036,.07);
  }
  // Leg to upper torso is a continuous tapered mesh.
  loft(chestRig,cloth,[
    [1.00,.205,.155,0],[1.11,.245,.18,0],[1.21,.185,.137,-.003],
    [1.34,.166,.131,-.008],[1.47,.205,.171,-.009],
    [1.63,.278,.194,-.009],[1.78,.308,.179,-.01],
    [1.88,.314,.142,-.005],[1.96,.187,.125,-.006],[1.99,.105,.105,0]
  ]);
  // Subtle fitted chest structure, fabric rather than exaggerated anatomy.
  for(const side of [-1,1]){
    sphere(chestRig,cloth,side*.128,1.678,.147,.143,.146,.129,0,side*.12);
    curve(chestRig,seam,[[side*.08,1.78,.190],[side*.19,1.62,.209],[side*.17,1.52,.158]],.004);
  }
  // Tall mock neck and fine ribbed folds from the reference.
  cone(chestRig,cloth,0,1.98,0,.105,.12,.19);
  for(let j=0;j<9;j++){
    const a=j/9*Math.PI*2;
    segment(chestRig,rib,[Math.cos(a)*.109,1.94,Math.sin(a)*.10],
      [Math.cos(a)*.103,2.04,Math.sin(a)*.098],.0025,.0025);
  }
  // Waist belt, buckle and hanging laminated badge from the image.
  box(character,cloth,0,1.077,.13,.48,.095,.12);
  box(character,gold,0,1.08,.207,.095,.075,.012);
  box(character,metal,0,1.081,.216,.060,.041,.011);
  segment(character,metal,[.212,1.09,.12],[.255,.90,.145],.007);
  const badge=box(character,white,.267,.824,.148,.098,.146,.012,.08,0,-.10);
  box(character,teal,.267,.839,.16,.075,.032,.005);
  box(character,blue,.269,.80,.16,.073,.010,.006);
  // Exposed shoulders and graceful arms, with rotatable shoulder pivots.
  const arms=[];
  for(const side of [-1,1]){
    const pivot=new THREE.Group();
    pivot.position.set(side*.322,1.83,0);
    character.add(pivot);arms.push({pivot,side});
    sphere(pivot,skin,side*.018,-.022,.002,.117,.12,.123);
    segment(pivot,skin,[side*.034,-.075,.004],[side*.12,-.39,.028],.105,.074);
    sphere(pivot,skinShade,side*.118,-.41,.027,.078,.083,.076);
    segment(pivot,skin,[side*.12,-.405,.03],[side*.155,-.735,.102],.077,.052);
    sphere(pivot,skin,side*.157,-.772,.103,.066,.102,.047);
    // Fingers are geometric too, not painted on a surface.
    for(let i=0;i<4;i++){
      const u=(i-1.5)*.029;
      segment(pivot,skin,[side*(.155+u),-.815,.13],
        [side*(.154+u),-.9+Math.abs(i-1.5)*.008,.14],.013,.010);
    }
    segment(pivot,skin,[side*.205,-.742,.135],[side*.222,-.8,.182],.024,.015);
  }
  arms[0].pivot.rotation.z=-.14;
  arms[1].pivot.rotation.z=.19;
  // Head: oval skull with gently tapered chin, ears, jaw, nose and lips.
  sphere(headRig,skin,0,.184,.014,.221,.282,.182,0,0,0);
  sphere(headRig,skin,0,.020,.060,.175,.145,.145);
  for(const side of [-1,1]){
    sphere(headRig,skinShade,side*.216,.127,.027,.045,.080,.040);
    sphere(headRig,skinPink,side*.192,.032,.135,.04,.017,.012);
  }
  sphere(headRig,skinShade,0,.095,.190,.034,.063,.046);
  sphere(headRig,skinPink,0,.028,.217,.043,.013,.012);
  sphere(headRig,lips,0,-.007,.198,.056,.012,.016);
  curve(headRig,skinShade,[[-.041,-.004,.201],[0,-.012,.222],[.04,-.004,.201]],.0029);
  // Eye surfaces on curved face (brows/lashes are actual 3D curves).
  const eyes=[];
  for(const side of [-1,1]){
    const x=side*.093;
    sphere(headRig,eyeWhite,x,.185,.169,.076,.037,.020,0,side*-.11);
    sphere(headRig,iris,x+side*.005,.183,.186,.032,.034,.009);
    sphere(headRig,pupil,x+side*.006,.183,.196,.017,.027,.007);
    sphere(headRig,gleam,x-side*.007,.198,.203,.009,.010,.004);
    const upper=[
      [x-side*.085,.197,.179],[x-side*.045,.223,.194],
      [x+side*.041,.223,.186],[x+side*.080,.205,.169]
    ];
    curve(headRig,lash,upper,.007);
    curve(headRig,hairDark,[[x-side*.07,.263,.152],[x,.273,.163],[x+side*.067,.255,.150]],.006);
    for(let i=0;i<3;i++){
      const angle=i*.018;
      segment(headRig,lash,[x+side*(.06+i*.012),.213,.177],
        [x+side*(.069+i*.014),.239+angle,.170],.0032,.0015);
    }
    eyes.push({x,side});
  }
  // Scalp cap and sweeping bangs, with art-directed layered hair strands.
  sphere(hairRig,hair,0,.285,-.015,.245,.287,.210);
  sphere(hairRig,hairDark,0,.180,-.133,.245,.280,.145);
  const backHair=new THREE.Group();
  hairRig.add(backHair);
  // Thick back silhouette (actual sculpted volumes) + tapered hair ribbons.
  for(let i=0;i<(mobile?13:25);i++){
    const t=i/((mobile?13:25)-1),x=(t-.5)*.43;
    const wave=Math.sin(i*2.34)*.06;
    const rootX=x*.72;
    const endX=x*1.25 + wave + (i%3)*.018;
    const length=.97 + .32*Math.sin(Math.PI*t) + (i%4)*.045;
    const p=[
      [rootX,.36,-.145],
      [x,.10,-.244],
      [x*1.12,-.31,-.28],
      [endX,-.68,-.23+wave],
      [endX+.09*Math.sin(i*1.3),.30-length,-.14+wave]
    ];
    taperLock(backHair,i%5===0?hairLight:i%4===1?hairDark:hair,p,.063);
  }
  const frontHair=new THREE.Group();hairRig.add(frontHair);
  // Asymmetrical centre-to-side fringe, exposing anime eyes.
  for(let i=0;i<(mobile?8:14);i++){
    const t=i/(mobile?8:14);
    const x=-.23+t*.46;
    const length=.22 + (i%5)*.020;
    const endsY=.26-length + (x<0?-.012:.040);
    const p=[[x*.55,.49,.005],[x*.79,.41,.125],
      [x,.31,.204],[x-.012,endsY,.213]];
    taperLock(frontHair,i%3===0?hairLight:hair,p,.048);
  }
  // Face-framing shoulder-length locks, moving independently of skull.
  const sideLocks=[];
  for(const side of [-1,1]){
    const pivot=new THREE.Group();
    pivot.position.set(side*.208,.24,.045);
    hairRig.add(pivot);sideLocks.push(pivot);
    for(let i=0;i<(mobile?3:6);i++){
      const j=i/(mobile?3:6),p=[
        [side*(-.01+j*.055),.17,-.035],
        [side*(.035+j*.02),-.13,.115],
        [side*(.073+j*.05),-.42,.15],
        [side*(.10+j*.052),-.74,.12]
      ];
      taperLock(pivot,i%3===0?hairLight:hair,p,.041);
    }
  }
  // Material-specific costume overlays retain recognizable black base outfit.
  const themeGroup=new THREE.Group();character.add(themeGroup);
  if(costume==='maid'){
    // White apron and collar; cat ears attached to hair rather than background.
    loft(themeGroup,cloth,[[.97,.30,.21,0],[1.08,.29,.22,0],
      [1.18,.26,.20,0],[1.26,.18,.14,0]]);
    box(themeGroup,white,0,1.17,.185,.315,.48,.024);
    box(themeGroup,white,0,1.52,.195,.115,.42,.02);
    box(themeGroup,white,0,1.04,.213,.45,.075,.023);
    for(const side of [-1,1]){
      // Small angular cat ears.
      const ear=new THREE.Mesh(new THREE.ConeGeometry(.103,.204,3),hairDark);
      ear.position.set(side*.153,.520,.01);
      ear.rotation.z=side*-.21;headRig.add(ear);
      const earInner=new THREE.Mesh(new THREE.ConeGeometry(.061,.126,3),pink);
      earInner.position.set(side*.155,.533,.059);earInner.rotation.z=side*-.21;headRig.add(earInner);
      sphere(themeGroup,white,side*.16,1.85,.105,.11,.10,.064);
    }
    sphere(themeGroup,pink,0,1.80,.21,.057,.045,.026);
  }else if(costume==='knight'){
    for(const side of [-1,1]){
      const armor=sphere(themeGroup,darkMetal,side*.306,1.846,-.004,.174,.126,.156,0,0,side*.1);
      sphere(themeGroup,silver,side*.34,1.916,.008,.13,.038,.12);
      box(themeGroup,gold,side*.32,1.823,.14,.076,.045,.028);
      const gauntlet=segment(themeGroup,darkMetal,[side*.448,1.48,.043],
        [side*.478,1.19,.106],.080,.053);
    }
    sphere(themeGroup,metal,0,1.62,.192,.13,.23,.037);
    // The greatsword is carried on the back, actual 3D crossguard/blade.
    const sword=new THREE.Group();sword.position.set(-.31,1.55,-.20);
    sword.rotation.z=-.35;themeGroup.add(sword);
    box(sword,silver,0,.27,0,.098,.84,.035);
    cone(sword,silver,0,.74,0,.001,.05,.17);
    box(sword,gold,0,-.18,0,.42,.045,.07);
    box(sword,cloth,0,-.34,0,.055,.29,.052);
    sphere(sword,gold,0,-.51,0,.06,.062,.060);
  }else if(costume==='arena'){
    for(const side of [-1,1]){
      sphere(themeGroup,teal,side*.28,1.83,.08,.11,.07,.105);
      segment(themeGroup,teal,[side*.435,1.50,.046],[side*.466,1.34,.084],.080,.070);
      box(themeGroup,gold,side*.17,1.14,.155,.16,.05,.04);
    }
    sphere(themeGroup,teal,0,1.59,.208,.095,.10,.029);
  }else if(costume==='duelist'){
    for(const side of [-1,1]){
      box(themeGroup,blue,side*.22,1.61,.155,.12,.53,.05,0,0,side*.075);
      sphere(themeGroup,gold,side*.18,1.93,.100,.04,.042,.03);
    }
    box(themeGroup,silver,0,1.72,.236,.022,.42,.03);
  }else if(costume==='commander'){
    for(const side of [-1,1]){
      sphere(themeGroup,green,side*.275,1.87,.036,.12,.085,.102);
      box(themeGroup,gold,side*.27,1.918,.105,.17,.024,.05);
      box(themeGroup,green,side*.21,1.46,.161,.12,.49,.026,0,0,-side*.16);
    }
    box(themeGroup,gold,0,1.82,.191,.065,.07,.02);
  }else{
    // Ancient-gallery gold jewellery and elegant collar.
    sphere(themeGroup,gold,0,1.947,.103,.176,.060,.09);
    for(const side of [-1,1]){
      sphere(themeGroup,gold,side*.218,1.96,.029,.039,.035,.025);
      sphere(themeGroup,teal,side*.217,1.96,.054,.022,.020,.017);
    }
    sphere(themeGroup,gold,0,1.56,.178,.05,.06,.019);
  }
  // Autonomous yet restrained idle rig. Characters don't walk or break pose.
  // Separate parts pivot: hair sway, eyes blink, chest breathing, shoulders.
  const eyelids=[];
  for(const e of eyes){
    const lid=sphere(headRig,skin,e.x,.199,.190,.074,.001,.019);
    eyelids.push(lid);
  }
  function animate(time,phase=0,isDark=false){
    const t=time*.001;
    const slow=t*1.05+phase, breath=Math.sin(slow*1.50);
    character.position.y=(mobile?.004:.009)*Math.sin(slow*.96);
    chestRig.scale.set(1+.005*breath,1+.008*breath,1+.006*breath);
    headRig.rotation.y=Math.sin(slow*.67)*.045;
    headRig.rotation.z=Math.sin(slow*.47)*.021;
    headRig.rotation.x=Math.sin(slow*.39)*.014;
    frontHair.rotation.z=Math.sin(slow*.72)*.006;
    backHair.rotation.z=Math.sin(slow*.60)*.030;
    backHair.rotation.x=Math.sin(slow*.46)*.024;
    for(let i=0;i<sideLocks.length;i++){
      sideLocks[i].rotation.z=Math.sin(slow*.8+i*.5)*(.035)*(i?1:-1);
      sideLocks[i].rotation.x=Math.sin(slow*.62+i)*.033;
    }
    arms[0].pivot.rotation.z=-.14+Math.sin(slow*.80)*.023;
    arms[1].pivot.rotation.z=.19+Math.sin(slow*.74+.7)*.023;
    // Natural brief blink every ~5.2 seconds, independent of fps.
    const blinkPhase=(slow+phase*.2)%5.2;
    const blink=blinkPhase>4.87&&blinkPhase<5.10
      ? Math.sin(((blinkPhase-4.87)/.23)*Math.PI):0;
    eyelids.forEach(lid=>{
      lid.scale.y=Math.max(.002,.042*blink);
      lid.position.y=.218-blink*.032;
      lid.visible=blink>.04;
    });
  }
  return {group:root,animate,costume,character};
}
