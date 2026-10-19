// Retain old bookmarks and the original browser-local progress.
const next = new URL('./circuit.html', location.href);
next.search = location.search;
next.searchParams.set('v', '6');
next.hash = location.hash;
location.replace(next.href);
