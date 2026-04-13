import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useReducedMotion } from 'framer-motion';
import { useGpuTier, adaptCloudinaryUrl } from '@/components/webgl/gpu-tier';
import { IdleTracker, shouldThrottleFrame } from '@/lib/adaptive-render';

export type HonorArtifactRecipe = 'book-award' | 'jogging-president' | 'micro-movie-gold' | 'fulbright-emi';

export interface HonorArtifactConfig {
  recipe: HonorArtifactRecipe;
  frontTextureUrl: string;
  backTextureUrl?: string;
  orientation: 'portrait' | 'landscape';
  accentColor: string;
  lightColor?: string;
  initialFace?: 'front' | 'back';
  emissiveIntensity?: number;
  floatingAmplitude?: number;
  cameraDistance?: number;
  scale?: number;
  baseRotationX?: number;
  baseRotationY?: number;
  staticImageAlt: string;
}

interface ArtifactResources {
  geometry: THREE.BoxGeometry;
  sideMaterial: THREE.MeshStandardMaterial;
  frontMaterial: THREE.MeshStandardMaterial;
  backMaterial: THREE.Material;
  frontTexture: THREE.Texture;
  backTexture?: THREE.Texture;
  mesh: THREE.Mesh;
}

const loadTexture = (loader: THREE.TextureLoader, url: string) =>
  new Promise<THREE.Texture>((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });

const disposeArtifactResources = (resources: ArtifactResources | null, group: THREE.Group | null) => {
  if (!resources) return;

  if (group) {
    group.remove(resources.mesh);
  }

  resources.geometry.dispose();
  resources.frontTexture.dispose();
  resources.backTexture?.dispose();

  const materials = new Set<THREE.Material>([
    resources.sideMaterial,
    resources.frontMaterial,
    resources.backMaterial,
  ]);

  materials.forEach((material) => material.dispose());
};

const getInitialRotation = (artifact: HonorArtifactConfig) => ({
  x: artifact.baseRotationX ?? 0.05,
  y: artifact.baseRotationY ?? (artifact.initialFace === 'back' ? Math.PI : 0),
});

const prepareTexture = (texture: THREE.Texture, renderer: THREE.WebGLRenderer) => {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
};

const createBaseFrontMaterial = (texture: THREE.Texture, emissiveIntensity: number) =>
  new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.85,
    metalness: 0.1,
    emissive: 0xffffff,
    emissiveMap: texture,
    emissiveIntensity,
  });

