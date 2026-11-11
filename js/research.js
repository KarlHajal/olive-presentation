;(() => {
  const NS = 'http://www.w3.org/2000/svg'
  const q = (s, sel) => s.querySelector(sel)
  function el(tag, attrs = {}, parent = null, text = null) {
    const e = document.createElementNS(NS, tag)
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
    if (text !== null) e.textContent = text
    if (parent) parent.appendChild(e)
    return e
  }
  const lin = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0)

  // Tooltip inside a positioned host; converts screen pixels back to stage pixels.
  function tooltip(host) {
    const tip = document.createElement('div')
    tip.className = 'tooltip'
    host.appendChild(tip)
    return {
      show(evt, html) {
        const r = host.getBoundingClientRect()
        const k = r.width / host.offsetWidth
        tip.innerHTML = html
        tip.style.left = `${(evt.clientX - r.left) / k + 16}px`
        tip.style.top = `${(evt.clientY - r.top) / k - 44}px`
        tip.classList.add('show')
      },
      hide() {
        tip.classList.remove('show')
      },
    }
  }

  const C = {
    base: 'var(--s-base)',
    d2v2: 'var(--s-d2v2)',
    a: 'var(--s-a)',
    jmask: 'var(--s-jmask)',
    jmix: 'var(--s-jmix)',
  }

  // ---------------- reconstruction dot plot ----------------
  const RECON = [
    { m: 'Mel spectrogram', c: C.base, v: [1.42, 0.677, 14.4, 0.565] },
    { m: 'wav2vec 2.0', c: C.base, v: [2.19, 0.474, 11.6, 0.645] },
    { m: 'HuBERT', c: C.base, v: [2.11, 0.475, 13.3, 0.668] },
    { m: 'WavLM', c: C.base, v: [2.21, 0.470, 13.1, 0.670] },
    { m: 'data2vec', c: C.base, v: [2.10, 0.467, 12.8, 0.664] },
    { m: 'data2vec 2.0', c: C.d2v2, v: [2.21, 0.434, 13.0, 0.676] },
    { m: 'OLIVE-A (Mix+Gain)', c: C.a, v: [2.62, 0.446, 11.6, 0.696], shape: 'diamond' },
    { m: 'OLIVE-J (Mask-only)', c: C.jmask, v: [2.81, 0.410, 10.8, 0.709] },
    { m: 'OLIVE-J (Mix)', c: C.jmix, v: [3.06, 0.421, 9.6, 0.736] },
    { m: 'OLIVE-J (Mask-only), integrated vocoder', c: C.jmask, v: [2.56, 0.476, 11.1, 0.693], ring: true },
    { m: 'OLIVE-J (Mix), integrated vocoder', c: C.jmix, v: [2.88, 0.579, 10.0, 0.722], ring: true },
  ]
  const METRICS = [
    { k: 'Quality (PESQ)', d: [1.2, 3.3], ticks: [1.5, 2, 2.5, 3], f: (v) => v.toFixed(2) },
    { k: 'Spectral fidelity (Mel-L1)', d: [0.4, 0.7], ticks: [0.4, 0.5, 0.6, 0.7], f: (v) => v.toFixed(3), lower: true },
    { k: 'Pitch estimation (F₀ MAE, Hz)', d: [9, 15], ticks: [9, 11, 13, 15], f: (v) => v.toFixed(1), lower: true },
    { k: 'Speaker similarity (SECS)', d: [0.55, 0.75], ticks: [0.6, 0.65, 0.7, 0.75], f: (v) => v.toFixed(3) },
  ]
  Deck.register('recon', {
    init(s) {
      this.host = q(s, '.chart')
      this.tip = tooltip(this.host)
      this.metric = 0
      const W = 1380
      const rowH = 38
      const top = 30
      const left = 430
      const right = W - 40
      const svg = el('svg', { viewBox: `0 0 ${W} ${top + RECON.length * rowH + 100}`, width: '100%' }, this.host)
      this.svg = svg
      this.geo = { left, right, top, rowH }
      this.grid = el('g', {}, svg)
      this.refLine = el('g', {}, svg)
      this.rows = RECON.map((r, i) => {
        const y = top + i * rowH + rowH / 2 + (i >= 6 ? 14 : 0) + (i >= 9 ? 14 : 0)
        const g = el('g', { class: 'drow' }, svg)
        el('line', { x1: left, x2: right, y1: y, y2: y, stroke: 'var(--line)', 'stroke-width': 1 }, g)
        el('text', { x: left - 20, y: y + 7, 'text-anchor': 'end', class: 'rowlab' + (r.c === C.base ? ' faint' : '') }, g, r.m)
        const dot =
          r.shape === 'diamond'
            ? el('rect', { x: -10, y: -10, width: 20, height: 20, transform: 'rotate(45)', fill: r.c, stroke: 'var(--surface)', 'stroke-width': 2 })
            : el('circle', {
                r: r.ring ? 9 : 11,
                fill: r.ring ? 'var(--surface)' : r.c,
                stroke: r.ring ? r.c : 'var(--surface)',
                'stroke-width': r.ring ? 4 : 2,
              })
        const dg = el('g', { class: 'dot', style: `transform: translate(${left}px, ${y}px)` }, g)
        dg.appendChild(dot)
        el('circle', { r: 22, fill: 'transparent' }, dg)
        dg.addEventListener('pointermove', (e) =>
          this.tip.show(e, `<b>${r.m}</b><br>${METRICS[this.metric].k}: ${METRICS[this.metric].f(r.v[this.metric])}`),
        )
        dg.addEventListener('pointerleave', () => this.tip.hide())
        return { g, dg, y, r }
      })
      this.axisLab = el('text', { x: (left + right) / 2, y: top + RECON.length * rowH + 74, 'text-anchor': 'middle', class: 'axislab' }, svg)
      s.querySelectorAll('[data-metric] button').forEach((b) =>
        b.addEventListener('click', () => {
          Deck.go(Deck.index, +b.dataset.v)
        }),
      )
      this.draw()
    },
    draw() {
      const M = METRICS[this.metric]
      const { left, right, top, rowH } = this.geo
      const x = lin(M.d[0], M.d[1], left + 10, right - 10)
      const bottom = top + RECON.length * rowH + 30
      this.grid.innerHTML = ''
      M.ticks.forEach((t) => {
        el('line', { x1: x(t), x2: x(t), y1: top - 6, y2: bottom, stroke: 'var(--line)', 'stroke-width': 1 }, this.grid)
        el('text', { x: x(t), y: bottom + 22, 'text-anchor': 'middle', class: 'tick' }, this.grid, String(t))
      })
      this.refLine.innerHTML = ''
      const best = (M.lower ? Math.min : Math.max)(...RECON.slice(1, 6).map((r) => r.v[this.metric]))
      el('line', { x1: x(best), x2: x(best), y1: top - 6, y2: bottom, stroke: 'var(--s-d2v2)', 'stroke-width': 2, 'stroke-dasharray': '5 6', opacity: 0.7 }, this.refLine)
      el('text', { x: x(best) + 8, y: top + 2, class: 'tick' }, this.refLine, 'best SSL baseline')
      if (M.ref) {
        el('line', { x1: x(M.ref), x2: x(M.ref), y1: top - 6, y2: bottom, stroke: 'var(--ink)', 'stroke-width': 2, 'stroke-dasharray': '2 5' }, this.refLine)
        el('text', { x: x(M.ref) - 8, y: top + 2, 'text-anchor': 'end', class: 'tick' }, this.refLine, 'real speech')
      }
      this.axisLab.textContent = `${M.k}, ${M.lower ? '← lower is better' : 'higher is better →'}`
      this.rows.forEach(({ dg, y, r }) => (dg.style.transform = `translate(${x(r.v[this.metric])}px, ${y}px)`))
    },
    step(s, n) {
      this.metric = n
      this.tip.hide()
      s.querySelectorAll('[data-metric] button').forEach((b) => b.classList.toggle('on', +b.dataset.v === n))
      this.draw()
    },
  })

  // ---------------- individual SUPERB task comparisons ----------------
  // SID, ASR, ER, SS SI-SDR improvement, and WavLM_s from tables/superb.tex.
  const TASK_RESULTS = [
    { m: 'wav2vec 2.0', c: C.base, v: [66.5, 6.5, 62.5, 10.3, 65.5] },
    { m: 'HuBERT', c: C.base, v: [67.3, 6.4, 65.1, 9.9, 66.5] },
    { m: 'WavLM', c: C.base, v: [62.3, 6.2, 64.9, 10.8, 66.6] },
    { m: 'data2vec', c: C.base, v: [54.9, 5.0, 65.4, 9.9, 65.9] },
    { m: 'data2vec 2.0', c: C.d2v2, v: [45.5, 4.8, 63.9, 10.4, 65.3] },
    { m: 'OLIVE-A (Mix)', c: C.a, v: [66.9, 6.4, 67.1, 12.2, 66.7] },
    { m: 'OLIVE-J (Mask-only)', c: C.jmask, v: [64.6, 4.9, 66.9, 10.5, 66.8] },
    { m: 'OLIVE-J (Mix)', c: C.jmix, v: [83.1, 6.4, 64.6, 12.3, 67.6] },
  ]
  const TASK_METRICS = [
    { t: 'Speaker identification', k: 'Accuracy (%)', d: [40, 90], ticks: [40, 50, 60, 70, 80, 90], f: (v) => v.toFixed(1) },
    { t: 'Speech recognition', k: 'WER (%)', d: [4.5, 7], ticks: [4.5, 5, 5.5, 6, 6.5, 7], lower: true, f: (v) => v.toFixed(1) },
    { t: 'Emotion recognition', k: 'Accuracy (%)', d: [62, 69], ticks: [62, 64, 66, 68], f: (v) => v.toFixed(1) },
    { t: 'Speech separation', k: 'SI-SDR improvement (dB)', d: [9, 13], ticks: [9, 10, 11, 12, 13], f: (v) => v.toFixed(1) },
    { t: 'WavLMₛ aggregate', k: 'Score', d: [65, 68], ticks: [65, 66, 67, 68], f: (v) => v.toFixed(1) },
  ]
  Deck.register('slopes', {
    init(s) {
      this.host = q(s, '.chart')
      this.tip = tooltip(this.host)
      this.svg = el('svg', { viewBox: '0 0 1380 510', width: '100%' }, this.host)
      s.querySelectorAll('[data-task-pair] button').forEach((b) =>
        b.addEventListener('click', () => Deck.go(Deck.index, +b.dataset.v)),
      )
    },
    step(s, n) {
      this.tip.hide()
      this.svg.replaceChildren()
      s.querySelectorAll('[data-task-pair] button').forEach((b) => b.classList.toggle('on', +b.dataset.v === n))
      const defs = el('defs', {}, this.svg)
      const marker = el('marker', { id: 'ah-superb-change', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto' }, defs)
      el('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--ink-soft)' }, marker)
      const pairs = [[4, 6], [5, 7]]
      const metrics = [[0, 1], [2, 3], [4]][n]
      const single = metrics.length === 1
      metrics.forEach((k, panel) => {
        const M = TASK_METRICS[k]
        const x0 = single ? 50 : 30 + panel * 700
        const xa = single ? 660 : x0 + 310
        const xb = single ? 1120 : x0 + 540
        const gridLeft = single ? 110 : x0 + 55
        const gridRight = single ? 1310 : x0 + 620
        const titleX = single ? 690 : x0 + 335
        const otherX = single ? 300 : x0 + 127
        const dividerX = single ? 460 : x0 + 195
        const y = lin(M.d[0], M.d[1], 410, 105)
        const g = el('g', { class: 'task-panel', 'data-task': M.t, 'data-change': 'reconstruction' }, this.svg)
        el('text', { x: titleX, y: 30, 'text-anchor': 'middle', class: 'paneltitle' }, g, M.t)
        el('text', { x: titleX, y: 58, 'text-anchor': 'middle', class: 'tick' }, g, `${M.k} · ${M.lower ? 'lower is better' : 'higher is better'}`)
        M.ticks.forEach((t) => {
          el('line', { x1: gridLeft, x2: gridRight, y1: y(t), y2: y(t), stroke: 'var(--line)' }, g)
          el('text', { x: gridLeft - 12, y: y(t) + 6, 'text-anchor': 'end', class: 'tick' }, g, String(t))
        })
        el('line', { x1: dividerX, x2: dividerX, y1: 85, y2: 430, stroke: 'var(--line-strong)', 'stroke-dasharray': '3 5' }, g)
        el('text', { x: otherX, y: 465, 'text-anchor': 'middle', class: 'tick' }, g, 'Other SSL models')
        el('text', { x: xa, y: 465, 'text-anchor': 'middle', class: 'tick' }, g, 'Without reconstruction')
        el('text', { x: xb, y: 465, 'text-anchor': 'middle', class: 'tick' }, g, 'With reconstruction')
        const dot = (model, x, label = null) => {
          const r = TASK_RESULTS[model]
          const d = el('g', { class: 'task-dot', transform: `translate(${x}, ${y(r.v[k])})`, 'data-model': r.m, 'data-value': r.v[k] }, g)
          el('circle', { r: r.c === C.base ? 8 : 11, fill: r.c, stroke: 'var(--surface)', 'stroke-width': 2 }, d)
          el('circle', { r: r.c === C.base ? 11 : 18, fill: 'transparent' }, d)
          if (label) el('text', { x: label.x, y: label.y, 'text-anchor': label.anchor, class: 'vallab' }, d, M.f(r.v[k]))
          d.addEventListener('pointermove', (e) => this.tip.show(e, `<b>${r.m}</b><br>${M.t}: ${M.f(r.v[k])}`))
          d.addEventListener('pointerleave', () => this.tip.hide())
        }
        ;[0, 1, 2, 3].forEach((model, i) => dot(model, otherX - 18 + i * 12))
        ;[[4, 5, xa], [6, 7, xb]].forEach(([a, b, x]) => {
          const start = y(TASK_RESULTS[a].v[k])
          const end = y(TASK_RESULTS[b].v[k])
          const direction = Math.sign(end - start)
          el('line', { class: 'mixup-arrow', x1: x, x2: x, y1: start + direction * 14, y2: end - direction * 14, stroke: 'var(--ink-soft)', 'stroke-width': 2, 'stroke-dasharray': '6 6', 'marker-end': 'url(#ah-superb-change)' }, g)
        })
        pairs.forEach(([a, b], i) => {
          const ya = y(TASK_RESULTS[a].v[k])
          const yb = y(TASK_RESULTS[b].v[k])
          const length = Math.hypot(xb - xa, yb - ya)
          const dx = (xb - xa) / length * 14
          const dy = (yb - ya) / length * 14
          el('line', { class: 'comparison-line', x1: xa + dx, x2: xb - dx, y1: ya + dy, y2: yb - dy, stroke: 'var(--ink-soft)', 'stroke-width': 2.5, 'marker-end': 'url(#ah-superb-change)' }, g)
          const labelY = (column) => {
            const own = y(TASK_RESULTS[pairs[i][column]].v[k])
            const other = y(TASK_RESULTS[pairs[1 - i][column]].v[k])
            if (Math.abs(own - other) >= 36) return 7
            return own < other || (own === other && i === 0) ? -16 : 26
          }
          dot(a, xa, { x: -20, y: labelY(0), anchor: 'end' })
          dot(b, xb, { x: 20, y: labelY(1), anchor: 'start' })
        })
      })
    },
  })

})()
