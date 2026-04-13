import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { type MotionValue } from 'framer-motion';
import { IdleTracker, shouldThrottleFrame } from '@/lib/adaptive-render';

interface HeroLiquidShaderProps {
  text: string;
  mouseX: MotionValue<number>;
  mouseY: MotionValue<number>;
  className?: string;
  fitToContainer?: boolean;
  variant?: 'default' | 'inline';
  interactionPadding?: {
    x: number;
    y: number;
  };
}

export const HeroLiquidShader: React.FC<HeroLiquidShaderProps> = ({
  text,
  mouseX,
  mouseY,
  className = '',
  fitToContainer = false,
  variant = 'default',
  interactionPadding,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isVisibleRef = useRef(true);
  const hasMovedRef = useRef(false);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    let reqId: number;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;
    
    const renderer = new THREE.WebGLRenderer({ 
      canvas: canvasRef.current, 
      alpha: true, 
      antialias: false, 
      powerPreference: "high-performance" 
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, variant === 'inline' ? 3 : 1.5)); 

    const textCanvas = document.createElement('canvas');
    const ctx = textCanvas.getContext('2d');

    const texture = new THREE.CanvasTexture(textCanvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const geometry = new THREE.PlaneGeometry(2, 2);
    
    const currentMouse = new THREE.Vector2(-10, -10);
    const targetMouse = new THREE.Vector2(-10, -10);
    let velocity = 0;
    const lastMouse = new THREE.Vector2(-10, -10);
    let resizeResetUntil = 0;

    const material = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tText;
        uniform vec2 uResolution;
        uniform vec2 uMouse;
        uniform float uTime;
        uniform float uVelocity;
        uniform float uBaseRadius;
        uniform float uVelocityRadius;
        uniform float uRippleStrength;
        uniform float uDistortionStrength;
        uniform float uChromaticStrength;
        uniform float uVelocityChromaticStrength;
        uniform float uSpecularStrength;
        varying vec2 vUv;

        void main() {
          vec2 uv = vUv;
          vec2 aUv = vec2(uv.x * (uResolution.x / uResolution.y), uv.y);
          vec2 aMouse = vec2(uMouse.x * (uResolution.x / uResolution.y), uMouse.y);
          float dist = distance(aUv, aMouse);
          
          float baseRadius = uBaseRadius + (uVelocity * uVelocityRadius);
          float ripple = sin(dist * 20.0 - uTime * 4.0) * uRippleStrength * smoothstep(baseRadius + 0.1, 0.0, dist);
          float liquidMask = smoothstep(baseRadius + 0.25, 0.0, dist);
          
          vec2 dir = normalize(aUv - aMouse + vec2(0.0001));
          vec2 refractUv = uv + dir * liquidMask * uDistortionStrength + vec2(ripple);
          
          float ca = liquidMask * uChromaticStrength + (uVelocity * uVelocityChromaticStrength);
          
          float r = texture2D(tText, clamp(refractUv + vec2(ca, 0.0), 0.0, 1.0)).r;
          float g = texture2D(tText, clamp(refractUv, 0.0, 1.0)).g;
          float b = texture2D(tText, clamp(refractUv - vec2(ca, 0.0), 0.0, 1.0)).b;
          float a = max(max(texture2D(tText, clamp(refractUv + vec2(ca, 0.0), 0.0, 1.0)).a, g), texture2D(tText, clamp(refractUv - vec2(ca, 0.0), 0.0, 1.0)).a);
          
          float spec = pow(liquidMask, 4.0) * uSpecularStrength * a;
          
          gl_FragColor = vec4(vec3(r, g, b) + spec, a);
        }
      `,
      uniforms: {
        tText: { value: texture },
        uResolution: { value: new THREE.Vector2() },
        uMouse: { value: currentMouse },
        uTime: { value: 0 },
        uVelocity: { value: 0 },
        uBaseRadius: { value: 0.12 },
        uVelocityRadius: { value: 0.15 },
        uRippleStrength: { value: 0.05 },
        uDistortionStrength: { value: 0.15 },
        uChromaticStrength: { value: 0.05 },
        uVelocityChromaticStrength: { value: 0.02 },
        uSpecularStrength: { value: 0.4 },
      },
      transparent: true
    });

    scene.add(new THREE.Mesh(geometry, material));

    const drawText = () => {
      if (!ctx || !containerRef.current) return;

      if (fitToContainer) {
        const styles = window.getComputedStyle(containerRef.current);
        // Render at high resolution once (like the reference's fixed 2048×512 canvas).
        // Use 4× CSS size to supersample, ensuring sharp edges at any display size.
        const superScale = 4;
        const cw = containerRef.current.clientWidth;
        const ch = containerRef.current.clientHeight;
        const width = Math.max(1, cw * superScale);
        const height = Math.max(1, ch * superScale);
        const fontWeight = styles.fontWeight || '700';
        const fontFamily = styles.fontFamily || '"PingFang TC", "Hiragino Sans GB", "Microsoft JhengHei", sans-serif';
        const fontSize = Math.max(1, parseFloat(styles.fontSize || '16') * superScale);
        const letterSpacing = styles.letterSpacing === 'normal' ? 0 : parseFloat(styles.letterSpacing || '0') * superScale;

        textCanvas.width = width;
        textCanvas.height = height;
        ctx.clearRect(0, 0, width, height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fontKerning = 'normal';

        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

        if (letterSpacing === 0) {
          ctx.fillText(text, width / 2, height / 2);
        } else {
          // draw per-character for letter-spacing
          ctx.textAlign = 'left';
          const chars = Array.from(text);
          let totalW = 0;
          const charWidths: number[] = [];
          chars.forEach((ch) => {
            const w = ctx.measureText(ch).width;
            charWidths.push(w);
            totalW += w;
          });
          totalW += Math.max(0, chars.length - 1) * letterSpacing;
          let cursorX = (width - totalW) / 2;
          chars.forEach((ch, i) => {
            ctx.fillText(ch, cursorX, height / 2);
            cursorX += charWidths[i] + letterSpacing;
          });
        }
      } else {
        textCanvas.width = 2048;
        textCanvas.height = 512;
        ctx.clearRect(0, 0, textCanvas.width, textCanvas.height);
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '900 200px "PingFang TC", "Hiragino Sans GB", "Microsoft JhengHei", sans-serif';
        ctx.fillText(text, textCanvas.width / 2, textCanvas.height / 2);
      }

      texture.needsUpdate = true;
    };

    // Render text once at high resolution — never re-render on resize
    // (matches the reference pattern: fixed canvas, only renderer size changes)
    drawText();

    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      renderer.setSize(w, h);
      material.uniforms.uResolution.value.set(w, h);
      if (fitToContainer) {
        // Reset all interaction state to prevent velocity spikes during resize
        currentMouse.set(-10, -10);
        targetMouse.set(-10, -10);
        lastMouse.set(-10, -10);
        velocity = 0;
        hasMovedRef.current = false;
        material.uniforms.uVelocity.value = 0;
        resizeResetUntil = performance.now() + 200;
      }
    };
    handleResize();
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);
    
    // Intersection Observer to pause animation
    const io = new IntersectionObserver(([entry]) => {
      isVisibleRef.current = entry.isIntersecting;
    });
    io.observe(containerRef.current);

    const clock = new THREE.Clock();
    const idleTracker = new IdleTracker();
    let frameCount = 0;

    const renderLoop = () => {
      reqId = requestAnimationFrame(renderLoop);
      if (!isVisibleRef.current || shouldThrottleFrame(frameCount++, idleTracker.idle)) return;

      const t = clock.getElapsedTime();
      const mX = mouseX.get();
      const mY = mouseY.get();
      
      if (mX !== 0 || mY !== 0) {
        hasMovedRef.current = true;
      }
      
      if (containerRef.current && hasMovedRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const paddingX = interactionPadding?.x ?? 0;
        const paddingY = interactionPadding?.y ?? 0;
        const interactionLeft = rect.left - paddingX;
        const interactionTop = rect.top - paddingY;
        const interactionWidth = rect.width + paddingX * 2;
        const interactionHeight = rect.height + paddingY * 2;

        targetMouse.x = THREE.MathUtils.clamp((mX - interactionLeft) / interactionWidth, -0.35, 1.35);
        targetMouse.y = THREE.MathUtils.clamp(1.0 - ((mY - interactionTop) / interactionHeight), -0.35, 1.35);
      }

      currentMouse.lerp(targetMouse, 0.1);

      const inCooldown = performance.now() < resizeResetUntil;
      if (inCooldown) {
        velocity *= 0.7; // Rapidly decay velocity during resize cooldown
      } else if (hasMovedRef.current) {
        const d = currentMouse.distanceTo(lastMouse);
        velocity += (d - velocity) * 0.15;
        if (d > 0.001) idleTracker.ping();
      }
      
      lastMouse.copy(currentMouse);

      material.uniforms.uTime.value = t;
      material.uniforms.uMouse.value.copy(currentMouse);
      material.uniforms.uVelocity.value = Math.min(velocity * 100.0, 10.0);
      renderer.render(scene, camera);
    };
    renderLoop();

    return () => {
      cancelAnimationFrame(reqId);
      resizeObserver.disconnect();
      io.disconnect();
      geometry.dispose();
      material.dispose();
      texture.dispose();
      renderer.dispose();
    };
  }, [fitToContainer, interactionPadding?.x, interactionPadding?.y, mouseX, mouseY, text, variant]);

  return (
    <div
      ref={containerRef}
      className={fitToContainer ? className : `w-full max-w-[1400px] h-[30vh] min-[394px]:max-[430px]:h-[34vh] min-[768px]:max-[1024px]:h-[42vh] lg:h-[50vh] relative flex justify-center items-center ${className}`.trim()}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
    </div>
  );
};
