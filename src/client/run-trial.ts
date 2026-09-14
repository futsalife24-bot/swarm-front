import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Explicit local development opt-in; assets are outside public and production builds. */
export async function loadRunTrial(key: 'jog' | 'sprint') {
  if (!import.meta.env.DEV) throw new Error('Run trials require local development mode');
  const base = '/assets/blender/candidates/trooper/ual-run-20260913/';
  const response = await fetch(`${base}${key}.json`);
  if (!response.ok) throw new Error(`Run trial metadata: ${response.status}`);
  const data = await response.json();
  const gltf = await new GLTFLoader().loadAsync(`${base}${key}.glb`);
  const clip = gltf.animations.find(c => c.name === `UAL_${key}`);
  if (!clip || !Number.isFinite(data.stride) || data.stride <= 0) throw new Error('Invalid run trial');
  return { clip, stride: data.stride as number, name: data.sourceClip as string };
}
