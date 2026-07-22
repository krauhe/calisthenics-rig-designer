// Foruddefinerede "forslag"-rigs man kan starte fra. Hver bygger en komplet,
// gyldig tegning oven på defaultDesign() (erstatter posts/connections/attachments).

function presetList() {
  return [
    { id: 'pullup2', nameKey: 'preset.pullup2' },
    { id: 'square4', nameKey: 'preset.square4' },
    { id: 'long6', nameKey: 'preset.long6' },
  ];
}

function buildPreset(id) {
  const d = defaultDesign();
  const pipe = { source: 'library', id: 'pipe-1' };
  const pipeBig = { source: 'library', id: 'pipe-1-4' };
  const wood10 = { source: 'library', id: 'wood-10' };
  const post = (pid, x, z, height = 2.5, depth = 1.0) => ({ id: pid, x_m: x, z_m: z, height_m: height, depth_m: depth, hole_mm: 200, override: null });
  const conn = (cid, a, b, h, mat) => ({ id: cid, a, b, height_m: h, material: mat || pipe, onTop: false });
  const avatar = (x, z) => ({ id: 'av1', type: 'avatar', x_m: x, z_m: z, height_m: 1.8 });
  const ladder = (postId) => ({ id: 'la1', type: 'ladder', postId, width_m: 0.5, angle_rad: 0 });

  if (id === 'pullup2') {
    // Simpelt pull-up-stativ: to stolper + én overligger.
    d.posts = [post('p1', 0, 0), post('p2', 1.6, 0)];
    d.connections = [conn('c1', 'p1', 'p2', 2.4)];
    d.attachments = [avatar(0.8, 0.6)];
  } else if (id === 'square4') {
    // Firkant-rig fra eksempelfilen "Firkant-rig 4 stolper.json".
    d.posts = [post('p1', 0, 0), post('p2', 2.1, 0), post('p3', 2.1, 1.6), post('p4', 0, 1.6)];
    d.posts.forEach(p => { p.height_m = 3.0; });
    d.connections = [
      conn('c1', 'p1', 'p2', 2.7),
      conn('c2', 'p2', 'p3', 1.8),
      conn('c3', 'p4', 'p3', 3.0, wood10),
      conn('c4', 'p1', 'p4', 1.3),
    ];
    d.attachments = [ladder('p1'), avatar(1.2, 0.8)];
  } else if (id === 'long6') {
    // Eksporten "Long rig monkey bars 6 posts.json": seks stolper i hovedrammen
    // plus fire ekstra stolper til de lavere sidebarer.
    d.posts = [
      post('p1', 0, 0), post('p2', 2.0, 0), post('p3', 4.0, 0),
      post('p4', 0, 0.8), post('p5', 2.0, 0.8), post('p6', 4.0, 0.8),
      post('p7', 3.25, 0, 2.5, 1.2),
      post('p8', 3.25, -1.25, 1.3, 1.2),
      post('p9', 4.0, -1.25, 1.3, 1.2),
      post('p10', 2.0, -1.25, 2.5, 1.2),
    ];
    d.connections = [
      conn('c1', 'p1', 'p2', 2.4, pipeBig), conn('c2', 'p2', 'p3', 2.4, pipeBig),
      conn('c3', 'p4', 'p5', 2.4, pipeBig), conn('c4', 'p5', 'p6', 2.4, pipeBig),
      conn('c5', 'p7', 'p8', 1.3),
      conn('c6', 'p3', 'p9', 1.3),
      conn('c7', 'p10', 'p2', 2.4),
    ];
    d.attachments = [
      { id: 'mb1', type: 'monkey', connA: 'c1', connB: 'c3', spacing_m: 0.33 },
      { id: 'mb2', type: 'monkey', connA: 'c2', connB: 'c4', spacing_m: 0.33 },
      ladder('p1'), avatar(2.75, -0.75),
    ];
  }
  return d;
}
