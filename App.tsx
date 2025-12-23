
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { gestureService } from './services/mediapipe';
import { AppMode, ParticleState, ParticleType } from './types';

const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [uiHidden, setUiHidden] = useState(false);
  const [mode, setMode] = useState<AppMode>(AppMode.TREE);
  
  // Three.js instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const mainGroupRef = useRef<THREE.Group | null>(null);
  const particlesRef = useRef<ParticleState[]>([]);
  const frameIdRef = useRef<number>(0);

  // Constants
  const TREE_PARTICLES = 1500;
  const DUST_PARTICLES = 2500;
  const CHAMPAGNE_GOLD = new THREE.Color('#d4af37');
  const CREAM_WHITE = new THREE.Color('#fceea7');
  const DARK_GREEN = new THREE.Color('#0b3d16');
  const XMAS_RED = new THREE.Color('#af111c');

  const createCandyCaneTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(-32, 32);
    ctx.lineTo(32, 96);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -32);
    ctx.lineTo(96, 64);
    ctx.stroke();
    return new THREE.CanvasTexture(canvas);
  };

  const createPhotoTexture = (text: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#fceea7';
    ctx.fillRect(0, 0, 512, 512);
    ctx.font = 'bold 64px Cinzel';
    ctx.fillStyle = '#d4af37';
    ctx.textAlign = 'center';
    ctx.fillText(text, 256, 256);
    return new THREE.CanvasTexture(canvas);
  };

  const initScene = useCallback(async () => {
    if (!containerRef.current) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = 2.2;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 50);
    cameraRef.current = camera;

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    const pointLight = new THREE.PointLight(0xffaa44, 2);
    pointLight.position.set(0, 5, 0);
    scene.add(pointLight);

    const spotGold = new THREE.SpotLight(0xd4af37, 1200);
    spotGold.position.set(30, 40, 40);
    scene.add(spotGold);

    const spotBlue = new THREE.SpotLight(0x4488ff, 600);
    spotBlue.position.set(-30, 20, -30);
    scene.add(spotBlue);

    // Environment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

    // Post processing
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.45, // strength
      0.4,  // radius
      0.7   // threshold
    );
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
    composerRef.current = composer;

    // Groups
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);
    mainGroupRef.current = mainGroup;

    // Materials
    const goldMat = new THREE.MeshStandardMaterial({ color: CHAMPAGNE_GOLD, metalness: 0.9, roughness: 0.1 });
    const greenMat = new THREE.MeshStandardMaterial({ color: DARK_GREEN, metalness: 0.5, roughness: 0.3 });
    const redMat = new THREE.MeshPhysicalMaterial({ color: XMAS_RED, clearcoat: 1.0, clearcoatRoughness: 0.1 });
    const candyTexture = createCandyCaneTexture();
    const candyMat = new THREE.MeshStandardMaterial({ map: candyTexture });

    // Initial Photo
    const photoTexture = createPhotoTexture("JOYEUX NOEL");
    if (photoTexture) {
      photoTexture.colorSpace = THREE.SRGBColorSpace;
      addPhotoToScene(photoTexture);
    }

    // Geometry Creators
    const createCandyCaneGeo = () => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0.5, 0),
        new THREE.Vector3(0, 0.8, 0),
        new THREE.Vector3(0.1, 0.95, 0),
        new THREE.Vector3(0.3, 0.9, 0),
        new THREE.Vector3(0.35, 0.7, 0),
      ]);
      return new THREE.TubeGeometry(curve, 20, 0.05, 8, false);
    };

    // Particles creation
    const boxGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const sphereGeo = new THREE.SphereGeometry(0.3, 16, 16);
    const candyGeo = createCandyCaneGeo();

    const particles: ParticleState[] = [];

    for (let i = 0; i < TREE_PARTICLES; i++) {
      let type: ParticleType = 'BOX';
      const rand = Math.random();
      let mesh: THREE.Mesh;

      if (rand < 0.4) {
        type = 'BOX';
        mesh = new THREE.Mesh(boxGeo, Math.random() > 0.5 ? goldMat : greenMat);
      } else if (rand < 0.8) {
        type = 'SPHERE';
        mesh = new THREE.Mesh(sphereGeo, Math.random() > 0.5 ? goldMat : redMat);
      } else {
        type = 'CANDY';
        mesh = new THREE.Mesh(candyGeo, candyMat);
      }

      const pState: ParticleState = {
        mesh,
        targetPos: new THREE.Vector3(),
        targetRot: new THREE.Euler(),
        targetScale: new THREE.Vector3(1, 1, 1),
        velocity: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.05),
        type,
        baseColor: (mesh.material as any).color.clone(),
        id: i
      };
      
      mainGroup.add(mesh);
      particles.push(pState);
    }

    // Dust particles (simple points)
    const dustGeo = new THREE.SphereGeometry(0.02, 4, 4);
    const dustMat = new THREE.MeshBasicMaterial({ color: CREAM_WHITE, transparent: true, opacity: 0.6 });
    for (let i = 0; i < DUST_PARTICLES; i++) {
      const mesh = new THREE.Mesh(dustGeo, dustMat);
      const pState: ParticleState = {
        mesh,
        targetPos: new THREE.Vector3(),
        targetRot: new THREE.Euler(),
        targetScale: new THREE.Vector3(1, 1, 1),
        velocity: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.01),
        type: 'SPHERE',
        baseColor: CREAM_WHITE.clone(),
        id: TREE_PARTICLES + i
      };
      mainGroup.add(mesh);
      particles.push(pState);
    }

    particlesRef.current = particles;
    setLoading(false);
  }, []);

  const addPhotoToScene = (texture: THREE.Texture) => {
    if (!mainGroupRef.current) return;
    const goldMat = new THREE.MeshStandardMaterial({ color: CHAMPAGNE_GOLD, metalness: 0.9, roughness: 0.1 });
    const frameGeo = new THREE.BoxGeometry(4.2, 4.2, 0.2);
    const frame = new THREE.Mesh(frameGeo, goldMat);
    
    const photoGeo = new THREE.PlaneGeometry(4, 4);
    const photoMat = new THREE.MeshBasicMaterial({ map: texture });
    const photo = new THREE.Mesh(photoGeo, photoMat);
    photo.position.z = 0.11;
    frame.add(photo);

    const pState: ParticleState = {
      mesh: frame,
      targetPos: new THREE.Vector3(),
      targetRot: new THREE.Euler(),
      targetScale: new THREE.Vector3(1, 1, 1),
      velocity: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.02),
      type: 'PHOTO',
      baseColor: CHAMPAGNE_GOLD.clone(),
      id: Date.now()
    };

    mainGroupRef.current.add(frame);
    particlesRef.current.push(pState);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          new THREE.TextureLoader().load(ev.target.result as string, (t) => {
            t.colorSpace = THREE.SRGBColorSpace;
            addPhotoToScene(t);
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Main animation and logic loop
  const animate = useCallback(() => {
    if (!sceneRef.current || !cameraRef.current || !rendererRef.current || !mainGroupRef.current) return;

    // Process CV
    const gestureResult = gestureService.process();
    if (gestureResult && gestureResult.landmarks && gestureResult.landmarks[0]) {
      const hand = gestureResult.landmarks[0];
      // Landmark mapping
      const palmCenter = hand[9];
      mainGroupRef.current.rotation.y = THREE.MathUtils.lerp(mainGroupRef.current.rotation.y, (palmCenter.x - 0.5) * 2, 0.1);
      mainGroupRef.current.rotation.x = THREE.MathUtils.lerp(mainGroupRef.current.rotation.x, (palmCenter.y - 0.5) * 1.5, 0.1);

      // Gesture Recognition
      const thumb = hand[4];
      const index = hand[8];
      const wrist = hand[0];
      const tips = [hand[8], hand[12], hand[16], hand[20]];
      
      const pinchDist = Math.hypot(thumb.x - index.x, thumb.y - index.y, thumb.z - index.z);
      const avgTipDist = tips.reduce((sum, tip) => sum + Math.hypot(tip.x - wrist.x, tip.y - wrist.y, tip.z - wrist.z), 0) / tips.length;

      if (pinchDist < 0.05) setMode(AppMode.FOCUS);
      else if (avgTipDist < 0.25) setMode(AppMode.TREE);
      else if (avgTipDist > 0.4) setMode(AppMode.SCATTER);
    } else {
      // Natural rotation when no hand
      mainGroupRef.current.rotation.y += 0.005;
    }

    // Update Particles
    const time = performance.now() * 0.001;
    const focusTarget = particlesRef.current.find(p => p.type === 'PHOTO');

    particlesRef.current.forEach((p, idx) => {
      const isMain = idx < TREE_PARTICLES;
      const isDust = idx >= TREE_PARTICLES && idx < TREE_PARTICLES + DUST_PARTICLES;
      const isPhoto = p.type === 'PHOTO';

      if (mode === AppMode.TREE) {
        if (isMain) {
          const t = idx / TREE_PARTICLES;
          const radius = 12 * (1 - t);
          const angle = t * 50 * Math.PI;
          p.targetPos.set(
            Math.cos(angle) * radius,
            t * 25 - 10,
            Math.sin(angle) * radius
          );
          p.targetRot.set(0, angle, 0);
          p.targetScale.set(1, 1, 1);
        } else if (isDust) {
          const angle = idx * 0.1 + time * 0.2;
          const r = 15 + Math.sin(idx) * 5;
          p.targetPos.set(Math.cos(angle) * r, Math.sin(idx * 0.5) * 20, Math.sin(angle) * r);
        } else if (isPhoto) {
          const angle = (idx % 10) * (Math.PI * 2 / 10) + time * 0.1;
          p.targetPos.set(Math.cos(angle) * 18, Math.sin(idx) * 10, Math.sin(angle) * 18);
          p.targetRot.y = angle + Math.PI / 2;
          p.targetScale.set(1, 1, 1);
        }
      } 
      else if (mode === AppMode.SCATTER) {
        // Particles rotate individually in scatter mode
        p.mesh.rotation.x += p.velocity.x;
        p.mesh.rotation.y += p.velocity.y;
        p.mesh.rotation.z += p.velocity.z;

        const angle = idx + time * 0.1;
        const r = 10 + (idx % 15);
        p.targetPos.set(Math.cos(angle) * r, Math.sin(idx * 0.7) * r, Math.sin(angle) * r);
        p.targetScale.set(1, 1, 1);
      }
      else if (mode === AppMode.FOCUS) {
        if (isPhoto && p === focusTarget) {
          p.targetPos.set(0, 2, 35);
          p.targetRot.set(0, 0, 0);
          p.targetScale.set(4.5, 4.5, 4.5);
        } else {
          // Push others away
          const dir = p.mesh.position.clone().normalize();
          p.targetPos.copy(dir.multiplyScalar(50));
          p.targetScale.set(0.2, 0.2, 0.2);
        }
      }

      // Smooth lerp
      p.mesh.position.lerp(p.targetPos, 0.05);
      p.mesh.scale.lerp(p.targetScale, 0.05);
      if (mode !== AppMode.SCATTER) {
        p.mesh.rotation.x = THREE.MathUtils.lerp(p.mesh.rotation.x, p.targetRot.x, 0.05);
        p.mesh.rotation.y = THREE.MathUtils.lerp(p.mesh.rotation.y, p.targetRot.y, 0.05);
        p.mesh.rotation.z = THREE.MathUtils.lerp(p.mesh.rotation.z, p.targetRot.z, 0.05);
      }
    });

    composerRef.current?.render();
    frameIdRef.current = requestAnimationFrame(animate);
  }, [mode]);

  useEffect(() => {
    initScene();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'h') setUiHidden(prev => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);

    // Camera setup
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 160, height: 120 } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          await gestureService.init();
          gestureService.setVideo(videoRef.current);
        }
      } catch (err) {
        console.warn("Camera access denied or failed", err);
      }
    };
    startCamera();

    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current || !composerRef.current) return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
      composerRef.current.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    frameIdRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameIdRef.current);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [initScene, animate]);

  return (
    <div className="relative w-full h-screen bg-black select-none overflow-hidden">
      {/* Loader */}
      {loading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black transition-opacity duration-1000">
          <div className="spinner mb-4"></div>
          <div className="cinzel text-[#d4af37] text-xl tracking-[0.2em]">LOADING HOLIDAY MAGIC</div>
        </div>
      )}

      {/* Main Canvas */}
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* UI Overlay */}
      <div className={`relative z-10 w-full h-full flex flex-col items-center justify-between pointer-events-none p-12 ${uiHidden ? 'ui-hidden' : ''}`}>
        
        {/* Header */}
        <div className="text-center">
          <h1 className="cinzel text-5xl md:text-7xl font-bold bg-gradient-to-b from-white to-[#d4af37] bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(212,175,55,0.6)]">
            Merry Christmas
          </h1>
        </div>

        {/* Bottom Controls */}
        <div className="flex flex-col items-center gap-4 pointer-events-auto">
          <div className="upload-wrapper">
            <button 
              onClick={() => inputRef.current?.click()}
              className="glass-btn cinzel px-8 py-3 rounded-full text-lg tracking-widest uppercase"
            >
              Add Memories
            </button>
            <input 
              ref={inputRef}
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleFileUpload} 
            />
          </div>
          <p className="text-[#fceea7]/60 text-sm italic">Press 'H' to Hide Controls</p>
          <div className="flex gap-4 mt-2">
            <button onClick={() => setMode(AppMode.TREE)} className={`px-4 py-1 text-xs border rounded transition-colors ${mode === AppMode.TREE ? 'bg-[#d4af37] text-black' : 'text-[#d4af37] border-[#d4af37]'}`}>TREE</button>
            <button onClick={() => setMode(AppMode.SCATTER)} className={`px-4 py-1 text-xs border rounded transition-colors ${mode === AppMode.SCATTER ? 'bg-[#d4af37] text-black' : 'text-[#d4af37] border-[#d4af37]'}`}>SCATTER</button>
            <button onClick={() => setMode(AppMode.FOCUS)} className={`px-4 py-1 text-xs border rounded transition-colors ${mode === AppMode.FOCUS ? 'bg-[#d4af37] text-black' : 'text-[#d4af37] border-[#d4af37]'}`}>FOCUS</button>
          </div>
        </div>
      </div>

      {/* Invisible Webcam */}
      <div className="absolute bottom-4 right-4 opacity-0 pointer-events-none">
        <video ref={videoRef} width="160" height="120" />
        <canvas ref={canvasRef} width="160" height="120" />
      </div>

      {/* Corner UI */}
      <div className={`fixed top-4 left-4 cinzel text-[#d4af37] text-sm pointer-events-none ${uiHidden ? 'ui-hidden' : ''}`}>
        Use Hand Gestures:<br/>
        ✊ Fist: Tree Mode<br/>
        🖐 Open: Scatter Mode<br/>
        👌 Pinch: Focus Mode
      </div>
    </div>
  );
};

export default App;
