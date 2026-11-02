(() => {
  const $ = (id) => document.getElementById(id);
  const sliders = {
    collateral: $('collateralInput'), liquidity: $('liquidityInput'),
    rate: $('rateInput'), shock: $('shockInput')
  };
  const initial = Object.fromEntries(Object.entries(sliders).map(([k, el]) => [k, el.value]));
  const toast = $('toast');
  let toastTimer;
  function notify(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
  }
  function paintRange(el) {
    const pct = ((Number(el.value) - Number(el.min)) / (Number(el.max) - Number(el.min))) * 100;
    el.style.setProperty('--fill', `${pct}%`);
  }
  function renderChart(days = 30, stress = 1.2) {
    const svg = $('pegChart');
    const w = 760, h = 250, left = 40, right = 8, top = 14, bottom = 18;
    const count = days === 7 ? 35 : days === 90 ? 90 : 60;
    const points = [];
    for (let i = 0; i < count; i++) {
      const x = left + i * (w - left - right) / (count - 1);
      const wave = Math.sin(i * .49) * .18 + Math.sin(i * .19 + 1.2) * .27 + Math.cos(i * .81) * .07;
      const drift = Math.sin(i / count * Math.PI * 2 - .8) * .15;
      const y = 124 - (wave + drift) * stress * 37;
      points.push([x, y]);
    }
    const path = points.map(([x,y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const area = `${path} L${points.at(-1)[0]},${h - bottom} L${left},${h - bottom} Z`;
    const rows = [42, 82, 122, 162, 202];
    const labels = ['$1.0040', '$1.0020', '$1.0000', '$0.9980', '$0.9960'];
    svg.innerHTML = `<defs><linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#a88bff" stop-opacity=".20"/><stop offset="1" stop-color="#a88bff" stop-opacity="0"/></linearGradient></defs>` +
      rows.map((y,i) => `<line class="grid-line" x1="${left}" y1="${y}" x2="${w}" y2="${y}"/><text class="chart-label" x="0" y="${y+3}">${labels[i]}</text>`).join('') +
      `<line class="target-line" x1="${left}" y1="122" x2="${w}" y2="122"/><path class="peg-area" d="${area}"/><path class="peg-line" d="${path}"/><circle cx="${points.at(-1)[0]}" cy="${points.at(-1)[1]}" r="4" fill="#b8a4ff" stroke="#1b1d2a" stroke-width="2"/>`;
  }
  function updateDisplays() {
    const c = Number(sliders.collateral.value), l = Number(sliders.liquidity.value);
    const r = Number(sliders.rate.value), s = Number(sliders.shock.value);
    $('collateralDisplay').textContent = `${c.toFixed(1)}%`;
    $('liquidityDisplay').textContent = `$${l.toFixed(1)}M`;
    $('rateDisplay').textContent = `${r.toFixed(2)}%`;
    $('shockDisplay').textContent = `${s.toFixed(1)}×`;
    Object.values(sliders).forEach(paintRange);
  }
  function runCalibration() {
    const c = Number(sliders.collateral.value), l = Number(sliders.liquidity.value), r = Number(sliders.rate.value), s = Number(sliders.shock.value);
    const deviation = Math.max(.01, (s * 0.055 + Math.max(0, 110-c) * .0011 + Math.max(0, 45-l) * .00035 - r * .0032));
    const confidence = Math.min(99.8, Math.max(62, 98 - deviation * 23 - Math.abs(c - 112) * .09 - Math.abs(l - 50) * .035));
    $('pegDeviation').innerHTML = `${deviation.toFixed(2)}<span>%</span>`;
    $('collateralRatio').innerHTML = `${c.toFixed(1)}<span>%</span>`;
    $('redemptionCapacity').innerHTML = `$${l.toFixed(1)}<span>M</span>`;
    $('modelConfidence').innerHTML = `${confidence.toFixed(1)}<span class="small-unit"> / 100</span>`;
    $('chartCurrent').textContent = `$${(1 + deviation / 100).toFixed(4)}`;
    $('chartCurrent').nextElementSibling.innerHTML = `↘ ${deviation.toFixed(2)}% <span>deviation</span>`;
    $('lastCalibrated').textContent = new Intl.DateTimeFormat('en-US', {month:'short', day:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', timeZone:'UTC'}).format(new Date()).toUpperCase() + ' UTC';
    $('confidenceBar')?.style.setProperty('--confidence', `${confidence}%`);
    document.querySelector('.confidence-bar i').style.width = `${confidence}%`;
    renderChart(Number($('rangeSelect').value), s);
    notify('Calibration complete · results updated');
  }
  Object.values(sliders).forEach(el => el.addEventListener('input', updateDisplays));
  $('runBtn').addEventListener('click', runCalibration);
  $('rangeSelect').addEventListener('change', e => renderChart(Number(e.target.value), Number(sliders.shock.value)));
  $('resetBtn').addEventListener('click', () => {
    Object.entries(sliders).forEach(([key, el]) => el.value = initial[key]);
    updateDisplays(); runCalibration(); notify('Inputs reset to base case');
  });
  $('saveBtn').addEventListener('click', () => {
    const model = {name:'USDN · Base case', savedAt:new Date().toISOString(), parameters:Object.fromEntries(Object.entries(sliders).map(([k,v]) => [k,Number(v.value)]))};
    localStorage.setItem('moneta-model', JSON.stringify(model));
    document.querySelector('.draft-badge').innerHTML = '<i></i> Saved';
    notify('Model saved in this browser');
  });
  $('exportBtn').addEventListener('click', () => {
    const payload = {model:'USDN · Base case', exportedAt:new Date().toISOString(), parameters:Object.fromEntries(Object.entries(sliders).map(([k,v]) => [k,Number(v.value)]))};
    const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'usd-n-base-case.json'; a.click(); URL.revokeObjectURL(a.href);
    notify('Model parameters exported as JSON');
  });
  $('assetDetails').addEventListener('click', () => notify('Reserve allocation shown in illustrative USD values'));
  document.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') runCalibration(); });
  updateDisplays(); renderChart();
})();
