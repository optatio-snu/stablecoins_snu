(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = {asset:'USDC', days:90, sample:[], supply:null, model:null, asOf:null, removed:0};
  const sourceBase = 'https://stablecoins.llama.fi';
  const priceBase = 'https://coins.llama.fi';
  let toastTimer;
  const toast = message => { const el=$('toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2400); };
  const fmt = (n,d=2) => Number.isFinite(n) ? n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}) : '—';
  const money = n => { if(!Number.isFinite(n)) return '—'; const a=Math.abs(n); return a>=1e12?`$${fmt(n/1e12,2)}T`:a>=1e9?`$${fmt(n/1e9,2)}B`:a>=1e6?`$${fmt(n/1e6,2)}M`:`$${fmt(n,2)}`; };
  async function json(url) { const res=await fetch(url,{headers:{accept:'application/json'}}); if(!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); }
  function getAssets(data){ return Array.isArray(data)?data:(data.peggedAssets||data.stablecoins||[]); }
  function assetSupply(asset){ const c=asset.circulating; if(typeof c==='number') return c; if(c&&typeof c==='object'){ const val=c[asset.pegType]??c.peggedUSD??Object.values(c)[0]; return typeof val==='number'?val:Number(val)||null; } return Number(asset.circulatingUSD)||null; }
  async function loadData(){
    const symbol=$('assetSelect').value; state.asset=symbol;
    $('sourceStatus').textContent='Loading public market data'; $('liveDot').classList.remove('error'); $('retrievalStatus').textContent='Fetching'; $('sampleMeta').textContent='Fetching observations…'; $('priceValue').textContent='—';
    $('assetCrumb').textContent=symbol; $('chartAsset').textContent=symbol; $('auditAsset').textContent=symbol==='USDC'?'USDC · USD Coin':'USDT · Tether';
    try{
      const catalog=await json(`${sourceBase}/stablecoins?includePrices=true`);
      const asset=getAssets(catalog).find(x=>String(x.symbol).toUpperCase()===symbol);
      if(!asset) throw new Error(`${symbol} not found in the public catalog`);
      state.supply=assetSupply(asset); state.assetMeta=asset;
      const gecko=asset.gecko_id||(symbol==='USDC'?'usd-coin':'tether');
      const chart=await json(`${priceBase}/chart/coingecko:${encodeURIComponent(gecko)}?span=${state.days}&period=86400`);
      const coin=chart.coins?.[`coingecko:${gecko}`]||Object.values(chart.coins||{})[0];
      const arr=coin?.prices||chart.prices||[];
      state.sample=arr.map(p=>({date:new Date(Number(p.timestamp)*1000),price:Number(p.price)})).filter(p=>Number.isFinite(p.price)&&Number.isFinite(p.date.getTime())).sort((a,b)=>a.date-b.date);
      if(state.sample.length<5) throw new Error('Price feed returned fewer than five daily observations');
      state.asOf=state.sample.at(-1).date; state.removed=0; $('missingRows').textContent='0 (feed response)';
      $('sourceStatus').textContent='Live feed connected'; $('liveDot').classList.remove('error'); $('retrievalStatus').textContent='Success';
      render();
    }catch(err){
      state.sample=[]; state.model=null; state.supply=null;
      $('sourceStatus').textContent='Feed unavailable'; $('liveDot').classList.add('error'); $('retrievalStatus').textContent=`Unavailable · ${err.message}`;
      $('sampleMeta').textContent=`No observations loaded (${err.message})`; $('asOf').textContent='—';
      renderEmpty();
    }
  }
  function erf(x){const s=x<0?-1:1; x=Math.abs(x); const t=1/(1+.3275911*x); const y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-x*x); return s*y;}
  function pNormal(t){return Math.max(0,Math.min(1,1-erf(Math.abs(t)/Math.sqrt(2))));}
  function fitAR(series){
    const y=series.map(p=>(p.price-1)*10000), pairs=[]; for(let i=1;i<y.length;i++) pairs.push({x:y[i-1],y:y[i]});
    const n=pairs.length, mx=pairs.reduce((s,p)=>s+p.x,0)/n, my=pairs.reduce((s,p)=>s+p.y,0)/n;
    const sxx=pairs.reduce((s,p)=>s+(p.x-mx)**2,0), sxy=pairs.reduce((s,p)=>s+(p.x-mx)*(p.y-my),0);
    const rho=sxx?sxy/sxx:NaN, alpha=my-rho*mx, residuals=pairs.map(p=>p.y-alpha-rho*p.x);
    const sse=residuals.reduce((s,e)=>s+e*e,0), sst=pairs.reduce((s,p)=>s+(p.y-my)**2,0), r2=sst?1-sse/sst:NaN;
    const lag=Math.max(1,Math.floor(4*Math.pow(n/100,2/9))), sx=pairs.reduce((s,p)=>s+p.x,0), sx2=pairs.reduce((s,p)=>s+p.x*p.x,0), det=n*sx2-sx*sx;
    const bread=det?[[sx2/det,-sx/det],[-sx/det,n/det]]:[[NaN,NaN],[NaN,NaN]];
    const meat=[[0,0],[0,0]], z=pairs.map((p,i)=>[1,p.x*1]);
    for(let t=0;t<n;t++){const v=z[t].map(a=>a*residuals[t]); for(let i=0;i<2;i++) for(let j=0;j<2;j++) meat[i][j]+=v[i]*v[j];}
    for(let l=1;l<=Math.min(lag,n-1);l++){const w=1-l/(lag+1);for(let t=l;t<n;t++){const a=z[t].map(v=>v*residuals[t]),b=z[t-l].map(v=>v*residuals[t-l]);for(let i=0;i<2;i++)for(let j=0;j<2;j++)meat[i][j]+=w*(a[i]*b[j]+b[i]*a[j]);}}
    const cov=Array.from({length:2},(_,i)=>Array.from({length:2},(_,j)=>bread[i].reduce((sum,v,k)=>sum+v*bread[j].reduce((s,u,m)=>s+meat[k][m]*u,0),0)));
    const se=[Math.sqrt(Math.max(0,cov[0][0])),Math.sqrt(Math.max(0,cov[1][1]))];
    let dwNum=0;for(let i=1;i<residuals.length;i++)dwNum+=(residuals[i]-residuals[i-1])**2;const dw=sse?dwNum/sse:NaN;
    const sigma=Math.sqrt(sse/Math.max(1,n-2)); const mae=y.reduce((s,v)=>s+Math.abs(v),0)/y.length;
    return {y,alpha,rho,residuals,n,r2,sse,se,lag,dw,sigma,mae};
  }
  function render(){
    state.model=fitAR(state.sample); const m=state.model, last=state.sample.at(-1);
    $('sampleMeta').textContent=`${state.sample.length} daily price observations · ${m.n} AR(1) transitions`;
    $('asOf').textContent=`Last observation ${state.asOf.toLocaleString('en-US',{dateStyle:'medium',timeZone:'UTC'})} UTC`;
    $('priceValue').textContent=`$${last.price.toFixed(6)}`; $('priceDeviation').textContent=`${fmt((last.price-1)*10000,2)} bp from par`;
    $('supplyValue').textContent=money(state.supply); $('maeValue').textContent=fmt(m.mae,3); $('halfLifeValue').textContent=halfLife(m.rho);
    $('rhoSub').textContent=`ρ = ${fmt(m.rho,4)} · AR coefficient`;
    $('nObs').textContent=m.n; $('rSquared').textContent=fmt(m.r2,4); $('residSigma').textContent=`${fmt(m.sigma,3)} bp`; $('dwStat').textContent=fmt(m.dw,3);
    const rows=[['Constant (α)',m.alpha,m.se[0],m.alpha/m.se[0]],['Lagged deviation (ρ)',m.rho,m.se[1],m.rho/m.se[1]]];
    $('coefRows').innerHTML=rows.map(([name,b,se,t])=>`<tr><td>${name}</td><td>${fmt(b,5)}</td><td>${fmt(se,5)}</td><td>${fmt(t,3)}</td><td>${fmt(pNormal(t),4)}</td></tr>`).join('');
    $('diagnostic').textContent=Number.isFinite(m.rho)&&Math.abs(m.rho)<1?`Mean-reverting in-sample (|ρ| < 1). HAC bandwidth ${m.lag}; half-life is a descriptive transformation, not a forecast.`:`No stable mean-reversion estimate in this sample (|ρ| ≥ 1 or undefined). Treat shock paths as non-convergent.`;
    $('diagnostic').classList.toggle('error-state',Math.abs(m.rho)>=1);
    $('chartRange').textContent=`Last ${state.days===365?'365 days':`${state.days} days`}`;
    drawPriceChart(); updateStress();
  }
  function halfLife(rho){if(!Number.isFinite(rho)||Math.abs(rho)>=1||rho===0)return '—';return `${fmt(-Math.LN2/Math.log(Math.abs(rho)),1)} d`;}
  function renderEmpty(){
    ['priceValue','supplyValue','maeValue','halfLifeValue','nObs','rSquared','residSigma','dwStat'].forEach(id=>$(id).textContent='—');
    $('coefRows').innerHTML='<tr><td colspan="5" class="empty-cell">No data loaded. Retry or import a CSV sample.</td></tr>';
    $('diagnostic').textContent='Model not estimated; no observations are being substituted.'; $('priceChart').innerHTML=''; $('scenarioChart').innerHTML='';
    ['scenarioPrice','redemptionAmount','recoveryTime'].forEach(id=>$(id).textContent='—'); $('sampleMeta').classList.add('error-state');
  }
  function drawPriceChart(){
    const svg=$('priceChart'), data=state.sample, w=900,h=300,L=54,R=10,T=15,B=26, vals=data.map(d=>(d.price-1)*10000);
    const lo=Math.min(-2,...vals), hi=Math.max(2,...vals), pad=Math.max(1,(hi-lo)*.12), min=lo-pad,max=hi+pad;
    const x=i=>L+i*(w-L-R)/(data.length-1), y=v=>T+(max-v)*(h-T-B)/(max-min);
    const path=vals.map((v,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' '), area=`${path} L${x(vals.length-1)},${h-B} L${L},${h-B} Z`;
    const ticks=[max,(max+min)/2,min];
    svg.innerHTML=`<defs><linearGradient id="chartFade" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#247c74" stop-opacity=".14"/><stop offset="1" stop-color="#247c74" stop-opacity="0"/></linearGradient></defs>`+
      ticks.map(v=>`<line class="gridline" x1="${L}" y1="${y(v)}" x2="${w-R}" y2="${y(v)}"/><text class="chart-axis" x="0" y="${y(v)+3}">${fmt(v,1)}</text>`).join('')+
      `<line class="zero-line" x1="${L}" y1="${y(0)}" x2="${w-R}" y2="${y(0)}"/><path class="price-area" d="${area}"/><path class="price-line" d="${path}"/>`+
      [0,.25,.5,.75,1].map(p=>{const i=Math.round(p*(data.length-1));return `<text class="chart-axis" text-anchor="${p===0?'start':p===1?'end':'middle'}" x="${x(i)}" y="${h-5}">${data[i].date.toISOString().slice(5,10)}</text>`;}).join('');
  }
  function updateStress(){
    if(!state.model||!state.sample.length)return;const m=state.model, shock=Number($('shockInput').value), pct=Number($('outflowInput').value), horizon=Number($('horizonInput').value), z=Number($('stressSigma').value), eq=m.alpha/(1-m.rho), current=(state.sample.at(-1).price-1)*10000, start=current+shock;
    $('shockOut').textContent=`${shock>0?'+':''}${fmt(shock,0)} bp`; $('outflowOut').textContent=`${fmt(pct,1)}% of supply`; $('horizonOut').textContent=`${horizon} trading days`; $('sigmaOut').textContent=`${fmt(z,1)}σ`;
    const phi=Math.max(-.999,Math.min(.999,m.rho)), end=eq+Math.pow(phi,horizon)*(start-eq), path=[];for(let d=0;d<=horizon;d++)path.push(eq+Math.pow(phi,d)*(start-eq));
    const varScale=Math.sqrt(Math.max(0,(1-Math.pow(phi,2*horizon))/(1-Math.pow(phi,2||1))));
    $('scenarioPrice').textContent=`$${(1+end/10000).toFixed(6)}`; $('redemptionAmount').textContent=Number.isFinite(state.supply)?money(state.supply*pct/100):'—';
    const daysTo= Math.abs(start-eq)<=1?0:(Math.abs(phi)>0&&Math.abs(phi)<1?Math.ceil(Math.log(1/Math.abs(start-eq))/Math.log(Math.abs(phi))):Infinity);
    $('recoveryTime').textContent=Number.isFinite(daysTo)?`${daysTo} d to ≤1 bp`:'Not convergent';
    $('scenarioCaption').textContent=`Conditional path from ${fmt(start,2)} bp after shock; ${fmt(pct,1)}% supply outflow is reported separately. Shaded band: ±${fmt(z*m.sigma*varScale,2)} bp (residual-scale illustration).`;
    drawScenario(path,z*m.sigma*varScale);
  }
  function drawScenario(path,band){const svg=$('scenarioChart'),w=700,h=190,L=34,R=8,T=12,B=22,lo=Math.min(-5,...path)-band,hi=Math.max(5,...path)+band,x=i=>L+i*(w-L-R)/Math.max(1,path.length-1),y=v=>T+(hi-v)*(h-T-B)/(hi-lo);const line=path.map((v,i)=>`${i?'L':'M'}${x(i)},${y(v)}`).join(' '),upper=path.map((v,i)=>`${i?'L':'M'}${x(i)},${y(v+band)}`).join(' '),lower=path.map((v,i)=>`${i?'L':'M'}${x(path.length-1-i)},${y(path[path.length-1-i]-band)}`).join(' ');svg.innerHTML=`<line class="gridline" x1="${L}" y1="${y(0)}" x2="${w-R}" y2="${y(0)}"/><line class="shock-line" x1="${x(0)}" y1="${T}" x2="${x(0)}" y2="${h-B}"/><path class="forecast-band" d="${upper} ${lower} Z"/><path class="forecast-line" d="${line}"/><text class="chart-axis" x="${L}" y="${h-5}">0</text><text class="chart-axis" text-anchor="end" x="${w-R}" y="${h-5}">Horizon</text><text class="chart-axis" x="2" y="${T+4}">${fmt(hi,1)}</text><text class="chart-axis" x="2" y="${h-B}">${fmt(lo,1)}</text>`;}
  function download(name,content,type){const blob=new Blob([content],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
  function exportCSV(){if(!state.sample.length){toast('No sample to export');return;}const lines=['date,asset,price,peg_deviation_bp,circulating_supply_usd',...state.sample.map(p=>`${p.date.toISOString().slice(0,10)},${state.asset},${p.price},${((p.price-1)*10000).toFixed(6)},${state.supply??''}`)];download(`${state.asset.toLowerCase()}-${state.days}d-market-sample.csv`,lines.join('\n'),'text/csv');toast('Analysis sample exported as CSV');}
  async function copyText(text){try{await navigator.clipboard.writeText(text);toast('Copied to clipboard');}catch{toast('Clipboard unavailable; browser permission required');}}
  $('assetSelect').addEventListener('change',loadData); $('refreshBtn').addEventListener('click',loadData); $('exportBtn').addEventListener('click',exportCSV);
  document.querySelectorAll('.segmented button').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.segmented button').forEach(b=>b.classList.toggle('chosen',b===btn));state.days=Number(btn.dataset.days);loadData();}));
  ['shockInput','outflowInput','horizonInput','stressSigma'].forEach(id=>$(id).addEventListener('input',updateStress)); $('runStress').addEventListener('click',()=>{updateStress();toast('Conditional experiment recalculated');});
  $('copyTableBtn').addEventListener('click',()=>{if(!state.model)return toast('Load data before copying estimates');const m=state.model;copyText(`Term\tEstimate\tHAC s.e.\tt-stat\tp-value*\nConstant (alpha)\t${m.alpha}\t${m.se[0]}\t${m.alpha/m.se[0]}\t${pNormal(m.alpha/m.se[0])}\nLagged deviation (rho)\t${m.rho}\t${m.se[1]}\t${m.rho/m.se[1]}\t${pNormal(m.rho/m.se[1])}`);});
  $('specBtn').addEventListener('click',()=>copyText('Model: d_t = alpha + rho*d_(t-1) + epsilon_t\nEstimator: OLS\nUnits: basis points from $1.00\nSE: Newey-West HAC, lag=floor(4*(N/100)^(2/9))\nSource: DeFiLlama public stablecoin catalog and CoinGecko price history via DeFiLlama.\nInterpretation: descriptive market-price dynamics; no causal or reserve-adequacy claims.'));
  $('loginBtn').addEventListener('click',()=>toast('Account sign-in is planned and not active yet.'));
  $('noticeClose').addEventListener('click',()=>document.querySelector('.notice').remove());
  $('csvInput').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{const text=await file.text(),lines=text.trim().split(/\r?\n/),head=lines.shift().split(',').map(s=>s.trim().toLowerCase()),di=head.indexOf('date'),pi=head.indexOf('price'),si=head.indexOf('supply');if(di<0||pi<0)throw new Error('CSV must include date and price columns');let removed=0;const data=lines.map(row=>{const c=row.split(',');return{date:new Date(c[di]),price:Number(c[pi]),supply:si>=0?Number(c[si]):null};}).filter(r=>Number.isFinite(r.date.getTime())&&Number.isFinite(r.price));removed=lines.length-data.length;if(data.length<5)throw new Error('At least five valid observations are required');state.sample=data.sort((a,b)=>a.date-b.date);state.supply=state.sample.at(-1).supply;state.asOf=state.sample.at(-1).date;state.removed=removed;$('sourceStatus').textContent='User CSV loaded';$('retrievalStatus').textContent='Imported CSV';$('sampleMeta').textContent=`${data.length} imported observations`;render();$('missingRows').textContent=String(removed);toast(`${data.length} observations imported`);}catch(err){toast(`CSV import failed: ${err.message}`);}e.target.value='';});
  loadData();
})();
