import React, { useEffect, useRef } from 'react';
import type {
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from 'three';

import { getUmbraCompositionAnchor } from '@/components/sections/fulbright/umbra-types';
import type { UmbraSceneSnapshot } from '@/components/sections/fulbright/umbra-types';

export type UmbraVisualPhase = 'collapse' | 'gate' | 'unlocking';

export interface CinematicBlackHoleProps {
  scene: UmbraSceneSnapshot;
  phase: UmbraVisualPhase;
  quality: 'full' | 'reduced';
  onReady?: () => void;
  onError?: () => void;
}

const VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;

  varying vec2 vUv;
  uniform vec2 uResolution;
  uniform vec2 uCenter;
  uniform float uTime;
  uniform float uCollapse;
  uniform float uUnlock;
  uniform float uQuality;

  #define PI 3.14159265359

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise21(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    mat2 rotation = mat2(0.80, -0.60, 0.60, 0.80);
    for (int i = 0; i < 4; i++) {
      if (i >= 2 && uQuality < 0.5) break;
      value += amplitude * noise21(p);
      p = rotation * p * 2.04 + 17.13;
      amplitude *= 0.5;
    }
    return value;
  }

  float starLayer(vec2 p, float scale, float seed) {
    vec2 grid = p * scale;
    vec2 cell = floor(grid);
    vec2 local = fract(grid) - 0.5;
    float random = hash21(cell + seed);
    vec2 offset = vec2(hash21(cell + seed * 2.31), hash21(cell + seed * 4.73)) - 0.5;
    float distanceToStar = length(local - offset * 0.68);
    float star = smoothstep(0.055, 0.0, distanceToStar);
    return star * pow(random, 18.0);
  }

  float ring(float radius, float target, float width) {
    return exp(-abs(radius - target) / max(width, 0.0001));
  }

  void main() {
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = vUv - uCenter;
    p.x *= aspect;
    float radius = length(p);
    vec2 direction = p / max(radius, 0.0001);

    float collapse = smoothstep(0.0, 1.0, uCollapse);
    float horizon = mix(0.008, 0.118, collapse);
    float lensPower = collapse * horizon * horizon * 0.82;
    vec2 lensed = p + direction * lensPower / max(radius * radius, 0.006);

    vec3 color = vec3(0.0015, 0.0025, 0.006);
    float stars = starLayer(lensed + uTime * 0.0012, 118.0, 3.2);
    stars += starLayer(lensed - uTime * 0.0007, 228.0, 9.7) * mix(0.18, 0.42, uQuality);
    float starSuppression = smoothstep(horizon * 0.96, horizon * 2.8, radius);
    color += vec3(0.72, 0.78, 0.96) * stars * starSuppression * collapse;

    float wave = sin(radius * 126.0 - uTime * 0.8) * 0.5 + 0.5;
    float gravitationalWave = ring(radius, horizon * 4.3 + fract(uTime * 0.022) * 0.22, 0.0035);
    color += vec3(0.18, 0.22, 0.34) * gravitationalWave * wave * collapse * 0.18;

    float angle = -0.072;
    mat2 diskRotation = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    vec2 diskP = diskRotation * p;
    float diskRadius = length(vec2(diskP.x, diskP.y * 5.4));
    float innerEdge = horizon * 1.18;
    float outerEdge = horizon * 4.7;
    float annulus = smoothstep(innerEdge, innerEdge * 1.22, diskRadius)
      * (1.0 - smoothstep(outerEdge * 0.72, outerEdge, diskRadius));
    float turbulence = fbm(vec2(log(max(diskRadius, 0.002)) * 5.5 - uTime * 0.32, atan(diskP.y * 5.4, diskP.x) * 3.2));
    float bandWidth = mix(0.0055, 0.015, smoothstep(innerEdge, outerEdge, diskRadius));
    float diskBand = exp(-abs(diskP.y) / max(bandWidth, 0.001)) * annulus;
    float orbitalPhase = atan(diskP.y * 5.4, diskP.x) * 8.0 - log(max(diskRadius, 0.002)) * 19.0 - uTime * 2.1;
    float filaments = pow(0.5 + 0.5 * sin(orbitalPhase + turbulence * 7.0), 5.0);
    float microFilaments = pow(0.5 + 0.5 * sin(orbitalPhase * 2.37 - turbulence * 11.0), 7.0);
    float striations = pow(0.5 + 0.5 * sin(
      diskRadius * 310.0 + atan(diskP.y * 5.4, diskP.x) * 11.0 + turbulence * 13.0
    ), 8.0);
    diskBand *= mix(0.42, 1.92, turbulence)
      * mix(0.62, 1.72, filaments)
      * mix(0.82, 1.42, microFilaments)
      * mix(0.92, 1.15, striations)
      * collapse;

    float doppler = smoothstep(-horizon * 3.8, horizon * 3.8, diskP.x);
    vec3 redShift = vec3(1.0, 0.31, 0.12);
    vec3 gold = vec3(1.0, 0.76, 0.34);
    vec3 blueShift = vec3(0.22, 0.53, 1.0);
    vec3 diskColor = mix(mix(redShift, gold, 0.67), blueShift, smoothstep(0.65, 0.97, doppler));
    float beaming = mix(1.08, 1.46, doppler);
    float diskGlow = exp(-abs(diskP.y) / max(bandWidth * 2.65, 0.002)) * annulus;
    color += diskColor * diskGlow * beaming * collapse * 0.34;
    vec3 filamentColor = mix(diskColor, vec3(1.0, 0.93, 0.76), filaments * (1.0 - doppler * 0.45));
    color += filamentColor * diskBand * beaming * 4.35;

    float particulate = starLayer(
      vec2(diskP.x * 1.7 - uTime * 0.006, diskP.y * 8.0),
      184.0,
      14.6
    );
    particulate *= annulus * exp(-abs(diskP.y) / max(bandWidth * 4.2, 0.002));
    color += mix(vec3(1.0, 0.42, 0.14), vec3(0.78, 0.9, 1.0), doppler)
      * particulate * collapse * 2.25;

    float curvedHeight = horizon * 0.72 + (p.x * p.x) / max(horizon * 8.0, 0.001);
    float farSide = exp(-abs(abs(p.y) - curvedHeight) / mix(0.017, 0.008, uQuality));
    farSide *= smoothstep(horizon * 0.35, horizon * 0.7, abs(p.x));
    farSide *= 1.0 - smoothstep(horizon * 2.4, horizon * 3.0, abs(p.x));
    float farTurbulence = mix(0.48, 1.35, fbm(vec2(p.x * 24.0 - uTime * 0.24, abs(p.y) * 22.0)));
    float farFilaments = mix(0.55, 1.45, pow(0.5 + 0.5 * sin(p.x * 104.0 - uTime * 1.4 + farTurbulence * 6.0), 4.0));
    vec3 farColor = mix(vec3(1.0, 0.66, 0.3), blueShift, smoothstep(0.78, 1.0, doppler));
    color += farColor * farSide * farTurbulence * farFilaments * collapse * 0.58;

    float lensHalo = ring(radius, horizon * 1.54, mix(0.012, 0.006, uQuality));
    lensHalo *= smoothstep(-horizon * 0.4, horizon * 1.25, p.y);
    color += mix(gold, blueShift, doppler) * lensHalo * collapse * 0.32;

    float photon = ring(radius, horizon * 1.025, mix(0.009, 0.0035, uQuality));
    float photonFine = ring(radius, horizon * 1.072, 0.0018);
    color += vec3(1.0, 0.82, 0.52) * photon * collapse * 2.0;
    color += vec3(0.97, 0.99, 1.0) * photonFine * collapse * 1.72;

    float radialDust = fbm(direction * 8.0 + vec2(radius * 18.0, uTime * 0.08));
    float dustMask = smoothstep(horizon * 1.2, horizon * 5.6, radius)
      * (1.0 - smoothstep(horizon * 5.6, horizon * 8.0, radius));
    color += vec3(0.52, 0.24, 0.09) * radialDust * dustMask * collapse * 0.12;

    float orbitTexture = pow(0.5 + 0.5 * sin(radius * 418.0 + radialDust * 7.0 - uTime * 0.16), 42.0);
    float orbitMask = smoothstep(horizon * 1.45, horizon * 2.2, radius)
      * (1.0 - smoothstep(horizon * 6.2, horizon * 8.4, radius));
    float warmField = 1.0 - smoothstep(-horizon * 0.6, horizon * 2.5, p.x);
    float orbitBreakup = smoothstep(0.42, 0.74, fbm(vec2(
      atan(p.y, p.x) * 3.4 + uTime * 0.025,
      radius * 22.0
    )));
    color += vec3(0.78, 0.33, 0.12)
      * orbitTexture * orbitBreakup * orbitMask * warmField * collapse * 0.075;

    float hotDust = starLayer(lensed + vec2(uTime * 0.0008, 0.0), 392.0, 22.8)
      + starLayer(lensed - vec2(uTime * 0.0004, 0.0), 612.0, 31.4) * 0.55;
    color += vec3(1.0, 0.55, 0.24) * hotDust * orbitMask * warmField * collapse * 1.1;

    float shadow = 1.0 - smoothstep(horizon * 0.90, horizon * 1.01, radius);
    color *= 1.0 - shadow;

    float aperture = (1.0 - smoothstep(horizon * 0.16, horizon * 0.88, radius)) * uUnlock;
    float portalBands = 0.5 + 0.5 * sin((p.y / max(horizon, 0.001)) * 16.0 + uTime * 1.7);
    vec3 portalA = vec3(1.0, 0.33, 0.55);
    vec3 portalB = vec3(0.44, 0.96, 0.79);
    vec3 portalC = vec3(1.0, 0.77, 0.32);
    vec3 portalColor = mix(mix(portalA, portalB, smoothstep(-horizon, horizon, p.y)), portalC, portalBands * 0.34);
    color = mix(color, portalColor * (1.2 + portalBands * 0.45), aperture);

    float unlockRing = ring(radius, horizon * mix(1.04, 5.2, uUnlock), 0.006 + uUnlock * 0.016);
    color += mix(vec3(1.0, 0.82, 0.53), portalColor, uUnlock) * unlockRing * uUnlock * 1.25;

    float vignette = 1.0 - smoothstep(0.18, 1.08, length((vUv - 0.5) * vec2(aspect, 1.0)));
    color *= mix(0.58, 1.0, vignette);
    color = color / (1.0 + color);
    color = pow(color, vec3(0.82));

    float alpha = collapse * mix(0.0, 0.82, smoothstep(0.04, 0.78, collapse));
    alpha = max(alpha, aperture * 0.98);
    gl_FragColor = vec4(color, alpha);
  }
`;

export const CinematicBlackHole: React.FC<CinematicBlackHoleProps> = ({ scene: sceneSnapshot, phase, quality, onReady, onError }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: WebGLRenderer | null = null;
    let scene: Scene | null = null;
    let camera: OrthographicCamera | null = null;
    let geometry: PlaneGeometry | null = null;
    let material: ShaderMaterial | null = null;
    let mesh: Mesh | null = null;
    let frame = 0;
    let resizeFrame = 0;
    let disposed = false;
    let contextLost = false;
    let startedAt = performance.now();
    let lastRenderedAt = 0;
    let previousRenderedAt = startedAt;
    let hiddenAt = 0;
    let pausedDuration = 0;
    let unlockValue = 0;
    let compositionX = getUmbraCompositionAnchor(1, 1).x;
    let compositionY = getUmbraCompositionAnchor(1, 1).y;

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
      onError?.();
    };

    const resize = () => {
      if (!renderer || !material) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, quality === 'full' ? 1.55 : 1);
      renderer.setPixelRatio(dpr);
      renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
      material.uniforms.uResolution.value.set(rect.width * dpr, rect.height * dpr);
    };

    const scheduleResize = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(resize);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        hiddenAt = performance.now();
      } else if (hiddenAt > 0) {
        pausedDuration += performance.now() - hiddenAt;
        hiddenAt = 0;
        previousRenderedAt = performance.now();
      }
    };

    const boot = async () => {
      const THREE = await import('three');
      if (disposed) return;

      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: 'high-performance',
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;

      scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      geometry = new THREE.PlaneGeometry(2, 2);
      material = new THREE.ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uResolution: { value: new THREE.Vector2(1, 1) },
          uCenter: { value: new THREE.Vector2(sceneSnapshot.sink.x, 1 - sceneSnapshot.sink.y) },
          uTime: { value: 0 },
          uCollapse: { value: 0 },
          uUnlock: { value: 0 },
          uQuality: { value: quality === 'full' ? 1 : 0 },
        },
      });
      mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      scene.add(mesh);

      resize();
      const initialAnchor = getUmbraCompositionAnchor(canvas.clientWidth, canvas.clientHeight);
      compositionX = initialAnchor.x;
      compositionY = initialAnchor.y;
      renderer.compile(scene, camera);
      startedAt = performance.now();
      onReady?.();

      const render = (now: number) => {
        if (disposed) return;
        frame = requestAnimationFrame(render);
        if (document.hidden || contextLost || !renderer || !scene || !camera || !material) return;

        const elapsed = Math.max(0, (now - startedAt - pausedDuration) / 1000);
        const isGateIdle = phaseRef.current === 'gate';
        const minFrameTime = quality === 'reduced' || isGateIdle ? 1000 / 30 : 1000 / 60;
        if (now - lastRenderedAt < minFrameTime) return;
        const deltaSeconds = Math.min(0.1, Math.max(0, now - previousRenderedAt) / 1000);
        previousRenderedAt = now;
        lastRenderedAt = now;

        const collapseValue = Math.min(1, elapsed / 4.15);
        const unlockTarget = phaseRef.current === 'unlocking' ? 1 : 0;
        unlockValue += (unlockTarget - unlockValue) * (1 - Math.exp(-2.8 * deltaSeconds));
        const centerProgress = Math.max(0, Math.min(1, (collapseValue - 0.72) / 0.28));
        const centerEase = centerProgress * centerProgress * (3 - 2 * centerProgress);
        const target = getUmbraCompositionAnchor(canvas.clientWidth, canvas.clientHeight);
        const compositionEase = 1 - Math.exp(-3.4 * deltaSeconds);
        compositionX += (target.x - compositionX) * compositionEase;
        compositionY += (target.y - compositionY) * compositionEase;

        material.uniforms.uCenter.value.set(
          sceneSnapshot.sink.x + (compositionX - sceneSnapshot.sink.x) * centerEase,
          1 - (sceneSnapshot.sink.y + (compositionY - sceneSnapshot.sink.y) * centerEase),
        );
        material.uniforms.uTime.value = elapsed;
        material.uniforms.uCollapse.value = collapseValue;
        material.uniforms.uUnlock.value = unlockValue;
        renderer.render(scene, camera);
      };

      frame = requestAnimationFrame(render);
    };

    canvas.addEventListener('webglcontextlost', handleContextLost);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(scheduleResize) : null;
    observer?.observe(canvas.parentElement ?? canvas);
    window.addEventListener('resize', scheduleResize, { passive: true });
    window.visualViewport?.addEventListener('resize', scheduleResize, { passive: true });
    document.addEventListener('visibilitychange', handleVisibility);
    void boot().catch(() => {
      if (!disposed) onError?.();
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(resizeFrame);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      observer?.disconnect();
      window.removeEventListener('resize', scheduleResize);
      window.visualViewport?.removeEventListener('resize', scheduleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (scene && mesh) scene.remove(mesh);
      geometry?.dispose();
      material?.dispose();
      renderer?.dispose();
      renderer?.forceContextLoss();
      renderer = null;
      scene = null;
      camera = null;
      geometry = null;
      material = null;
      mesh = null;
    };
  }, [onError, onReady, quality, sceneSnapshot]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 z-[2] h-full w-full"
      data-umbra-canvas
    />
  );
};

export default CinematicBlackHole;
