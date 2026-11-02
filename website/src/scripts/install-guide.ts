/** Desktop guide enhances the complete static instructions; mobile keeps all steps readable. */
const guide = document.querySelector<HTMLElement>('[data-install-guide]');
const guideQuery = matchMedia('(min-width: 900px)');
const cards = Array.from(guide?.querySelectorAll<HTMLElement>('[data-install-step]') ?? []);
let selected = cards[0]?.dataset.installStep;
function updateGuide() {
  const enhanced = guideQuery.matches;
  guide?.classList.toggle('is-interactive', enhanced);
  cards.forEach((card) => {
    const active = card.dataset.installStep === selected;
    card.classList.toggle('is-selected', active);
    const button = card.querySelector<HTMLButtonElement>('[data-install-select]');
    button?.setAttribute('aria-expanded', String(!enhanced || active));
    const art = card.querySelector<HTMLElement>('.step-art');
    if (art) art.hidden = enhanced && !active;
  });
}
cards.forEach((card) =>
  card.querySelector('[data-install-select]')?.addEventListener('click', () => {
    selected = card.dataset.installStep;
    updateGuide();
  }),
);
guideQuery.addEventListener('change', updateGuide);
updateGuide();