const createJoggingFrontMaterial = (texture: THREE.Texture, emissiveIntensity: number) => {
  const material = createBaseFrontMaterial(texture, emissiveIntensity);

  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `
      float roughnessFactor = roughness;
      #ifdef USE_MAP
        vec4 texColor = texture2D( map, vMapUv );
        float lumFront = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
        float isBlueFront = smoothstep(0.05, 0.2, texColor.b - texColor.r);
        float isDarkFront = step(lumFront, 0.7) * (1.0 - isBlueFront);
        float isNameArea = step(0.55, vMapUv.y) * step(vMapUv.y, 0.65) * step(0.15, vMapUv.x) * step(vMapUv.x, 0.45);
        float isNameInk = isDarkFront * isNameArea;
        float isBorderOrLogoArea = step(vMapUv.x, 0.13) + step(0.87, vMapUv.x) + step(0.81, vMapUv.y) + step(vMapUv.y, 0.14);
        isBorderOrLogoArea = min(isBorderOrLogoArea, 1.0);
        float isGoldFoil = isDarkFront * isBorderOrLogoArea;
        float isOtherDark = isDarkFront * (1.0 - isNameArea) * (1.0 - isBorderOrLogoArea);
        float isPaperFront = 1.0 - clamp(isBlueFront + isDarkFront, 0.0, 1.0);
        vec3 paleChampagneGold = vec3(0.85, 0.80, 0.58);
        diffuseColor.rgb = diffuseColor.rgb * (1.0 - isGoldFoil) + paleChampagneGold * isGoldFoil;
        roughnessFactor = 0.98 * isPaperFront + 0.15 * isGoldFoil + 0.25 * isNameInk + 0.35 * isBlueFront + 0.4 * isOtherDark;
      #endif
      `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <metalnessmap_fragment>',
      `
      float metalnessFactor = metalness;
      #ifdef USE_MAP
        vec4 texColorM = texture2D( map, vMapUv );
        float lumFrontM = dot(texColorM.rgb, vec3(0.299, 0.587, 0.114));
        float isBlueFrontM = smoothstep(0.05, 0.2, texColorM.b - texColorM.r);
        float isDarkFrontM = step(lumFrontM, 0.7) * (1.0 - isBlueFrontM);
        float isNameAreaM = step(0.55, vMapUv.y) * step(vMapUv.y, 0.65) * step(0.15, vMapUv.x) * step(vMapUv.x, 0.45);
        float isNameInkM = isDarkFrontM * isNameAreaM;
        float isBorderOrLogoAreaM = step(vMapUv.x, 0.13) + step(0.87, vMapUv.x) + step(0.81, vMapUv.y) + step(vMapUv.y, 0.14);
        isBorderOrLogoAreaM = min(isBorderOrLogoAreaM, 1.0);
        float isGoldFoilM = isDarkFrontM * isBorderOrLogoAreaM;
        float isOtherDarkM = isDarkFrontM * (1.0 - isNameAreaM) * (1.0 - isBorderOrLogoAreaM);
        float isPaperFrontM = 1.0 - clamp(isBlueFrontM + isDarkFrontM, 0.0, 1.0);
        metalnessFactor = 0.0 * isPaperFrontM + 0.95 * isGoldFoilM + 0.85 * isNameInkM + 0.5 * isBlueFrontM + 0.6 * isOtherDarkM;
      #endif
      `,
    );
  };

  material.customProgramCacheKey = () => 'jogging-president-front-v1';
  return material;
};

const createBookAwardFrontMaterial = (texture: THREE.Texture, emissiveIntensity: number) => {
  const material = createBaseFrontMaterial(texture, emissiveIntensity);

  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `
      float roughnessFactor = roughness;
      #ifdef USE_MAP
        vec3 origColor = diffuseColor.rgb;
        float lumFront = dot(origColor, vec3(0.299, 0.587, 0.114));
        float isBlueFront = smoothstep(0.05, 0.25, origColor.b - origColor.r);
        float isRedFront = smoothstep(0.15, 0.25, origColor.r - origColor.g) * smoothstep(0.15, 0.25, origColor.r - origColor.b);
        float isGoldFront = smoothstep(0.05, 0.25, origColor.r - origColor.b) * smoothstep(0.05, 0.2, origColor.g - origColor.b) * (1.0 - isRedFront);
        float isDarkFront = step(lumFront, 0.6) * (1.0 - isBlueFront) * (1.0 - isRedFront) * (1.0 - isGoldFront);
        float isPaperFront = 1.0 - clamp(isBlueFront + isRedFront + isGoldFront + isDarkFront, 0.0, 1.0);
        roughnessFactor = 0.98 * isPaperFront + 0.3 * isGoldFront + 0.3 * isRedFront + 0.35 * isBlueFront + 0.4 * isDarkFront;
      #endif
      `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <metalnessmap_fragment>',
      `
      float metalnessFactor = metalness;
      #ifdef USE_MAP
        vec3 origColorM = diffuseColor.rgb;
        float lumFrontM = dot(origColorM, vec3(0.299, 0.587, 0.114));
        float isBlueFrontM = smoothstep(0.05, 0.25, origColorM.b - origColorM.r);
        float isRedFrontM = smoothstep(0.15, 0.25, origColorM.r - origColorM.g) * smoothstep(0.15, 0.25, origColorM.r - origColorM.b);
        float isGoldFrontM = smoothstep(0.05, 0.25, origColorM.r - origColorM.b) * smoothstep(0.05, 0.2, origColorM.g - origColorM.b) * (1.0 - isRedFrontM);
        float isDarkFrontM = step(lumFrontM, 0.6) * (1.0 - isBlueFrontM) * (1.0 - isRedFrontM) * (1.0 - isGoldFrontM);
        float isPaperFrontM = 1.0 - clamp(isBlueFrontM + isRedFrontM + isGoldFrontM + isDarkFrontM, 0.0, 1.0);
        metalnessFactor = 0.0 * isPaperFrontM + 0.8 * isGoldFrontM + 0.65 * isRedFrontM + 0.5 * isBlueFrontM + 0.3 * isDarkFrontM;
        float isCenterLogo = isGoldFrontM * step(0.3, vMapUv.x) * step(vMapUv.x, 0.7) * step(0.2, vMapUv.y) * step(vMapUv.y, 0.8);
        float isBorderGold = isGoldFrontM * (1.0 - isCenterLogo);
        vec3 lighterGoldBorder = origColorM + vec3(0.15, 0.15, 0.10);
        vec3 fadedCenterGold = origColorM + vec3(0.45, 0.45, 0.40);
        diffuseColor.rgb = mix(diffuseColor.rgb, lighterGoldBorder, isBorderGold);
        diffuseColor.rgb = mix(diffuseColor.rgb, fadedCenterGold, isCenterLogo);
      #endif
      `,
    );
  };

  material.customProgramCacheKey = () => 'book-award-front-v1';
  return material;
};

