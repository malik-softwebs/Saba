document.body.addEventListener("click", e => {
  const ripple = document.createElement("div");
  ripple.style.cssText = `
    position: fixed;
    left: ${e.clientX - 250}px;
    top: ${e.clientY - 250}px;
    width: 500px;
    height: 500px;
    background: radial-gradient(circle, rgba(173,216,230,0.15) 0%, transparent 80%);
    border-radius: 50%;
    pointer-events: none;
    transform: scale(0);
    animation: ripple-global 0.6s ease-out forwards;
    z-index: 9999;    
  `;
  document.body.appendChild(ripple);
  setTimeout(() => ripple.remove(), 700);
});

document.head.appendChild(Object.assign(document.createElement("style"), {
  innerHTML: `
    @keyframes ripple-global {
      to {
        transform: scale(1);
        opacity: 0;
      }
    }
  `
}));

window.onload = () => document.querySelector('input, textarea')?.focus();
document.head.innerHTML += `<style>::selection{background:#ffd240;color:#000}</style>`;
if (window.matchMedia('(prefers-color-scheme: dark)').matches) document.body.classList.add('dark-mode');
