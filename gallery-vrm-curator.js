/*
 * OIBUNG GALLERY / VRoid curator.
 *
 * Replaces the old spheres-and-cylinders stand-in with a genuine skinned,
 * sculpted and textured VRM 3D avatar. This is a legally reusable CC0
 * VRoid Studio sample ("おんなのこ１ロング" / long-hair anime girl), NOT
 * a custom 1:1 reconstruction of the screenshot reference.
 *
 * Base 3D model source:
 * https://github.com/GY19A/jev-stage/blob/main/static/vrm/anime_girl.vrm
 * License: CC0 (original VRoid Studio sample model / pixiv).
 * https://vroid.pixiv.help/hc/en-us/articles/4402614652569
 *
 * Three.js, three-vrm and SkeletonUtils are MIT licensed.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

const SOURCES = [
  'https://gy19a.github.io/jev-stage/static/vrm/anime_girl.vrm',
  'https://cdn.jsdelivr.net/gh/GY19A/jev-stage@main/static/vrm/anime_girl.vrm',
  'https://raw.githubusercontent.com/GY19A/jev-stage/main/static/vrm/anime_girl.vrm'
];
const MODEL_HEIGHT = 2.60; // The floor-level display height of the curator, metres.
let sourcePromise;
const dyedCache = new Map();
function sharedRecolor(texture,hex,options){
  if(!texture)return null;
  const key=texture.uuid+'|'+hex;
  if(!dyedCache.has(key))dyedCache.set(key,recolorTexture(texture,hex,options));
  return dyedCache.get(key);
}
const presets = {
  knight: {uniform:'#15161d', metal:'#c8a880', accent:'#958286'},
  maid: {uniform:'#161417', metal:'#dfc8c9', accent:'#e7d7dc'},
  arena: {uniform:'#132e36', metal:'#73c4b5', accent:'#2d8c9d'},
  duelist: {uniform:'#211b2f', metal:'#d6b59b', accent:'#6e6eaa'},
  commander: {uniform:'#19272a', metal:'#c2a46e', accent:'#54766a'},
  egypt: {uniform:'#2a2320', metal:'#e6bc69', accent:'#caa36b'},
};

function rgb(hex) {
  // Canvas pixel data is sRGB; using THREE.Color's linear RGB channels
  // previously made blonde hair and skin-adjacent colours unnecessarily dark.
  return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
}
function recolorTexture(original,hex,{warmth=1,depth=0.40}={}) {
  const source=original?.image;
  if (!source || !source.width || !source.height) return null;
  const canvas=document.createElement('canvas');
  // Keep one source texture aspect ratio, but enforce a mobile budget.
  const limit=matchMedia('(pointer:coarse)').matches?768:1536;
  const factor=Math.min(1,limit/Math.max(source.width,source.height));
  canvas.width=Math.max(1,Math.round(source.width*factor));
  canvas.height=Math.max(1,Math.round(source.height*factor));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if (!ctx)return null;
  try{
    ctx.drawImage(source,0,0,canvas.width,canvas.height);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
    const data=pixels.data,[red,green,blue]=rgb(hex);
    // Preserve texture-drawn folds and strands while changing the dye colour.
    for(let i=0;i<data.length;i+=4) {
      const lum=(data[i]*.30+data[i+1]*.59+data[i+2]*.11)/255;
      const shading=depth+(1-depth)*Math.pow(lum,.67);
      const highlight=Math.max(0,(lum-.67)*.55);
      data[i]=Math.min(255,red*shading+highlight*50*warmth);
      data[i+1]=Math.min(255,green*shading+highlight*38*warmth);
      data[i+2]=Math.min(255,blue*shading+highlight*27*warmth);
    }
    ctx.putImageData(pixels,0,0);
    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.flipY=original.flipY;
    texture.wrapS=original.wrapS; texture.wrapT=original.wrapT;
    texture.repeat.copy(original.repeat);texture.offset.copy(original.offset);
    texture.rotation=original.rotation;texture.center.copy(original.center);
    texture.anisotropy=4;
    return texture;
  }catch(e) {
    console.warn('[3D Curator] Texture remapping unavailable, using original texture.',e);
    return null;
  }
}
async function loadBase() {
  if(!sourcePromise){
    sourcePromise=(async()=>{
      const loader=new GLTFLoader();
      loader.register(parser=>new VRMLoaderPlugin(parser));
      let gltf,lastError;
      for(const url of SOURCES){
        try{gltf=await loader.loadAsync(url);break;}
        catch(error){lastError=error;console.warn('[3D Curator] Source unavailable:',url,error);}
      }
      if(!gltf)throw lastError||new Error('No VRM source accessible');
      const vrm=gltf.userData.vrm;
      if(!vrm?.scene)throw new Error('VRM did not contain a humanoid scene');
      // VRM0 models face the opposite direction to newer VRM1 models.
      // This utility itself checks the VRM version. Avoid misdetecting
      // VRM 0 metadata and accidentally displaying the back of the head.
      VRMUtils.rotateVRM0(vrm);
      const group=vrm.scene;
      const head=vrm.humanoid?.getNormalizedBoneNode?.('head');
      const neck=vrm.humanoid?.getNormalizedBoneNode?.('neck');
      const chest=vrm.humanoid?.getNormalizedBoneNode?.('chest');
      const left=vrm.humanoid?.getNormalizedBoneNode?.('leftUpperArm');
      const right=vrm.humanoid?.getNormalizedBoneNode?.('rightUpperArm');
      const bones={head:head?.name,neck:neck?.name,chest:chest?.name,
        left:left?.name,right:right?.name};
      group.updateWorldMatrix(true,true);
      const bbox=new THREE.Box3().setFromObject(group);
      const rawHeight=bbox.getSize(new THREE.Vector3()).y;
      if(!(rawHeight>.7 && rawHeight<5))throw Error('Unexpected source model dimensions');
      return {group,bones,rawHeight,bbox};
    })().catch(error=>{sourcePromise=null;throw error;});
  }
  return sourcePromise;
}
function meshCategory(mesh,mat){
  const id=[mesh.name,mesh.parent?.name,mat?.name].join(' ').toLowerCase();
  // Prefixes from VRoid v0.x exports, with Japanese-name fallback.
  if(/hair|hairsample|_hair_|髪|前髪|後髪|sideburn/.test(id))return 'hair';
  if(/face|skin|body|naked|肌|顔|blush|eye|brow|lash|teeth|mouth|tongue/.test(id))return 'skin';
  if(/clothes|cloth|skirt|shirt|vest|dress|outfit|uniform|sailor|wear|袖|服|制服|スカート/.test(id))return 'outfit';
  return '';
}
function makePalette(avatar,preset){
  const colors=presets[preset]||presets.egypt;
  const palette=[];
  avatar.traverse(node=>{
    if (!node.isMesh && !node.isSkinnedMesh)return;
    const materials=Array.isArray(node.material)?node.material:[node.material];
    const updated=materials.map(material=>{
      if(!material)return material;
      const type=meshCategory(node,material);
      if(!type)return material;
      const next=material.clone();
      next.userData={...next.userData,oibungCuratorOwned:true};
      if(type==='hair'){
        const dyed=sharedRecolor(material.map,'#f3c775',{depth:.49});
        if(dyed){next.map=dyed;next.color.set(0xffffff);}
        else next.color.set('#ffda80');
      } else if(type==='outfit'){
        const dyed=sharedRecolor(material.map,colors.uniform,{depth:.56});
        if(dyed){next.map=dyed;next.color.set(0xffffff);}
        else next.color.set(colors.uniform);
      }
      if('roughness' in next)next.roughness=type==='hair'?.51:.79;
      next.needsUpdate=true;
      return next;
    });
    node.material=Array.isArray(node.material)?updated:updated[0];
    node.frustumCulled=false; // keep skinned body/hair intact while animated
  });
  return palette;
}
function nearestNamedBone(root,name){
  if(!name)return null;
  return root.getObjectByName(name);
}
function makeClone(base,costume) {
  const model=cloneSkeleton(base.group);
  model.name='Skinned VRoid Curator - '+costume;
  const root=new THREE.Group();
  root.add(model);
  const scaled=MODEL_HEIGHT/base.rawHeight;
  // Small silhouette refinement of the ORIGINAL skinned mesh, not extra
  // spheres/cylinders: slightly longer stature and less chibi-wide framing.
  model.scale.set(scaled*.965,scaled*1.025,scaled*.982);
  model.updateWorldMatrix(true,true);
  const bounds=new THREE.Box3().setFromObject(model);
  model.position.y-=bounds.min.y; // feet stand on the actual gallery floor
  const bones={};
  for(const [key,name] of Object.entries(base.bones)){
    const found=nearestNamedBone(model,name);
    if(found)bones[key]={node:found,base:found.rotation.clone()};
  }
  const texturePalette=makePalette(model,costume);
  const blinkTargets=[];
  model.traverse(node=>{
    if(!node.isMesh || !node.morphTargetDictionary)return;
    const found=Object.entries(node.morphTargetDictionary).find(([name])=>
      /^(blink|fcl_eye_close|eye_close|blinkboth)$/i.test(name));
    if(found)blinkTargets.push({mesh:node,index:found[1]});
  });
  const hairBones=[];
  model.traverse(node=>{
    if(!node.isBone || !/hair|毛|髪|sway|spring|pony|j_hair/i.test(node.name))return;
    if(hairBones.length>=28)return;
    hairBones.push({node,base:node.rotation.clone(),phase:hairBones.length*.54});
  });
  return {root,model,bones,texturePalette,blinkTargets,hairBones,costume};
}
function animateRig(rig,time,phase=0){
  const t=time*.001+phase,breath=Math.sin(t*1.48);
  const {bones}=rig;
  if(bones.head){
    bones.head.node.rotation.y=bones.head.base.y+Math.sin(t*.57)*.047;
    bones.head.node.rotation.x=bones.head.base.x+Math.sin(t*.38)*.016;
    bones.head.node.rotation.z=bones.head.base.z+Math.sin(t*.46)*.018;
  }
  if(bones.chest){
    bones.chest.node.rotation.x=bones.chest.base.x+breath*.008;
  }
  for(const key of ['left','right']){
    const bone=bones[key];if(!bone)continue;
    // Natural relaxed gallery guide posture: lower T/A-pose shoulders.
    const down=key==='left'?-.72:.72;
    bone.node.rotation.z=bone.base.z+down+Math.sin(t*.63+(key==='left'?0:1.4))*.018;
  }
  for(const {node,base,phase} of rig.hairBones){
    // Low-amplitude bone sway keeps an existing modeled hairstyle natural
    // without replacing hair with procedural cones or ribbon strips.
    node.rotation.z=base.z+Math.sin(t*.76+phase)*.017;
    node.rotation.x=base.x+Math.sin(t*.58+phase*.6)*.014;
  }
  for(const {mesh,index} of rig.blinkTargets){
    if(!mesh.morphTargetInfluences)continue;
    const phase=(t*.81)%4.8;
    const closed=phase>4.60?Math.max(0,Math.sin((phase-4.60)/.20*Math.PI)):0;
    mesh.morphTargetInfluences[index]=closed;
  }
}
export async function getVRMCuratorFactory(){
  const base=await loadBase();
  return function createCurator({costume='knight'}={}) {
    const rig=makeClone(base,costume);
    return {
      group:rig.root,
      animate(time,phase){animateRig(rig,time,phase)},
      dispose(){
        rig.model.traverse(node=>{
          if(node.isMesh || node.isSkinnedMesh){
            const mats=Array.isArray(node.material)?node.material:[node.material];
            mats.forEach(mat=>{if(mat?.userData?.oibungCuratorOwned)mat.dispose?.()});
          }
        });
        // Recolored textures are shared across all copies of each costume.
      }
    };
  };
}
