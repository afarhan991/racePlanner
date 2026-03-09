const checkpointsEl = document.getElementById('checkpoints');
const template = document.getElementById('checkpoint-template');
const form = document.getElementById('planner-form');
const addCheckpointBtn = document.getElementById('add-checkpoint');
const loadDemoBtn = document.getElementById('load-demo');
const emptyState = document.getElementById('empty-state');
const resultsEl = document.getElementById('results');
const summaryEl = document.getElementById('summary');
const metricSourcesEl = document.getElementById('metricSources');
const segmentTableEl = document.getElementById('segmentTable');
const fuelingPlanEl = document.getElementById('fuelingPlan');
const assumptionsEl = document.getElementById('assumptions');
const fuelScheduleEl = document.getElementById('fuelSchedule');
const waypointPanelEl = document.getElementById('waypointPanel');
const sourcePolicyEl = document.getElementById('sourcePolicy');

document.body.classList.add('privacy-shield');
document.addEventListener('visibilitychange', () => document.body.classList.toggle('blur-guard', document.hidden));
document.addEventListener('contextmenu', (event) => event.preventDefault());
document.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (key === 'f12' || (event.ctrlKey && event.shiftKey && ['i', 'j', 'c', 's'].includes(key))) event.preventDefault();
});

function addCheckpointRow(data = {}) {
  const node = template.content.firstElementChild.cloneNode(true);
  node.querySelector('.cp-name').value = data.name || '';
  node.querySelector('.cp-km').value = data.km ?? '';
  node.querySelector('.cp-cutoff').value = data.cutoff ?? '';
  node.querySelector('.remove-checkpoint').addEventListener('click', () => node.remove());
  checkpointsEl.appendChild(node);
}

addCheckpointBtn.addEventListener('click', () => addCheckpointRow());

loadDemoBtn.addEventListener('click', () => {
  document.getElementById('raceName').value = 'BTR Ultra 60K';
  document.getElementById('targetHours').value = 17;
  document.getElementById('totalCutoff').value = 19;
  document.getElementById('distanceOverride').value = 60;
  document.getElementById('elevationOverride').value = 3800;
  document.getElementById('weatherMode').value = 'mixed';
  document.getElementById('aidStationDelay').value = 4;
  document.getElementById('smoothMode').value = 'medium';
  document.getElementById('gelCarbs').value = 25;
  document.getElementById('fuelStartMinutes').value = 25;
  checkpointsEl.innerHTML = '';
  [
    { name: 'COP 1', km: 18, cutoff: 8 },
    { name: 'COP 2', km: 31, cutoff: 11 },
    { name: 'COP 3', km: 46, cutoff: 15 },
    { name: 'Finish', km: 60, cutoff: 19 }
  ].forEach(addCheckpointRow);
});

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function smoothElevations(rawPoints, windowSize) {
  return rawPoints.map((point, index) => {
    let total = 0;
    let count = 0;
    for (let i = Math.max(0, index - windowSize); i <= Math.min(rawPoints.length - 1, index + windowSize); i += 1) {
      total += rawPoints[i].ele;
      count += 1;
    }
    return { ...point, ele: total / count };
  });
}

function parseGpx(text, smoothMode = 'medium') {
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  const pts = [...xml.querySelectorAll('trkpt')];
  const wpts = [...xml.querySelectorAll('wpt')];
  if (!pts.length) return null;

  const rawPoints = pts.map((pt, index) => ({
    index,
    lat: parseFloat(pt.getAttribute('lat')),
    lon: parseFloat(pt.getAttribute('lon')),
    ele: parseFloat(pt.querySelector('ele')?.textContent || '0')
  }));

  const waypoints = wpts.map((wpt, index) => ({
    index,
    lat: parseFloat(wpt.getAttribute('lat')),
    lon: parseFloat(wpt.getAttribute('lon')),
    ele: parseFloat(wpt.querySelector('ele')?.textContent || '0'),
    name: (wpt.querySelector('name')?.textContent || `Waypoint ${index + 1}`).trim()
  }));

  const smoothingMap = { light: 1, medium: 3, strong: 5 };
  const pointsWithElevation = smoothElevations(rawPoints, smoothingMap[smoothMode] ?? 3);

  let distanceKm = 0;
  let gainM = 0;
  let lossM = 0;
  let prev = null;
  const points = [];

  pointsWithElevation.forEach((pt) => {
    if (prev) {
      const segmentKm = haversine(prev.lat, prev.lon, pt.lat, pt.lon);
      distanceKm += segmentKm;
      const diff = pt.ele - prev.ele;
      if (diff > 0) gainM += diff;
      if (diff < 0) lossM += Math.abs(diff);
    }
    points.push({ ...pt, distanceKm });
    prev = pt;
  });

  return { distanceKm, gainM, lossM, points, waypoints, smoothMode };
}

