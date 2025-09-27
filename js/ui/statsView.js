import { loadMatches, saveMatches } from '../services/storage.js';
import { $ } from './dom.js';

export function ensureStatsShell(){
  var ex = document.getElementById('statsHost');
  if (ex) return ex;
  
  var host = document.createElement('div');
  host.id = 'statsHost';
  host.className = 'summary';
  host.style.display = 'none';
  host.innerHTML = 
    '<h3>Alle kamper & oversikt</h3>' +
    '<div id="stats" class="stats"></div>' +
    '<div id="leaderboard"></div>' +
    '<div style="height:.6rem"></div>' +
    '<table>' +
      '<thead><tr>' +
        '<th>#</th><th>Dato</th><th>Spiller A</th><th>Spiller B</th><th>Sett</th><th>Vinner</th><th>Handling</th>' +
      '</tr></thead>' +
      '<tbody id="historyBody"></tbody>' +
    '</table>';
  document.body.appendChild(host);
  return host;
}

export function fmtStats(arr) {
  var stats = {
    matches: arr.length,
    sets: 0,
    straight: 0,      // 2–0-kamper
    three: 0,         // 2–1-kamper
    deuceSets: 0,     // sett som nådde ≥20–20
    avgMargin: 0,     // snitt seiersmargin per sett
    maxTotalSet: null // {a,b,names}
  };
  var marginSum = 0;

  for (var i = 0; i < arr.length; i++) {
    var m = arr[i];
    var sets = m.sets || [];
    stats.sets += sets.length;
    var wins = [0, 0]; // [A,B]

    for (var j = 0; j < sets.length; j++) {
      var s = sets[j];
      var a = +s.a || 0, b = +s.b || 0;

      wins[a > b ? 0 : 1]++;

      var total = a + b;
      var margin = Math.abs(a - b);
      marginSum += margin;

      if (a >= 20 && b >= 20) stats.deuceSets++;
      if (!stats.maxTotalSet || total > (stats.maxTotalSet.a + stats.maxTotalSet.b)) {
        stats.maxTotalSet = { a: a, b: b, names: m.names };
      }
    }

    if (wins[0] === 2 || wins[1] === 2) stats.straight++;
    else stats.three++;
  }

  stats.avgMargin = stats.sets ? (marginSum / stats.sets) : 0;
  return stats;
}

export function renderStats(arr, setViewMode, renderMenu) {
  var s = fmtStats(arr);
  var host = ensureStatsShell();
  host.style.display = 'block';
  
  // Skjul kampvisningen
  document.querySelector('.wrap').style.display = 'none';
  var summaryBtn = document.getElementById('showSummaryBtn');
  if (summaryBtn) summaryBtn.style.display = 'none';
  
  // Sett VIEW_MODE til stats og legg til CSS-klasse
  setViewMode('stats');
  document.body.classList.add('stats-mode');
  
  // Debug logging
  console.log('renderStats: VIEW_MODE satt til: stats');
  
  // Oppdater menyen
  renderMenu('stats');
  
  var el = document.getElementById('stats');
  el.innerHTML = '';

  function card(label, val) {
    var d = document.createElement('div');
    d.className = 'stat';
    d.innerHTML = 
      '<div class="muted">' + label + '</div>' +
      '<div style="font-size:1.15rem;font-weight:700">' + val + '</div>';
    return d;
  }

  el.appendChild(card('Kamper lagret', s.matches));
  el.appendChild(card('Sett spilt', s.sets));
  el.appendChild(card('2–0-kamper', s.straight));
  el.appendChild(card('3-settskamper', s.three));
  el.appendChild(card('Deuce-sett (≥20–20)', String(s.deuceSets)));
  el.appendChild(card('Snitt seiersmargin/sett', s.avgMargin.toFixed(2)));
  if (s.maxTotalSet) {
    el.appendChild(card('Høyest poeng i ett sett', s.maxTotalSet.a + '-' + s.maxTotalSet.b));
  }

  // Leaderboard (antall seire per spiller-navn)
  var all = loadMatches();
  var winMap = {};
  for (var i = 0; i < all.length; i++) {
    var w = all[i].winner || '';
    winMap[w] = (winMap[w] || 0) + 1;
  }

  var leaderDiv = document.getElementById('leaderboard');
  leaderDiv.innerHTML = '<h4 style="margin:.2rem 0 .4rem 0">Seiersoversikt</h4>';

  var entries = [];
  for (var k in winMap) {
    if (Object.prototype.hasOwnProperty.call(winMap, k)) {
      entries.push([k, winMap[k]]);
    }
  }
  entries.sort(function(a, b) { return b[1] - a[1]; });

  if (!entries.length) {
    leaderDiv.appendChild(document.createTextNode('Ingen lagrede kamper ennå.'));
  } else {
    var cont = document.createElement('div');
    cont.className = 'leader';
    for (var ii = 0; ii < entries.length; ii++) {
      var n = document.createElement('div');
      n.textContent = entries[ii][0];
      var c = document.createElement('div');
      c.textContent = entries[ii][1];
      c.style.textAlign = 'right';
      cont.appendChild(n);
      cont.appendChild(c);
    }
    leaderDiv.appendChild(cont);
  }

  // Historikktabell
  var body = document.getElementById('historyBody');
  body.innerHTML = '';
  for (i = 0; i < all.length; i++) {
    (function(idx) {
      var m = all[idx];
      var tr = document.createElement('tr');

      function td(txt) {
        var x = document.createElement('td');
        x.textContent = txt;
        return x;
      }
      
      function fmtDate(ts) {
        var d = new Date(ts);
        return d.toLocaleString(undefined, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      }

      tr.appendChild(td(String(idx + 1)));
      tr.appendChild(td(fmtDate(m.ts)));
      tr.appendChild(td(m.names.A));
      tr.appendChild(td(m.names.B));

      var parts = [];
      for (var j = 0; j < (m.sets || []).length; j++) {
        var s2 = m.sets[j];
        parts.push(String(s2.a) + '-' + String(s2.b));
      }
      tr.appendChild(td(parts.join(' , ')));
      tr.appendChild(td(m.winner));

      var tdAct = document.createElement('td');
      var del = document.createElement('button');
      del.className = 'button';
      del.textContent = 'Slett';
      del.addEventListener('click', function() {
        var arr2 = loadMatches();
        arr2.splice(idx, 1);
        saveMatches(arr2);
        renderStats(arr2, setViewMode, renderMenu);
      });
      tdAct.appendChild(del);
      tr.appendChild(tdAct);

      body.appendChild(tr);
    })(i);
  }
}

export function showMatch(setViewMode, renderMenu, setBodyScroll, updateEditableState, fitScores) {
  // Vis kampvisningen igjen
  var wrap = document.querySelector('.wrap');
  if (wrap) {
    // Viktig: la CSS ta over (grid fra stylesheet), eller sett eksplisitt 'grid'
    wrap.style.display = ''; // eller: wrap.style.display = 'grid';
  }

  var statsHost = document.getElementById('statsHost');
  if (statsHost) statsHost.style.display = 'none';

  // Sett modus tilbake og rydd opp
  setViewMode('match');
  document.body.classList.remove('stats-mode');
  setBodyScroll(false);          // i tilfelle noe har låst scroll
  updateEditableState();         // reaktiverer .areas-active for klikk
  fitScores();                   // rekalkulerer fontstørrelser etter layout-endring

  // Bygg riktig meny (kamp-menyen)
  renderMenu('match');
}

