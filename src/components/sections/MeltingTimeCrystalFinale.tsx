import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useGpuTier } from '@/components/webgl/gpu-tier';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { shouldThrottleFrame } from '@/lib/adaptive-render';

const FALLBACK_IMAGE = '/images/melting-time-crystal-reference-fallback.png';
const TITLE_CHARS = ['鹽', '埕', '的', '冰'];
const TITLE_SCRAMBLE_CHARS = Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789[]{}<>/+*-=!?');
const TITLE_SCRAMBLE_FRAME_MS = 30;
const TITLE_DECODE_DURATION_MS = 1_280;
const TITLE_POINTER_DECAY_MS = 780;
const TITLE_SETTLE_POINTS = [0.58, 0.72, 0.86, 0.98];

export const MELTING_TIME_TITLE_DECODE_EVENT = 'melting-time:title-decode';

const getScrambledTitleChar = (characterIndex: number, frame: number, run: number) => {
  const glyphIndex = (frame * 7 + characterIndex * 11 + run * 13) % TITLE_SCRAMBLE_CHARS.length;
  return TITLE_SCRAMBLE_CHARS[glyphIndex];
};

const seededRandom = (seed: number) => {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const sculptCrystal = (geometry: THREE.BufferGeometry) => {
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
  const vertex = new THREE.Vector3();
  const direction = new THREE.Vector3();

  for (let index = 0; index < positions.count; index += 1) {
    vertex.fromBufferAttribute(positions, index);
    direction.copy(vertex).normalize();
    const displacement =
      Math.sin(vertex.x * 2.5) *
      Math.cos(vertex.y * 2.5) *
      Math.sin(vertex.z * 2.5) *
      0.4;
    vertex.addScaledVector(direction, displacement);
    positions.setXYZ(index, vertex.x, vertex.y, vertex.z);
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
};

const applyCrystalPalette = (geometry: THREE.BufferGeometry) => {
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(positions.count * 3);
  const topColor = new THREE.Color(0xdce2ee);
  const middleColor = new THREE.Color(0x8795b1);
  const lowerColor = new THREE.Color(0x3d8fec);
  const color = new THREE.Color();

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const lowerWeight = 1 - THREE.MathUtils.smoothstep(y, -0.9, 0.72);
    const leftBias = THREE.MathUtils.clamp((0.85 - x) / 3.7, 0, 1);
    const blueWeight = THREE.MathUtils.clamp(lowerWeight * (0.28 + leftBias * 0.72), 0, 1);
    const middleWeight = THREE.MathUtils.clamp((0.9 - y) / 2.8, 0, 1) * (1 - blueWeight);
    const facetVariation = 0.94 + Math.sin(x * 3.7 + y * 2.3 + z * 4.1) * 0.06;

    color.copy(topColor).lerp(middleColor, middleWeight).lerp(lowerColor, blueWeight);
    color.multiplyScalar(facetVariation);
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
};

export const MeltingTimeCrystalFinale: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const cursorDotRef = useRef<HTMLDivElement>(null);
  const cursorRingRef = useRef<HTMLDivElement>(null);
  const titleDecodeFrameRef = useRef(0);
  const titlePointerFrameRef = useRef(0);
  const titleDecodeRunRef = useRef(0);
  const titleDecodeRunningRef = useRef(false);
  const titlePointerRef = useRef({ x: 0, y: 0, lastMove: -Infinity, frame: -1 });
  const pointerTargetRef = useRef(new THREE.Vector2());
  const cursorTargetRef = useRef(new THREE.Vector2());
  const pointerInsideRef = useRef(false);
  const pointerPressedRef = useRef(false);
  const gpu = useGpuTier();
  const coarsePointer = useMediaQuery('(pointer: coarse)');
  const reducedMotion = Boolean(useReducedMotion());
  const [displayedTitleChars, setDisplayedTitleChars] = useState(TITLE_CHARS);
  const [shouldInitialize, setShouldInitialize] = useState(false);
  const [renderMode, setRenderMode] = useState<'pending' | 'webgl' | 'fallback'>('pending');

  const restoreTitle = useCallback(() => {
    setDisplayedTitleChars(TITLE_CHARS);
    titleRef.current?.removeAttribute('data-scrambling');
  }, []);

  const runTitleDecode = useCallback(() => {
    if (reducedMotion) {
      restoreTitle();
      return;
    }

    window.cancelAnimationFrame(titleDecodeFrameRef.current);
    window.cancelAnimationFrame(titlePointerFrameRef.current);
    titlePointerFrameRef.current = 0;
    titleDecodeRunningRef.current = true;
    const run = ++titleDecodeRunRef.current;
    const startedAt = window.performance.now();
    let previousFrame = -1;

    titleRef.current?.setAttribute('data-scrambling', 'true');

    const decode = (now: number) => {
      if (run !== titleDecodeRunRef.current) return;

      const progress = Math.min(1, (now - startedAt) / TITLE_DECODE_DURATION_MS);
      const frame = Math.floor((now - startedAt) / TITLE_SCRAMBLE_FRAME_MS);

      if (frame !== previousFrame) {
        previousFrame = frame;
        setDisplayedTitleChars(
          TITLE_CHARS.map((character, index) => (
            progress >= TITLE_SETTLE_POINTS[index]
              ? character
              : getScrambledTitleChar(index, frame, run)
          )),
        );
      }

      if (progress < 1) {
        titleDecodeFrameRef.current = window.requestAnimationFrame(decode);
        return;
      }

      titleDecodeFrameRef.current = 0;
      titleDecodeRunningRef.current = false;
      restoreTitle();
    };

    titleDecodeFrameRef.current = window.requestAnimationFrame(decode);
  }, [reducedMotion, restoreTitle]);

  useEffect(() => {
    const section = sectionRef.current;
    const title = titleRef.current;
    if (!section || !title) return;

    const stopPointerScramble = (restore = true) => {
      window.cancelAnimationFrame(titlePointerFrameRef.current);
      titlePointerFrameRef.current = 0;
      if (restore && !titleDecodeRunningRef.current) restoreTitle();
    };

    const renderPointerScramble = (now: number) => {
      if (titleDecodeRunningRef.current) {
        titlePointerFrameRef.current = 0;
        return;
      }

      const pointer = titlePointerRef.current;
      const strength = Math.max(0, 1 - (now - pointer.lastMove) / TITLE_POINTER_DECAY_MS);
      if (strength <= 0) {
        stopPointerScramble();
        return;
      }

      const frame = Math.floor(now / TITLE_SCRAMBLE_FRAME_MS);
      if (frame !== pointer.frame) {
        pointer.frame = frame;
        const radius = Math.min(190, Math.max(96, window.innerWidth * 0.18)) * (0.72 + strength * 0.28);
        const characterElements = Array.from(title.querySelectorAll<HTMLElement>('[data-melting-crystal-char]'));
        let hasScrambledGlyph = false;
        const nextChars = TITLE_CHARS.map((character, index) => {
          const characterRect = characterElements[index]?.getBoundingClientRect();
          if (!characterRect) return character;

          const centerX = characterRect.left + characterRect.width / 2;
          const centerY = characterRect.top + characterRect.height / 2;
          const distance = Math.hypot(pointer.x - centerX, (pointer.y - centerY) * 1.35);
          const heat = Math.pow(Math.max(0, 1 - distance / radius) * strength, 1.4);
          const probability = 0.15 + heat * 0.75;
          const noise = ((frame * 17 + index * 31 + titleDecodeRunRef.current * 13) % 100) / 100;

          if (heat > 0.04 && noise < probability) {
            hasScrambledGlyph = true;
            return getScrambledTitleChar(index, frame, titleDecodeRunRef.current + 1);
          }

          return character;
        });

        setDisplayedTitleChars((currentChars) => (
          currentChars.every((character, index) => character === nextChars[index])
            ? currentChars
            : nextChars
        ));
        if (hasScrambledGlyph) title.setAttribute('data-scrambling', 'true');
        else title.removeAttribute('data-scrambling');
      }

      titlePointerFrameRef.current = window.requestAnimationFrame(renderPointerScramble);
    };

    const startPointerScramble = (event: PointerEvent) => {
      if (reducedMotion || titleDecodeRunningRef.current) return;

      const titleRect = title.getBoundingClientRect();
      const activationRadius = Math.min(190, Math.max(96, window.innerWidth * 0.18)) * 1.15;
      const distanceX = Math.max(titleRect.left - event.clientX, 0, event.clientX - titleRect.right);
      const distanceY = Math.max(titleRect.top - event.clientY, 0, event.clientY - titleRect.bottom);
      if (Math.hypot(distanceX, distanceY) > activationRadius) return;

      titlePointerRef.current.x = event.clientX;
      titlePointerRef.current.y = event.clientY;
      titlePointerRef.current.lastMove = window.performance.now();

      if (!titlePointerFrameRef.current) {
        titlePointerFrameRef.current = window.requestAnimationFrame(renderPointerScramble);
      }
    };

    const decayPointerScramble = () => {
      titlePointerRef.current.lastMove = window.performance.now() - TITLE_POINTER_DECAY_MS * 0.28;
    };

    const replayOnTouch = (event: PointerEvent) => {
      if (event.pointerType === 'touch') runTitleDecode();
    };

    const handleDecodeRequest = () => runTitleDecode();

    section.addEventListener(MELTING_TIME_TITLE_DECODE_EVENT, handleDecodeRequest);
    section.addEventListener('pointermove', startPointerScramble, { passive: true });
    title.addEventListener('pointerleave', decayPointerScramble);
    title.addEventListener('pointerdown', replayOnTouch, { passive: true });

    return () => {
      titleDecodeRunRef.current += 1;
      titleDecodeRunningRef.current = false;
      window.cancelAnimationFrame(titleDecodeFrameRef.current);
      stopPointerScramble(false);
      section.removeEventListener(MELTING_TIME_TITLE_DECODE_EVENT, handleDecodeRequest);
      section.removeEventListener('pointermove', startPointerScramble);
      title.removeEventListener('pointerleave', decayPointerScramble);
      title.removeEventListener('pointerdown', replayOnTouch);
    };
  }, [reducedMotion, restoreTitle, runTitleDecode]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    let scheduledFrame = 0;

    const checkPosition = () => {
      scheduledFrame = 0;
      const rect = section.getBoundingClientRect();
      if (rect.top < window.innerHeight * 2.4) {
        setShouldInitialize(true);
      }
    };

    const schedulePositionCheck = () => {
      if (scheduledFrame) return;
      scheduledFrame = window.requestAnimationFrame(checkPosition);
    };

    const preloadObserver = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setShouldInitialize(true);
      preloadObserver.disconnect();
    }, { rootMargin: '140% 0px' });

    preloadObserver.observe(section);
    schedulePositionCheck();
    window.addEventListener('scroll', schedulePositionCheck, { passive: true });
    window.addEventListener('resize', schedulePositionCheck);

    return () => {
      preloadObserver.disconnect();
      window.cancelAnimationFrame(scheduledFrame);
      window.removeEventListener('scroll', schedulePositionCheck);
      window.removeEventListener('resize', schedulePositionCheck);
    };
  }, []);

  useEffect(() => {
    if (gpu.tier === 'fallback' || reducedMotion) {
      setRenderMode('fallback');
    }
  }, [gpu.tier, reducedMotion]);

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!shouldInitialize || !section || !canvas || gpu.tier === 'fallback' || reducedMotion) return;

    const compactViewport = window.innerWidth < 640;
    const tallViewport = window.innerHeight / Math.max(1, window.innerWidth) > 0.72;
    const crystalBaseX = 0;
    const crystalBaseY = compactViewport ? -0.05 : tallViewport ? -0.42 : 0;
    const lowPower = gpu.tier === 'reduced' || coarsePointer || compactViewport;
    const random = seededRandom(3932026);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x010308);
    scene.fog = new THREE.FogExp2(0x010308, 0.05);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 10;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: false,
        antialias: !lowPower,
        powerPreference: 'high-performance',
      });
    } catch {
      setRenderMode('fallback');
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environmentMap = pmrem.fromScene(room, 0.04).texture;
    scene.environment = environmentMap;
    room.dispose();

    const crystalGeometry = new THREE.IcosahedronGeometry(2.5, lowPower ? 3 : 5);
    sculptCrystal(crystalGeometry);
    applyCrystalPalette(crystalGeometry);
    const crystalMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      vertexColors: true,
      transmission: lowPower ? 0.1 : 0.16,
      transparent: true,
      opacity: 1,
      metalness: 0.1,
      roughness: 0.15,
      ior: 1.31,
      thickness: lowPower ? 1.2 : 2,
      specularIntensity: 2,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      envMapIntensity: lowPower ? 0.48 : 0.56,
      emissive: 0x07111f,
      emissiveIntensity: 0.1,
      side: THREE.DoubleSide,
      flatShading: true,
    });
    const crystal = new THREE.Mesh(crystalGeometry, crystalMaterial);
    scene.add(crystal);

    const particleCount = lowPower ? 680 : 1500;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let index = 0; index < particleCount; index += 1) {
      particlePositions[index * 3] = (random() - 0.5) * 30;
      particlePositions[index * 3 + 1] = (random() - 0.5) * 30;
      particlePositions[index * 3 + 2] = (random() - 0.5) * 20 - 5;
    }
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xaee6ff,
      size: lowPower ? 0.042 : 0.05,
      transparent: true,
      opacity: lowPower ? 0.5 : 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    const debrisCount = lowPower ? 72 : 150;
    const debrisGeometry = new THREE.OctahedronGeometry(1, 0);
    const debrisMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: lowPower ? 0.05 : 0.3,
      transparent: true,
      opacity: 0.9,
      metalness: 0,
      roughness: 0.6,
      ior: 1.1,
      thickness: 0.1,
      clearcoat: 0.2,
    });
    const debris = new THREE.InstancedMesh(debrisGeometry, debrisMaterial, debrisCount);
    debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(debris);

    const debrisPositions = new Float32Array(debrisCount * 3);
    const debrisVelocities = new Float32Array(debrisCount * 3);
    const debrisScales = new Float32Array(debrisCount);
    const debrisPhases = new Float32Array(debrisCount);
    for (let index = 0; index < debrisCount; index += 1) {
      const offset = index * 3;
      debrisPositions[offset] = (random() - 0.5) * 20;
      debrisPositions[offset + 1] = (random() - 0.5) * 20;
      debrisPositions[offset + 2] = (random() - 0.5) * 12;
      debrisVelocities[offset] = (random() - 0.5) * 0.018;
      debrisVelocities[offset + 1] = (random() - 0.5) * 0.018;
      debrisVelocities[offset + 2] = (random() - 0.5) * 0.012;
      debrisScales[index] = 0.02 + random() * 0.04;
      debrisPhases[index] = random() * Math.PI * 2;
    }

    scene.add(new THREE.AmbientLight(0x0a1a3a, 1.5));
    const mainLight = new THREE.DirectionalLight(0xffffff, 2);
    mainLight.position.set(5, 5, 5);
    scene.add(mainLight);

    const orbitingLights = [0x55b6ff, 0x174dff, 0xffffff].map((color) => {
      const light = new THREE.PointLight(color, 3, 20);
      scene.add(light);
      return {
        light,
        angle: random() * Math.PI * 2,
        speed: 0.005 + random() * 0.01,
        radius: 3 + random() * 2,
      };
    });

    const pointerCurrent = new THREE.Vector2();
    const cursorCurrent = new THREE.Vector2(section.clientWidth / 2, section.clientHeight / 2);
    const dummy = new THREE.Object3D();
    let running = false;
    let visible = false;
    let disposed = false;
    let animationFrame = 0;
    let frameCount = 0;
    let previousTime = performance.now();
    let elapsed = 0;

    const syncSize = () => {
      const width = Math.max(1, section.clientWidth);
      const height = Math.max(1, section.clientHeight);
      const aspect = width / height;
      camera.aspect = aspect;
      // Keep the complete crystal in frame on narrow screens without changing its geometry.
      camera.position.z = Math.max(10, 2.65 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect));
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.15 : Math.min(gpu.maxDpr, 2)));
      renderer.setSize(width, height, false);
    };

    const showCursor = () => {
      pointerInsideRef.current = true;
      if (cursorDotRef.current) cursorDotRef.current.style.opacity = '1';
      if (cursorRingRef.current) cursorRingRef.current.style.opacity = '1';
    };

    const hideCursor = () => {
      pointerInsideRef.current = false;
      if (cursorDotRef.current) cursorDotRef.current.style.opacity = '0';
      if (cursorRingRef.current) cursorRingRef.current.style.opacity = '0';
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = section.getBoundingClientRect();
      pointerTargetRef.current.set(
        ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
        -(((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1),
      );
      cursorTargetRef.current.set(event.clientX - rect.left, event.clientY - rect.top);
      if (!pointerInsideRef.current) showCursor();
    };

    const onPointerDown = () => {
      pointerPressedRef.current = true;
    };
    const onPointerUp = () => {
      pointerPressedRef.current = false;
    };

    const renderFrame = (time: number) => {
      if (!running || disposed) return;
      animationFrame = window.requestAnimationFrame(renderFrame);
      const delta = Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;
      elapsed += delta;

      if (shouldThrottleFrame(frameCount++, lowPower, {
        activeFrameInterval: lowPower ? 2 : 1,
        idleFrameInterval: lowPower ? 2 : 1,
      })) return;

      const pointerSmoothing = 1 - Math.exp(-3 * delta);
      const cursorSmoothing = 1 - Math.exp(-10 * delta);
      pointerCurrent.lerp(pointerTargetRef.current, pointerSmoothing);
      cursorCurrent.lerp(cursorTargetRef.current, cursorSmoothing);

      camera.position.x = pointerCurrent.x * 2;
      camera.position.y = pointerCurrent.y * 2;
      camera.lookAt(scene.position);

      crystal.rotation.y = elapsed * 0.1;
      crystal.rotation.x = elapsed * 0.05;
      crystal.position.x = crystalBaseX;
      crystal.position.y = crystalBaseY + Math.sin(elapsed * 0.5) * 0.2;

      orbitingLights.forEach((entry) => {
        entry.angle += entry.speed * delta * 60;
        entry.light.position.x = Math.cos(entry.angle) * entry.radius;
        entry.light.position.y = Math.sin(entry.angle * 1.5) * (entry.radius * 0.5);
        entry.light.position.z = Math.sin(entry.angle) * entry.radius;
      });

      const frameScale = delta * 60;
      const damping = Math.pow(0.85, frameScale);
      const pointerWorldX = pointerCurrent.x * 12;
      const pointerWorldY = pointerCurrent.y * 8;
      for (let index = 0; index < debrisCount; index += 1) {
        const offset = index * 3;
        let x = debrisPositions[offset];
        let y = debrisPositions[offset + 1];
        let z = debrisPositions[offset + 2];
        let velocityX = debrisVelocities[offset] - x * 0.0007 * frameScale;
        let velocityY = debrisVelocities[offset + 1] - y * 0.0007 * frameScale;
        let velocityZ = debrisVelocities[offset + 2] - z * 0.0007 * frameScale;
        const deltaX = x - pointerWorldX;
        const deltaY = y - pointerWorldY;
        const distance = Math.hypot(deltaX, deltaY);
        if (distance < 1.5 && distance > 0.001) {
          const force = (1 - distance / 1.5) * 0.055 * frameScale;
          velocityX += (deltaX / distance) * force;
          velocityY += (deltaY / distance) * force;
        }
        velocityX *= damping;
        velocityY *= damping;
        velocityZ *= damping;
        x += velocityX * frameScale;
        y += velocityY * frameScale;
        z += velocityZ * frameScale;
        debrisPositions[offset] = x;
        debrisPositions[offset + 1] = y;
        debrisPositions[offset + 2] = z;
        debrisVelocities[offset] = velocityX;
        debrisVelocities[offset + 1] = velocityY;
        debrisVelocities[offset + 2] = velocityZ;

        const phase = debrisPhases[index];
        dummy.position.set(x, y, z);
        dummy.rotation.set(elapsed * 0.8 + phase, elapsed * 0.62 + phase * 0.7, phase);
        dummy.scale.setScalar(debrisScales[index]);
        dummy.updateMatrix();
        debris.setMatrixAt(index, dummy.matrix);
      }
      debris.instanceMatrix.needsUpdate = true;

      particles.rotation.y = elapsed * 0.02;
      particles.position.x = -pointerCurrent.x * 0.5;
      particles.position.y = -pointerCurrent.y * 0.5;

      if (!coarsePointer) {
        const cursorDot = cursorDotRef.current;
        const cursorRing = cursorRingRef.current;
        const title = titleRef.current;
        if (cursorDot) {
          cursorDot.style.transform = `translate3d(${cursorTargetRef.current.x}px, ${cursorTargetRef.current.y}px, 0) translate(-50%, -50%)`;
        }
        if (cursorRing) {
          const scale = pointerPressedRef.current ? 1.5 : 1;
          cursorRing.style.transform = `translate3d(${cursorCurrent.x}px, ${cursorCurrent.y}px, 0) translate(-50%, -50%) scale(${scale})`;
          cursorRing.style.borderColor = pointerPressedRef.current ? '#ffffff' : 'rgba(255, 255, 255, 0.4)';
        }
        if (title) {
          title.style.transform = `rotateX(${pointerCurrent.y * 5}deg) rotateY(${pointerCurrent.x * 5}deg) translateZ(0)`;
        }
      }

      renderer.render(scene, camera);
    };

    const start = () => {
      if (running || disposed || !visible || document.hidden) return;
      running = true;
      previousTime = performance.now();
      animationFrame = window.requestAnimationFrame(renderFrame);
    };
    const stop = () => {
      running = false;
      window.cancelAnimationFrame(animationFrame);
    };
    const onVisibilityChange = () => (document.hidden ? stop() : start());
    const onContextLost = (event: Event) => {
      event.preventDefault();
      stop();
      setRenderMode('fallback');
    };

    const resizeObserver = new ResizeObserver(syncSize);
    resizeObserver.observe(section);
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    }, { rootMargin: '80% 0px' });
    visibilityObserver.observe(section);

    section.addEventListener('pointerenter', showCursor);
    section.addEventListener('pointerleave', hideCursor);
    section.addEventListener('pointermove', onPointerMove, { passive: true });
    section.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    document.addEventListener('visibilitychange', onVisibilityChange);
    canvas.addEventListener('webglcontextlost', onContextLost);

    syncSize();
    renderer.render(scene, camera);
    setRenderMode('webgl');

    return () => {
      disposed = true;
      stop();
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      section.removeEventListener('pointerenter', showCursor);
      section.removeEventListener('pointerleave', hideCursor);
      section.removeEventListener('pointermove', onPointerMove);
      section.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      crystalGeometry.dispose();
      crystalMaterial.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      debrisGeometry.dispose();
      debrisMaterial.dispose();
      environmentMap.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    };
  }, [coarsePointer, gpu.maxDpr, gpu.tier, reducedMotion, shouldInitialize]);

  return (
    <section
      ref={sectionRef}
      className={`melting-time-crystal-finale melting-time-crystal-finale--${renderMode}`}
      aria-labelledby="melting-time-crystal-title"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .melting-time-crystal-finale {
              position: relative;
              z-index: 10;
              width: 100%;
              min-height: 100svh;
              overflow: hidden;
              isolation: isolate;
              background: #010308;
              color: #ffffff;
              cursor: none;
              font-family: 'Noto Serif TC', serif;
              font-synthesis: none;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
            }

            .melting-time-crystal-stage,
            .melting-time-crystal-scene,
            .melting-time-crystal-canvas,
            .melting-time-crystal-fallback,
            .melting-time-crystal-noise,
            .melting-time-crystal-vignette,
            .melting-time-crystal-ui {
              position: absolute;
              inset: 0;
              width: 100%;
              height: 100%;
            }

            .melting-time-crystal-stage {
              overflow: hidden;
              background: #010308;
              transform: translateZ(0);
              will-change: opacity, transform;
            }

            .melting-time-crystal-scene {
              z-index: 1;
              overflow: hidden;
              transform-origin: 50% 50%;
              will-change: opacity, transform, filter;
            }

            .melting-time-crystal-canvas,
            .melting-time-crystal-fallback {
              display: block;
              object-fit: cover;
              object-position: center;
              transition: opacity 900ms cubic-bezier(0.19, 1, 0.22, 1);
            }

            .melting-time-crystal-fallback { z-index: 0; opacity: 1; }
            .melting-time-crystal-canvas { z-index: 1; opacity: 0; }
            .melting-time-crystal-finale--webgl .melting-time-crystal-fallback { opacity: 0; }
            .melting-time-crystal-finale--webgl .melting-time-crystal-canvas { opacity: 1; }

            .melting-time-crystal-noise {
              z-index: 4;
              pointer-events: none;
              opacity: 0.05;
              filter: url('#melting-time-crystal-noise-filter');
            }

            .melting-time-crystal-vignette {
              z-index: 3;
              pointer-events: none;
              background: radial-gradient(circle at center, rgba(0, 0, 0, 0) 0%, rgba(2, 6, 17, 0.7) 100%);
            }

            .melting-time-crystal-ui {
              z-index: 6;
              display: flex;
              align-items: center;
              justify-content: center;
              pointer-events: none;
            }

            .melting-time-crystal-title {
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 -0.15em 0 0;
              color: #ffffff;
              font-family: 'Noto Serif TC', serif;
              font-size: clamp(4rem, 12vw, 9rem);
              font-weight: 900;
              font-synthesis: none;
              line-height: 1.1;
              letter-spacing: 0.33em;
              text-align: center;
              text-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 0 0 60px rgba(255, 255, 255, 0.1);
              transform-style: preserve-3d;
              perspective: 1000px;
              mix-blend-mode: screen;
              pointer-events: auto;
              touch-action: pan-y;
              will-change: transform;
            }

            .melting-time-crystal-char {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              block-size: 1.1em;
              flex: 0 0 1em;
              inline-size: 1em;
              margin-inline-end: 0.33em;
              opacity: 0;
              letter-spacing: normal;
              text-align: center;
              transform: translateY(40px) scale(0.95);
              will-change: opacity, transform, filter;
            }

            .melting-time-crystal-char[data-scrambled='true'] {
              font-family: ui-monospace, 'SFMono-Regular', 'SF Mono', Menlo, Consolas, monospace;
              font-weight: 700;
              font-synthesis: none;
            }

            .melting-time-crystal-bottom-text {
              position: absolute;
              z-index: 7;
              right: 0;
              bottom: max(8svh, calc(env(safe-area-inset-bottom) + 1.5rem));
              left: 0;
              width: 100%;
              padding-inline: 1rem;
              text-align: center;
              pointer-events: none;
            }

            .melting-time-crystal-subtitle {
              display: inline-block;
              max-width: 100%;
              margin: 0 -0.8em 0 0;
              color: #f5d76e;
              font-family: 'Noto Serif TC', serif;
              font-size: clamp(0.75rem, 1.5vw, 1rem);
              font-weight: 600;
              font-synthesis: none;
              line-height: 1.45;
              letter-spacing: 0.8em;
              text-shadow: 0 4px 10px rgba(0, 0, 0, 0.9), 0 0 25px rgba(245, 215, 110, 0.5), 0 0 40px rgba(245, 215, 110, 0.2);
              opacity: 0;
              transform: translateY(20px);
              white-space: nowrap;
              will-change: opacity, transform, filter;
            }

            .melting-time-crystal-cursor-dot,
            .melting-time-crystal-cursor-ring {
              position: absolute;
              top: 0;
              left: 0;
              z-index: 20;
              border-radius: 50%;
              opacity: 0;
              pointer-events: none;
              will-change: transform;
              transition: opacity 300ms ease;
            }

            .melting-time-crystal-cursor-dot {
              width: 6px;
              height: 6px;
              background: #ffffff;
              box-shadow: 0 0 10px #ffffff;
            }

            .melting-time-crystal-cursor-ring {
              width: 40px;
              height: 40px;
              border: 1px solid rgba(255, 255, 255, 0.4);
              box-shadow: 0 0 20px rgba(174, 230, 255, 0.2);
              transition: opacity 300ms ease, border-color 300ms ease;
            }

            .melting-time-crystal-filter-defs {
              position: absolute;
              width: 0;
              height: 0;
              overflow: hidden;
            }

            @media (max-width: 639px) {
              .melting-time-crystal-finale--fallback .melting-time-crystal-fallback {
                transform: scale(0.74);
              }

              .melting-time-crystal-title {
                width: calc(100% - 1.5rem);
                font-size: clamp(3rem, 15vw, 3.9rem);
                letter-spacing: 0.11em;
                mix-blend-mode: normal;
                text-shadow: 0 12px 30px rgba(0, 0, 0, 0.72), 0 0 34px rgba(255, 255, 255, 0.12);
              }

              .melting-time-crystal-char {
                margin-inline-end: 0.11em;
              }

              .melting-time-crystal-subtitle {
                margin-right: -0.55em;
                font-size: 0.75rem;
                letter-spacing: 0.55em;
              }

              .melting-time-crystal-bottom-text {
                bottom: max(8svh, calc(env(safe-area-inset-bottom) + 1.5rem));
              }
            }

            @media (pointer: coarse) {
              .melting-time-crystal-finale { cursor: auto; }
              .melting-time-crystal-cursor-dot,
              .melting-time-crystal-cursor-ring { display: none; }
            }

            @media (prefers-reduced-motion: reduce) {
              .melting-time-crystal-canvas,
              .melting-time-crystal-fallback { transition: none; }
              .melting-time-crystal-char,
              .melting-time-crystal-subtitle {
                opacity: 1;
                transform: none;
                filter: none;
                animation: none !important;
              }
              .melting-time-crystal-cursor-dot,
              .melting-time-crystal-cursor-ring { display: none; }
            }
          `,
        }}
      />

      <svg className="melting-time-crystal-filter-defs" aria-hidden="true">
        <filter id="melting-time-crystal-noise-filter">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves={3} stitchTiles="stitch" />
          <feColorMatrix type="matrix" values="1 0 0 0 0, 0 1 0 0 0, 0 0 1 0 0, 0 0 0 0.1 0" />
        </filter>
      </svg>

      <div className="melting-time-crystal-stage" data-melting-crystal-stage>
        <div className="melting-time-crystal-scene" data-melting-crystal-scene>
          <img
            className="melting-time-crystal-fallback"
            src={FALLBACK_IMAGE}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
          />
          <canvas ref={canvasRef} className="melting-time-crystal-canvas" aria-hidden="true" />
          <div className="melting-time-crystal-vignette" aria-hidden="true" />
          <div className="melting-time-crystal-noise" aria-hidden="true" />
        </div>

        <div className="melting-time-crystal-ui">
          <h2
            ref={titleRef}
            id="melting-time-crystal-title"
            className="melting-time-crystal-title"
            aria-label="鹽埕的冰"
            data-melting-crystal-title
          >
            {TITLE_CHARS.map((character, index) => (
              <span
                key={`${character}-${index}`}
                className="melting-time-crystal-char"
                data-melting-crystal-char
                data-original-character={character}
                data-scrambled={displayedTitleChars[index] === character ? undefined : 'true'}
                aria-hidden="true"
              >
                {displayedTitleChars[index]}
              </span>
            ))}
          </h2>
        </div>

        <div className="melting-time-crystal-bottom-text">
          <p className="melting-time-crystal-subtitle" data-melting-crystal-subtitle>
            中華民國微電影協會 金獎
          </p>
        </div>

        <div ref={cursorDotRef} className="melting-time-crystal-cursor-dot" aria-hidden="true" />
        <div ref={cursorRingRef} className="melting-time-crystal-cursor-ring" aria-hidden="true" />
      </div>
    </section>
  );
};