const createMicroMovieFrontMaterial = (texture: THREE.Texture, emissiveIntensity: number) => {
  const material = createBaseFrontMaterial(texture, emissiveIntensity);

  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `
      float roughnessFactor = roughness;
      #ifdef USE_MAP
        float isRedFront = smoothstep(0.15, 0.25, diffuseColor.r - diffuseColor.g) * smoothstep(0.15, 0.25, diffuseColor.r - diffuseColor.b);
        float isGoldFront = smoothstep(0.1, 0.25, diffuseColor.r - diffuseColor.b) * smoothstep(0.05, 0.2, diffuseColor.g - diffuseColor.b) * (1.0 - isRedFront);
        float lumFront = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        float isDarkFront = smoothstep(0.6, 0.3, lumFront) * (1.0 - isRedFront) * (1.0 - isGoldFront);
        float isPaperFront = 1.0 - clamp(isRedFront + isGoldFront + isDarkFront, 0.0, 1.0);
        roughnessFactor = 0.98 * isPaperFront + 0.3 * isRedFront + 0.35 * isGoldFront + 0.4 * isDarkFront;
      #endif
      `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <metalnessmap_fragment>',
      `
      float metalnessFactor = metalness;
      #ifdef USE_MAP
        float isRedFrontM = smoothstep(0.15, 0.25, diffuseColor.r - diffuseColor.g) * smoothstep(0.15, 0.25, diffuseColor.r - diffuseColor.b);
        float isGoldFrontM = smoothstep(0.1, 0.25, diffuseColor.r - diffuseColor.b) * smoothstep(0.05, 0.2, diffuseColor.g - diffuseColor.b) * (1.0 - isRedFrontM);
        float lumFrontM = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        float isDarkFrontM = smoothstep(0.6, 0.3, lumFrontM) * (1.0 - isRedFrontM) * (1.0 - isGoldFrontM);
        float isPaperFrontM = 1.0 - clamp(isRedFrontM + isGoldFrontM + isDarkFrontM, 0.0, 1.0);
        metalnessFactor = 0.0 * isPaperFrontM + 0.65 * isRedFrontM + 0.7 * isGoldFrontM + 0.5 * isDarkFrontM;
      #endif
      `,
    );
  };

  material.customProgramCacheKey = () => 'micro-movie-front-v1';
  return material;
};

