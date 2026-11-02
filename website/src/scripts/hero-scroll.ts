/** A native-scroll laptop hinge followed by four stable product chapters. */
const track = document.querySelector<HTMLElement>('[data-hero-scroll]');
const hero = track?.querySelector<HTMLElement>('.pulse-hero');
const workspace = track?.querySelector<HTMLElement>('[data-demo-workspace]');
const device = track?.querySelector<HTMLElement>('[data-scroll-device]');
const copy = track?.querySelector<HTMLElement>('.pulse-hero-copy');
let zoomScale = 1;
let zoomX = 0;
let zoomY = 0;
let closedLidAngle = -125;
const cue = track?.querySelector<HTMLElement>('[data-hero-scroll-label]');
const dots = Array.from(track?.querySelectorAll<HTMLElement>('.hero-scroll-cues i') ?? []);
const order = ['overview', 'resets', 'today', 'tokens'] as const;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const tall = matchMedia('(min-height: 640px)');
const intro = cue?.textContent ?? '';
let start = 0;
let distance = 1;
let raf = 0;
let selected = -1;
let previousScroll = -1;
const clamp = (value: number) => Math.min(1, Math.max(0, value));

function paintHero() {
  raf = 0;
  if (!track?.classList.contains('hero-scroll-active') || !hero) return;
  const scroll = window.scrollY;
  const progress = clamp((scroll - start) / distance);
  const desktop = innerWidth > 1100;
  const rotationEnd = desktop ? 0.12 : 0.16;
  const openingStart = rotationEnd + 0.06;
  const openingEnd = desktop ? 0.42 : 0.56;
  const chaptersStart = openingEnd + 0.08;
  const approachStart = desktop ? 0.33 : 0.43;
  // Complete the closed-lid horizontal turn before the hinge starts moving.
  const facingViewer = progress >= rotationEnd;
  const phase = !facingViewer ? 'turning' : progress <= openingStart ? 'front' : 'opening';
  if (hero.dataset.hardwarePhase !== phase) hero.dataset.hardwarePhase = phase;
  const opening = facingViewer ? clamp((progress - openingStart) / (openingEnd - openingStart)) : 0;
  const power = clamp((progress - openingEnd) / 0.08);
  const approach = clamp((progress - approachStart) / (chaptersStart - approachStart));
  const zoom = approach * approach * (3 - 2 * approach);
  hero.style.setProperty('--hero-zoom-scale', String(1 + (zoomScale - 1) * zoom));
  hero.style.setProperty('--hero-zoom-x', zoomX * zoom + 'px');
  hero.style.setProperty('--hero-zoom-y', zoomY * zoom + 'px');
  hero.style.setProperty('--hero-copy-opacity', String(1 - clamp(approach / 0.6)));
  if (copy) copy.inert = approach > 0.6;
  const eased = opening * opening * (3 - 2 * opening);
  // The lid opens by 105 degrees relative to the stationary deck.
  const lidAngle = closedLidAngle + 105 * eased;
  hero.style.setProperty('--lid-angle', lidAngle.toFixed(3) + 'deg');
  hero.style.setProperty('--lid-content-opacity', String(power));
  hero.style.setProperty('--lid-shell-opacity', lidAngle < -90 ? '1' : '0');
  hero.style.setProperty('--lid-rim-color', lidAngle < -90 ? '#a9b1bb' : '#191a1d');
  hero.style.setProperty('--screen-off-opacity', String(1 - power));
  const turning = clamp(progress / rotationEnd);
  const turnEase = turning * turning * (3 - 2 * turning);
  // Start oblique, finish the horizontal turn, then open the lid while facing the viewer.
  const sideAngle = desktop ? -32 : -24;
  const yaw = facingViewer ? 0 : sideAngle * (1 - turnEase);
  hero.style.setProperty('--device-yaw', yaw.toFixed(3) + 'deg');
  const chapter = clamp((progress - chaptersStart) / (1 - chaptersStart)) * 4;
  const from = Math.min(3, Math.floor(chapter));
  const to = Math.min(3, from + 1);
  const transition = from === 3 ? 0 : clamp((chapter - from - 0.68) / 0.32);
  const mix = transition * transition * (3 - 2 * transition);
  const stage = mix >= 0.5 ? to : from;
  hero.style.setProperty('--device-reveal', String(eased));
  if (scroll >= start && scroll <= start + distance && scroll !== previousScroll) {
    workspace?.dispatchEvent(
      new CustomEvent('pulse:demo-morph', {
        detail: { from: order[from], to: order[to], mix },
        bubbles: true,
      }),
    );
    if (selected !== stage) {
      selected = stage;
      dots.forEach((dot, index) => dot.classList.toggle('is-active', index === stage));
    }
  }
  if (cue) {
    const label = track.querySelector<HTMLElement>('[data-demo-tab="' + order[stage] + '"]');
    cue.textContent = power < 1 ? intro : (label?.textContent?.trim() ?? intro);
  }
  previousScroll = scroll;
}
function scheduleHero() {
  if (!raf) raf = requestAnimationFrame(paintHero);
}
function measureHero() {
  if (!track || !hero) return;
  const offset = parseFloat(getComputedStyle(hero).top) || 0;
  start = track.getBoundingClientRect().top + scrollY - offset;
  distance = Math.max(1, track.offsetHeight - hero.offsetHeight);
  if (device) {
    const scene = device.querySelector<HTMLElement>('.product-scene');
    if (scene)
      closedLidAngle =
        Number(getComputedStyle(scene).getPropertyValue('--lid-closed-angle')) || -125;
    // Layout dimensions stay unchanged while transforms bring the hardware into focus.
    const availableWidth = hero.clientWidth - (innerWidth > 1100 ? 96 : 24);
    const availableHeight = hero.clientHeight - 185;
    zoomScale = Math.max(
      1,
      Math.min(availableWidth / device.offsetWidth, availableHeight / device.offsetHeight, 1.85),
    );
    zoomX = hero.clientWidth / 2 - (device.offsetLeft + device.offsetWidth / 2);
    zoomY = (hero.clientHeight - 10) / 2 - (device.offsetTop + device.offsetHeight / 2);
  }
  scheduleHero();
}
function configureHero() {
  const enabled = !reduced.matches && tall.matches;
  track?.classList.toggle('hero-scroll-active', enabled);
  if (!enabled) {
    if (copy) copy.inert = false;
    if (hero) delete hero.dataset.hardwarePhase;
    ['--hero-zoom-scale', '--hero-zoom-x', '--hero-zoom-y', '--hero-copy-opacity'].forEach(
      (property) => hero?.style.removeProperty(property),
    );
    hero?.style.removeProperty('--lid-visibility');
    hero?.style.removeProperty('--lid-angle');
    hero?.style.removeProperty('--lid-content-opacity');
    hero?.style.removeProperty('--device-reveal');
    hero?.style.removeProperty('--lid-shell-opacity');
    hero?.style.removeProperty('--lid-rim-color');
    hero?.style.removeProperty('--screen-off-opacity');
    hero?.style.removeProperty('--device-yaw');
    workspace?.dispatchEvent(new CustomEvent('pulse:demo-morph-reset', { bubbles: true }));
    if (cue) cue.textContent = intro;
  }
  selected = -1;
  previousScroll = -1;
  measureHero();
}
window.addEventListener('scroll', scheduleHero, { passive: true });
window.addEventListener('resize', measureHero, { passive: true });
window.addEventListener('pageshow', measureHero);
reduced.addEventListener('change', configureHero);
tall.addEventListener('change', configureHero);
if (track) {
  const resize = new ResizeObserver(measureHero);
  resize.observe(track);
}
configureHero();
export {};
