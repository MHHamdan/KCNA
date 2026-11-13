// Applies the saved theme before first paint (external file so the CSP can forbid inline scripts).
try {
  var t = JSON.parse(localStorage.getItem('kcna-progress-v1') || '{}').prefs;
  var theme = t && t.theme;
  var dark = theme === 'dark' || ((!theme || theme === 'system') && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
} catch {
  // storage unavailable: keep the default theme
}