const createFulbrightFrontMaterial = (texture: THREE.Texture, emissiveIntensity: number) => {
  const material = createBaseFrontMaterial(texture, emissiveIntensity);

  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `
      float roughnessFactor = roughness;
      #ifdef USE_MAP
        float isRedFront = smoothstep(0.1, 0.2, diffuseColor.r - diffuseColor.g) * smoothstep(0.1, 0.2, diffuseColor.r - diffuseColor.b);
        float isBlueFront = smoothstep(0.1, 0.2, diffuseColor.b - diffuseColor.r) * smoothstep(0.05, 0.15, diffuseColor.b - diffuseColor.g);
        float isGoldFront = smoothstep(0.1, 0.2, diffuseColor.r - diffuseColor.b) * smoothstep(0.1, 0.2, diffuseColor.g - diffuseColor.b) * (1.0 - isRedFront);
        float lumFront = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        float isDarkFront = smoothstep(0.5, 0.2, lumFront) * (1.0 - isRedFront) * (1.0 - isBlueFront) * (1.0 - isGoldFront);
        float isNameArea = step(0.44, vMapUv.y) * step(vMapUv.y, 0.55) * step(0.2, vMapUv.x) * step(vMapUv.x, 0.8);
        float isNameInk = isDarkFront * isNameArea;
        float isOtherDark = isDarkFront * (1.0 - isNameArea);
        float isPaperFront = 1.0 - clamp(isRedFront + isBlueFront + isGoldFront + isDarkFront, 0.0, 1.0);
        roughnessFactor = 0.98 * isPaperFront + 0.3 * isRedFront + 0.35 * isBlueFront + 0.25 * isGoldFront + 0.15 * isNameInk + 0.4 * isOtherDark;
      #endif
      `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <metalnessmap_fragment>',
      `
      float metalnessFactor = metalness;
      #ifdef USE_MAP
        float isRedFrontM = smoothstep(0.1, 0.2, diffuseColor.r - diffuseColor.g) * smoothstep(0.1, 0.2, diffuseColor.r - diffuseColor.b);
        float isBlueFrontM = smoothstep(0.1, 0.2, diffuseColor.b - diffuseColor.r) * smoothstep(0.05, 0.15, diffuseColor.b - diffuseColor.g);
        float isGoldFrontM = smoothstep(0.1, 0.2, diffuseColor.r - diffuseColor.b) * smoothstep(0.1, 0.2, diffuseColor.g - diffuseColor.b) * (1.0 - isRedFrontM);
        float lumFrontM = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        float isDarkFrontM = smoothstep(0.5, 0.2, lumFrontM) * (1.0 - isRedFrontM) * (1.0 - isBlueFrontM) * (1.0 - isGoldFrontM);
        float isNameAreaM = step(0.44, vMapUv.y) * step(vMapUv.y, 0.55) * step(0.2, vMapUv.x) * step(vMapUv.x, 0.8);
        float isNameInkM = isDarkFrontM * isNameAreaM;
        float isOtherDarkM = isDarkFrontM * (1.0 - isNameAreaM);
        float isPaperFrontM = 1.0 - clamp(isRedFrontM + isBlueFrontM + isGoldFrontM + isDarkFrontM, 0.0, 1.0);
        metalnessFactor = 0.0 * isPaperFrontM + 0.6 * isRedFrontM + 0.4 * isBlueFrontM + 0.7 * isGoldFrontM + 0.85 * isNameInkM + 0.3 * isOtherDarkM;
      #endif
      `,
    );
  };

  material.customProgramCacheKey = () => 'fulbright-front-v1';
  return material;
};

const createTexturedFoilBackMaterial = (texture: THREE.Texture) => {
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.5,
    metalness: 0.5,
    emissive: 0xffffff,
    emissiveMap: texture,
    emissiveIntensity: 0.12,
  });

  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `
      float lumBack = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
      float isDark = step(lumBack, 0.7);
      float isPaper = 1.0 - isDark;
      float roughnessFactor = roughness;
      roughnessFactor = 0.45 * isPaper + 0.25 * isDark;
      `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <metalnessmap_fragment>',
      `
      float metalnessFactor = metalness;
      float lumBackM = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
      float isDarkM = step(lumBackM, 0.7);
      float isPaperM = 1.0 - isDarkM;
      metalnessFactor = 0.1 * isPaperM + 0.85 * isDarkM;
      `,
    );
  };

  material.customProgramCacheKey = () => 'textured-foil-back-v1';
  return material;
};

