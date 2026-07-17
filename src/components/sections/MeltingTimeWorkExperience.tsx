import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import {
  MELTING_TIME_TITLE_DECODE_EVENT,
  MeltingTimeCrystalFinale,
} from '@/components/sections/MeltingTimeCrystalFinale';

const ASSETS = {
  macModel: 'https://ksenia-k.com/models/mac-noUv.glb',
  keyboardTexture: 'https://ksenia-k.com/img/threejs/keyboard-overlay.png',
  videoSources: [
    {
      src: 'https://res.cloudinary.com/dt8x2v9id/video/upload/f_mp4,q_auto:best,vc_h264/v1776238532/Screen_Recording_2026-04-14_at_9.49.45_PM_irukbg.mp4',
      type: 'video/mp4',
    },
    {
      src: 'https://res.cloudinary.com/dt8x2v9id/video/upload/v1776238532/Screen_Recording_2026-04-14_at_9.49.45_PM_irukbg.mov',
      type: 'video/quicktime',
    },
  ],
  fallbackImage:
    'https://res.cloudinary.com/dt8x2v9id/image/upload/v1776170471/Screenshot_2026-04-14_at_8.40.55_PM_e9qej7.png',
  oldImage: 'https://res.cloudinary.com/dt8x2v9id/image/upload/f_auto,q_auto/icephotoold_b7isax',
  youngImage: 'https://res.cloudinary.com/dt8x2v9id/image/upload/f_auto,q_auto/icephotoyoung_thwgtq',
};

const VISUAL_CONFIG = {
  baseRadius: 0.18,
  velocityMultiplier: 0.3,
  pulseAmount: 0.02,
  chromaticOffset: 0.015,
};

const SCREEN_SIZE: [number, number] = [29.4, 20];

