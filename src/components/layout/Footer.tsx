import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full py-10 min-[768px]:max-[1024px]:py-11 md:py-12 px-4 min-[394px]:max-[430px]:px-5 min-[768px]:max-[1024px]:px-8 md:px-6 border-t border-white/[0.05] bg-[#050505] text-[#A1A1AA]">
      <div className="max-w-6xl mx-auto flex flex-col min-[768px]:max-[1024px]:flex-row md:flex-row justify-between items-center gap-4 min-[768px]:max-[1024px]:gap-5 text-center min-[768px]:max-[1024px]:text-left">
        <div className="text-[13px] md:text-sm font-light tracking-wide">
          © 2026 Tseng Pin-Han. A machine for becoming.
        </div>
        <div className="flex gap-5 md:gap-6 text-[11px] md:text-xs uppercase tracking-[0.1em]">
          <a href="https://www.linkedin.com/in/pin-han-tseng/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">LinkedIn</a>
          <a href="mailto:henry930702@gmail.com" className="hover:text-white transition-colors">Email</a>
        </div>
      </div>
    </footer>
  );
};
