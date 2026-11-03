/** Keep the desktop demo's proportions on small screens instead of shrinking each child differently. */
const scene = document.querySelector<HTMLElement>('#product-demo');
const display = scene?.querySelector<HTMLElement>('.laptop-display');
if (scene && display) {
  const fit = () => {
    // Deck and lid share a physical ratio; projected depth also sets the hinge clearance.
    const deckAngle = 55;
    const deckDepth = display.offsetHeight;
    const projectedDepth = deckDepth * Math.cos((deckAngle * Math.PI) / 180);
    scene.style.setProperty('--keyboard-angle', deckAngle + 'deg');
    scene.style.setProperty('--hinge-y', display.offsetHeight + 'px');
    scene.style.setProperty('--lid-closed-angle', String(deckAngle - 180));
    scene.style.setProperty('--keyboard-depth', deckDepth + 'px');
    scene.style.setProperty('--keyboard-lip', projectedDepth + 'px');
    const fitted = Math.min(
      (display.clientWidth * 0.9) / 900,
      Math.max(1, display.clientHeight - 35) / 600,
    );
    scene.style.setProperty('--demo-fit-scale', String(fitted));
    scene.style.setProperty('--demo-mobile-scale', String((display.clientWidth * 0.9) / 900));
    scene.style.setProperty('--mobile-scene-height', display.offsetHeight + 55 + 'px');
  };
  const sizeObserver = new ResizeObserver(fit);
  sizeObserver.observe(display);
  fit();
}