const SHADER = {
  vertex: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `,
  fragment: `
    uniform sampler2D tOld;
    uniform sampler2D tYoung;
    uniform vec2 uRes;
    uniform vec2 uImageRes;
    uniform vec2 uMouse;
    uniform float uTime;
    uniform float uVel;
    uniform float uRadiusMult;
    uniform float uAlpha;
    uniform float uZoom;
    uniform float uIceTransition;
    uniform float uFinaleTransition;
    uniform vec2 uFrameOffset;
    uniform bool uReducedMotion;
    uniform float pBaseRadius;
    uniform float pVelMult;
    uniform float pPulse;
    uniform float pCaOffset;

    varying vec2 vUv;

    vec4 permute(vec4 x) {
      return mod(((x * 34.0) + 1.0) * x, 289.0);
    }

    float snoise(vec3 v) {
      const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + 2.0 * C.xxx;
      vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
      i = mod(i, 289.0);
      vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      vec3 ns = (1.0 / 7.0) * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ * ns.x + ns.yyyy;
      vec4 y = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0) * 2.0 + 1.0;
      vec4 s1 = floor(b1) * 2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = 1.79284291400159 - 0.85373472095314 * vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
      return 42.0 * dot(m * m * m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
    }

    float hash21(vec2 value) {
      vec3 value3 = fract(vec3(value.xyx) * 0.1031);
      value3 += dot(value3, value3.yzx + 33.33);
      return fract((value3.x + value3.y) * value3.z);
    }

    void main() {
      vec2 texUv = (vUv - 0.5) * uZoom + 0.5;
      vec2 aspect = vec2(uRes.x / uRes.y, 1.0);
      float imageAspect = uImageRes.x / uImageRes.y;

      if (aspect.x > imageAspect) {
        texUv.y = (texUv.y - 0.5) * (imageAspect / aspect.x) + 0.5;
      } else {
        texUv.x = (texUv.x - 0.5) * (aspect.x / imageAspect) + 0.5;
      }

      texUv += uFrameOffset;
      float outgoingDrop = smoothstep(0.08, 0.62, clamp(uFinaleTransition, 0.0, 1.0));
      texUv = (texUv - 0.5) * mix(1.0, 0.64, pow(outgoingDrop, 1.35)) + 0.5;
      texUv.y += pow(outgoingDrop, 1.8) * 0.72;

      vec2 aUv = vUv * aspect;
      vec2 aMouse = uMouse * aspect;
      float n1 = uReducedMotion ? 0.0 : snoise(vec3(aUv * 3.0, uTime * 0.3));
      float n2 = uReducedMotion ? 0.0 : snoise(vec3(aUv * 6.0, uTime * 0.5 - 100.0));
      float pulse = uReducedMotion ? 0.0 : sin(uTime * 1.5) * pPulse;
      float dynamicRadius = (pBaseRadius + uVel * pVelMult + pulse) * uRadiusMult;
      float mask = smoothstep(dynamicRadius + 0.3, dynamicRadius - 0.1, distance(aUv, aMouse));

      if (!uReducedMotion) {
        mask = clamp(mask + (n1 * 0.25 + n2 * 0.1) * mask, 0.0, 1.0);
      }

      vec2 fluidUv = texUv + vec2(n1, n2) * mask * 0.012 * (2.0 - uAlpha);
      float caOff = uReducedMotion ? 0.0 : (smoothstep(0.0, 0.4, mask) - smoothstep(0.6, 1.0, mask)) * pCaOffset;

      vec4 cYoung = vec4(
        texture2D(tYoung, clamp(fluidUv + vec2(caOff, 0.0), 0.0, 1.0)).r,
        texture2D(tYoung, clamp(fluidUv, 0.0, 1.0)).g,
        texture2D(tYoung, clamp(fluidUv - vec2(caOff, 0.0), 0.0, 1.0)).b,
        1.0
      );

      vec2 dir = aUv - aMouse;
      float dist = length(dir);
      vec2 safeDir = dist > 0.0001 ? dir / dist : vec2(0.0);
      vec4 cOld = texture2D(tOld, clamp(texUv - (safeDir * mask * 0.02), 0.0, 1.0));
      vec3 glow = vec3(1.0, 0.3, 0.05) * (smoothstep(0.2, 0.5, mask) - smoothstep(0.5, 0.8, mask)) * 1.2;
      vec3 finalColor = mix(cOld.rgb, cYoung.rgb, smoothstep(0.4, 0.6, mask)) + glow;

      float iceProgress = clamp(uIceTransition, 0.0, 1.0);
      float iceAttack = smoothstep(0.015, 0.24, iceProgress);
      float iceRelease = 1.0 - smoothstep(0.64, 0.985, iceProgress);
      float iceEnergy = uReducedMotion ? 0.0 : iceAttack * iceRelease;
      float iceAlpha = 0.0;

      if (iceEnergy > 0.001) {
        vec2 centeredUv = vUv - 0.5;
        float edgeDistance = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
        float fracturedFront = edgeDistance + n1 * 0.035 + n2 * 0.018;
        float frontPosition = mix(0.025, 0.37, smoothstep(0.0, 0.62, iceProgress));
        float edgeField = 1.0 - smoothstep(frontPosition - 0.055, frontPosition + 0.07, fracturedFront);
        vec2 shardScale = vec2(6.4 * aspect.x, 6.5);
        vec2 shardUv = vUv * shardScale;
        shardUv.x += hash21(vec2(floor(shardUv.y), 17.0)) * 0.88;
        vec2 shardCell = floor(shardUv);
        vec2 shardLocal = fract(shardUv) - 0.5;
        float shardSeed = hash21(shardCell);
        shardLocal.x += shardLocal.y * (shardSeed - 0.5) * 1.15;
        float shardDistance = max(abs(shardLocal.x) * (0.86 + shardSeed * 0.28), abs(shardLocal.y) * (0.92 + (1.0 - shardSeed) * 0.22));
        float shardBody = 1.0 - smoothstep(0.28, 0.55, shardDistance);
        float sparseRim = smoothstep(0.72, 0.93, shardSeed);
        float shardRim = smoothstep(0.36, 0.48, shardDistance) * (1.0 - smoothstep(0.48, 0.55, shardDistance)) * sparseRim;
        float angle = atan(centeredUv.y, centeredUv.x);
        float radialStreak = pow(0.5 + 0.5 * sin(angle * 29.0 + shardSeed * 6.2831 + uTime * 0.3), 5.0);
        float fragmentNoise = 0.5 + 0.5 * snoise(vec3(vUv * vec2(6.5 * aspect.x, 7.5), 31.7));
        float shardPresence = smoothstep(0.24, 0.78, fragmentNoise + shardSeed * 0.3 + radialStreak * 0.18);
        float iceMask = edgeField * iceEnergy * mix(0.32, 0.88, shardPresence) * (0.82 + shardBody * 0.18);
        vec2 radialDirection = normalize(centeredUv + vec2(0.0001));
        vec2 tangentDirection = vec2(-radialDirection.y, radialDirection.x);
        float refraction = iceMask * (0.014 + shardSeed * 0.036);
        vec2 refractedUv = clamp(
          fluidUv - radialDirection * refraction + tangentDirection * (shardSeed - 0.5) * refraction * 0.45,
          0.0,
          1.0
        );
        float spectralOffset = iceMask * (0.005 + shardSeed * 0.017);
        vec3 dispersedIce = vec3(
          texture2D(tYoung, clamp(refractedUv + radialDirection * spectralOffset, 0.0, 1.0)).r,
          texture2D(tYoung, refractedUv).g,
          texture2D(tYoung, clamp(refractedUv - radialDirection * spectralOffset, 0.0, 1.0)).b
        );
        vec3 coldGlass = mix(vec3(0.23, 0.64, 1.0), vec3(0.88, 0.97, 1.0), shardBody);
        vec3 spectralRim = mix(vec3(0.1, 0.62, 1.0), vec3(1.0, 0.24, 0.16), step(0.5, shardSeed));

        finalColor = mix(finalColor, dispersedIce * 1.04, iceMask * 0.82);
        finalColor += coldGlass * shardRim * edgeField * iceEnergy * 0.16;
        finalColor += spectralRim * radialStreak * edgeField * iceEnergy * 0.1;
        finalColor += vec3(0.32, 0.62, 0.92) * edgeField * iceEnergy * (0.018 + shardBody * 0.034);
        iceAlpha = edgeField * iceEnergy * (0.34 + shardBody * 0.24);
      }

      float finaleProgress = clamp(uFinaleTransition, 0.0, 1.0);

      if (finaleProgress > 0.001) {
        float finaleAttack = smoothstep(0.015, 0.2, finaleProgress);
        float finaleRelease = 1.0 - smoothstep(0.72, 0.985, finaleProgress);
        float finaleEnergy = uReducedMotion ? 0.0 : finaleAttack * finaleRelease;
        float fogFront = mix(-0.14, 1.2, smoothstep(0.02, 0.88, finaleProgress));
        float warpedY = vUv.y + n1 * 0.052 + n2 * 0.022;
        float fogBody = 1.0 - smoothstep(fogFront - 0.13, fogFront + 0.09, warpedY);
        float fogEdge = 1.0 - smoothstep(0.0, 0.105, abs(warpedY - fogFront));
        float rowSeed = hash21(vec2(floor(vUv.y * 18.0), 41.0));
        float opticalStreak = pow(
          0.5 + 0.5 * sin(vUv.x * (18.0 + rowSeed * 21.0) + rowSeed * 6.2831 + n2 * 1.8),
          7.0
        );
        float refractiveBand = finaleEnergy * clamp(fogEdge * 0.92 + opticalStreak * fogBody * 0.24, 0.0, 1.0);
        vec2 opticalUv = clamp(
          fluidUv + vec2((n2 + rowSeed - 0.5) * 0.024, n1 * 0.012) * refractiveBand,
          0.0,
          1.0
        );
        float finaleSpectralOffset = refractiveBand * (0.004 + rowSeed * 0.006);
        vec3 finaleSpectrum = vec3(
          texture2D(tYoung, clamp(opticalUv + vec2(finaleSpectralOffset, 0.0), 0.0, 1.0)).r,
          texture2D(tYoung, opticalUv).g,
          texture2D(tYoung, clamp(opticalUv - vec2(finaleSpectralOffset, 0.0), 0.0, 1.0)).b
        );
        float spectralMix = finaleEnergy * (fogEdge * 0.82 + fogBody * opticalStreak * 0.22);
        vec3 fogColor = mix(
          vec3(0.025, 0.105, 0.17),
          vec3(0.55, 0.82, 0.92),
          fogEdge * (0.42 + opticalStreak * 0.28)
        );
        vec3 coldFringe = mix(vec3(0.05, 0.64, 1.0), vec3(1.0, 0.16, 0.34), step(0.52, rowSeed));

        finalColor = mix(finalColor, finaleSpectrum, spectralMix);
        finalColor = mix(finalColor, fogColor, fogBody * finaleEnergy * (0.22 + fogEdge * 0.22));
        finalColor += coldFringe * fogEdge * finaleEnergy * (0.075 + opticalStreak * 0.085);
        finalColor = mix(finalColor, vec3(0.004, 0.009, 0.017), smoothstep(0.66, 0.995, finaleProgress));
      }

      float vignette = smoothstep(0.8, 0.2, length(vUv - 0.5));
      float grain = (fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5) - 0.5) * 0.06;

      gl_FragColor = vec4(mix(finalColor * 0.4, finalColor, vignette) + grain, max(uAlpha, iceAlpha));
    }
  `,
};

type GsapInstance = typeof import('gsap').gsap;
type ScrollTriggerPlugin = typeof import('gsap/ScrollTrigger').ScrollTrigger;

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    material.forEach(disposeMaterial);
    return;
  }

  material.dispose();
}

function disposeScene(scene: THREE.Scene | undefined) {
  scene?.traverse((child) => {
    const mesh = child as THREE.Mesh;

    if (!mesh.isMesh) {
      return;
    }

    mesh.geometry?.dispose();

    if (mesh.material) {
      disposeMaterial(mesh.material);
    }
  });
}

export const MeltingTimeWorkExperience: React.FC = () => {
  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const root = rootRef.current;
    const canvasEl = canvasRef.current;

    if (!root || !canvasEl) {
      return;
    }

    let disposed = false;
    let rafId = 0;
    let loaderTimeout = 0;
    let gsapContext: { revert: () => void } | undefined;

    let scene: THREE.Scene | undefined;
    let camera: THREE.PerspectiveCamera | undefined;
    let renderer: THREE.WebGLRenderer | undefined;
    let ambientLight: THREE.AmbientLight | undefined;
    let mainLight: THREE.PointLight | undefined;
    let screenLight: THREE.RectAreaLight | undefined;
    let heroScene: THREE.Scene | undefined;
    let heroCamera: THREE.OrthographicCamera | undefined;
    let heroMaterial: THREE.ShaderMaterial | undefined;
    let screenMaterial: THREE.MeshBasicMaterial | undefined;
    let keyboardMaterial: THREE.MeshBasicMaterial | undefined;
    let baseMetalMaterial: THREE.MeshStandardMaterial | undefined;
    let darkPlasticMaterial: THREE.MeshStandardMaterial | undefined;
    let cameraMaterial: THREE.MeshBasicMaterial | undefined;
    let logoMaterial: THREE.MeshBasicMaterial | undefined;
    let macGroup: THREE.Group | undefined;
    let lidGroup: THREE.Group | undefined;
    let bottomGroup: THREE.Group | undefined;
    let screenMesh: THREE.Mesh | undefined;
    let textureOld: THREE.Texture | undefined;
    let textureYoung: THREE.Texture | undefined;

    const mouse = new THREE.Vector2(0.5, 0.5);
    const targetMouse = new THREE.Vector2(0.5, 0.5);
    const clock = new THREE.Clock();
    let currentVelocity = 0;
    let targetRadius = 1;
    let currentRadius = 1;
    const getHeroFrameOffsetX = () => (window.innerWidth < 640 ? 0.045 : 0);
    const getRenderPixelRatio = () => {
      const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
      const dprCap = window.innerWidth < 640 ? 1.1 : coarsePointer || window.innerWidth < 1024 ? 1.25 : 1.5;
      return Math.min(window.devicePixelRatio || 1, dprCap);
    };
    const setThermalPointer = (clientX: number, clientY: number, intensity = 0.72) => {
      const width = window.innerWidth || 1;
      const height = window.innerHeight || 1;
      const normalizedX = Math.max(0, Math.min(1, clientX / width));
      const normalizedY = Math.max(0, Math.min(1, clientY / height));
      const centeredX = (normalizedX - 0.5) * 2;
      const centeredY = (normalizedY - 0.5) * 2;

      targetMouse.set(normalizedX, 1 - normalizedY);
      root.style.setProperty('--melting-pointer-x', `${clientX}px`);
      root.style.setProperty('--melting-pointer-y', `${clientY}px`);
      root.style.setProperty('--melting-sheet-shift-x', `${centeredX * 26}px`);
      root.style.setProperty('--melting-sheet-shift-y', `${centeredY * 18}px`);
      root.style.setProperty('--melting-title-shift-x', `${centeredX * 3.5}px`);
      root.style.setProperty('--melting-title-shift-y', `${centeredY * 2.25}px`);
      root.style.setProperty('--melting-title-glass-shift-x', `${centeredX * 1.25}px`);
      root.style.setProperty('--melting-title-glass-shift-y', `${centeredY * 0.65}px`);
      root.style.setProperty('--melting-title-ca-shift-x', `${centeredX * 0.5}px`);
      root.style.setProperty('--melting-title-ca-shift-y', `${centeredY * 0.32}px`);
      const heat = Math.max(0.45, Math.min(1, intensity));

      root.style.setProperty('--melting-pointer-heat', `${heat}`);
      root.style.setProperty('--melting-title-glass-opacity', `${0.42 + heat * 0.18}`);
    };

    setThermalPointer(window.innerWidth * 0.5, window.innerHeight * 0.48, 0.62);

    const scrubEngine = {
      scrollProgress: 0,
      video: undefined as HTMLVideoElement | undefined,
      canvas: undefined as HTMLCanvasElement | undefined,
      context: undefined as CanvasRenderingContext2D | null | undefined,
      texture: undefined as THREE.CanvasTexture | undefined,
      posterImage: undefined as HTMLImageElement | undefined,
      lastProgress: -1,
      metadataReady: false,
      isReady: false,
      isSeeking: false,
      targetTime: 0,
      pendingTime: undefined as number | undefined,
      committedTime: -1,
      seekTolerance: 1 / 45,
      compactPanScale: 1.12,

      paintSource(source: CanvasImageSource) {
        if (!this.context || !this.canvas || !this.texture) {
          return;
        }

        const { width, height } = this.canvas;
        const isCompact = window.innerWidth < 640;
        const scaleX = isCompact ? this.compactPanScale : 1;
        const drawWidth = width * scaleX;
        const drawX = isCompact ? width * (1 - scaleX) : 0;

        this.context.fillStyle = '#050505';
        this.context.fillRect(0, 0, width, height);
        this.context.drawImage(source, drawX, 0, drawWidth, height);
        this.texture.needsUpdate = true;
      },

      init() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = 1920;
        this.canvas.height = 1080;
        this.context = this.canvas.getContext('2d', { alpha: false });
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.magFilter = THREE.LinearFilter;
        this.texture.generateMipmaps = false;
        this.texture.flipY = false;

        this.video = document.createElement('video');
        this.video.muted = true;
        this.video.playsInline = true;
        this.video.setAttribute('webkit-playsinline', 'true');
        this.video.crossOrigin = 'anonymous';
        this.video.preload = 'auto';
        this.video.disablePictureInPicture = true;

        ASSETS.videoSources.forEach((sourceConfig) => {
          const source = document.createElement('source');
          source.src = sourceConfig.src;
          source.type = sourceConfig.type;
          this.video?.appendChild(source);
        });

        const unlock = () => {
          if (!this.isReady && this.video) {
            const playPromise = this.video.play();
            playPromise?.then(() => this.video?.pause()).catch(() => undefined);
          }

          ['touchstart', 'pointerdown', 'wheel'].forEach((eventName) => {
            window.removeEventListener(eventName, unlock);
          });
        };

        ['touchstart', 'pointerdown', 'wheel'].forEach((eventName) => {
          window.addEventListener(eventName, unlock, { once: true, passive: true });
        });

        this.video.addEventListener('loadedmetadata', () => {
          if (!this.video || !this.canvas) {
            return;
          }

          if (this.video.videoWidth && this.video.videoHeight) {
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            this.drawPoster();
          }

          this.video.pause();
          this.metadataReady = true;
          this.queueSeekForProgress(true);
        });

        this.video.addEventListener('loadeddata', () => {
          if (!this.isReady) {
            this.drawFrame();
          }
        });

        this.video.addEventListener('seeked', () => {
          if (!this.video) {
            return;
          }

          this.isSeeking = false;
          this.committedTime = this.video.currentTime;
          this.drawFrame();

          const queuedTime = this.pendingTime;
          this.pendingTime = undefined;

          if (queuedTime !== undefined && Math.abs(queuedTime - this.committedTime) > this.seekTolerance) {
            this.seekToTime(queuedTime, true);
          }
        });

        this.video.addEventListener('error', () => {
          console.warn('[MeltingTimeWorkExperience] video scrub source failed; keeping poster frame.');
        });

        this.video.load();
      },

      loadPoster(url: string) {
        return new Promise<void>((resolve, reject) => {
          const image = new Image();
          image.crossOrigin = 'anonymous';
          image.onload = () => {
            this.posterImage = image;
            this.drawPoster();
            resolve();
          };
          image.onerror = () => reject(new Error('Poster load failed'));
          image.src = url;
        });
      },

      drawPoster() {
        if (!this.posterImage || this.isReady || !this.context || !this.canvas || !this.texture) {
          return;
        }

        this.paintSource(this.posterImage);
      },

      drawFrame() {
        if (!this.video || !this.context || !this.canvas || !this.texture) {
          return;
        }

        const paint = () => {
          if (!this.video || !this.context || !this.canvas || !this.texture) {
            return;
          }

          try {
            this.paintSource(this.video);
            this.isReady = true;
          } catch {
            // Keep the poster visible until the browser exposes a decoded video frame.
          }
        };

        if ('requestVideoFrameCallback' in this.video) {
          this.video.requestVideoFrameCallback(() => paint());
          return;
        }

        requestAnimationFrame(paint);
      },

      redrawCurrentFrame() {
        if (this.video && this.isReady) {
          try {
            this.paintSource(this.video);
          } catch {
            // If the current video frame is temporarily unavailable, the next seek/update will repaint it.
          }

          return;
        }

        this.drawPoster();
      },

      setScrollProgress(progress: number) {
        const nextProgress = Math.max(0, Math.min(1, progress));

        if (Math.abs(nextProgress - this.scrollProgress) < 0.0005) {
          return;
        }

        this.scrollProgress = nextProgress;
        this.queueSeekForProgress();
      },

      queueSeekForProgress(force = false) {
        if (!this.metadataReady || !this.video) {
          return;
        }

        if (!force && Math.abs(this.scrollProgress - this.lastProgress) < 0.0005) {
          return;
        }

        this.lastProgress = this.scrollProgress;

        const { duration } = this.video;

        if (!Number.isFinite(duration) || duration <= 0) {
          return;
        }

        const safeStart = Math.min(0.08, duration * 0.02);
        const safeEnd = Math.max(safeStart, duration - Math.min(0.08, duration * 0.02));
        const targetTime = safeStart + this.scrollProgress * (safeEnd - safeStart);
        this.targetTime = Math.max(0, Math.min(targetTime, duration));
        this.seekToTime(this.targetTime, force);
      },

      seekToTime(time: number, force = false) {
        if (!this.video) {
          return;
        }

        const targetTime = Math.max(0, Math.min(time, this.video.duration || time));

        if (!force && Math.abs(targetTime - this.committedTime) <= this.seekTolerance) {
          return;
        }

        if (this.isSeeking) {
          this.pendingTime = targetTime;
          return;
        }

        this.isSeeking = true;
        this.pendingTime = undefined;

        try {
          this.video.pause();
          this.video.currentTime = targetTime;
        } catch {
          this.isSeeking = false;
        }
      },

      update() {
        this.queueSeekForProgress();
      },

      dispose() {
        this.texture?.dispose();

        if (this.video) {
          this.video.pause();
          this.video.src = '';
          this.video.querySelectorAll('source').forEach((source) => source.remove());
          this.video.removeAttribute('src');
          this.video.load();
        }
      },
    };

    const handlers = {
      resize: () => {
        if (!camera || !renderer || !heroMaterial) {
          return;
        }

        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(getRenderPixelRatio());
        renderer.setSize(window.innerWidth, window.innerHeight);
        heroMaterial.uniforms.uRes.value.set(window.innerWidth, window.innerHeight);
        heroMaterial.uniforms.uFrameOffset.value.set(getHeroFrameOffsetX(), 0);
        setThermalPointer(window.innerWidth * 0.5, window.innerHeight * 0.48, 0.62);
        scrubEngine.redrawCurrentFrame();
      },
      mousemove: (event: MouseEvent) => {
        setThermalPointer(event.clientX, event.clientY, 0.82);
      },
      mousedown: () => {
        targetRadius = 2;
        root.style.setProperty('--melting-pointer-heat', '1');
        root.style.setProperty('--melting-title-glass-opacity', '0.6');
      },
      mouseup: () => {
        targetRadius = 1;
        root.style.setProperty('--melting-pointer-heat', '0.72');
        root.style.setProperty('--melting-title-glass-opacity', '0.55');
      },
      touchstart: (event: TouchEvent) => {
        const touch = event.touches[0];

        if (touch) {
          setThermalPointer(touch.clientX, touch.clientY, 0.92);
        }
      },
      touchmove: (event: TouchEvent) => {
        const touch = event.touches[0];

        if (touch) {
          setThermalPointer(touch.clientX, touch.clientY, 0.92);
        }
      },
      touchend: () => {
        targetRadius = 1;
        root.style.setProperty('--melting-pointer-heat', '0.66');
        root.style.setProperty('--melting-title-glass-opacity', '0.54');
      },
    };

    const loadTexture = (url: string) =>
      new Promise<THREE.Texture>((resolve, reject) => {
        new THREE.TextureLoader().setCrossOrigin('anonymous').load(url, resolve, undefined, reject);
      });

    const initSceneSetup = () => {
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 10, 1000);
      camera.position.z = 85;

      renderer = new THREE.WebGLRenderer({
        antialias: !window.matchMedia('(pointer: coarse)').matches,
        alpha: false,
        canvas: canvasEl,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(getRenderPixelRatio());
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setClearColor(0x050505, 1);
      renderer.autoClear = false;

      RectAreaLightUniformsLib.init();

      ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
      scene.add(ambientLight);

      mainLight = new THREE.PointLight(0xffffff, 0.8);
      mainLight.position.set(0, 5, 50);
      scene.add(mainLight);

      macGroup = new THREE.Group();
      macGroup.position.set(0, -5, -10);
      macGroup.rotation.set(0.1, 0, 0);
      scene.add(macGroup);

      lidGroup = new THREE.Group();
      bottomGroup = new THREE.Group();
      macGroup.add(lidGroup);
      macGroup.add(bottomGroup);
      lidGroup.rotation.x = Math.PI / 2;

      heroScene = new THREE.Scene();
      heroCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
      heroCamera.position.z = 1;

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      heroMaterial = new THREE.ShaderMaterial({
        vertexShader: SHADER.vertex,
        fragmentShader: SHADER.fragment,
        uniforms: {
          tOld: { value: textureOld },
          tYoung: { value: textureYoung },
          uRes: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
          uImageRes: {
            value: new THREE.Vector2(textureOld?.image?.width || 1, textureOld?.image?.height || 1),
          },
          uMouse: { value: mouse },
          uTime: { value: 0 },
          uVel: { value: 0 },
          uRadiusMult: { value: 1 },
          uAlpha: { value: 0 },
          uZoom: { value: 0.7 },
          uIceTransition: { value: 0 },
          uFinaleTransition: { value: 0 },
          uFrameOffset: { value: new THREE.Vector2(getHeroFrameOffsetX(), 0) },
          uReducedMotion: { value: reducedMotion },
          pBaseRadius: { value: VISUAL_CONFIG.baseRadius },
          pVelMult: { value: VISUAL_CONFIG.velocityMultiplier },
          pPulse: { value: VISUAL_CONFIG.pulseAmount },
          pCaOffset: { value: VISUAL_CONFIG.chromaticOffset },
        },
        transparent: true,
        depthWrite: false,
        depthTest: false,
      });

      heroScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), heroMaterial));

      window.addEventListener('resize', handlers.resize);
      window.visualViewport?.addEventListener('resize', handlers.resize);
      window.addEventListener('mousemove', handlers.mousemove);
      window.addEventListener('mousedown', handlers.mousedown);
      window.addEventListener('mouseup', handlers.mouseup);
      window.addEventListener('touchstart', handlers.touchstart, { passive: true });
      window.addEventListener('touchmove', handlers.touchmove, { passive: true });
      window.addEventListener('touchend', handlers.touchend);
    };

    const createMaterials = () => {
      screenMaterial = new THREE.MeshBasicMaterial({
        map: scrubEngine.texture,
        transparent: true,
        opacity: 0,
        side: THREE.BackSide,
      });

      const textureLoader = new THREE.TextureLoader();
      const keyboardTexture = textureLoader.load(ASSETS.keyboardTexture, undefined, undefined, () => undefined);
      keyboardMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        alphaMap: keyboardTexture,
        transparent: true,
      });
      baseMetalMaterial = new THREE.MeshStandardMaterial({ color: 0x8a8b8e, roughness: 0.4, metalness: 0.8 });
      darkPlasticMaterial = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.8, metalness: 0.2 });
      cameraMaterial = new THREE.MeshBasicMaterial({ color: 0x111111 });
      logoMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    };

    const loadModel = () =>
      new Promise<void>((resolve, reject) => {
        if (
          !scene ||
          !lidGroup ||
          !bottomGroup ||
          !screenMaterial ||
          !keyboardMaterial ||
          !baseMetalMaterial ||
          !darkPlasticMaterial ||
          !cameraMaterial ||
          !logoMaterial
        ) {
          reject(new Error('Scene not initialized'));
          return;
        }

        const lid = lidGroup;
        const bottom = bottomGroup;
        const screen = screenMaterial;
        const keyboard = keyboardMaterial;
        const baseMetal = baseMetalMaterial;
        const darkPlastic = darkPlasticMaterial;
        const cameraLens = cameraMaterial;
        const logo = logoMaterial;
        const modelLoader = new GLTFLoader();

        modelLoader.load(
          ASSETS.macModel,
          (glb) => {
            [...glb.scene.children].forEach((child) => {
              if (child.name === '_top') {
                lid.add(child);

                [...child.children].forEach((mesh) => {
                  const namedMesh = mesh as THREE.Mesh;

                  if (namedMesh.name === 'lid') {
                    namedMesh.material = baseMetal;
                  } else if (namedMesh.name === 'logo') {
                    namedMesh.material = logo;
                  } else if (namedMesh.name === 'screen-frame') {
                    namedMesh.material = darkPlastic;
                  } else if (namedMesh.name === 'camera') {
                    namedMesh.material = cameraLens;
                  }
                });
              } else if (child.name === '_bottom') {
                bottom.add(child);

                [...child.children].forEach((mesh) => {
                  const namedMesh = mesh as THREE.Mesh;

                  if (namedMesh.name === 'base') {
                    namedMesh.material = baseMetal;
                  } else if (
                    namedMesh.name === 'legs' ||
                    namedMesh.name === 'keyboard' ||
                    namedMesh.name === 'inner'
                  ) {
                    namedMesh.material = darkPlastic;
                  }
                });
              }
            });

            screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_SIZE[0], SCREEN_SIZE[1]), screen);
            screenMesh.position.set(0, 10.5, -0.11);
            screenMesh.rotation.set(Math.PI, 0, 0);
            lid.add(screenMesh);

            screenLight = new THREE.RectAreaLight(0xffffff, 0, SCREEN_SIZE[0], SCREEN_SIZE[1]);
            screenLight.position.set(0, 10.5, 0);
            screenLight.rotation.set(Math.PI, 0, 0);
            lid.add(screenLight);

            const darkScreen = new THREE.Mesh(
              new THREE.PlaneGeometry(SCREEN_SIZE[0], SCREEN_SIZE[1]),
              darkPlastic,
            );
            darkScreen.position.set(0, 10.5, -0.111);
            darkScreen.rotation.set(Math.PI, Math.PI, 0);
            lid.add(darkScreen);

            const keyboardKeys = new THREE.Mesh(new THREE.PlaneGeometry(27.7, 11.6), keyboard);
            keyboardKeys.rotation.set(-0.5 * Math.PI, 0, 0);
            keyboardKeys.position.set(0, 0.045, 7.21);
            bottom.add(keyboardKeys);

            resolve();
          },
          undefined,
          reject,
        );
      });

    const renderLoop = () => {
      if (!renderer || !scene || !camera || !heroScene || !heroCamera || !heroMaterial) {
        return;
      }

      scrubEngine.update();

      const distance = mouse.distanceTo(targetMouse);

      if (distance > 0.0001 || currentVelocity > 0.0001) {
        mouse.lerp(targetMouse, 0.08);
        currentVelocity += (distance - currentVelocity) * 0.1;
      } else {
        currentVelocity = 0;
      }

      if (Math.abs(targetRadius - currentRadius) > 0.001) {
        currentRadius += (targetRadius - currentRadius) * 0.15;
      }

      heroMaterial.uniforms.uTime.value = clock.getElapsedTime();
      heroMaterial.uniforms.uVel.value = currentVelocity;
      heroMaterial.uniforms.uRadiusMult.value = currentRadius;

      renderer.clear();

      if (heroMaterial.uniforms.uAlpha.value < 1) {
        renderer.render(scene, camera);
      }

      if (heroMaterial.uniforms.uAlpha.value > 0.001) {
        renderer.render(heroScene, heroCamera);
      }

      rafId = requestAnimationFrame(renderLoop);
    };

    const createScrollAnimation = (
      gsap: GsapInstance,
      ScrollTrigger: ScrollTriggerPlugin,
    ) => {
      if (!macGroup || !lidGroup || !screenMaterial || !heroMaterial || !ambientLight || !mainLight) {
        return;
      }

      const mac = macGroup;
      const lid = lidGroup;
      const screen = screenMaterial;
      const hero = heroMaterial;
      const ambient = ambientLight;
      const main = mainLight;
      const screenScrubStart = 4.5 / 15;
      const screenScrubEnd = 9 / 15;
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const getHeroFinalZoom = () => (window.innerWidth < 640 ? 1.12 : 1);
      const getHeroEntryZoom = () => (prefersReducedMotion ? getHeroFinalZoom() : getHeroFinalZoom() + 0.24);
      const getHeroImpactZoom = () => (prefersReducedMotion ? getHeroFinalZoom() : getHeroFinalZoom() - 0.08);
      const setScreenScrubProgress = (scrollProgress: number) => {
        const normalizedProgress = (scrollProgress - screenScrubStart) / (screenScrubEnd - screenScrubStart);
        scrubEngine.setScrollProgress(normalizedProgress);
      };
      const getIntroTextLiftY = () => {
        const firstText = root.querySelector<HTMLElement>('.melting-time-text-1');
        const viewportHeight = window.innerHeight || 900;
        const textTop = firstText ? parseFloat(window.getComputedStyle(firstText).top) : viewportHeight * 0.15;
        const navigationClearance =
          window.innerWidth >= 768
            ? Math.max(72, Math.min(96, viewportHeight * 0.09))
            : Math.max(78, Math.min(120, viewportHeight * 0.11));
        const desiredLift = Math.max(28, Math.min(84, viewportHeight * 0.075));
        const safeLift = Math.min(desiredLift, Math.max(14, textTop - navigationClearance));

        return -safeLift;
      };
      const getIntroTextExitY = () => getIntroTextLiftY() - Math.max(18, Math.min(34, window.innerHeight * 0.035));
      const getIntroTextScale = () => (window.innerWidth < 520 || window.innerHeight < 720 ? 0.93 : 0.9);
      const getFallbackLidEdgeRatio = (stage: 'closed' | 'open' | 'scrub') => {
        const width = window.innerWidth || 1440;

        if (width < 640) {
          return stage === 'closed' ? 0.62 : stage === 'open' ? 0.36 : 0.26;
        }

        if (width < 1024) {
          return stage === 'closed' ? 0.56 : stage === 'open' ? 0.34 : 0.25;
        }

        return stage === 'closed' ? 0.5 : stage === 'open' ? 0.32 : 0.24;
      };
      const getProjectedLidEdgeY = (stage: 'closed' | 'open' | 'scrub') => {
        if (!camera || !screenMesh) {
          return window.innerHeight * getFallbackLidEdgeRatio(stage);
        }

        const activeCamera = camera;
        const activeScreenMesh = screenMesh;
        const previousMacPosition = mac.position.clone();
        const previousMacRotation = mac.rotation.clone();
        const previousLidRotation = lid.rotation.clone();

        try {
          if (stage === 'closed') {
            mac.position.set(0, -5, -10);
            mac.rotation.set(0.1, 0, 0);
            lid.rotation.x = Math.PI / 2;
          } else if (stage === 'open') {
            mac.position.set(0, -7, 5);
            mac.rotation.set(0.1, 0, 0);
            lid.rotation.x = -0.15 * Math.PI;
          } else {
            mac.position.set(0, -10, 42);
            mac.rotation.set(0.05, 0, 0);
            lid.rotation.x = -0.15 * Math.PI;
          }

          mac.updateWorldMatrix(true, true);

          const screenCorners = [
            new THREE.Vector3(-SCREEN_SIZE[0] / 2, -SCREEN_SIZE[1] / 2, 0),
            new THREE.Vector3(SCREEN_SIZE[0] / 2, -SCREEN_SIZE[1] / 2, 0),
            new THREE.Vector3(-SCREEN_SIZE[0] / 2, SCREEN_SIZE[1] / 2, 0),
            new THREE.Vector3(SCREEN_SIZE[0] / 2, SCREEN_SIZE[1] / 2, 0),
          ];
          const projectedYs = screenCorners
            .map((corner) => {
              activeScreenMesh.localToWorld(corner);
              corner.project(activeCamera);
              return ((1 - corner.y) / 2) * window.innerHeight;
            })
            .filter((value) => Number.isFinite(value));
          const projectedY = projectedYs.length
            ? (() => {
                const topEdgeY = Math.min(...projectedYs);
                const lowerEdgeY = Math.max(...projectedYs);

                return stage === 'closed' ? topEdgeY + (lowerEdgeY - topEdgeY) * 0.78 : topEdgeY;
              })()
            : window.innerHeight * getFallbackLidEdgeRatio(stage);

          return Math.max(0, Math.min(window.innerHeight, projectedY));
        } finally {
          mac.position.copy(previousMacPosition);
          mac.rotation.copy(previousMacRotation);
          lid.rotation.copy(previousLidRotation);
          mac.updateWorldMatrix(true, true);
        }
      };
      const getAttachedSecondTextY = (stage: 'closed' | 'open' | 'scrub') => {
        const secondText = root.querySelector<HTMLElement>('.melting-time-text-2');
        const viewportHeight = window.innerHeight || 900;
        const textHeight = secondText?.getBoundingClientRect().height || Math.max(48, viewportHeight * 0.08);
        const edgeY = getProjectedLidEdgeY(stage);
        const gap = Math.max(6, Math.min(12, viewportHeight * 0.014));
        const navigationClearance =
          window.innerWidth >= 768
            ? Math.max(86, Math.min(118, viewportHeight * 0.1))
            : Math.max(92, Math.min(126, viewportHeight * 0.125));

        return Math.max(navigationClearance, edgeY - textHeight - gap);
      };
      const getSecondTextExitY = () =>
        getAttachedSecondTextY('scrub') - Math.max(14, Math.min(28, window.innerHeight * 0.03));

      gsap.registerPlugin(ScrollTrigger);

      const introHandoffStart = 0.75;
      const introTextExitStart = 1.8;

      gsapContext = gsap.context(() => {
        gsap.set('.melting-time-text-1', { opacity: 1, y: 0, scale: 1, transformOrigin: '50% 50%' });
        gsap.set('.melting-time-text-2', {
          opacity: 0,
          xPercent: -50,
          y: () => getAttachedSecondTextY('closed'),
          scale: 0.94,
          transformOrigin: '50% 50%',
        });

        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: '.melting-time-scroll-track',
            start: 'top top',
            end: 'bottom bottom',
            scrub: 1.2,
            invalidateOnRefresh: true,
            onRefresh: (self: { progress: number }) => setScreenScrubProgress(self.progress),
            onUpdate: (self: { progress: number }) => setScreenScrubProgress(self.progress),
          },
        });

        timeline.to(
          '.melting-time-text-1',
          {
            opacity: 0.62,
            y: getIntroTextLiftY,
            scale: getIntroTextScale,
            duration: 1.35,
            ease: 'power2.out',
          },
          introHandoffStart,
        );
        timeline.to(
          '.melting-time-text-2',
          {
            y: () => getAttachedSecondTextY('open'),
            scale: 1,
            duration: 1.5,
            ease: 'power2.out',
          },
          introHandoffStart,
        );
        timeline.to('.melting-time-text-2', { opacity: 0.96, duration: 0.9, ease: 'power2.out' }, introHandoffStart);
        timeline.to(
          '.melting-time-text-1',
          { opacity: 0, y: getIntroTextExitY, duration: 0.45, ease: 'power2.in' },
          introTextExitStart,
        );
        timeline.to(lid.rotation, { x: -0.15 * Math.PI, duration: 1.5, ease: 'power1.inOut' }, introHandoffStart);
        timeline.to(mac.position, { z: 5, y: -7, duration: 1.5, ease: 'power1.inOut' }, introHandoffStart);

        if (screenLight) {
          timeline.to(screen, { opacity: 1, duration: 0.5 }, 3);
          timeline.to(screenLight, { intensity: 2.5, duration: 0.5 }, 3);
          timeline.to(mac.position, { z: 42, y: -10, duration: 1.5, ease: 'power2.inOut' }, 3);
          timeline.to(mac.rotation, { x: 0.05, duration: 1.5, ease: 'power2.inOut' }, 3);
        }

        timeline.to(
          '.melting-time-text-2',
          {
            opacity: 0.92,
            y: () => getAttachedSecondTextY('scrub'),
            duration: 1.5,
            ease: 'power1.inOut',
          },
          3,
        );
        timeline.to(
          '.melting-time-text-2',
          {
            opacity: 0,
            y: getSecondTextExitY,
            duration: 0.35,
            ease: 'power2.in',
          },
          4.5,
        );
        timeline.to({}, { duration: 4.5, ease: 'none' }, 4.5);

        timeline.to(mac.position, { z: 76, y: -14, duration: 1.85, ease: 'power4.in' }, 8.65);
        timeline.to(mac.rotation, { x: 0, y: 0, duration: 1.85, ease: 'power4.in' }, 8.65);
        timeline.to(ambient, { intensity: 0, duration: 1.5, ease: 'power2.out' }, 9);
        timeline.to(main, { intensity: 0, duration: 1.5, ease: 'power2.out' }, 9);

        if (screenLight) {
          timeline.to(screenLight, { intensity: 0.2, duration: 1.5 }, 9);
        }

        timeline.fromTo(
          hero.uniforms.uIceTransition,
          { value: prefersReducedMotion ? 1 : 0 },
          { value: 1, duration: prefersReducedMotion ? 0.01 : 1.95, ease: 'none' },
          9.05,
        );
        timeline.fromTo(
          hero.uniforms.uZoom,
          { value: getHeroEntryZoom },
          { value: getHeroImpactZoom, duration: prefersReducedMotion ? 0.01 : 1.35, ease: 'expo.in' },
          9.1,
        );
        timeline.to(
          hero.uniforms.uZoom,
          { value: getHeroFinalZoom, duration: prefersReducedMotion ? 0.01 : 0.72, ease: 'expo.out' },
          10.45,
        );
        timeline.to(
          hero.uniforms.uAlpha,
          { value: 1, duration: prefersReducedMotion ? 0.35 : 1.18, ease: 'power2.inOut' },
          9.42,
        );
        timeline.to({}, { duration: 4 }, 11);

        const crystalStage = Array.from(root.querySelectorAll<HTMLElement>('[data-melting-crystal-stage]'));
        const crystalScene = Array.from(root.querySelectorAll<HTMLElement>('[data-melting-crystal-scene]'));
        const crystalChars = Array.from(root.querySelectorAll<HTMLElement>('[data-melting-crystal-char]'));
        const crystalSubtitle = Array.from(root.querySelectorAll<HTMLElement>('[data-melting-crystal-subtitle]'));
        const crystalHandoff = Array.from(root.querySelectorAll<HTMLElement>('[data-melting-crystal-handoff]'));
        const crystalHandoffEchoes = Array.from(
          root.querySelectorAll<HTMLElement>('[data-melting-crystal-handoff-echo]'),
        );
        const crystalHandoffMists = Array.from(
          root.querySelectorAll<HTMLElement>('[data-melting-crystal-handoff-mist]'),
        );
        const crystalHandoffPrisms = Array.from(
          root.querySelectorAll<HTMLElement>('[data-melting-crystal-handoff-prism]'),
        );
        const crystalHandoffPrismField = Array.from(
          root.querySelectorAll<HTMLElement>('[data-melting-crystal-handoff-prisms]'),
        );
        const finaleSection = root.querySelector<HTMLElement>('.melting-time-crystal-finale');
        const compactFinaleMotion = window.matchMedia('(max-width: 767px), (pointer: coarse)').matches;

        gsap.set(crystalChars, {
          opacity: 0,
          y: 40,
          scale: 0.95,
          filter: compactFinaleMotion ? 'none' : 'blur(10px)',
        });
        gsap.set(crystalSubtitle, {
          opacity: 0,
          y: 20,
          filter: compactFinaleMotion ? 'none' : 'blur(10px)',
        });

        if (prefersReducedMotion || !finaleSection) {
          gsap.set(crystalStage, { autoAlpha: 1, scale: 1 });
          gsap.set(crystalScene, { opacity: 1, scale: 1, filter: 'blur(0px)' });
          gsap.set(crystalHandoff, { opacity: 0 });
          gsap.set([...crystalChars, ...crystalSubtitle], {
            opacity: 1,
            y: 0,
            scale: 1,
            filter: 'blur(0px)',
          });
        } else {
          gsap.set(crystalStage, { autoAlpha: 0, scale: 1.055 });
          gsap.set(crystalScene, {
            opacity: 0,
            yPercent: compactFinaleMotion ? -14 : -20,
            scale: compactFinaleMotion ? 0.52 : 0.42,
            webkitMaskPosition: '0% 100%',
            maskPosition: '0% 100%',
            filter: compactFinaleMotion ? 'none' : 'blur(6px) saturate(1.08)',
          });
          gsap.set(crystalHandoff, { opacity: 0, yPercent: 30, scale: 0.94 });
          gsap.set(crystalHandoffEchoes, {
            opacity: 0,
            xPercent: (index: number) => [-1.1, 1.1, 0.35][index] ?? 0,
            yPercent: compactFinaleMotion ? -12 : -18,
            scale: compactFinaleMotion ? 0.56 : 0.44,
          });
          gsap.set(crystalHandoffMists, { opacity: 0, yPercent: 70, scaleX: 0.86 });
          gsap.set(crystalHandoffPrismField, { opacity: 0 });
          gsap.set(crystalHandoffPrisms, { opacity: 0, xPercent: -14, scaleX: 0.72 });

          const crystalHandoffTimeline = gsap.timeline({
            scrollTrigger: {
              trigger: finaleSection,
              start: 'top bottom',
              end: 'top top',
              scrub: compactFinaleMotion ? 0.42 : 0.62,
              invalidateOnRefresh: true,
            },
          });
          crystalHandoffTimeline
            .to(hero.uniforms.uFinaleTransition, { value: 1, duration: 1, ease: 'none' }, 0)
            .to(crystalStage, { autoAlpha: 1, scale: 1, duration: 0.82, ease: 'power2.inOut' }, 0.08)
            .to(crystalScene, {
              opacity: 1,
              yPercent: 0,
              scale: 1.025,
              webkitMaskPosition: '0% 0%',
              maskPosition: '0% 0%',
              filter: 'blur(0px) saturate(1)',
              duration: 0.7,
              ease: 'expo.inOut',
            }, 0.14)
            .to(crystalScene, {
              scale: 1,
              duration: 0.16,
              ease: 'power2.out',
            }, 0.84)
            .to(crystalHandoff, {
              opacity: 1,
              yPercent: -2,
              scale: 1.05,
              duration: 0.52,
              ease: 'power2.out',
            }, 0.02)
            .to(crystalHandoffMists, {
              opacity: (index: number) => (index === 0 ? 0.74 : 0.58),
              yPercent: -18,
              scaleX: 1.08,
              duration: 0.58,
              stagger: 0.035,
              ease: 'power2.out',
            }, 0.06)
            .to(crystalHandoffEchoes, {
              opacity: (index: number) => [0.22, 0.16, 0.09][index] ?? 0.1,
              xPercent: (index: number) => [-0.85, 0.85, 0.25][index] ?? 0,
              yPercent: -2,
              scale: 1.08,
              duration: 0.48,
              stagger: 0.025,
              ease: 'expo.out',
            }, 0.11)
            .to(crystalHandoffPrismField, { opacity: 1, duration: 0.12, ease: 'power1.out' }, 0.14)
            .to(crystalHandoffPrisms, {
              opacity: 0.38,
              xPercent: 14,
              scaleX: 1.08,
              duration: 0.42,
              stagger: 0.025,
              ease: 'power2.out',
            }, 0.14)
            .to(crystalHandoffEchoes, {
              opacity: 0,
              xPercent: (index: number) => [-1.45, 1.45, 0.5][index] ?? 0,
              yPercent: -14,
              scale: 1.14,
              duration: 0.32,
              stagger: 0.018,
              ease: 'power3.in',
            }, 0.56)
            .to(crystalHandoffMists, {
              opacity: 0,
              yPercent: -65,
              scaleX: 1.18,
              duration: 0.38,
              stagger: 0.025,
              ease: 'power3.in',
            }, 0.55)
            .to(crystalHandoffPrisms, {
              opacity: 0,
              xPercent: 38,
              scaleX: 0.56,
              duration: 0.27,
              stagger: 0.018,
              ease: 'power3.in',
            }, 0.58)
            .to(crystalHandoff, {
              opacity: 0,
              yPercent: -28,
              scale: 1.08,
              duration: 0.22,
              ease: 'power3.in',
            }, 0.66);

          const crystalEntrance = gsap.timeline({ paused: true });
          crystalEntrance
            .call(() => {
              finaleSection?.dispatchEvent(new Event(MELTING_TIME_TITLE_DECODE_EVENT));
            }, undefined, 0)
            .to(crystalChars, {
              opacity: 1,
              y: 0,
              scale: 1,
              filter: 'blur(0px)',
              duration: 1.2,
              stagger: 0.085,
              ease: 'expo.out',
            }, 0)
            .to(crystalSubtitle, {
              opacity: 1,
              y: 0,
              filter: 'blur(0px)',
              duration: 1.16,
              ease: 'expo.out',
            }, 0.3);

          const playCrystalEntrance = () => {
            if (crystalEntrance.progress() < 1) crystalEntrance.play();
          };
          const playCrystalEntranceIfReached = () => {
            if (finaleSection.getBoundingClientRect().top <= window.innerHeight * 0.4) {
              playCrystalEntrance();
            }
          };
          const resetCrystalEntrance = () => {
            crystalEntrance.pause(0);
            gsap.set(crystalChars, {
              opacity: 0,
              y: 40,
              scale: 0.95,
              filter: compactFinaleMotion ? 'none' : 'blur(10px)',
            });
            gsap.set(crystalSubtitle, {
              opacity: 0,
              y: 20,
              filter: compactFinaleMotion ? 'none' : 'blur(10px)',
            });
          };
          ScrollTrigger.create({
            trigger: finaleSection,
            start: 'top 40%',
            end: 'bottom top',
            onEnter: playCrystalEntrance,
            onEnterBack: playCrystalEntrance,
            onLeaveBack: resetCrystalEntrance,
            onUpdate: (self) => {
              if (self.progress > 0) playCrystalEntrance();
            },
            onRefresh: playCrystalEntranceIfReached,
          });
          window.requestAnimationFrame(playCrystalEntranceIfReached);
        }
      }, root);

      ScrollTrigger.refresh();
    };

    const bootstrap = async () => {
      try {
        const [gsapModule, scrollTriggerModule] = await Promise.all([
          import('gsap'),
          import('gsap/ScrollTrigger'),
        ]);

        if (disposed) {
          return;
        }

        scrubEngine.init();

        const [loadedOldTexture, loadedYoungTexture] = await Promise.all([
          loadTexture(ASSETS.oldImage),
          loadTexture(ASSETS.youngImage),
          scrubEngine.loadPoster(ASSETS.fallbackImage),
        ]);

        if (disposed) {
          loadedOldTexture.dispose();
          loadedYoungTexture.dispose();
          return;
        }

        textureOld = loadedOldTexture;
        textureYoung = loadedYoungTexture;
        textureOld.minFilter = THREE.LinearFilter;
        textureYoung.minFilter = THREE.LinearFilter;
        textureOld.generateMipmaps = false;
        textureYoung.generateMipmaps = false;

        initSceneSetup();
        createMaterials();
        await loadModel();

        if (disposed) {
          return;
        }

        setLoadState('ready');
        loaderTimeout = window.setTimeout(() => {
          if (disposed) {
            return;
          }

          createScrollAnimation(gsapModule.gsap, scrollTriggerModule.ScrollTrigger);
          renderLoop();
        }, 900);
      } catch (error) {
        console.error('[MeltingTimeWorkExperience] bootstrap failed', error);

        if (!disposed) {
          setLoadState('error');
        }
      }
    };

    bootstrap();

    return () => {
      disposed = true;
      window.clearTimeout(loaderTimeout);

      if (rafId) {
        cancelAnimationFrame(rafId);
      }

      gsapContext?.revert();
      window.removeEventListener('resize', handlers.resize);
      window.visualViewport?.removeEventListener('resize', handlers.resize);
      window.removeEventListener('mousemove', handlers.mousemove);
      window.removeEventListener('mousedown', handlers.mousedown);
      window.removeEventListener('mouseup', handlers.mouseup);
      window.removeEventListener('touchstart', handlers.touchstart);
      window.removeEventListener('touchmove', handlers.touchmove);
      window.removeEventListener('touchend', handlers.touchend);

      disposeScene(scene);
      disposeScene(heroScene);
      textureOld?.dispose();
      textureYoung?.dispose();
      scrubEngine.dispose();
      renderer?.dispose();
    };
  }, []);

  return (
    <section
      ref={rootRef}
      className="melting-time-experience relative isolate w-full overflow-x-clip bg-[#050505] text-[#F5F5F7]"
      aria-label="鹽埕的冰作品頁"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
          .melting-time-loader {
            background:
              radial-gradient(circle at 50% 38%, rgba(255, 255, 255, 0.1), transparent 32%),
              linear-gradient(180deg, #090909 0%, #030303 100%);
          }

          .melting-time-loader__backdrop {
            position: absolute;
            inset: 0;
            background-image:
              linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
            background-size: 7rem 7rem;
            mask-image: radial-gradient(circle at center, black 25%, transparent 76%);
            opacity: 0.55;
          }

          .melting-time-loader__core {
            --loader-size: clamp(6.4rem, 12vw, 9.6rem);
            --rect-width: calc(var(--loader-size) * 0.22);
            --rect-height: calc(var(--loader-size) * 0.28);
            --top-center-x: calc((var(--loader-size) - var(--rect-width)) / 2);
            --top-center-y: calc(var(--loader-size) * 0.07);
            --bottom-left-x: calc(var(--loader-size) * 0.185);
            --bottom-left-y: calc(var(--loader-size) * 0.515);
            --bottom-right-x: calc(var(--loader-size) - var(--rect-width) - (var(--loader-size) * 0.185));
            --bottom-right-y: calc(var(--loader-size) * 0.515);
            position: relative;
            width: var(--loader-size);
            height: var(--loader-size);
            animation: melting-time-loader-breathe 2000ms ease-in-out infinite;
          }

          .melting-time-loader__core::before {
            content: '';
            position: absolute;
            inset: -62%;
            background: radial-gradient(circle, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0) 68%);
          }

          .melting-time-loader__square {
            position: absolute;
            left: 0;
            top: 0;
            width: var(--rect-width);
            height: var(--rect-height);
            border: clamp(3px, 0.25vw, 4px) solid rgba(255, 255, 255, 0.92);
            background: rgba(255, 255, 255, 0.02);
            box-shadow:
              0 0 14px rgba(255, 255, 255, 0.12),
              0 0 28px rgba(255, 255, 255, 0.05);
            animation:
              melting-time-loader-square-path 4000ms cubic-bezier(1, 0, 0, 1) infinite,
              melting-time-loader-square-blink 1000ms ease-in-out infinite;
          }

          .melting-time-loader__square:nth-of-type(1) {
            border-color: rgba(255, 255, 255, 0.98);
          }

          .melting-time-loader__square:nth-of-type(2) {
            border-color: rgba(255, 255, 255, 0.88);
            box-shadow:
              0 0 12px rgba(255, 255, 255, 0.1),
              0 0 24px rgba(255, 255, 255, 0.045);
            animation-delay: -1333ms, -75ms;
          }

          .melting-time-loader__square:nth-of-type(3) {
            border-color: rgba(255, 255, 255, 0.78);
            box-shadow:
              0 0 10px rgba(255, 255, 255, 0.08),
              0 0 18px rgba(255, 255, 255, 0.035);
            animation-delay: -2666ms, -150ms;
          }

          @keyframes melting-time-loader-square-path {
            0%,
            100% {
              transform: translate3d(var(--top-center-x), var(--top-center-y), 0);
            }

            33.333% {
              transform: translate3d(var(--bottom-right-x), var(--bottom-right-y), 0);
            }

            66.666% {
              transform: translate3d(var(--bottom-left-x), var(--bottom-left-y), 0);
            }
          }

          @keyframes melting-time-loader-square-blink {
            0%,
            100% {
              filter: brightness(1);
              opacity: 0.95;
            }

            50% {
              filter: brightness(0.72);
              opacity: 0.82;
            }
          }

          @keyframes melting-time-loader-breathe {
            0%,
            100% {
              transform: scale(1);
            }

            50% {
              transform: scale(0.7);
            }
          }

          .melting-time-experience ::selection {
            background: #FFD60A;
            color: #050505;
          }

          .melting-time-experience {
            --melting-pointer-x: 50vw;
            --melting-pointer-y: 48vh;
            --melting-pointer-heat: 0.62;
            --melting-sheet-shift-x: 0px;
            --melting-sheet-shift-y: 0px;
            --melting-title-shift-x: 0px;
            --melting-title-shift-y: 0px;
            --melting-title-glass-shift-x: 0px;
            --melting-title-glass-shift-y: 0px;
            --melting-title-ca-shift-x: 0px;
            --melting-title-ca-shift-y: 0px;
            --melting-title-glass-opacity: 0.54;
          }

          .melting-time-hero-title {
            position: relative;
            display: inline-block;
            color: #eff6ff;
            will-change: clip-path, transform, opacity;
          }

          .melting-time-hero-title::before {
            content: '';
            position: absolute;
            inset: -0.24em -0.22em -0.14em;
            z-index: 0;
            border-radius: 48% 52% 44% 56% / 58% 44% 56% 42%;
            background:
              radial-gradient(
                circle at calc(50% + var(--melting-title-shift-x, 0px)) calc(44% + var(--melting-title-shift-y, 0px)),
                rgba(255, 224, 159, 0.28),
                rgba(255, 116, 72, 0.12) 34%,
                transparent 66%
              ),
              radial-gradient(
                ellipse at calc(46% - var(--melting-title-shift-x, 0px)) 58%,
                rgba(108, 223, 255, 0.18),
                transparent 54%
              ),
              linear-gradient(96deg, rgba(255, 255, 255, 0.035), rgba(255, 206, 127, 0.1), rgba(84, 199, 255, 0.045));
            filter: blur(5px) saturate(1.22);
            mix-blend-mode: screen;
            opacity: var(--melting-title-glass-opacity, 0.54);
            transform: translate3d(
              var(--melting-title-glass-shift-x, 0px),
              var(--melting-title-glass-shift-y, 0px),
              0
            );
            will-change: transform, opacity, background;
          }

          .melting-time-title-base,
          .melting-time-title-liquid-layer {
            display: block;
          }

          .melting-time-title-base {
            position: relative;
            z-index: 1;
            color: #eef7ff;
            text-shadow:
              0 0.045em 0 rgba(99, 118, 132, 0.82),
              0 0.09em 0 rgba(26, 38, 48, 0.8),
              0 18px 60px rgba(0, 0, 0, 0.55),
              0 0 34px rgba(255, 214, 138, 0.18);
          }

          .melting-time-title-liquid-layer {
            position: absolute;
            inset: 0;
            z-index: 2;
            color: rgba(255, 237, 192, 0.42);
            filter:
              drop-shadow(0 0 18px rgba(255, 189, 95, 0.28))
              drop-shadow(0 0 28px rgba(94, 212, 255, 0.13));
            mix-blend-mode: screen;
            opacity: 0;
            transform: translateZ(0);
            animation: melting-time-title-liquid-flow 7200ms ease-in-out infinite alternate;
            pointer-events: none;
            will-change: transform, opacity, color;
          }

          .melting-time-title-liquid-layer::before,
          .melting-time-title-liquid-layer::after {
            content: attr(data-title);
            position: absolute;
            inset: 0;
            pointer-events: none;
          }

          .melting-time-title-liquid-layer::before {
            color: rgba(109, 227, 255, 0.34);
            transform: translate3d(calc(-0.018em - var(--melting-title-ca-shift-x, 0px)), calc(0.012em + var(--melting-title-ca-shift-y, 0px)), 0);
            opacity: 0.52;
          }

          .melting-time-title-liquid-layer::after {
            color: rgba(255, 95, 72, 0.3);
            transform: translate3d(calc(0.018em + var(--melting-title-ca-shift-x, 0px)), calc(-0.01em - var(--melting-title-ca-shift-y, 0px)), 0);
            opacity: 0.46;
          }

          @keyframes melting-time-title-liquid-flow {
            0% {
              color: rgba(255, 237, 192, 0.34);
              transform: translate3d(calc(-0.012em + var(--melting-title-shift-x, 0px)), calc(0.006em + var(--melting-title-shift-y, 0px)), 0) skewX(-1.2deg);
              filter:
                drop-shadow(0 0 16px rgba(255, 189, 95, 0.24))
                drop-shadow(0 0 24px rgba(94, 212, 255, 0.1));
            }

            100% {
              color: rgba(162, 232, 255, 0.42);
              transform: translate3d(calc(0.012em + var(--melting-title-shift-x, 0px)), calc(-0.006em + var(--melting-title-shift-y, 0px)), 0) skewX(1.1deg);
              filter:
                drop-shadow(0 0 24px rgba(255, 189, 95, 0.32))
                drop-shadow(0 0 34px rgba(94, 212, 255, 0.16));
            }
          }

          .melting-time-scroll-text {
            background: linear-gradient(180deg, #ffffff 0%, #a0a0a0 100%);
            background-clip: text;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            color: transparent;
            text-shadow: 0 10px 30px rgba(0, 0, 0, 0.8);
          }

          .melting-time-content-section {
            isolation: isolate;
            background: #041622;
          }

          .melting-time-content-backdrop {
            position: fixed;
            inset: 0;
            z-index: 0;
            overflow: hidden;
            background:
              radial-gradient(circle at 50% 34%, rgba(255, 174, 82, 0.16), transparent 34%),
              radial-gradient(circle at 50% 72%, rgba(101, 181, 255, 0.1), transparent 34%),
              linear-gradient(180deg, rgba(2, 8, 14, 0.98) 0%, rgba(5, 23, 36, 0.99) 48%, rgba(2, 10, 16, 1) 100%);
            transform: translateZ(0);
            will-change: opacity;
          }

          .melting-time-content-backdrop::before,
          .melting-time-content-backdrop::after {
            content: '';
            position: absolute;
            inset: 0;
            pointer-events: none;
            transform: translateZ(0);
            will-change: transform, opacity, background;
          }

          .melting-time-content-backdrop::before {
            background:
              radial-gradient(
                circle at var(--melting-pointer-x, 50vw) var(--melting-pointer-y, 48vh),
                rgba(255, 228, 168, 0.28) 0 6%,
                rgba(255, 116, 72, 0.13) 18%,
                rgba(92, 213, 255, 0.09) 34%,
                transparent 56%
              ),
              radial-gradient(ellipse at 50% 52%, rgba(255, 198, 118, 0.1), transparent 42%);
            filter: blur(10px) saturate(1.3);
            mix-blend-mode: screen;
            opacity: var(--melting-pointer-heat, 0.62);
          }

          .melting-time-content-backdrop::after {
            background:
              radial-gradient(
                ellipse at var(--melting-pointer-x, 50vw) var(--melting-pointer-y, 48vh),
                rgba(255, 255, 255, 0.08),
                transparent 24rem
              ),
              repeating-linear-gradient(98deg, rgba(255, 255, 255, 0.018) 0 1px, transparent 1px 36px);
            mix-blend-mode: screen;
            opacity: 0.34;
            transform: translate3d(var(--melting-sheet-shift-x, 0px), var(--melting-sheet-shift-y, 0px), 0);
          }

          .melting-time-transition-field {
            position: fixed;
            inset: 0;
            z-index: 1;
            overflow: hidden;
            pointer-events: none;
            contain: layout paint style;
          }

          .melting-time-transition-veil {
            position: absolute;
            inset: -10vh -8vw;
            background:
              radial-gradient(ellipse at 50% 34%, rgba(255, 154, 78, 0.14), transparent 30%),
              radial-gradient(ellipse at 48% 42%, rgba(126, 206, 255, 0.1), transparent 40%),
              linear-gradient(180deg, rgba(2, 9, 15, 0.08) 0%, rgba(7, 29, 45, 0.9) 48%, rgba(3, 13, 21, 1) 100%);
            transform: translateZ(0);
            will-change: clip-path, opacity;
          }

          .melting-time-memory-grain {
            position: absolute;
            inset: 0;
            background:
              radial-gradient(circle at 18% 24%, rgba(255, 255, 255, 0.06) 0 1px, transparent 2px),
              radial-gradient(circle at 72% 58%, rgba(255, 255, 255, 0.045) 0 1px, transparent 2px),
              radial-gradient(circle at 46% 74%, rgba(255, 214, 155, 0.045) 0 1px, transparent 2px),
              repeating-linear-gradient(96deg, rgba(255, 255, 255, 0.018) 0 1px, transparent 1px 24px);
            mix-blend-mode: screen;
            transform: translateZ(0);
            will-change: opacity;
          }

          .melting-time-melt-field {
            position: absolute;
            inset: -8vh -6vw;
            transform: translateZ(0);
            will-change: transform, opacity;
          }

          .melting-time-melt-field::before {
            content: '';
            position: absolute;
            inset: 0;
            background:
              radial-gradient(ellipse at 50% 36%, rgba(255, 214, 10, 0.2), transparent 28%),
              radial-gradient(ellipse at 50% 47%, rgba(255, 116, 68, 0.12), transparent 38%),
              linear-gradient(100deg, transparent 0 31%, rgba(255, 236, 180, 0.09) 38%, transparent 48% 100%),
              linear-gradient(78deg, transparent 0 40%, rgba(155, 216, 255, 0.08) 45%, transparent 56% 100%);
            mix-blend-mode: screen;
            opacity: 0.78;
          }

          .melting-time-memory-slit {
            position: absolute;
            left: 50%;
            top: 36%;
            width: min(108vw, 88rem);
            height: clamp(8rem, 18vh, 13rem);
            clip-path: polygon(
              0% 47%,
              6% 42%,
              14% 45%,
              24% 38%,
              35% 43%,
              47% 37%,
              59% 44%,
              70% 39%,
              82% 45%,
              93% 41%,
              100% 46%,
              100% 58%,
              92% 62%,
              81% 58%,
              69% 64%,
              57% 59%,
              45% 66%,
              33% 60%,
              21% 65%,
              10% 60%,
              0% 64%
            );
            overflow: hidden;
            transform: translate3d(-50%, -50%, 0);
            transform-origin: 50% 50%;
            background:
              radial-gradient(ellipse at 50% 48%, rgba(255, 215, 128, 0.28), rgba(255, 112, 64, 0.08) 34%, transparent 66%),
              linear-gradient(90deg, transparent, rgba(255, 238, 184, 0.2) 18%, rgba(255, 255, 255, 0.06) 50%, rgba(165, 222, 255, 0.15) 82%, transparent);
            filter: drop-shadow(0 0 24px rgba(255, 178, 80, 0.22));
            will-change: transform, opacity;
          }

          .melting-time-memory-slit::before,
          .melting-time-memory-slit::after {
            content: '';
            position: absolute;
            left: 0;
            right: 0;
            height: 34%;
            pointer-events: none;
            background:
              linear-gradient(90deg, transparent, rgba(255, 237, 180, 0.58), rgba(255, 139, 76, 0.2), rgba(197, 235, 255, 0.34), transparent);
            box-shadow:
              0 0 18px rgba(255, 199, 117, 0.32),
              0 0 70px rgba(255, 112, 64, 0.15);
          }

          .melting-time-memory-slit::before {
            top: 0;
            clip-path: polygon(0 78%, 8% 68%, 16% 76%, 25% 64%, 36% 73%, 48% 61%, 60% 74%, 72% 66%, 84% 75%, 94% 67%, 100% 76%, 100% 100%, 0 100%);
          }

          .melting-time-memory-slit::after {
            bottom: 0;
            clip-path: polygon(0 0, 100% 0, 100% 24%, 91% 33%, 82% 24%, 72% 36%, 61% 25%, 50% 38%, 39% 25%, 29% 35%, 18% 25%, 8% 34%, 0 25%);
          }

          .melting-time-memory-film {
            position: absolute;
            inset: 10% 0;
            background:
              radial-gradient(ellipse at 50% 46%, rgba(255, 226, 168, 0.64) 0 8%, rgba(255, 184, 83, 0.2) 27%, transparent 64%),
              radial-gradient(ellipse at 42% 54%, rgba(210, 235, 255, 0.24), transparent 44%),
              linear-gradient(93deg, transparent 0 32%, rgba(255, 255, 255, 0.08) 43%, transparent 54%),
              linear-gradient(86deg, transparent 0 46%, rgba(255, 121, 76, 0.09) 51%, transparent 62%),
              linear-gradient(180deg, rgba(218, 238, 255, 0.08), rgba(4, 18, 29, 0.02));
            mix-blend-mode: screen;
            transform: translateZ(0);
            will-change: transform, opacity;
          }

          .melting-time-transition-line {
            position: absolute;
            left: 50%;
            top: 38%;
            width: min(82vw, 68rem);
            height: 2px;
            border-radius: 999px;
            background: linear-gradient(90deg, transparent, rgba(255, 226, 168, 0.84), rgba(255, 112, 64, 0.46), rgba(178, 229, 255, 0.6), transparent);
            box-shadow:
              0 0 22px rgba(255, 185, 92, 0.32),
              0 0 72px rgba(255, 112, 64, 0.16);
            transform: translate3d(-50%, -50%, 0);
            transform-origin: 50% 50%;
            will-change: transform, opacity;
          }

          .melting-time-transition-sheen {
            position: absolute;
            inset: -12vh -35vw;
            background: linear-gradient(106deg, transparent 36%, rgba(255, 226, 168, 0.14) 47%, rgba(255, 112, 64, 0.12) 51%, transparent 63%);
            mix-blend-mode: screen;
            transform: translateZ(0);
            will-change: transform, opacity;
          }

          .melting-time-memory-drips {
            position: absolute;
            inset: 0;
          }

          .melting-time-memory-drip {
            position: absolute;
            top: calc(35% + clamp(2.2rem, 6vh, 4.8rem));
            width: 2px;
            height: clamp(3.6rem, 12vh, 8rem);
            border-radius: 999px;
            background: linear-gradient(180deg, rgba(255, 232, 184, 0.74), rgba(255, 132, 76, 0.18) 68%, transparent);
            box-shadow: 0 0 18px rgba(255, 173, 92, 0.24);
            transform: translate3d(0, 0, 0) scaleY(0.04);
            transform-origin: 50% 0%;
            will-change: transform, opacity;
          }

          .melting-time-memory-drip::after {
            content: '';
            position: absolute;
            left: 50%;
            bottom: -4px;
            width: 6px;
            height: 6px;
            border-radius: 999px;
            background: rgba(255, 224, 172, 0.56);
            transform: translateX(-50%);
          }

          .melting-time-memory-drip:nth-child(1) {
            left: 12%;
            height: clamp(4.2rem, 13vh, 8.5rem);
          }

          .melting-time-memory-drip:nth-child(2) {
            left: 20%;
            height: clamp(5rem, 17vh, 11rem);
          }

          .melting-time-memory-drip:nth-child(3) {
            left: 28%;
            height: clamp(4rem, 14vh, 9rem);
          }

          .melting-time-memory-drip:nth-child(4) {
            left: 38%;
            height: clamp(5.5rem, 19vh, 12rem);
          }

          .melting-time-memory-drip:nth-child(5) {
            left: 47%;
            height: clamp(3.8rem, 12vh, 8rem);
          }

          .melting-time-memory-drip:nth-child(6) {
            left: 56%;
            height: clamp(5.2rem, 18vh, 11rem);
          }

          .melting-time-memory-drip:nth-child(7) {
            left: 64%;
            height: clamp(4.5rem, 15vh, 9.5rem);
          }

          .melting-time-memory-drip:nth-child(8) {
            left: 73%;
            height: clamp(6rem, 20vh, 13rem);
          }

          .melting-time-memory-drip:nth-child(9) {
            left: 81%;
            height: clamp(4.4rem, 14vh, 9rem);
          }

          .melting-time-memory-drip:nth-child(10) {
            left: 88%;
            height: clamp(5.2rem, 18vh, 11rem);
          }

          .melting-time-memory-drip:nth-child(11) {
            left: 94%;
            height: clamp(4rem, 15vh, 9rem);
          }

          .melting-time-transition-slices {
            position: absolute;
            inset: 0;
          }

          .melting-time-final-liquid {
            position: fixed;
            inset: 0;
            z-index: 2;
            overflow: hidden;
            pointer-events: none;
            contain: layout paint style;
            transform: translateZ(0);
            will-change: transform, opacity;
          }

          .melting-time-final-liquid::before {
            content: '';
            position: absolute;
            left: var(--melting-pointer-x, 50vw);
            top: var(--melting-pointer-y, 49vh);
            width: min(118vw, 76rem);
            aspect-ratio: 1.75;
            border-radius: 999px;
            background:
              radial-gradient(ellipse at 50% 46%, rgba(255, 223, 154, 0.24), transparent 34%),
              radial-gradient(ellipse at 52% 54%, rgba(255, 103, 67, 0.13), transparent 48%),
              radial-gradient(ellipse at 42% 58%, rgba(105, 212, 255, 0.12), transparent 46%);
            filter: blur(18px);
            opacity: 0.92;
            transform: translate3d(-50%, -50%, 0);
            animation: melting-time-final-liquid-breathe 7800ms ease-in-out infinite alternate;
          }

          .melting-time-final-liquid::after {
            content: '';
            position: absolute;
            left: calc(50% + var(--melting-title-glass-shift-x, 0px));
            top: calc(50% + var(--melting-title-glass-shift-y, 0px));
            width: min(92vw, 58rem);
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(139, 224, 255, 0.38), rgba(255, 224, 164, 0.72), rgba(255, 103, 67, 0.28), transparent);
            box-shadow:
              0 0 30px rgba(255, 190, 108, 0.22),
              0 0 90px rgba(88, 207, 255, 0.12);
            opacity: 0.78;
            transform: translate3d(-50%, -50%, 0) scaleX(0.88);
            animation: melting-time-final-liquid-line 6200ms ease-in-out infinite alternate;
          }

          .melting-time-final-liquid-sheet {
            position: absolute;
            left: calc(50% + var(--melting-sheet-shift-x, 0px));
            top: calc(50% + var(--melting-sheet-shift-y, 0px));
            width: min(88vw, 56rem);
            height: clamp(5rem, 12vh, 8rem);
            border-radius: 999px 46% 999px 58%;
            background:
              linear-gradient(94deg, transparent 0 8%, rgba(109, 225, 255, 0.08) 20%, rgba(255, 238, 190, 0.24) 50%, rgba(255, 107, 69, 0.12) 72%, transparent 100%);
            filter: blur(8px);
            mix-blend-mode: screen;
            opacity: 0.7;
            transform: translate3d(-50%, -50%, 0) rotate(-2deg);
            animation: melting-time-final-sheet-drift 9200ms ease-in-out infinite alternate;
          }

          .melting-time-final-liquid-sheet:nth-child(2) {
            top: calc(43% + var(--melting-title-glass-shift-y, 0px));
            width: min(70vw, 48rem);
            height: clamp(4rem, 8vh, 5.8rem);
            opacity: 0.48;
            transform: translate3d(-50%, -50%, 0) rotate(3deg);
            animation-duration: 8400ms;
            animation-delay: -2400ms;
          }

          .melting-time-final-liquid-sheet:nth-child(3) {
            top: calc(57% + var(--melting-title-glass-shift-y, 0px));
            width: min(76vw, 50rem);
            height: clamp(3.8rem, 9vh, 6.5rem);
            opacity: 0.42;
            transform: translate3d(-50%, -50%, 0) rotate(-4deg);
            animation-duration: 10400ms;
            animation-delay: -3600ms;
          }

          @keyframes melting-time-final-liquid-breathe {
            0% {
              transform: translate3d(-50%, -50%, 0) scale(0.94, 0.9);
            }

            100% {
              transform: translate3d(-50%, -51.5%, 0) scale(1.04, 1.08);
            }
          }

          @keyframes melting-time-final-liquid-line {
            0% {
              transform: translate3d(-50%, -50%, 0) scaleX(0.78) rotate(-0.35deg);
              opacity: 0.52;
            }

            100% {
              transform: translate3d(-50%, -50%, 0) scaleX(1.02) rotate(0.35deg);
              opacity: 0.86;
            }
          }

          @keyframes melting-time-final-sheet-drift {
            0% {
              transform: translate3d(-53%, -52%, 0) rotate(-3deg) scaleX(0.94);
            }

            100% {
              transform: translate3d(-47%, -48%, 0) rotate(2deg) scaleX(1.05);
            }
          }

          .melting-time-transition-slice {
            position: absolute;
            left: -8vw;
            right: -8vw;
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(255, 224, 172, 0.3), rgba(255, 112, 64, 0.14), transparent);
            transform-origin: 50% 50%;
            will-change: transform, opacity;
          }

          .melting-time-transition-slice:nth-child(1) {
            top: 30%;
            transform: rotate(-1.2deg);
          }

          .melting-time-transition-slice:nth-child(2) {
            top: 34%;
            transform: rotate(0.8deg);
          }

          .melting-time-transition-slice:nth-child(3) {
            top: 39%;
            transform: rotate(-0.4deg);
          }

          .melting-time-transition-slice:nth-child(4) {
            top: 43%;
            transform: rotate(1.1deg);
          }

          .melting-time-transition-slice:nth-child(5) {
            top: 48%;
            transform: rotate(-0.7deg);
          }

          .melting-time-content-wrapper {
            position: relative;
            z-index: 3;
            will-change: transform, opacity, filter;
          }

          .melting-time-award-pill {
            position: relative;
            isolation: isolate;
            overflow: hidden;
            will-change: transform, opacity;
          }

          .melting-time-award-pill::before {
            content: '';
            position: absolute;
            inset: -70% -24%;
            z-index: -1;
            background:
              radial-gradient(circle at 22% 50%, rgba(112, 224, 255, 0.18), transparent 24%),
              linear-gradient(104deg, transparent 0 28%, rgba(255, 225, 154, 0.24) 42%, rgba(255, 108, 72, 0.13) 54%, transparent 70% 100%);
            opacity: 0.84;
            transform: translate3d(-32%, 0, 0);
            animation: melting-time-award-liquid-sheen 5400ms ease-in-out infinite;
          }

          @keyframes melting-time-award-liquid-sheen {
            0%,
            18% {
              transform: translate3d(-34%, 0, 0);
            }

            62%,
            100% {
              transform: translate3d(34%, 0, 0);
            }
          }

          @media (max-width: 639px) {
            .melting-time-melt-field {
              inset: -6vh -10vw;
            }

            .melting-time-memory-slit {
              top: 36%;
              width: 112vw;
              height: clamp(5.8rem, 14vh, 8.2rem);
            }

            .melting-time-transition-line {
              top: 39%;
              width: 88vw;
            }

            .melting-time-transition-veil {
              inset: -8vh -14vw;
            }

            .melting-time-memory-drip {
              top: calc(35% + clamp(1.8rem, 5.5vh, 3.6rem));
              width: 1px;
            }

            .melting-time-memory-drip:nth-child(1),
            .melting-time-memory-drip:nth-child(7),
            .melting-time-memory-drip:nth-child(10) {
              display: none;
            }

            .melting-time-final-liquid::before {
              width: 126vw;
              top: 48%;
              filter: blur(14px);
            }

            .melting-time-final-liquid::after {
              width: 86vw;
            }

            .melting-time-final-liquid-sheet {
              width: 98vw;
              filter: blur(7px);
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .melting-time-transition-line,
            .melting-time-transition-sheen,
            .melting-time-transition-slice,
            .melting-time-melt-field,
            .melting-time-memory-grain,
            .melting-time-memory-drip {
              display: none;
            }

            .melting-time-final-liquid::before,
            .melting-time-final-liquid::after,
            .melting-time-final-liquid-sheet,
            .melting-time-title-liquid-layer,
            .melting-time-award-pill::before {
              animation: none;
            }
          }
        `,
        }}
      />

      <div
        className={`melting-time-loader fixed inset-0 z-[120] grid h-screen w-screen place-items-center text-white transition-opacity duration-[820ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
          loadState === 'ready' ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
        aria-live="polite"
        aria-busy={loadState === 'loading'}
      >
        {loadState === 'error' ? (
          <div className="px-6 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-[#ff6b6b]">資源載入失敗</p>
            <p className="mt-3 text-sm font-light leading-relaxed text-[#86868B]">請檢查網路連線或重新整理頁面。</p>
          </div>
        ) : (
          <>
            <div className="melting-time-loader__backdrop" aria-hidden="true" />
          <div className="relative z-[1] grid place-items-center">
            <div className="melting-time-loader__core" role="status" aria-label="Loading work">
              <div className="melting-time-loader__square" />
              <div className="melting-time-loader__square" />
              <div className="melting-time-loader__square" />
            </div>
          </div>
          </>
        )}
      </div>

      <canvas ref={canvasRef} className="fixed inset-0 z-0 block h-screen w-screen bg-[#050505]" />

      <div className="melting-time-scroll-track pointer-events-none relative z-[1] h-[950vh]">
        <div className="sticky top-0 h-screen w-screen overflow-hidden">
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <h1 className="melting-time-scroll-text melting-time-text-1 absolute top-[15%] max-w-[calc(100vw-2rem)] whitespace-nowrap text-center text-[clamp(1.42rem,6.1vw,3.5rem)] font-bold tracking-[-0.015em] opacity-100 sm:text-[clamp(2rem,4.5vw,3.5rem)]">
              自全國 393 部參賽作品中
            </h1>
            <h1 className="melting-time-scroll-text melting-time-text-2 absolute left-1/2 top-0 max-w-[calc(100vw-1rem)] whitespace-nowrap text-center text-[clamp(1.72rem,8.6vw,3.5rem)] font-bold tracking-[-0.015em] opacity-0 sm:max-w-[min(90vw,980px)] sm:text-[clamp(2rem,4.5vw,3.5rem)]">
              真正脫穎而出...
            </h1>
          </div>
        </div>
      </div>

      <MeltingTimeCrystalFinale />
    </section>
  );
};
