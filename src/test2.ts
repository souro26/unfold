const sidebarToggle = document.getElementById('sidebarToggle')!;
const sidebar = document.getElementById('sidebar')!;
const sidebarOverlay = document.getElementById('sidebarOverlay')!;

sidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
  sidebarOverlay.classList.toggle('visible', window.innerWidth <= 1000 && !sidebar.classList.contains('collapsed'));
});