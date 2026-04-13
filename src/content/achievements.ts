/**
 * Achievement / Honor data.
 *
 * Extracted from AchievementTimeline.tsx so that content (titles,
 * years, texture URLs, artifact configs) can be maintained separately
 * from the 800+ line animation component.
 */
import type { HonorArtifactConfig } from '@/components/webgl/HonorArtifactPreview';

export interface Achievement {
  titleZh: string;
  titleZhLines: {
    base: string[];
    lg?: string[];
  };
  titleEn: string;
  titleEnLines: {
    base: string[];
    lg?: string[];
  };
  year: number;
  artifact: HonorArtifactConfig;
}

const GALLERY_WARM_LIGHT = '#ffefcc';

export const achievements: Achievement[] = [
  {
    titleZh: '國立中山大學電機工程學系書香獎',
    titleZhLines: {
      base: ['國立中山大學', '電機工程學系', '書香獎'],
      lg: ['國立中山大學', '電機工程學系書香獎'],
    },
    titleEn: 'National Sun Yat-sen University Department of Electrical Engineering Certificate of Excellent Student Award',
    titleEnLines: {
      base: ['National Sun Yat-sen University', 'Department of Electrical', 'Engineering', 'Certificate of Excellent', 'Student Award'],
      lg: ['National Sun Yat-sen University', 'Department of Electrical Engineering', 'Certificate of Excellent Student Award'],
    },
    year: 2022,
    artifact: {
      recipe: 'book-award' as const,
      frontTextureUrl: 'https://res.cloudinary.com/dt8x2v9id/image/upload/v1775571555/Screenshot_2026-04-07_at_9.58.49_PM_l4lej2.png',
      backTextureUrl: 'https://res.cloudinary.com/dt8x2v9id/image/upload/v1775611329/IMG_0118_yw68jf.jpg',
      orientation: 'landscape' as const,
      accentColor: '#1e3a8a',
      lightColor: GALLERY_WARM_LIGHT,
      initialFace: 'front' as const,
      emissiveIntensity: 0.12,
      floatingAmplitude: 0.05,
      cameraDistance: 4.5,
      scale: 1,
      baseRotationX: 0.05,
      baseRotationY: -0.15,
      staticImageAlt: '國立中山大學書香獎獎狀 3D 預覽',
    },
  },
  {
    titleZh: '國立中山大學慢跑社社長',
    titleZhLines: {
      base: ['國立中山大學', '慢跑社社長'],
      lg: ['國立中山大學', '慢跑社社長'],
    },
    titleEn: 'National Sun Yat-sen University Jogging Club President',
    titleEnLines: {
      base: ['National Sun Yat-sen University', 'Jogging Club', 'President'],
      lg: ['National Sun Yat-sen University', 'Jogging Club President'],
    },
    year: 2024,
    artifact: {
      recipe: 'jogging-president' as const,
      frontTextureUrl: 'https://res.cloudinary.com/dt8x2v9id/image/upload/v1775608844/Screenshot_2026-04-08_at_8.40.08_AM_bvkamu.png',
      backTextureUrl: 'https://res.cloudinary.com/dt8x2v9id/image/upload/v1775611329/IMG_0118_yw68jf.jpg',
      orientation: 'landscape' as const,
      accentColor: '#1e3a8a',
      lightColor: GALLERY_WARM_LIGHT,
      initialFace: 'front' as const,
      emissiveIntensity: 0.12,
      floatingAmplitude: 0.05,
      cameraDistance: 4.5,
      scale: 1,
      baseRotationX: 0.05,
      baseRotationY: 0.15,
      staticImageAlt: '慢跑社長幹部證明 3D 預覽',
    },
  },
  {
    titleZh: '中華民國微電影協會青春有影大學盃金獎',
    titleZhLines: {
      base: ['中華民國微電影協會', '青春有影大學盃金獎'],
      lg: ['中華民國微電影協會', '青春有影大學盃金獎'],
    },
    titleEn: 'Gold Award (University Category), 11th Youth Film Awards 2025, Micro Movie Association',
    titleEnLines: {
      base: ['Gold Award', '(University Category),', '11th Youth Film Awards 2025,', 'Micro Movie Association'],
      lg: ['Gold Award (University Category),', '11th Youth Film Awards 2025,', 'Micro Movie Association'],
    },
    year: 2025,
    artifact: {
      recipe: 'micro-movie-gold' as const,
      frontTextureUrl: 'https://res.cloudinary.com/dt8x2v9id/image/upload/v1775610744/Screenshot_2026-04-08_at_9.11.41_AM_y7e2pj.png',
      backTextureUrl: 'https://res.cloudinary.com/dt8x2v9id/image/upload/v1775813157/1e14ff7bc43648f3883fef68fa41d48f_kotbrq.jpg',
      orientation: 'portrait' as const,
      accentColor: '#78350f',
      lightColor: GALLERY_WARM_LIGHT,
      initialFace: 'front' as const,
      emissiveIntensity: 0.12,
      floatingAmplitude: 0.05,
      cameraDistance: 5.2,
      scale: 1,
      baseRotationX: 0.05,
      baseRotationY: -0.15,
      staticImageAlt: '青春有影 2025 大學盃金獎獎狀 3D 預覽',
    },
  },
  {
    titleZh: '教育部 × Fulbright「EMI免試計畫」',
    titleZhLines: {
      base: ['教育部 × Fulbright', '「EMI免試計畫」'],
      lg: ['教育部 × Fulbright', '「EMI免試計畫」'],
    },
    titleEn: 'Ministry of Education × Fulbright EMI Test-Waiver Program',
    titleEnLines: {
      base: ['Ministry of Education × Fulbright', 'EMI Test-Waiver Program'],
      lg: ['Ministry of Education × Fulbright', 'EMI Test-Waiver Program'],
    },
    year: 2026,
    artifact: {
      recipe: 'fulbright-emi' as const,
      frontTextureUrl: 'https://res.cloudinary.com/dt8x2v9id/image/upload/v1775609809/Screenshot_2026-04-08_at_8.56.25_AM_v2skd8.png',
      orientation: 'landscape' as const,
      accentColor: '#7f1d1d',
      lightColor: GALLERY_WARM_LIGHT,
      initialFace: 'front' as const,
      emissiveIntensity: 0.12,
      floatingAmplitude: 0.05,
      cameraDistance: 4.5,
      scale: 1,
      baseRotationX: 0.05,
      baseRotationY: -0.15,
      staticImageAlt: 'Fulbright EMI 計畫證書 3D 預覽',
    },
  },
].sort((a, b) => a.year - b.year);
