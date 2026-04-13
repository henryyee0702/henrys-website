import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

const WRITING_MENU_ITEMS = [
  {
    href: '/series/my-story',
    label: '我的故事',
    sublabel: 'My Story',
  },
  {
    href: '/writing',
    label: '全部文章',
    sublabel: '→',
    separatorBefore: true,
    compact: true,
  },
];

export const Navigation: React.FC = () => {
  const [writingOpen, setWritingOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuItemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const menuBaseId = useId();
  const menuId = `${menuBaseId}-writing-menu`;
  const menuButtonId = `${menuBaseId}-writing-button`;

  const focusMenuItem = (index: number) => {
    menuItemRefs.current[index]?.focus();
  };

  const openMenu = (focusIndex?: number) => {
    clearTimeout(timeoutRef.current);
    setWritingOpen(true);

    if (focusIndex !== undefined) {
      requestAnimationFrame(() => focusMenuItem(focusIndex));
    }
  };

  const toggleMenu = () => {
    clearTimeout(timeoutRef.current);
    setWritingOpen(prev => !prev);
  };

  const closeMenu = () => {
    timeoutRef.current = setTimeout(() => setWritingOpen(false), 180);
  };

  const closeMenuImmediately = () => {
    clearTimeout(timeoutRef.current);
    setWritingOpen(false);
  };

  const handleMenuButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openMenu(0);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      openMenu(WRITING_MENU_ITEMS.length - 1);
    }
  };

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = menuItemRefs.current.findIndex((item) => item === document.activeElement);
    const lastIndex = WRITING_MENU_ITEMS.length - 1;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusMenuItem(currentIndex >= lastIndex ? 0 : currentIndex + 1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusMenuItem(currentIndex <= 0 ? lastIndex : currentIndex - 1);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      focusMenuItem(0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      focusMenuItem(lastIndex);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenuImmediately();
      menuButtonRef.current?.focus();
      return;
    }

    if (event.key === 'Tab') {
      closeMenuImmediately();
    }
  };

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        closeMenuImmediately();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenuImmediately();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timeoutRef.current);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <nav className="fixed top-0 w-full z-50 px-3 max-[393px]:px-3 min-[394px]:max-[430px]:px-4 min-[768px]:max-[1024px]:px-8 md:px-12 py-3.5 min-[768px]:max-[1024px]:py-4 md:py-5 flex justify-between items-center bg-[#050505]/60 backdrop-blur-xl border-b border-white/[0.05] gap-2.5 min-[768px]:max-[1024px]:gap-4 md:gap-6">
      <a href="/" className="interactive-node group flex flex-col leading-none">
        <span className="font-semibold tracking-tight text-[15px] min-[394px]:max-[430px]:text-[16px] min-[768px]:max-[1024px]:text-[18px] md:text-xl text-[#F5F5F7] group-hover:opacity-90 transition-opacity duration-300">曾品翰</span>
        <span className="mt-1 text-[10px] tracking-[0.18em] uppercase text-[#8F9098] group-hover:text-[#C9CAD1] transition-colors duration-300">Pin-Han Tseng</span>
      </a>
      <div className="flex items-center rounded-full border border-white/10 bg-white/[0.02] backdrop-blur-2xl px-1 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] max-w-[calc(100vw-5.8rem)] min-[394px]:max-[430px]:max-w-[calc(100vw-6.2rem)] min-[768px]:max-[1024px]:max-w-[calc(100vw-10rem)] md:max-w-[calc(100vw-7.5rem)] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <a href="/about" className="interactive-node group flex flex-col items-center justify-center px-2 max-[393px]:px-2 min-[394px]:max-[430px]:px-2.5 min-[768px]:max-[1024px]:px-3 py-1.5 rounded-full text-[#B7B8C0] hover:text-white hover:bg-white/[0.06] transition-all duration-300 shrink-0">
          <span className="text-[10px] min-[394px]:max-[430px]:text-[11px] md:text-[12px] font-medium tracking-tight leading-none">關於</span>
          <span className="mt-0.5 text-[10px] tracking-[0.14em] uppercase text-[#8E909A] group-hover:text-[#D1D2D9] transition-colors duration-300 leading-none">About</span>
        </a>

        {/* Writing dropdown */}
        <div
          ref={dropdownRef}
          className="relative"
          onMouseEnter={() => openMenu()}
          onMouseLeave={closeMenu}
        >
          <div className={`flex items-stretch rounded-full transition-all duration-300 ${writingOpen ? 'bg-white/[0.06]' : 'hover:bg-white/[0.06]'}`}>
            <a
              href="/writing"
              onClick={closeMenuImmediately}
              className="interactive-node group flex flex-col items-center justify-center pl-2 pr-1 max-[393px]:pl-2 max-[393px]:pr-1 min-[394px]:max-[430px]:pl-2.5 min-[394px]:max-[430px]:pr-1.5 min-[768px]:max-[1024px]:pl-3 min-[768px]:max-[1024px]:pr-1.5 py-1.5 rounded-l-full text-[#B7B8C0] hover:text-white transition-all duration-300 shrink-0"
            >
              <span className="text-[10px] min-[394px]:max-[430px]:text-[11px] md:text-[12px] font-medium tracking-tight leading-none">文字</span>
              <span className="mt-0.5 text-[10px] tracking-[0.14em] uppercase text-[#8E909A] group-hover:text-[#D1D2D9] transition-colors duration-300 leading-none">Writing</span>
            </a>
            <button
              type="button"
              id={menuButtonId}
              ref={menuButtonRef}
              aria-haspopup="menu"
              aria-expanded={writingOpen}
              aria-controls={menuId}
              aria-label="Open writing menu"
              onClick={toggleMenu}
              onKeyDown={handleMenuButtonKeyDown}
              className="interactive-node flex items-center justify-center pl-1 pr-2 max-[393px]:pr-2 min-[394px]:max-[430px]:pr-2.5 min-[768px]:max-[1024px]:pr-3 rounded-r-full text-[#8E909A] hover:text-white transition-colors duration-300 shrink-0"
            >
              <ChevronDown size={14} className={`transition-transform duration-300 ${writingOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {writingOpen && (
            <div
              id={menuId}
              className="absolute right-0 top-full mt-2 w-40 min-[394px]:max-[430px]:w-44 rounded-xl border border-white/10 bg-[#111113]/95 backdrop-blur-2xl shadow-[0_16px_48px_rgba(0,0,0,0.5)] py-1.5 z-50"
              role="menu"
              aria-labelledby={menuButtonId}
              onKeyDown={handleMenuKeyDown}
            >
              {WRITING_MENU_ITEMS.map((item, index) => (
                <React.Fragment key={item.href}>
                  {item.separatorBefore && <div className="my-1 mx-3 h-px bg-white/[0.06]" role="separator" aria-orientation="horizontal" />}
                  <a
                    ref={(el) => { menuItemRefs.current[index] = el; }}
                    href={item.href}
                    role="menuitem"
                    tabIndex={writingOpen ? 0 : -1}
                    onClick={closeMenuImmediately}
                    className={item.compact
                      ? 'flex items-center justify-between px-4 py-2 hover:bg-white/[0.06] transition-colors duration-200 rounded-lg mx-1'
                      : 'flex flex-col px-4 py-2.5 hover:bg-white/[0.06] transition-colors duration-200 rounded-lg mx-1'}
                  >
                    {item.compact ? (
                      <>
                        <span className="text-[11px] text-[#8B8C96]">{item.label}</span>
                        <span className="text-[10px] text-[#6D6E78]" aria-hidden="true">{item.sublabel}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-[12px] font-medium text-[#E0E0E5]">{item.label}</span>
                        <span className="text-[10px] text-[#6D6E78] mt-0.5">{item.sublabel}</span>
                      </>
                    )}
                  </a>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        <a href="/works/the-melting-time" className="interactive-node group flex flex-col items-center justify-center px-2 max-[393px]:px-2 min-[394px]:max-[430px]:px-2.5 min-[768px]:max-[1024px]:px-3 py-1.5 rounded-full text-[#B7B8C0] hover:text-white hover:bg-white/[0.06] transition-all duration-300 shrink-0">
          <span className="text-[10px] min-[394px]:max-[430px]:text-[11px] md:text-[12px] font-medium tracking-tight leading-none">作品</span>
          <span className="mt-0.5 text-[10px] tracking-[0.14em] uppercase text-[#8E909A] group-hover:text-[#D1D2D9] transition-colors duration-300 leading-none">Works</span>
        </a>
      </div>
    </nav>
  );
};
