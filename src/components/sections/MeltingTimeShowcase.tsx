import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { ThermodynamicExhibit } from '@/components/webgl/ThermodynamicExhibit';

export const MeltingTimeShowcase: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Track scroll progress within this 300vh section
  const { scrollYProgress } = useScroll({ 
    target: containerRef, 
    offset: ["start start", "end end"] 
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 60, damping: 20 });

  // Transform values for the preview monitor shrinking effect
  // Starts full bleed (scale 1, radius 0), shrinks to a cinematic preview window (e.g. scale 0.6)
  const scale = useTransform(smoothProgress, [0, 0.4, 1], [1, 0.65, 0.65]);
  const borderRadius = useTransform(smoothProgress, [0, 0.4, 1], ["0px", "12px", "12px"]);
  const yOffset = useTransform(smoothProgress, [0, 0.4, 1], ["0vh", "5vh", "5vh"]);
  
  // UI framing elements fade in
  const uiOpacity = useTransform(smoothProgress, [0.2, 0.4, 1], [0, 1, 1]);
  
  // Text fade in when monitor shrinks
  const textOpacity = useTransform(smoothProgress, [0.4, 0.5, 1], [0, 1, 1]);
  const textY = useTransform(smoothProgress, [0.4, 0.5, 1], [20, 0, 0]);

  return (
    <section ref={containerRef} className="relative w-full h-[300vh] bg-[#050505]">
      {/* Sticky container that holds the viewport */}
      <div className="sticky top-0 w-full h-screen overflow-hidden bg-[#0A0A0C]">
        
        {/* Editor UI Frame (fades in as video shrinks) */}
        <motion.div 
          style={{ opacity: uiOpacity }}
          className="absolute inset-0 pointer-events-none z-0"
        >
          {/* Top Bar */}
          <div className="absolute top-0 w-full h-12 border-b border-white/[0.05] bg-[#050505]/80 flex items-center px-6 gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
            <div className="ml-4 text-[10px] uppercase tracking-widest text-[#555555]">Source Monitor // Timeline</div>
          </div>
          
          {/* Timeline UI Panel Area */}
          <div className="absolute bottom-0 w-full h-[30vh] border-t border-white/[0.05] bg-[#0A0A0C] flex flex-col pt-8 px-6">
            <motion.div 
              style={{ opacity: textOpacity, y: textY }}
              className="max-w-2xl mx-auto text-center"
            >
              <h3 className="text-2xl font-medium tracking-tight text-white mb-2">Editing the Unseen</h3>
              <p className="text-sm text-[#A1A1AA] font-light leading-relaxed">
                Behind the thermodynamic distortion lies hours of careful framing and memory reconstruction. 
                This interface mimics the digital workbench where the cold reality of hardware meets the warmth of human storytelling.
              </p>
            </motion.div>
          </div>
          
          {/* Left/Right Panels */}
          <div className="absolute left-0 top-12 w-[15vw] h-[calc(70vh-3rem)] border-r border-white/[0.05] bg-[#050505]/30 hidden md:block" />
          <div className="absolute right-0 top-12 w-[15vw] h-[calc(70vh-3rem)] border-l border-white/[0.05] bg-[#050505]/30 hidden md:block" />
        </motion.div>

        {/* The Scalable Canvas Screen */}
        <motion.div 
          style={{ 
            scale, 
            borderRadius, 
            y: yOffset,
            boxShadow: "0 20px 80px rgba(0,0,0,0.8)"
          }}
          className="relative z-10 w-full h-[100vh] origin-top overflow-hidden"
        >
          {/* Thermodynamic Exhibit acts exactly as the screen content */}
          <ThermodynamicExhibit 
            title="鹽埕的冰"
            description="2045年的鹽埕區，阿嬤被一個惡夢嚇得渾身顫抖。兒子在得知消息後，火速前往阿嬤的夢境，卻發現了阿嬤不可告人的祕密..."
            award="中華民國微電影協會 — 金獎 (AI 生成類)"
            youngImageSrc="https://res.cloudinary.com/dt8x2v9id/image/upload/f_auto,q_auto/icephotoyoung_thwgtq"
            oldImageSrc="https://res.cloudinary.com/dt8x2v9id/image/upload/f_auto,q_auto/icephotoold_b7isax"
          />
        </motion.div>

      </div>
    </section>
  );
};
