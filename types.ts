
import * as THREE from 'three';

export enum AppMode {
  TREE = 'TREE',
  SCATTER = 'SCATTER',
  FOCUS = 'FOCUS'
}

export type ParticleType = 'BOX' | 'SPHERE' | 'CANDY' | 'PHOTO';

export interface ParticleState {
  mesh: THREE.Object3D;
  targetPos: THREE.Vector3;
  targetRot: THREE.Euler;
  targetScale: THREE.Vector3;
  velocity: THREE.Vector3;
  type: ParticleType;
  baseColor: THREE.Color;
  id: number;
}