const createMicroMovieBackMaterial = (texture: THREE.Texture) => {
  texture.repeat.set(4, 4);
  texture.offset.set(-1.5, -1.5);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.5,
    metalness: 0.5,
    emissive: 0xffffff,
    emissiveMap: texture,
    emissiveIntensity: 0.12,
  });

  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `
      float isRed = step(diffuseColor.g + 0.15, diffuseColor.r) * step(diffuseColor.b + 0.15, diffuseColor.r);
      float lumBack = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
      float isBlack = (1.0 - isRed) * step(lumBack, 0.6);
      float isPaper = (1.0 - isRed) * step(0.6, lumBack);

      vec3 redFoil = vec3(0.88, 0.12, 0.18);
      vec3 blackFoil = vec3(0.20, 0.20, 0.20);
      vec3 pearlYellow = vec3(1.0, 0.965, 0.875);
      vec3 paperColor = diffuseColor.rgb * pearlYellow;

      diffuseColor.rgb = paperColor * isPaper + redFoil * isRed + blackFoil * isBlack;

      float roughnessFactor = roughness;
      roughnessFactor = 0.35 * isPaper + 0.25 * isRed + 0.25 * isBlack;
      `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <metalnessmap_fragment>',
      `
      float metalnessFactor = metalness;
      float isRedM = step(diffuseColor.g + 0.15, diffuseColor.r) * step(diffuseColor.b + 0.15, diffuseColor.r);
      float lumBackM = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
      float isBlackM = (1.0 - isRedM) * step(lumBackM, 0.6);
      float isPaperM = (1.0 - isRedM) * step(0.6, lumBackM);
      metalnessFactor = 0.12 * isPaperM + 0.75 * isRedM + 0.8 * isBlackM;
      `,
    );
  };

  material.customProgramCacheKey = () => 'micro-movie-back-v1';
  return material;
};

const createFulbrightBackMaterial = () =>
  new THREE.MeshPhysicalMaterial({
    color: 0xfdfdfd,
    roughness: 0.8,
    metalness: 0.0,
  });

const createArtifactResources = (
  artifact: HonorArtifactConfig,
  renderer: THREE.WebGLRenderer,
  frontTexture: THREE.Texture,
  backTexture?: THREE.Texture,
): ArtifactResources => {
  prepareTexture(frontTexture, renderer);

  if (backTexture) {
    prepareTexture(backTexture, renderer);
  }

  const geometry =
    artifact.orientation === 'portrait'
      ? new THREE.BoxGeometry(1.96, 2.8, 0.025)
      : new THREE.BoxGeometry(2.8, 1.96, 0.025);

  const sideMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const emissiveIntensity = artifact.emissiveIntensity ?? 0.12;

  let frontMaterial: THREE.MeshStandardMaterial;
  let backMaterial: THREE.Material;

  switch (artifact.recipe) {
    case 'jogging-president':
      frontMaterial = createJoggingFrontMaterial(frontTexture, emissiveIntensity);
      backMaterial = backTexture ? createTexturedFoilBackMaterial(backTexture) : createFulbrightBackMaterial();
      break;
    case 'micro-movie-gold':
      frontMaterial = createMicroMovieFrontMaterial(frontTexture, emissiveIntensity);
      backMaterial = backTexture ? createMicroMovieBackMaterial(backTexture) : createFulbrightBackMaterial();
      break;
    case 'fulbright-emi':
      frontMaterial = createFulbrightFrontMaterial(frontTexture, emissiveIntensity);
      backMaterial = createFulbrightBackMaterial();
      break;
    case 'book-award':
    default:
      frontMaterial = createBookAwardFrontMaterial(frontTexture, emissiveIntensity);
      backMaterial = backTexture ? createTexturedFoilBackMaterial(backTexture) : createFulbrightBackMaterial();
      break;
  }

  const mesh = new THREE.Mesh(geometry, [
    sideMaterial,
    sideMaterial,
    sideMaterial,
    sideMaterial,
    frontMaterial,
    backMaterial,
  ]);

  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return {
    geometry,
    sideMaterial,
    frontMaterial,
    backMaterial,
    frontTexture,
    backTexture,
    mesh,
  };
};