function fmtHoursDecimal(hours) {
  const sign = hours < 0 ? '-' : '';
  const abs = Math.abs(hours);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  const hh = h + Math.floor(m / 60);
  const mm = m % 60;
  return `${sign}${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function fmtClock(hours) {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function fmtPace(minPerKm) {
  if (!Number.isFinite(minPerKm) || minPerKm <= 0) return '-';
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  const mm = m + Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, '0')}/km`;
}

function safeNum(value) {
  return Number.isFinite(value) ? value : null;
}

function checkpointRows() {
  return [...document.querySelectorAll('.checkpoint-row')]
    .map((row) => ({
      name: row.querySelector('.cp-name').value.trim(),
      km: parseFloat(row.querySelector('.cp-km').value),
      cutoff: parseFloat(row.querySelector('.cp-cutoff').value)
    }))
    .filter((cp) => cp.name && Number.isFinite(cp.km) && Number.isFinite(cp.cutoff))
    .sort((a, b) => a.km - b.km);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getHydrationRange(weatherMode) {
  if (weatherMode === 'hot') return { fluidLow: 650, fluidHigh: 900, sodiumLow: 500, sodiumHigh: 800, label: 'hot' };
  if (weatherMode === 'warm') return { fluidLow: 550, fluidHigh: 800, sodiumLow: 400, sodiumHigh: 700, label: 'warm' };
  if (weatherMode === 'mixed') return { fluidLow: 500, fluidHigh: 850, sodiumLow: 350, sodiumHigh: 750, label: 'mixed' };
  return { fluidLow: 450, fluidHigh: 700, sodiumLow: 300, sodiumHigh: 600, label: 'temperate' };
}

function getFuelingRange(targetHours) {
  if (targetHours >= 12) return { carbsPerHour: 75, mode: 'high-endurance' };
  if (targetHours >= 6) return { carbsPerHour: 60, mode: 'standard-endurance' };
  return { carbsPerHour: 45, mode: 'light-endurance' };
}

function computeFlatEquivalentPace(distanceKm, gainM, lossM, targetHours) {
  const climbPenaltyKm = gainM / 100;
  const descentPenaltyKm = lossM / 250;
  const equivalentKm = distanceKm + climbPenaltyKm + descentPenaltyKm;
  const pace = (targetHours * 60) / equivalentKm;
  return { equivalentKm, pace };
}

function computeGapFromGrade(actualPaceMinKm, verticalDeltaM, segmentKm) {
  if (!segmentKm || !Number.isFinite(actualPaceMinKm) || actualPaceMinKm <= 0) return null;
  const grade = (verticalDeltaM / (segmentKm * 1000)) * 100;
  const absGrade = Math.abs(grade);
  let factor = 1;
  if (grade > 0) factor = 1 + grade * 0.035;
  else if (grade < 0) factor = 1 - Math.min(absGrade * 0.018, 0.18);
  factor = clamp(factor, 0.72, 1.85);
  return { gapPace: actualPaceMinKm / factor, gradePercent: grade, factor };
}

function findClosestPointIndex(points, targetKm) {
  let bestIndex = 0;
  let bestDelta = Infinity;
  for (let i = 0; i < points.length; i += 1) {
    const delta = Math.abs(points[i].distanceKm - targetKm);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function analyzeSegmentFromPoints(points, startKm, endKm) {
  if (!points?.length || endKm <= startKm) return null;
  const startIndex = findClosestPointIndex(points, startKm);
  const endIndex = findClosestPointIndex(points, endKm);
  const from = Math.min(startIndex, endIndex);
  const to = Math.max(startIndex, endIndex);
  let gainM = 0;
  let lossM = 0;
  for (let i = from + 1; i <= to; i += 1) {
    const diff = points[i].ele - points[i - 1].ele;
    if (diff > 0) gainM += diff;
    if (diff < 0) lossM += Math.abs(diff);
  }
  const pointStart = points[from];
  const pointEnd = points[to];
  const distanceKm = Math.max(pointEnd.distanceKm - pointStart.distanceKm, endKm - startKm, 0.001);
  const netVerticalM = pointEnd.ele - pointStart.ele;
  const gradePercent = (netVerticalM / (distanceKm * 1000)) * 100;
  return { distanceKm, gainM, lossM, netVerticalM, gradePercent };
}

function nearestTrackProgress(points, lat, lon) {
  if (!points?.length) return null;
  let best = null;
  for (const point of points) {
    const d = haversine(lat, lon, point.lat, point.lon);
    if (!best || d < best.distanceToTrackKm) {
      best = { point, distanceToTrackKm: d };
    }
  }
  return best;
}

function buildFuelSchedule(targetHours, carbsPerHour, gelCarbs, fuelStartMinutes) {
  const intervalMinutes = carbsPerHour >= 75 ? 20 : 30;
  const totalMinutes = Math.round(targetHours * 60);
  const entries = [];
  let minute = fuelStartMinutes;
  let count = 1;
  while (minute <= totalMinutes) {
    const cumulativeCarbs = Math.round((minute / 60) * carbsPerHour);
    entries.push({ label: `Fuel ${count}`, minute, clock: fmtClock(minute / 60), suggestion: gelCarbs >= carbsPerHour / 3 ? `1 gel (~${gelCarbs}g)` : `gel/sip combo (~${gelCarbs}g unit)`, cumulativeCarbs });
    minute += intervalMinutes;
    count += 1;
  }
  return { intervalMinutes, entries };
}

function buildSegmentFueling(seg, carbsPerHour, gelCarbs, hydration) {
  const splitMinutes = Math.max(seg.splitHours * 60, 0);
  const segmentCarbs = Math.round(seg.splitHours * carbsPerHour);
  const gels = Math.max(1, Math.round(segmentCarbs / gelCarbs));
  const fluidLow = Math.round(hydration.fluidLow * seg.splitHours);
  const fluidHigh = Math.round(hydration.fluidHigh * seg.splitHours);
  const sodiumLow = Math.round(hydration.sodiumLow * seg.splitHours);
  const sodiumHigh = Math.round(hydration.sodiumHigh * seg.splitHours);
  const cue = splitMinutes >= 75 ? `carry ${gels} gel` : splitMinutes >= 40 ? '1 gel / sip combo' : 'few sips + top up';
  return {
    segmentCarbs,
    gels,
    fluidLow,
    fluidHigh,
    sodiumLow,
    sodiumHigh,
    cue,
    text: `${segmentCarbs}g carbs · ${fluidLow}-${fluidHigh}ml · ${cue}`
  };
}

function nextOfficialCutoff(km, checkpoints = []) {
  if (km == null || !checkpoints.length) return null;
  const sorted = [...checkpoints]
    .filter((cp) => Number.isFinite(cp.km) && Number.isFinite(cp.cutoffHours))
    .sort((a, b) => a.km - b.km);
  return sorted.find((cp) => km <= cp.km + 0.05) || null;
}

function buildWaypointDetections(parsed, segments) {
  if (!parsed?.waypoints?.length || !parsed?.points?.length) return [];
  return parsed.waypoints.map((wpt) => {
    const nearest = nearestTrackProgress(parsed.points, wpt.lat, wpt.lon);
    const km = nearest?.point?.distanceKm ?? null;
    let etaHours = null;
    let elapsedHours = null;
    let fueling = null;
    if (km != null && segments?.length) {
      let prevKm = 0;
      let prevElapsed = 0;
      for (const seg of segments) {
        if (km <= seg.km) {
          const legKm = Math.max(seg.km - prevKm, 0.001);
          const progress = clamp((km - prevKm) / legKm, 0, 1);
          etaHours = seg.etaHours * progress;
          elapsedHours = prevElapsed + seg.etaHours * progress;
          if (seg.fueling) {
            fueling = {
              ...seg.fueling,
              text: `${Math.max(1, Math.round(seg.fueling.segmentCarbs * progress))}g carbs · ${Math.max(50, Math.round(seg.fueling.fluidLow * progress))}-${Math.max(80, Math.round(seg.fueling.fluidHigh * progress))}ml · ${progress >= 0.7 ? seg.fueling.cue : 'early fueling / sips'}`
            };
          }
          break;
        }
        prevKm = seg.km;
        prevElapsed = seg.elapsedHours;
      }
      if (etaHours == null) etaHours = segments.at(-1)?.etaHours ?? null;
      if (elapsedHours == null) elapsedHours = segments.at(-1)?.elapsedHours ?? null;
    }
    const nextCutoff = nextOfficialCutoff(km, segments);
    const bufferHours = nextCutoff && elapsedHours != null ? nextCutoff.cutoffHours - elapsedHours : null;
    return {
      name: wpt.name,
      ele: wpt.ele,
      km,
      etaHours,
      elapsedHours,
      cutoffHours: null,
      cutoffType: null,
      bufferHours,
      bufferTargetLabel: nextCutoff?.name || null,
      fueling,
      distanceToTrackKm: nearest?.distanceToTrackKm ?? null,
      type: /ws|water|aid/i.test(wpt.name) ? 'WS' : 'Waypoint'
    };
  }).sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
}

function buildPlan({ parsed, distanceKm, gainM, lossM, targetHours, totalCutoff, checkpoints, aidStationDelay, weatherMode, gelCarbs, fuelStartMinutes }) {
  const avgPaceMinKm = (targetHours * 60) / distanceKm;
  const flatEquivalent = computeFlatEquivalentPace(distanceKm, gainM, lossM, targetHours);
  const fueling = getFuelingRange(targetHours);
  const hydration = getHydrationRange(weatherMode);
  const totalCarbs = fueling.carbsPerHour * targetHours;
  const gelEquivalent = totalCarbs / gelCarbs;
  const fluidRangeMl = [hydration.fluidLow * targetHours, hydration.fluidHigh * targetHours];
  const sodiumRangeMg = [hydration.sodiumLow * targetHours, hydration.sodiumHigh * targetHours];
  const schedule = buildFuelSchedule(targetHours, fueling.carbsPerHour, gelCarbs, fuelStartMinutes);

  let prevKm = 0;
  let elapsed = 0;
  const rows = checkpoints.length ? checkpoints : [{ name: 'Finish', km: distanceKm, cutoff: totalCutoff }];
  const fallbackClimbRatePerKm = gainM / distanceKm;
  const fallbackDescentRatePerKm = lossM / distanceKm;

  const rawSegments = rows.map((cp, idx) => {
    const segKm = Math.max(cp.km - prevKm, 0.001);
    const pointStats = analyzeSegmentFromPoints(parsed?.points, prevKm, cp.km);
    const segmentClimbM = pointStats?.gainM ?? fallbackClimbRatePerKm * segKm;
    const segmentLossM = pointStats?.lossM ?? fallbackDescentRatePerKm * segKm;
    const netVerticalM = pointStats?.netVerticalM ?? (segmentClimbM - segmentLossM);
    const effectiveSegKm = pointStats?.distanceKm ?? segKm;
    const gradePercent = pointStats?.gradePercent ?? ((netVerticalM / (effectiveSegKm * 1000)) * 100);
    const climbPenaltyHours = segmentClimbM / 600;
    const descentPenaltyHours = segmentLossM / 1500;
    const movingHours = (effectiveSegKm * flatEquivalent.pace) / 60 + climbPenaltyHours + descentPenaltyHours;
    const stopHours = idx === rows.length - 1 ? 0 : aidStationDelay / 60;
    const splitHours = movingHours + stopHours;
    const actualPaceMinKm = movingHours > 0 ? (movingHours * 60) / effectiveSegKm : 0;
    const gap = computeGapFromGrade(actualPaceMinKm, netVerticalM, effectiveSegKm);
    prevKm = cp.km;
    return { name: cp.name, km: cp.km, segKm: effectiveSegKm, segmentGainM: segmentClimbM, segmentLossM, splitHours, cutoffHours: cp.cutoff, paceMinKm: actualPaceMinKm, gapPaceMinKm: gap?.gapPace || null, gradePercent };
  });

  const rawTotalHours = rawSegments.reduce((sum, seg) => sum + seg.splitHours, 0);
  const scaleFactor = rawTotalHours > 0 ? targetHours / rawTotalHours : 1;

  elapsed = 0;
  const segments = rawSegments.map((seg) => {
    const splitHours = seg.splitHours * scaleFactor;
    elapsed += splitHours;
    return {
      ...seg,
      splitHours,
      etaHours: splitHours,
      elapsedHours: elapsed,
      paceMinKm: seg.paceMinKm * scaleFactor,
      gapPaceMinKm: seg.gapPaceMinKm != null ? seg.gapPaceMinKm * scaleFactor : null,
      bufferHours: seg.cutoffHours - elapsed,
      cutoffType: 'official',
      bufferTargetLabel: seg.name,
      fueling: buildSegmentFueling({ ...seg, splitHours }, fueling.carbsPerHour, gelCarbs, hydration)
    };
  });

  const confidenceBase = parsed?.points?.length ? 88 : 68;
  const confidence = clamp(confidenceBase - checkpoints.length * 2 - Math.round((gainM / distanceKm) / 7), 58, 90);
  const overallGap = computeGapFromGrade(avgPaceMinKm, gainM - lossM, distanceKm);
  const waypoints = buildWaypointDetections(parsed, segments);

  return {
    summary: { distanceKm, gainM, lossM, targetHours, totalCutoff, avgPaceMinKm, effortPaceMinKm: flatEquivalent.pace, overallGapPaceMinKm: overallGap?.gapPace || flatEquivalent.pace, equivalentKm: flatEquivalent.equivalentKm, checkpointCount: checkpoints.length, carbsPerHour: fueling.carbsPerHour, fuelingMode: fueling.mode, totalCarbs, gelEquivalent, gelCarbs, fluidRangeMl, sodiumRangeMg, weatherMode: hydration.label, feedIntervalMinutes: schedule.intervalMinutes, fuelStartMinutes, confidence, usesSegmentGpx: Boolean(parsed?.points?.length), smoothMode: parsed?.smoothMode || 'none', waypointCount: waypoints.length },
    segments,
    schedule,
    waypoints,
    classification: {
      official: [`Distance ${distanceKm.toFixed(1)} km`, `Elevation gain ${Math.round(gainM)} m`, `Elevation loss ${Math.round(lossM)} m`, `COP/COT rows ${checkpoints.length || 0}`, `Waypoints detected ${waypoints.length}`],
      guideline: [`Carb baseline ${fueling.carbsPerHour} g/jam`, `Hydration ${hydration.fluidLow}-${hydration.fluidHigh} ml/jam`, `Sodium ${hydration.sodiumLow}-${hydration.sodiumHigh} mg/jam`],
      model: [`Flat-equivalent pace ${fmtPace(flatEquivalent.pace)}`, `Overall GAP-style effort pace ${fmtPace((overallGap?.gapPace || flatEquivalent.pace))}`, parsed?.points?.length ? `Segment ETA/GAP pakai GPX segment analysis + ${parsed.smoothMode} smoothing.` : 'Segment ETA/GAP masih fallback dari total course distribution.']
    },
    metricSources: [['Distance / elevation', 'Official race docs / GPX'], ['Fueling baseline', 'AND/DC/ACSM + IOC + ISSN'], ['Hydration / sodium', 'ACSM fluid replacement'], ['Pace / split model', parsed?.points?.length ? 'GPX segment analysis + Naismith-derived model' : 'Naismith-derived model'], ['GAP / effort pace', 'Grade-adjusted heuristic'], ['Waypoint / WS map', 'GPX waypoint + nearest track mapping']]
  };
}

function renderSourcePolicy() {
  const sections = Object.entries(window.ULTRA_SOURCES || {});
  sourcePolicyEl.innerHTML = `<div class="source-grid">${sections.flatMap(([group, items]) => items.map((item) => `<div class="source-item"><div class="source-tier">${item.tier} · ${group}</div><strong>${item.label}</strong><p>${item.use}${item.note ? ` ${item.note}` : ''}</p></div>`)).join('')}</div>`;
}

function renderWaypoints(waypoints, checkpoints = []) {
  const startPoint = {
    label: 'Start',
    type: 'Start',
    km: 0,
    ele: null,
    etaHours: 0,
    elapsedHours: 0,
    fueling: 'start fueled / sip early',
    cutoff: null,
    cutoffType: null,
    buffer: null,
    deltaMeters: null,
    priority: 0
  };

  const rawPoints = [
    startPoint,
    ...waypoints.map((wpt) => ({
      label: wpt.name,
      type: wpt.type,
      km: wpt.km,
      ele: wpt.ele,
      etaHours: wpt.etaHours,
      elapsedHours: wpt.elapsedHours,
      fueling: wpt.fueling?.text || null,
      cutoff: null,
      cutoffType: null,
      buffer: wpt.bufferHours,
      bufferTargetLabel: wpt.bufferTargetLabel,
      deltaMeters: wpt.distanceToTrackKm != null ? wpt.distanceToTrackKm * 1000 : null,
      priority: 1
    })),
    ...checkpoints.map((cp) => ({
      label: cp.name,
      type: /finish/i.test(cp.name) ? 'Finish' : /cop|cp/i.test(cp.name) ? 'COP' : 'Checkpoint',
      km: cp.km,
      ele: null,
      etaHours: cp.etaHours,
      elapsedHours: cp.elapsedHours,
      fueling: cp.fueling?.text || null,
      cutoff: cp.cutoffHours,
      cutoffType: cp.cutoffType,
      buffer: cp.bufferHours,
      bufferTargetLabel: cp.bufferTargetLabel,
      deltaMeters: null,
      priority: 2
    }))
  ].filter((pt) => pt.km != null || pt.type === 'Start');

  const merged = [];
  const sorted = rawPoints.sort((a, b) => {
    const kmDelta = (a.km ?? 0) - (b.km ?? 0);
    if (Math.abs(kmDelta) > 0.05) return kmDelta;
    return (a.priority ?? 0) - (b.priority ?? 0);
  });

  for (const pt of sorted) {
    const last = merged.at(-1);
    const sameKm = last && Math.abs((last.km ?? 0) - (pt.km ?? 0)) < 0.05;
    const sameType = last && last.type === pt.type;
    if (sameKm && sameType) {
      merged[merged.length - 1] = { ...last, ...pt };
    } else {
      merged.push({ ...pt });
    }
  }

  let prevElapsed = 0;
  merged.forEach((pt, index) => {
    if (index === 0) {
      pt.legEtaHours = 0;
      return;
    }
    pt.legEtaHours = Math.max((pt.elapsedHours ?? 0) - prevElapsed, 0);
    prevElapsed = pt.elapsedHours ?? prevElapsed;
  });

  if (!merged.length) {
    waypointPanelEl.innerHTML = '<div class="empty-state">No split points detected yet.</div>';
    return;
  }

  waypointPanelEl.innerHTML = `<div class="table-wrap"><table class="split-table"><thead><tr><th>Point</th><th>Type</th><th>KM</th><th>Elev</th><th>ETA</th><th>Elapsed Time</th><th>Fueling</th><th>Cutoff</th><th>Buffer</th></tr></thead><tbody>${merged.map((pt) => `<tr><td>${pt.label}${pt.deltaMeters != null ? `<div class="muted-inline">delta ${pt.deltaMeters.toFixed(0)} m ke track</div>` : ''}</td><td>${pt.type}</td><td>${pt.km != null ? pt.km.toFixed(1) : '-'}</td><td>${pt.ele != null ? `${Math.round(pt.ele)} m` : '-'}</td><td>${pt.legEtaHours != null ? fmtHoursDecimal(pt.legEtaHours) : '-'}</td><td>${pt.elapsedHours != null ? fmtHoursDecimal(pt.elapsedHours) : '-'}</td><td>${pt.fueling || '-'}</td><td>${pt.cutoff != null ? `${fmtHoursDecimal(pt.cutoff)}<div class="muted-inline">official</div>` : '-'}</td><td>${pt.buffer != null ? `${fmtHoursDecimal(pt.buffer)}${pt.bufferTargetLabel ? `<div class="muted-inline">vs ${pt.bufferTargetLabel}</div>` : ''}` : '-'}</td></tr>`).join('')}</tbody></table></div>`;
}

function renderPlan(plan, raceName) {
  emptyState.hidden = true;
  resultsEl.hidden = false;
  const s = plan.summary;

  summaryEl.innerHTML = [
    ['Race', raceName || 'Unnamed race'],
    ['Distance / EG', `${s.distanceKm.toFixed(1)} km / ${Math.round(s.gainM)} m`],
    ['Elevation loss', `${Math.round(s.lossM)} m`],
    ['Average pace', fmtPace(s.avgPaceMinKm)],
    ['Flat-equivalent pace', fmtPace(s.effortPaceMinKm)],
    ['Overall GAP pace', fmtPace(s.overallGapPaceMinKm)],
    ['Segment mode', s.usesSegmentGpx ? `Real GPX (${s.smoothMode})` : 'Fallback distribution'],
    ['Waypoints', `${s.waypointCount} detected`]
  ].map(([label, value]) => `<div class="summary-card"><span>${label}</span><strong>${value}</strong></div>`).join('');

  metricSourcesEl.innerHTML = plan.metricSources.map(([label, source]) => `<div class="source-chip"><span>${label}</span><strong>${source}</strong></div>`).join('');

  segmentTableEl.innerHTML = plan.segments.map((seg) => {
    const cls = seg.bufferHours < 0 ? 'bad' : seg.bufferHours < 0.5 ? 'warn' : 'good';
    return `<tr><td>${seg.name}<div class="muted-inline">+${Math.round(seg.segmentGainM)}m / -${Math.round(seg.segmentLossM)}m</div></td><td>${seg.km.toFixed(1)}<div class="muted-inline">seg ${seg.segKm.toFixed(1)} km</div></td><td>${fmtHoursDecimal(seg.splitHours)} <div class="muted-inline">${fmtPace(seg.paceMinKm)}</div></td><td>${fmtPace(seg.gapPaceMinKm)} <div class="muted-inline">grade ${seg.gradePercent >= 0 ? '+' : ''}${seg.gradePercent.toFixed(1)}%</div></td><td>${fmtHoursDecimal(seg.etaHours)}</td><td>${fmtHoursDecimal(seg.elapsedHours)}</td><td>${seg.fueling.text}<div class="muted-inline">Na ${seg.fueling.sodiumLow}-${seg.fueling.sodiumHigh}mg</div></td><td>${fmtHoursDecimal(seg.cutoffHours)}<div class="muted-inline">official</div></td><td class="${cls}">${fmtHoursDecimal(seg.bufferHours)}</td></tr>`;
  }).join('');

  fuelingPlanEl.innerHTML = `<ul><li><strong>Carb target:</strong> ${s.carbsPerHour} g/hour (${Math.round(s.totalCarbs)} g total).</li><li><strong>Gel equivalent:</strong> ${Math.ceil(s.gelEquivalent)} gels total (assuming ${s.gelCarbs} g per gel).</li><li><strong>Feed interval:</strong> every ${s.feedIntervalMinutes} minutes, starting at minute ${s.fuelStartMinutes}.</li><li><strong>Hydration:</strong> ${Math.round(s.fluidRangeMl[0])}-${Math.round(s.fluidRangeMl[1])} ml total for <strong>${s.weatherMode}</strong> conditions.</li><li><strong>Sodium:</strong> ${Math.round(s.sodiumRangeMg[0])}-${Math.round(s.sodiumRangeMg[1])} mg total.</li><li><strong>Weather note:</strong> <strong>${s.weatherMode}</strong> works well for races with changing conditions, so fluid and sodium ranges stay more flexible.</li><li><strong>GAP note:</strong> actual pace is for real-time execution, while GAP helps you judge effort more fairly.</li></ul>`;

  fuelScheduleEl.innerHTML = `<div class="class-list">${plan.schedule.entries.slice(0, 12).map((item) => `<div class="class-item"><span>${item.label}</span><strong>${item.clock}</strong><div class="muted-inline">${item.suggestion} · cumulative ~${item.cumulativeCarbs}g</div></div>`).join('')}${plan.schedule.entries.length > 12 ? `<div class="class-item"><span>More</span><strong>+${plan.schedule.entries.length - 12} fuel events</strong><div class="muted-inline">The full schedule is calculated internally, but the view is trimmed to stay readable.</div></div>` : ''}</div>`;

  assumptionsEl.innerHTML = `<div class="class-list"><div class="class-item"><span>Official / factual</span><strong>${plan.classification.official.join(' · ')}</strong></div><div class="class-item"><span>Guideline-based</span><strong>${plan.classification.guideline.join(' · ')}</strong></div><div class="class-item"><span>Model estimate</span><strong>${plan.classification.model.join(' · ')}</strong></div></div>`;

  renderWaypoints(plan.waypoints, plan.segments);
  renderSourcePolicy();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const raceName = document.getElementById('raceName').value.trim();
  const targetHours = parseFloat(document.getElementById('targetHours').value);
  const totalCutoff = parseFloat(document.getElementById('totalCutoff').value);
  const distanceOverride = parseFloat(document.getElementById('distanceOverride').value);
  const elevationOverride = parseFloat(document.getElementById('elevationOverride').value);
  const aidStationDelay = parseFloat(document.getElementById('aidStationDelay').value) || 0;
  const weatherMode = document.getElementById('weatherMode').value;
  const smoothMode = document.getElementById('smoothMode').value;
  const gelCarbs = parseFloat(document.getElementById('gelCarbs').value) || 25;
  const fuelStartMinutes = parseFloat(document.getElementById('fuelStartMinutes').value) || 25;
  const file = document.getElementById('gpxFile').files[0];
  const checkpoints = checkpointRows();

  let parsed = null;
  if (file) parsed = parseGpx(await file.text(), smoothMode);

  const distanceKm = safeNum(distanceOverride) || parsed?.distanceKm || checkpoints.at(-1)?.km;
  const gainM = safeNum(elevationOverride) || parsed?.gainM || 0;
  const lossM = parsed?.lossM || gainM * 0.65;
  if (!distanceKm || !targetHours || !totalCutoff) {
    alert('Please enter a target finish, total cutoff, and either a GPX file or a distance override.');
    return;
  }

  const finishExists = checkpoints.some((cp) => Math.abs(cp.km - distanceKm) < 0.2);
  const finalCheckpoints = [...checkpoints];
  if (!finishExists) finalCheckpoints.push({ name: 'Finish', km: distanceKm, cutoff: totalCutoff });

  const plan = buildPlan({ parsed, distanceKm, gainM, lossM, targetHours, totalCutoff, checkpoints: finalCheckpoints, aidStationDelay, weatherMode, gelCarbs, fuelStartMinutes });
  renderPlan(plan, raceName);
});

renderWaypoints([], []);
renderSourcePolicy();
