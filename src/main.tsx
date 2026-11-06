// One page, two sites: Converge for any address with "converge" in it (converge.sunstone.in,
// sunstone-converge.vercel.app, converge.localhost), Vertex otherwise. Hosts serve this same
// page for every address, so the app is chosen here; the server does the same for the data
// (api/_app.ts). index.html has already set Converge's title, icon and colours before paint.

if (/converge/i.test(window.location.hostname)) {
  void import('./converge/main');
} else {
  void import('./vertex');
}
