import { state } from '../state/matchState.js';
import { loadMatches, saveMatches } from '../services/storage.js';
import { fitScores } from './layout.js';
// (fjernet ubrukte imports)
import { openModal, closeModal } from './modal.js';

let lastRenderMenu = null;
let lastHandlers = null;
let onModeChange = null;

function ensureStatsShell(){
  var panelBody = document.getElementById('statsPanelBody');
  if(!panelBody) return null;
  
  // Check if it only contains the placeholder comment
  const hasOnlyComment = panelBody.children.length === 0 && panelBody.innerHTML.includes('Stats content will be rendered here');
  
  if(!panelBody.hasChildNodes() || hasOnlyComment) {
    panelBody.innerHTML = '<h3>Alle kamper & oversikt</h3>'+
      '<div id="stats" class="stats"></div>'+
      '<div id="leaderboard"></div>'+
      '<div style="height:.6rem"></div>'+
      '<table>'+
        '<thead><tr><th>#</th><th>Dato</th><th>Spiller A</th><th>Spiller B</th><th>Sett</th><th>Vinner</th><th>Handling</th></tr></thead>'+
        '<tbody id="historyBody"></tbody>'+
      '</table>';
  }
  return panelBody;
}

export function fmtStats(matches){
  var stats = {
    matches: matches.length,
    sets: 0,
    straight: 0,
    three: 0,
    deuceSets: 0,
    avgMargin: 0,
    maxTotalSet: null
  };
  var marginSum = 0;

  matches.forEach(function(match){
    var sets = match.sets || [];
    stats.sets += sets.length;
    var wins = [0,0];

    sets.forEach(function(set){
      var a = +set.a || 0;
      var b = +set.b || 0;
      if(a > b) wins[0]++; else wins[1]++;
      var total = a + b;
      var margin = Math.abs(a - b);
      marginSum += margin;
      if(a >= 20 && b >= 20) stats.deuceSets++;
      if(!stats.maxTotalSet || total > (stats.maxTotalSet.a + stats.maxTotalSet.b)){
        stats.maxTotalSet = { a: a, b: b, names: match.names };
      }
    });

    if(wins[0] === 2 || wins[1] === 2) stats.straight++;
    else stats.three++;
  });

  stats.avgMargin = stats.sets ? (marginSum / stats.sets) : 0;
  return stats;
}

