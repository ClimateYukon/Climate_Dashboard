/* Canterbury climate projections V3.2: map, communities and source-grounded definitions. */
'use strict';

(async () => {
  // 1. Read only publishable static files. No basemap credentials or live app server.
  const el = (id) => document.getElementById(id);
  const htmlSafe = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[ch]));
  const state = {variable:'T',scenario:'ssp370',period:'fp2041-2060',season:'ANN',mode:'median',tab:'map',showTowns:true,showBasemap:true,rasterOpacity:92};
  let manifest, towns, glossary, map, contextLayer, baseTiles, imageLayer, boundaryLayer, townLayer;
  let markers = new Map();
  let communityCache = new Map();
  let renderToken = 0;
  const scenarioNames = {ssp126:'SSP1-2.6', ssp245:'SSP2-4.5', ssp370:'SSP3-7.0', ssp585:'SSP5-8.5'};
  const agreementColors = ['#c0634c','#dea358','#8dbb97','#247055'];
  const seasonOrder = ['DJF','MAM','JJA','SON','ANN'];
  const keyFor = () => [state.variable,state.scenario,state.period,state.season].join('|');
  const nicePeriod = p => p.replace(/^fp/,'').replace('-','–');
  const variable = () => manifest.variables.find(v=>v.id === state.variable);
  const entry = () => manifest.entries[keyFor()];
  const has = x => x !== null && x !== undefined && Number.isFinite(Number(x));
  const fmt = (x,unit='',signed=true) => {
    if (!has(x)) return '–';
    const n = Number(x), digits = Math.abs(n) < 0.1 ? 3 : Math.abs(n) < 10 ? 2 : 1;
    const val = (signed && n>0 ? '+' : '') + n.toLocaleString('en-NZ',{minimumFractionDigits:digits,maximumFractionDigits:digits});
    return `${val}${unit==='%'||unit==='°C'?'':' '}${unit}`.trim();
  };
  const unitLabel = u => ({'Deg C':'°C','deg C':'°C', 'degrees_C':'°C'}[u] || u || 'source units');
  const activeUnit = () => unitLabel(variable()?.unit || '');
  const visibleKey = () => `${state.variable}/${state.scenario}/${state.period}`;
  const paintVar = () => {
    const search = el('search').value.toLowerCase().trim();
    const vs = manifest.variables.filter(v=>v.label.toLowerCase().includes(search));
    el('variables').innerHTML = vs.map(v=>`<button class="variable ${v.id===state.variable?'active':''}" data-variable="${htmlSafe(v.id)}">${htmlSafe(v.label)}</button>`).join('');
    el('variableCount').textContent = `${manifest.variables.length} available`;
  };

  try {
    const response = await fetch('data/manifest_5km.json?v=3');
    if (!response.ok) throw Error('The climate maps have not been generated yet. Run scripts/build_maps.py on Junix.');
    manifest = await response.json();
    const townsResponse = await fetch('data/community_locations.json?v=3');
    if (!townsResponse.ok) throw Error('The community locations have not been generated yet. Run scripts/build_maps.py on Junix.');
    towns = await townsResponse.json();
    const glossaryResponse = await fetch('data/indicator_definitions.json?v=3.2');
    if (!glossaryResponse.ok) throw Error('The indicator definitions are missing from docs/data. Install the complete v3.2 package.');
    glossary = (await glossaryResponse.json()).indicators;
    if (!window.L) throw Error('Leaflet did not load. Check browser access to unpkg.com.');
    if (!manifest.variables.some(v=>v.id===state.variable)) state.variable=manifest.variables[0].id;
    map = L.map('map',{preferCanvas:true,zoomControl:true,attributionControl:true,zoomSnap:.25,zoomDelta:.5});
    map.setView([-43.7,172],7);
    // OSM Standard does not require an API key. Map still works with the
    // packaged regional geography if internet access to OSM tiles is blocked.
    baseTiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>',
      maxZoom:13, maxNativeZoom:13, minZoom:5, updateWhenIdle:true, keepBuffer:1,
    }).addTo(map);

    for (const [pane,z] of [['baseGeography',320],['climateRaster',370],
                             ['regionOutline',425],['communityPoints',465]]) {
      map.createPane(pane);
      map.getPane(pane).style.zIndex=String(z);
    }
    map.attributionControl.setPrefix(false);
    map.attributionControl.addAttribution('Regional boundaries: Environment Canterbury / Stats NZ');
    L.control.scale({imperial:false,position:'bottomleft'}).addTo(map);
    // ECan local geography is also available if the OSM Standard tiles are blocked.
    const contextResponse=await fetch('data/regional_context.geojson');
    if (contextResponse.ok) {
      const context = await contextResponse.json();
      contextLayer = L.geoJSON(context,{interactive:false,pane:'baseGeography',
        style:{color:'#afc4b6',weight:1,fillColor:'#edf1e8',fillOpacity:0}}).addTo(map);
    }
    const boundsResponse=await fetch('data/canterbury_boundary.geojson');
    if (!boundsResponse.ok) throw Error('Canterbury regional boundary was not generated.');
    const region = await boundsResponse.json();
    boundaryLayer = L.geoJSON(region,{interactive:false,pane:'regionOutline',style:{color:'#204c3d',weight:2.05,fillOpacity:0}}).addTo(map);
    map.fitBounds(manifest.bounds,{padding:[28,28],maxZoom:9});
    townLayer = L.featureGroup().addTo(map);
    el('townCount').textContent = `${towns.length} mapped places`;
    addCommunityMarkers();
    paintVar();
    attachEvents();
    await render();
  } catch (err) {
    el('error').hidden = false;
    el('error').textContent = err.message || String(err);
    el('panel-map').hidden = true;
    el('filters').hidden = true;
    console.error(err);
  }

  // 2. A single set of community markers is used by BOTH map and table.
  function addCommunityMarkers() {
    const labelled = new Set(['Christchurch','Kaikōura','Timaru','Ashburton','Twizel','Hanmer Springs','Rangiora','Waimate']);
    for (const town of towns) {
      const marker = L.circleMarker([town.lat,town.lon], {
        radius:6,pane:'communityPoints',color:'#183c30',weight:2.2,fillColor:'#fff6d5',fillOpacity:1,
      }).addTo(townLayer);
      marker.bindTooltip(town.name,{
        direction:'top',offset:[0,-5],opacity:1,permanent:labelled.has(town.name),className:'town-label',
      });
      marker.on('click',()=>openTown(town.id));
      markers.set(town.id,marker);
    }
    map.on('popupopen',({popup})=>{
      const button = popup.getElement()?.querySelector('[data-open-table]');
      if(button) button.addEventListener('click',()=>{
        const townId=button.dataset.openTable;
        setTab('communities');
        const row=el('communityTable').querySelector(`[data-town-row="${CSS.escape(townId)}"]`);
        row?.scrollIntoView({behavior:'smooth',block:'center'});
      });
    });
  }

  // 3. Keep selectors constrained to combinations actually present in the archive.
  function selectField(field,available,display) {
    const select=el(field);
    if (!available.includes(state[field])) state[field]=available[0];
    select.innerHTML=available.map(x=>`<option value="${x}">${display(x)}</option>`).join('');
    select.value=state[field];
  }
  function refreshSelectors() {
    const all=Object.values(manifest.entries).filter(x=>x.variable===state.variable);
    selectField('scenario',[...new Set(all.map(x=>x.scenario))].sort(),x=>scenarioNames[x]||x);
    selectField('period',[...new Set(all.filter(x=>x.scenario===state.scenario).map(x=>x.period))].sort(),nicePeriod);
    const seasons=all.filter(x=>x.scenario===state.scenario&&x.period===state.period).map(x=>x.season);
    selectField('season',seasonOrder.filter(s=>seasons.includes(s)),s=>manifest.seasons[s]);
  }
  function updateHead() {
    el('title').textContent = variable().label;
    const period=nicePeriod(state.period);
    el('subtitle').textContent=`${period} · ${scenarioNames[state.scenario]} · Changes relative to 1995–2014`;
    paintVar();
  }
  async function getCommunityData() {
    const key=visibleKey();
    if (!communityCache.has(key)) {
      const path=`data/communities/${key}.json?v=${encodeURIComponent(manifest.build_id || '3')}`;
      communityCache.set(key,fetch(path).then(r=>{
        if(!r.ok)throw Error(`Community data missing: ${path}. Run scripts/build_maps.py.`);
        return r.json();
      }));
    }
    return communityCache.get(key);
  }
  async function render() {
    const token=++renderToken;
    refreshSelectors();
    updateHead();
    if (state.tab==='map') renderMap();
    if (state.tab==='communities') await renderCommunities(token);
    if (state.tab==='about') renderDefinitions();
  }
  function setTab(tab) {
    state.tab=tab;
    for(const key of ['map','communities','about']){
      el(`panel-${key}`).hidden=key!==tab;
      el(`tab-${key}`).classList.toggle('active',key===tab);
      el(`tab-${key}`).setAttribute('aria-selected',String(key===tab));
    }
    el('filters').hidden=tab==='about';
    el('season-wrap').hidden=tab!=='map';
    if (tab==='map') {
      render();
      requestAnimationFrame(()=>map.invalidateSize());
    } else if (tab==='communities') render();
    else if (tab==='about') renderDefinitions();
  }

  // 4. Display original 5 km science as a *reprojected* image in Leaflet.
  function renderMap() {
    const r=entry();
    if (!r) return;
    if(imageLayer) map.removeLayer(imageLayer);
    imageLayer=L.imageOverlay(r.images[state.mode]+`?v=${encodeURIComponent(manifest.build_id || '3')}`, manifest.bounds,{
      opacity:state.rasterOpacity/100,interactive:false,crossOrigin:false,pane:'climateRaster',
    }).addTo(map);
    // Dedicated Leaflet panes put the land context behind the climate raster.
    // Region outlines and town markers stay above it, independent of load order.
    for (const button of document.querySelectorAll('[data-mode]')){
      button.classList.toggle('active',button.dataset.mode===state.mode);
      button.setAttribute('aria-pressed',String(button.dataset.mode===state.mode));
    }
    el('townToggle').checked=state.showTowns;
    el('basemapToggle').checked=state.showBasemap;
    el('opacityValue').textContent = `${state.rasterOpacity}%`;
    if (state.showBasemap && !map.hasLayer(baseTiles)) baseTiles.addTo(map);
    if (!state.showBasemap && map.hasLayer(baseTiles)) map.removeLayer(baseTiles);
    if (contextLayer) contextLayer.setStyle({fillOpacity:state.showBasemap ? 0 : 0.85});
    if(state.showTowns && !map.hasLayer(townLayer)) townLayer.addTo(map);
    if(!state.showTowns && map.hasLayer(townLayer)) map.removeLayer(townLayer);
    renderLegend(r);
    const note={
      median:'Median of the six individual model changes calculated independently at each original grid cell.',
      agreement:'Number of models projecting a change in the same direction at each grid cell. This is directional agreement, not a probability or confidence interval.',
      low:`Full spatial field from ${r.low_model}, selected as the lowest Canterbury-wide area-average model.`,
      high:`Full spatial field from ${r.high_model}, selected as the highest Canterbury-wide area-average model.`,
    };
    el('notes').textContent=`${note[state.mode]} ${r.valid_5km_cells.toLocaleString('en-NZ')} Canterbury grid cells have values for all six models. Continuous map colours are smoothed for display only; source values remain on the original grid.`;
  }

  // 5. Colour legend uses the FULL min/max for each current map, not a broad pooled range.
  function renderLegend(r) {
    const meta=r.legends[state.mode];
    const vMin=meta.min,vMax=meta.max;
    if(state.mode==='agreement') {
      el('legend').innerHTML=`<div class="legend-head"><strong>Model agreement on direction of change</strong><span class="legend-sub">Six models per cell</span></div><div class="swatchline">`+
        agreementColors.map((c,i)=>`<div class="swatch"><span style="background:${c}"></span>${i===0?'0–3':i+3} of 6</div>`).join('')+'</div>';
      return;
    }
    const unit=activeUnit();
    const lo=Number(vMin),hi=Number(vMax);
    let bg, ticks, zeroPercent = null;
    if(meta.type==='positive') {
      bg='linear-gradient(90deg,#ffe7be,#f2a764 33%,#d55b41 66%,#8c272f)';
      ticks=[fmt(lo,unit),fmt((lo+hi)/2,unit),fmt(hi,unit)];
    } else if(meta.type==='negative') {
      bg='linear-gradient(90deg,#1b4c85,#5287b8 33%,#9bc6dd 66%,#dceff7)';
      ticks=[fmt(lo,unit),fmt((lo+hi)/2,unit),fmt(hi,unit)];
    } else if (meta.type==='diverging') {
      const zero=(100*(-lo)/(hi-lo)).toFixed(3);
      zeroPercent=zero;
      bg=`linear-gradient(90deg,#1d4f8d 0%,#f6f2e7 ${zero}%,#9f2b2c 100%)`;
      ticks=[fmt(lo,unit),fmt(0,unit),fmt(hi,unit)];
    } else {
      bg='linear-gradient(90deg,#a6b4aa,#bcd2c6)';
      ticks=[fmt(lo,unit),'Uniform',fmt(hi,unit)];
    }
    const middleLabel = zeroPercent === null ? `<span>${htmlSafe(ticks[1])}</span>` :
      `<span class="zero-marker" style="left:${zeroPercent}%">${htmlSafe(ticks[1])}</span>`;
    el('legend').innerHTML=`<div class="legend-head"><strong>Projected change (${htmlSafe(unit)})</strong><span class="legend-sub">Actual range of this map</span></div><div class="ramp" style="background:${bg}"></div><div class="ramp-labels ${zeroPercent===null?'':'zero'}"><span>${htmlSafe(ticks[0])}</span>${middleLabel}<span>${htmlSafe(ticks[2])}</span></div>`;
  }

  // 6. Full seasonal/annual community heat table, coloured by direction agreement.
  async function renderCommunities(token) {
    const data=await getCommunityData();
    if(token!==renderToken || state.tab!=='communities')return;
    const validSeasons=seasonOrder.filter(s=>data.seasons.includes(s));
    const townStats=new Map(data.towns.map(x=>[x.id,x.values]));
    el('communitySummary').innerHTML=`<span class="summary-chip">${towns.length} mapped communities</span>`+
      `<span class="summary-chip">${htmlSafe(nicePeriod(state.period))}</span>`+
      `<span class="summary-chip">${htmlSafe(scenarioNames[state.scenario])}</span>`+
      `<span class="summary-chip">Change in ${htmlSafe(activeUnit())}</span>`;
    el('communityTable').querySelector('thead').innerHTML='<tr><th>Community</th>'+
      validSeasons.map(s=>`<th>${htmlSafe(manifest.seasons[s])}</th>`).join('')+'</tr>';
    el('communityTable').querySelector('tbody').innerHTML=towns.map(town=>{
      const values=townStats.get(town.id)||{};
      const cells=validSeasons.map(season=>{
        const v=values[season];
        if(!v)return '<td><span class="heat-cell none">–</span></td>';
        const ix=Math.min(Math.max(v.agreement-3,0),3);
        const shade=['#f6d8d0','#f6e5c9','#dfede2','#c6e5d3'][ix];
        const hover=`${town.name} · ${manifest.seasons[season]}\n`+
          `Median: ${fmt(v.median,activeUnit())}\n`+
          `Agreement: ${v.agreement}/6 models on direction\n`+
          `Lowest: ${fmt(v.low,activeUnit())} (${v.low_model})\n`+
          `Highest: ${fmt(v.high,activeUnit())} (${v.high_model})\n`+
          `Nearest valid model grid centre: ${v.grid_distance_km} km from mapped town centre`;
        return `<td><div class="heat-cell" style="--shade:${shade}" role="img" title="${htmlSafe(hover)}" aria-label="${htmlSafe(hover)}">`+
          `${htmlSafe(fmt(v.median,activeUnit()))}<small>${v.agreement}/6 agree</small></div></td>`;
      }).join('');
      return `<tr data-town-row="${htmlSafe(town.id)}"><td><button class="place-button" data-jump="${htmlSafe(town.id)}">${htmlSafe(town.name)}</button></td>${cells}</tr>`;
    }).join('');
    el('agreementLegend').innerHTML='<b>Colour: </b>' +
      agreementColors.map((c,i)=>`<span class="agreement-chip"><i style="background:${c}"></i>${i===0?'0–3':i+3} / 6 models</span>`).join('');
  }

  // 7. Selecting a town from the map or table keeps the same names and geometry.
  async function openTown(id) {
    const town=towns.find(x=>x.id===id);
    if(!town)return;
    const marker=markers.get(id);
    const data=await getCommunityData();
    const values=data.towns.find(x=>x.id===id)?.values || {};
    const v=values[state.season]||values.ANN||Object.values(values)[0];
    let details='<p>Values unavailable for the selected season.</p>';
    if(v) details=`<p>Median change: <b>${htmlSafe(fmt(v.median,activeUnit()))}</b></p>`+
        `<p>Direction agreement: <b>${v.agreement}/6 models</b></p>`+
        `<p>Individual model range: ${htmlSafe(fmt(v.low,activeUnit()))} to ${htmlSafe(fmt(v.high,activeUnit()))}</p>`+
        `<small>Nearest source grid centre: ${v.grid_distance_km} km away.</small>`;
    marker.bindPopup(`<div class="popup"><h4>${htmlSafe(town.name)}</h4>`+
        `<small>${htmlSafe(variable().label)} · ${htmlSafe(manifest.seasons[state.season])}</small>`+
        `${details}<div><button data-open-table="${htmlSafe(id)}">View seasonal table</button></div></div>`,{maxWidth:310});
    marker.openPopup();
  }

  // 8. Scientific indicator glossary: one clear definition for every published variable.
  function renderDefinitions() {
    const search = el('definitionSearch').value.toLocaleLowerCase('en-NZ').trim();
    const names = [...manifest.variables]
      .filter(v => {
        const guide = glossary[v.id];
        if (!guide) return false;
        const content = [v.id,v.label,guide.definition,guide.method,guide.interpretation,guide.note].join(' ');
        return content.toLocaleLowerCase('en-NZ').includes(search);
      })
      .sort((a,b) => search ? a.label.localeCompare(b.label,'en-NZ') :
        (a.id===state.variable?-1:b.id===state.variable?1:a.label.localeCompare(b.label,'en-NZ')));
    el('definitionCount').textContent = `${names.length} of ${manifest.variables.length} indicators`;
    el('definitionList').innerHTML = names.map(v => {
      const guide=glossary[v.id];
      const annual=Object.values(manifest.entries).some(r=>r.variable===v.id&&r.season==='ANN');
      const seasonal=Object.values(manifest.entries).some(r=>r.variable===v.id&&r.season!=='ANN');
      const timing=annual&&seasonal?'Annual and seasonal':seasonal?'Seasonal':'Annual only';
      const selected=v.id===state.variable;
      return `<details class="indicator-guide ${selected?'is-current':''}" ${selected?'open':''}>`+
        `<summary><span class="guide-name">${htmlSafe(v.label)}</span>`+
        `<span class="guide-metadata">${htmlSafe(v.id)} · ${htmlSafe(timing)} · ${htmlSafe(guide.change_unit)}</span>`+
        `${selected?'<span class="current-indicator">Currently selected</span>':''}</summary>`+
        `<div class="indicator-content"><p><strong>What it measures.</strong> ${htmlSafe(guide.definition)}</p>`+
        `<p><strong>How it is calculated.</strong> ${htmlSafe(guide.method)}</p>`+
        `<p><strong>How to read projected changes.</strong> ${htmlSafe(guide.interpretation)}</p>`+
        `<p class="indicator-note"><strong>Important context.</strong> ${htmlSafe(guide.note)}</p>`+
        `</div></details>`;
    }).join('') || '<p>No indicators match this search.</p>';
  }

  // 9. Simple controls: no separate framework, build step or API key required.
  function attachEvents() {
    el('variables').addEventListener('click', async event=>{
      const b=event.target.closest('[data-variable]');
      if(!b)return;
      state.variable=b.dataset.variable;
      await render();
    });
    el('search').addEventListener('input',paintVar);
    el('definitionSearch').addEventListener('input',renderDefinitions);
    el('expandDefinitions').addEventListener('click',()=>{
      el('definitionList').querySelectorAll('details').forEach(d=>{d.open=true;});
    });
    el('collapseDefinitions').addEventListener('click',()=>{
      el('definitionList').querySelectorAll('details').forEach(d=>{d.open=false;});
    });
    el('defineCurrent').addEventListener('click',()=>{
      el('definitionSearch').value='';
      setTab('about');
      el('panel-about').scrollIntoView({block:'start',behavior:'smooth'});
    });
    for(const field of ['period','scenario','season']){
      el(field).addEventListener('change', async()=>{state[field]=el(field).value;await render();});
    }
    for(const button of document.querySelectorAll('[data-mode]')){
      button.addEventListener('click',()=>{state.mode=button.dataset.mode;renderMap();});
    }
    for(const button of document.querySelectorAll('[data-tab]')){
      button.addEventListener('click',()=>setTab(button.dataset.tab));
    }
    el('townToggle').addEventListener('change',()=>{state.showTowns=el('townToggle').checked;renderMap();});
    el('basemapToggle').addEventListener('change',()=>{state.showBasemap=el('basemapToggle').checked;renderMap();});
    el('opacityRange').addEventListener('input',()=>{
      state.rasterOpacity=Number(el('opacityRange').value);
      el('opacityValue').textContent=`${state.rasterOpacity}%`;
      if(imageLayer) imageLayer.setOpacity(state.rasterOpacity/100);
    });
    el('communityTable').addEventListener('click',async(event)=>{
      const jump=event.target.closest('[data-jump]');
      if(!jump)return;
      const id=jump.dataset.jump;
      const town=towns.find(t=>t.id===id);
      state.showTowns=true;
      setTab('map');
      map.setView([town.lat,town.lon],Math.max(map.getZoom(),9));
      await openTown(id);
    });
  }
})();