export const HonorArtifactPreview: React.FC<{ artifact: HonorArtifactConfig }> = ({ artifact }) => {
  const prefersReduced = useReducedMotion();
  const gpu = useGpuTier();
  const canRenderWebgl = !prefersReduced && gpu.tier !== 'fallback';
  const mountRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const macroGroupRef = useRef<THREE.Group | null>(null);
  const microGroupRef = useRef<THREE.Group | null>(null);
  const foilLightRef = useRef<THREE.PointLight | null>(null);
  const resourcesRef = useRef<ArtifactResources | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const clockRef = useRef(new THREE.Clock());
  const artifactRef = useRef(artifact);
  const targetRotationRef = useRef(getInitialRotation(artifact));
  const currentRotationRef = useRef(getInitialRotation(artifact));
  const dragStateRef = useRef({ dragging: false, x: 0, y: 0 });
  const mouseOffsetRef = useRef({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    if (!canRenderWebgl) return;

    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#050505');
    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });

    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, gpu.maxDpr));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = gpu.tier === 'full';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 0.7);
    mainLight.position.set(3, 2, 4);
    mainLight.castShadow = gpu.tier === 'full';
    mainLight.shadow.mapSize.width = gpu.shadowMapSize;
    mainLight.shadow.mapSize.height = gpu.shadowMapSize;
    mainLight.shadow.camera.left = -4;
    mainLight.shadow.camera.right = 4;
    mainLight.shadow.camera.top = 4;
    mainLight.shadow.camera.bottom = -4;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 15;
    mainLight.shadow.bias = -0.0005;
    mainLight.shadow.radius = 32;
    scene.add(mainLight);

    const foilHighlight1 = new THREE.DirectionalLight(0xfff0dd, 0.4);
    foilHighlight1.position.set(2.5, 3.0, 4.0);
    scene.add(foilHighlight1);

    const foilHighlight2 = new THREE.DirectionalLight(0xeef5ff, 0.2);
    foilHighlight2.position.set(-2.0, -2.0, 3.5);
    scene.add(foilHighlight2);

    const foilLight = new THREE.PointLight(0xfff8ee, 1.2, 20);
    foilLight.position.set(0, 0, 3.5);
    scene.add(foilLight);
    foilLightRef.current = foilLight;

    const macroGroup = new THREE.Group();
    const microGroup = new THREE.Group();
    macroGroup.add(microGroup);
    scene.add(macroGroup);
    macroGroupRef.current = macroGroup;
    microGroupRef.current = microGroup;

    const initialRotation = getInitialRotation(artifactRef.current);
    macroGroup.rotation.set(initialRotation.x, initialRotation.y, 0);

    const planeGeo = new THREE.PlaneGeometry(20, 20);
    const planeMat = new THREE.ShadowMaterial({ opacity: 0.5 });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -2;
    plane.receiveShadow = true;
    scene.add(plane);

    const idleTracker = new IdleTracker();
    let frameCount = 0;
    let isVisible = true;
    const io = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    });
    io.observe(mount);

    const syncCamera = () => {
      const currentArtifact = artifactRef.current;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.position.z = currentArtifact.cameraDistance ?? (currentArtifact.orientation === 'portrait' ? 5.2 : 4.5);
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };

    const onPointerDown = (event: PointerEvent) => {
      dragStateRef.current.dragging = true;
      dragStateRef.current.x = event.clientX;
      dragStateRef.current.y = event.clientY;
      idleTracker.ping();
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = mount.getBoundingClientRect();
      mouseOffsetRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseOffsetRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      idleTracker.ping();

      if (!dragStateRef.current.dragging) return;

      const deltaX = event.clientX - dragStateRef.current.x;
      const deltaY = event.clientY - dragStateRef.current.y;

      targetRotationRef.current.y += deltaX * 0.01;
      targetRotationRef.current.x += deltaY * 0.01;
      targetRotationRef.current.x = Math.max(-0.5, Math.min(0.5, targetRotationRef.current.x));

      dragStateRef.current.x = event.clientX;
      dragStateRef.current.y = event.clientY;
    };

    const onPointerUp = () => {
      dragStateRef.current.dragging = false;
    };

    syncCamera();

    window.addEventListener('resize', syncCamera, { passive: true });
    mount.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      if (!isVisible || shouldThrottleFrame(frameCount++, idleTracker.idle)) return;

      const macroGroup = macroGroupRef.current;
      const microGroup = microGroupRef.current;
      const foilLight = foilLightRef.current;
      const currentRenderer = rendererRef.current;
      const currentCamera = cameraRef.current;
      const currentScene = sceneRef.current;

      if (!macroGroup || !microGroup || !foilLight || !currentRenderer || !currentCamera || !currentScene) return;

      const t = clockRef.current.getElapsedTime();
      const floatingAmplitude = artifactRef.current.floatingAmplitude ?? 0.05;

      currentRotationRef.current.x += (targetRotationRef.current.x - currentRotationRef.current.x) * 0.1;
      currentRotationRef.current.y += (targetRotationRef.current.y - currentRotationRef.current.y) * 0.1;
      macroGroup.rotation.x = currentRotationRef.current.x;
      macroGroup.rotation.y = currentRotationRef.current.y;

      const targetMicroX = mouseOffsetRef.current.y * 0.15;
      const targetMicroY = mouseOffsetRef.current.x * 0.15;
      microGroup.rotation.x += (targetMicroX - microGroup.rotation.x) * 0.1;
      microGroup.rotation.y += (targetMicroY - microGroup.rotation.y) * 0.1;
      microGroup.position.y = Math.sin(t * 1.5) * floatingAmplitude;

      const baseLightX = Math.sin(t * 1.5) * 1.5;
      const baseLightY = Math.cos(t * 1.0) * 1.0;
      foilLight.position.x += (baseLightX + mouseOffsetRef.current.x * 3.0 - foilLight.position.x) * 0.08;
      foilLight.position.y += (baseLightY + mouseOffsetRef.current.y * 3.0 - foilLight.position.y) * 0.08;

      currentRenderer.render(currentScene, currentCamera);
    };

    animate();

    return () => {
      window.removeEventListener('resize', syncCamera);
      mount.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      io.disconnect();

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      disposeArtifactResources(resourcesRef.current, microGroupRef.current);
      resourcesRef.current = null;

      planeGeo.dispose();
      planeMat.dispose();
      renderer.dispose();

      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }

      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      macroGroupRef.current = null;
      microGroupRef.current = null;
      foilLightRef.current = null;
    };
  }, [canRenderWebgl, gpu.tier]);

  useEffect(() => {
    artifactRef.current = artifact;

    if (!canRenderWebgl) {
      return;
    }

    const renderer = rendererRef.current;
    const macroGroup = macroGroupRef.current;
    const group = microGroupRef.current;
    const camera = cameraRef.current;

    if (!renderer || !macroGroup || !group || !camera) return;

    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    const swapArtifact = async () => {
      setRenderError(false);
      setIsLoading(true);

      let loadedFront: THREE.Texture | undefined;
      let loadedBack: THREE.Texture | undefined;
      try {
        const results = await Promise.all([
          loadTexture(loader, adaptCloudinaryUrl(artifact.frontTextureUrl, gpu.tier)),
          artifact.backTextureUrl ? loadTexture(loader, adaptCloudinaryUrl(artifact.backTextureUrl, gpu.tier)) : Promise.resolve(undefined),
        ]);
        loadedFront = results[0];
        loadedBack = results[1];

        if (cancelled) {
          loadedFront.dispose();
          loadedBack?.dispose();
          return;
        }

        const nextResources = createArtifactResources(artifact, renderer, loadedFront, loadedBack);

        disposeArtifactResources(resourcesRef.current, group);
        resourcesRef.current = nextResources;
        nextResources.mesh.scale.setScalar(artifact.scale ?? 1);
        group.add(nextResources.mesh);

        const initialRotation = getInitialRotation(artifact);
        macroGroup.rotation.set(initialRotation.x, initialRotation.y, 0);
        group.rotation.set(0, 0, 0);
        group.position.set(0, 0, 0);
        targetRotationRef.current = { ...initialRotation };
        currentRotationRef.current = { ...initialRotation };
        mouseOffsetRef.current = { x: 0, y: 0 };

        camera.position.z = artifact.cameraDistance ?? (artifact.orientation === 'portrait' ? 5.2 : 4.5);
        camera.updateProjectionMatrix();

        if (glowRef.current) {
          glowRef.current.style.backgroundColor = artifact.accentColor;
        }

        setRenderError(false);
        setIsLoading(false);
      } catch (error) {
        loadedFront?.dispose();
        loadedBack?.dispose();
        if (!cancelled) {
          console.error('Failed to load honor artifact.', error);
          setRenderError(true);
          setIsLoading(false);
        }
      }
    };

    void swapArtifact();

    return () => {
      cancelled = true;
    };
  }, [artifact, canRenderWebgl, gpu.tier]);

  // ── Reduced-motion / GPU fallback: skip WebGL entirely ─────────────
  if (!canRenderWebgl) {
    return (
      <div className="relative h-full w-full overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-[#070707] shadow-[0_32px_120px_rgba(0,0,0,0.38)] md:rounded-[2rem]">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#0b0c0f_0%,#060606_100%)]" />
        <div className="absolute inset-0 flex items-center justify-center p-6 md:p-10">
          <img
            src={artifact.frontTextureUrl}
            alt={artifact.staticImageAlt}
            className="h-full w-full object-contain"
            loading="eager"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-[#070707] shadow-[0_32px_120px_rgba(0,0,0,0.38)] md:rounded-[2rem]">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#0b0c0f_0%,#060606_100%)]" />
      <div ref={glowRef} className="pointer-events-none absolute left-1/2 top-[42%] h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.12] blur-[110px]" style={{ backgroundColor: artifact.accentColor }} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,rgba(255,255,255,0.08),transparent_36%)] opacity-60" />

      {(isLoading || renderError) && (
        <div className={`absolute inset-0 flex items-center justify-center p-6 md:p-10 ${renderError ? 'z-20' : 'z-10'}`}>
          <img
            src={artifact.frontTextureUrl}
            alt={artifact.staticImageAlt}
            className={`h-full w-full object-contain transition-opacity duration-500 ${isLoading && !renderError ? 'opacity-72 saturate-[0.9]' : 'opacity-100'}`}
            loading="eager"
          />

          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#070707]/38 text-[11px] uppercase tracking-[0.28em] text-white/65 backdrop-blur-[2px]">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-white/80" />
              <span>Loading Artifact</span>
            </div>
          )}
        </div>
      )}

      {!renderError && <div ref={mountRef} className={`relative z-0 h-full w-full cursor-grab active:cursor-grabbing transition-opacity duration-500 ${isLoading ? 'opacity-0' : 'opacity-100'}`} />}

      {!isLoading && !renderError && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex justify-center sm:inset-x-4 sm:bottom-4 md:inset-x-5 md:bottom-5">
          <div className="inline-flex max-w-full flex-col items-center gap-0.5 rounded-full border border-white/[0.08] bg-black/44 px-3 py-2 text-center shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur-md min-[420px]:flex-row min-[420px]:gap-2 min-[420px]:px-4 md:px-5">
            <span className="text-[11px] font-medium tracking-[0.08em] text-white/84 md:text-[11.5px]">拖曳以欣賞</span>
            <span className="hidden text-white/28 min-[420px]:inline">/</span>
            <span className="text-[9px] uppercase tracking-[0.24em] text-white/58 md:text-[9.5px]">Drag to explore</span>
          </div>
        </div>
      )}
    </div>
  );
};