export function renderStats(matches, modeChangeCb, renderMenuFn, handlers){
  matches = matches || loadMatches();
  onModeChange = modeChangeCb;
  lastRenderMenu = renderMenuFn || lastRenderMenu;
  lastHandlers = handlers || lastHandlers;

  let host = ensureStatsShell();
  if(!host){
    // init én gang og prøv igjen
    try { 
      if (typeof setupStatsModal === 'function') setupStatsModal(); 
    } catch(_) {}
    host = ensureStatsShell();
    if(!host){
      // siste fallback: logg og vis noe synlig
      console && console.warn && console.warn('statsPanelBody missing');
      const mask = document.getElementById('statsMask');
      if (mask) openModal('#statsMask');
      return;
    }
  }
  
  try {
    // Show stats modal
    openModal('#statsMask');

    state.VIEW_MODE = 'stats';
    document.body.classList.add('stats-mode');

    if(typeof onModeChange === 'function') onModeChange('stats');
    if(lastRenderMenu) lastRenderMenu('stats', lastHandlers);

    var stats = fmtStats(matches);
    
    var statsContainer = document.getElementById('stats');
    if(statsContainer){
      statsContainer.innerHTML = '';
      statsContainer.appendChild(statCard('Kamper lagret', stats.matches));
      statsContainer.appendChild(statCard('Sett spilt', stats.sets));
      statsContainer.appendChild(statCard('2-0-kamper', stats.straight));
      statsContainer.appendChild(statCard('3-settskamper', stats.three));
      statsContainer.appendChild(statCard('Deuce-sett (≥20–20)', String(stats.deuceSets)));
      statsContainer.appendChild(statCard('Snitt seiersmargin/sett', stats.avgMargin.toFixed(2)));
      if(stats.maxTotalSet){
        statsContainer.appendChild(statCard('Høyest poeng i ett sett', stats.maxTotalSet.a + '-' + stats.maxTotalSet.b));
      }
    }

  var leaderDiv = document.getElementById('leaderboard');
  if(leaderDiv){
    leaderDiv.innerHTML = '<h4 style="margin:.2rem 0 .4rem 0">Seiersoversikt</h4>';
    var winMap = {};
    matches.forEach(function(match){
      var w = match.winner || '';
      winMap[w] = (winMap[w] || 0) + 1;
    });
    var entries = Object.keys(winMap).map(function(name){
      return [name, winMap[name]];
    }).sort(function(a,b){ return b[1] - a[1]; });
    if(!entries.length){
      leaderDiv.appendChild(document.createTextNode('Ingen lagrede kamper ennå.'));
    }else{
      var cont = document.createElement('div');
      cont.className = 'leader';
      entries.forEach(function(entry){
        var name = document.createElement('div');
        name.textContent = entry[0];
        var count = document.createElement('div');
        count.textContent = entry[1];
        count.style.textAlign = 'right';
        cont.appendChild(name);
        cont.appendChild(count);
      });
      leaderDiv.appendChild(cont);
    }
  }

  var body = document.getElementById('historyBody');
  if(body){
    body.innerHTML = '';
    matches.forEach(function(match, idx){
      var tr = document.createElement('tr');
      function td(txt){
        var cell = document.createElement('td');
        cell.textContent = txt;
        return cell;
      }
      tr.appendChild(td(String(idx + 1)));
      tr.appendChild(td(formatDate(match.ts)));
      tr.appendChild(td(match.names?.A || 'Spiller A'));
      tr.appendChild(td(match.names?.B || 'Spiller B'));
      var parts = (match.sets || []).map(function(set){
        return String(set.a) + '-' + String(set.b);
      });
      tr.appendChild(td(parts.join(' , ')));
      tr.appendChild(td(match.winner || ''));

      var tdAct = document.createElement('td');
      var del = document.createElement('button');
      del.className = 'button';
      del.textContent = 'Slett';
      del.addEventListener('click', function(){
        var arr = loadMatches();
        arr.splice(idx, 1);
        saveMatches(arr);
        renderStats(arr, onModeChange, lastRenderMenu, lastHandlers);
      });
      tdAct.appendChild(del);
      tr.appendChild(tdAct);
      body.appendChild(tr);
    });
  }
  } catch (err) {
    console && console.error && console.error('renderStats failed', err);
    if (host) {
      host.innerHTML = '<div class="statsError">Kunne ikke generere statistikk akkurat nå.</div>';
    }
  }
}

export function showMatch(){
  // Hide stats modal
  closeModal('#statsMask');

  state.VIEW_MODE = 'match';
  document.body.classList.remove('stats-mode');
  if(typeof onModeChange === 'function') onModeChange('match');
  if(lastRenderMenu) lastRenderMenu('match', lastHandlers);

  fitScores();
}

export function setupStatsModal(){
  const closeBtn = document.getElementById('statsClose');
  const mask = document.getElementById('statsMask');
  
  if(closeBtn) {
    closeBtn.addEventListener('click', showMatch);
  }
  
  if(mask) {
    mask.addEventListener('click', function(e) {
      if(e.target === mask) showMatch();
    });
  }
}

function statCard(label, value){
  var card = document.createElement('div');
  card.className = 'stat';
  card.innerHTML = '<div class="muted">'+label+'</div>'+
    '<div style="font-size:1.15rem;font-weight:700">'+value+'</div>';
  return card;
}

function formatDate(ts){
  var d = new Date(ts || Date.now());
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}



