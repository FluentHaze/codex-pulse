/** Scroll-linked presentation. Native scrolling and static content work without this enhancement. */
const story = document.querySelector<HTMLElement>('[data-scroll-story]');
const chart = document.querySelector<HTMLElement>('.pulse-chart-panel');
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const desktopQuery = matchMedia('(min-width: 768px) and (min-height: 650px)');
const steps = Array.from(document.querySelectorAll<HTMLElement>('[data-story-step]'));
const dots = Array.from(document.querySelectorAll<HTMLElement>('.pulse-story-position i'));
const clamp = (value: number) => Math.min(1, Math.max(0, value));
let frame = 0;
let storyTop = 0;
let storyTravel = 1;
let activeStep = -1;
let chartTop = 0;

function measure() {
  if (story) {
    storyTop = story.getBoundingClientRect().top + window.scrollY - 66;
    const sticky = story.querySelector<HTMLElement>('.pulse-story-sticky');
    storyTravel = Math.max(1, story.offsetHeight - (sticky?.offsetHeight ?? innerHeight));
  }
  if (chart) chartTop = chart.getBoundingClientRect().top + window.scrollY;
  schedule();
}

function paint() {
  frame = 0;
  if (motionQuery.matches) return;
  const scroll = window.scrollY;
  if (chart) {
    const reveal = clamp((scroll + innerHeight - chartTop) / (innerHeight * 0.65));
    chart.style.setProperty('--chart-reveal', String(0.45 + reveal * 0.55));
  }
  if (!story?.classList.contains('is-scroll-enabled')) return;
  const progress = clamp((scroll - storyTop) / storyTravel);
  story.style.setProperty('--story-progress', progress.toFixed(4));
  const token = clamp((progress - 0.22) / 0.25);
  const notice = clamp((progress - 0.61) / 0.23);
  story.style.setProperty('--token-opacity', token.toFixed(4));
  story.style.setProperty('--token-y', (70 * (1 - token)).toFixed(2) + 'px');
  story.style.setProperty('--notice-opacity', notice.toFixed(4));
  story.style.setProperty('--notice-y', (35 * (1 - notice)).toFixed(2) + 'px');
  steps.forEach((step, index) => {
    const distance = Math.abs(progress * 2.6 - 0.3 - index);
    const opacity = 1 - clamp((distance - 0.28) / 0.22);
    step.style.setProperty('--step-opacity', opacity.toFixed(4));
    step.style.setProperty('--step-y', ((index - progress * 2.6 + 0.3) * 22).toFixed(2) + 'px');
  });
  const nextStep = Math.min(2, Math.max(0, Math.round(progress * 2.6 - 0.3)));
  if (nextStep !== activeStep) {
    activeStep = nextStep;
    dots.forEach((dot, index) => dot.classList.toggle('is-active', index === activeStep));
  }
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(paint);
}

function configure() {
  const enabled = !motionQuery.matches && desktopQuery.matches;
  story?.classList.toggle('is-scroll-enabled', enabled);
  if (!enabled) {
    chart?.removeAttribute('style');
    steps.forEach((step) => step.removeAttribute('style'));
  }
  measure();
}

window.addEventListener('scroll', schedule, { passive: true });
window.addEventListener('resize', measure, { passive: true });
motionQuery.addEventListener('change', configure);
desktopQuery.addEventListener('change', configure);
// Fonts and responsive demo layouts can change the chapter's position after first paint.
const observer = new ResizeObserver(measure);
observer.observe(document.body);
configure();
window.addEventListener('pageshow', measure);
