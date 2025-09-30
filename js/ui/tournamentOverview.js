import { state } from '../state/matchState.js';
// (fjernet ubrukte imports)
import { openModal, closeModal } from './modal.js';
import { hasActiveMatchState, getContinueLabel } from './session.js';
import { showSplash, setSplashContinueState, syncSplashButtons } from './splash.js';
import { goToStart } from '../main.js';

// Konfig: når turneringen låses (må matche tournamentSetup.js)
const TOURNAMENT_LOCK_MODE = 'onCreation'; // 'onCreation' | 'onFirstMatch'


let mask;
let modal;
let titleElement;
let nameElement;
let closeBtn;
let backBtn;
let startBtn;

function ensureElements(){
  if(!mask) mask = document.getElementById('tournamentOverviewMask');
  if(!mask) return false;
  if(!modal) modal = mask.querySelector('.tournamentOverviewPanel');
  if(!titleElement) titleElement = document.getElementById('tournamentOverviewTitle');
  if(!nameElement) nameElement = document.getElementById('tournamentOverviewName');
  if(!closeBtn) closeBtn = document.getElementById('tournamentOverviewClose');
  if(!backBtn) backBtn = document.getElementById('tournamentOverviewBack');
  if(!startBtn) startBtn = document.getElementById('tournamentOverviewStart');
  return true;
}

function bindEvents(){
  if(!ensureElements()) return;
  if(mask.dataset.bound) return;
  mask.dataset.bound = '1';

  if(closeBtn){
    closeBtn.addEventListener('click', function(){
      hideTournamentOverview();
      goToStart({ from: 'overview' });
    });
  }

  if(backBtn){
    backBtn.addEventListener('click', function(){
      // Guard: blokker tilbake-navigasjon når turneringen er låst
      if(state.tournamentData && state.tournamentData.locked){
        // Avskjær forsøk på å gå tilbake til setup når låst
        return;
      }
      hideTournamentOverview();
      // Import and show tournament setup
      import('./tournamentSetup.js').then(function(module){
        module.showTournamentSetup();
      });
    });
  }

  if(startBtn){
    startBtn.addEventListener('click', function(){
      hideTournamentOverview();
      startFirstMatch();
    });
  }
}

export function showTournamentOverview(){
  if(!ensureElements()) return;
  
  // Ensure we have tournament data
  if(!state.tournamentData || !state.tournamentData.name){
    console.error('No tournament data available');
    return;
  }

  state.allowScoring = false;
  document.body.classList.remove('areas-active');

  // Set the tournament name dynamically
  nameElement.textContent = state.tournamentData.name;

  // Hide/disable back button when tournament is locked
  if(backBtn){
    if(state.tournamentData.locked){
      backBtn.style.display = 'none';
    } else {
      backBtn.style.display = '';
    }
  }

  openModal('#tournamentOverviewMask');

  if (startBtn) {
    const matches = state.tournamentData?.matches || [];
    const matchStates = state.tournamentData?.matchStates || {};
    const hasPending = matches.some(m => {
      const st = matchStates[m.id];
      return !st || (st.status !== 'completed' && st.status !== 'walkover');
    });
    startBtn.disabled = !hasPending;
    startBtn.textContent = hasPending ? 'Start første kamp' : 'Ingen flere kamper';
    startBtn.focus();
  }
}

export function hideTournamentOverview(){
  if(!ensureElements()) return;
  closeModal('#tournamentOverviewMask');
}

function startFirstMatch(){
  // Set tournament mode
  state.playMode = 'tournament';
  
  // Lock tournament when first match starts (if configured)
  if(TOURNAMENT_LOCK_MODE === 'onFirstMatch' && state.tournamentData && !state.tournamentData.locked){
    state.tournamentData.locked = true;
  }

  // Finn første pending kamp (ikke completed/walkover)
  const matches = state.tournamentData?.matches || [];
  const matchStates = state.tournamentData?.matchStates || {};
  const firstPending = matches.find(m => {
    const st = matchStates[m.id];
    // Hvis ingen state: regn som pending
    if (!st) return true;
    return st.status !== 'completed' && st.status !== 'walkover';
  });

  // Ingen pending? Gi tydelig tilbakemelding og disable knappen.
  if (!firstPending) {
    try { 
      const btn = document.getElementById('tournamentOverviewStart');
      if (btn) { btn.disabled = true; btn.textContent = 'Ingen flere kamper'; }
    } catch(_) {}
    return;
  }

  // Start valgt kamp via eksisterende hjelpefunksjon
  handleStartMatch(firstPending.id);
}


export function renderTournamentOverview(){
  if(!state.tournamentData || !state.tournamentData.matches) {
    return;
  }

  const roundsElement = document.getElementById('tournamentRounds');
  if(!roundsElement) return;

  // Clear existing content
  roundsElement.innerHTML = '';

  const scrollTargetId = state.tournamentData.scrollTargetMatchId;
  let targetElement = null;

  // Group matches by round
  const matchesByRound = {};
  state.tournamentData.matches.forEach(match => {
    if(!matchesByRound[match.round]) {
      matchesByRound[match.round] = [];
    }
    matchesByRound[match.round].push(match);
  });

  // Render each round as a table
  Object.keys(matchesByRound).sort((a, b) => parseInt(a) - parseInt(b)).forEach(roundNumber => {
    // Round header
    const roundHeader = document.createElement('h4');
    roundHeader.className = 'tournament-round-header';
    roundHeader.textContent = `Runde ${roundNumber}`;
    roundsElement.appendChild(roundHeader);

    // Create table
    const table = document.createElement('table');
    table.className = 'tournament-table';

    // Table header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = `
      <th>#</th>
      <th>Spillere</th>
      <th>Status</th>
      <th>Handling</th>
    `;
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Table body
    const tbody = document.createElement('tbody');
    const matchesFragment = document.createDocumentFragment();

    matchesByRound[roundNumber].forEach((match, index) => {
      const row = document.createElement('tr');
      row.dataset.matchId = match.id;

      const matchState = state.tournamentData.matchStates?.[match.id];
      const isCompleted = matchState?.status === 'completed';
      const isWalkover = matchState?.status === 'walkover';
      const isOngoing = matchState && !isCompleted && !isWalkover;
      const winner = isCompleted ? (matchState.finalScore.setsA > matchState.finalScore.setsB ? 'A' : 'B') :
                   isWalkover ? matchState.walkoverWinner : null;

      // Match number column
      const matchNumberCell = document.createElement('td');
      matchNumberCell.className = 'match-number';
      matchNumberCell.textContent = `#${index + 1}`;
      row.appendChild(matchNumberCell);

      // Players column
      const playersCell = document.createElement('td');
      playersCell.className = 'match-players';
      
      const playerA = document.createElement('span');
      playerA.className = 'player-name';
      playerA.textContent = match.playerA || 'TBD';
      if (winner === 'A') playerA.classList.add('winner-name');
      
      const vs = document.createElement('span');
      vs.className = 'vs';
      vs.textContent = 'vs';
      
      const playerB = document.createElement('span');
      playerB.className = 'player-name';
      playerB.textContent = match.playerB || 'TBD';
      if (winner === 'B') playerB.classList.add('winner-name');
      
      playersCell.appendChild(playerA);
      playersCell.appendChild(vs);
      playersCell.appendChild(playerB);
      row.appendChild(playersCell);

      // Status column
      const statusCell = document.createElement('td');
      statusCell.className = 'match-status-cell';
      
      if (!matchState) {
        statusCell.innerHTML = '<span class="status-waiting">Venter</span>';
      } else if (isCompleted) {
        const setScores = document.createElement('div');
        setScores.className = 'set-scores';
        
        if (matchState.finalScore && matchState.finalScore.setHistory) {
          matchState.finalScore.setHistory.forEach((set, setIndex) => {
            const setScore = document.createElement('span');
            setScore.className = 'set-score';
            setScore.textContent = `${set.a}-${set.b}`;
            if (winner === 'A' && set.a > set.b) setScore.classList.add('winner-scores');
            if (winner === 'B' && set.b > set.a) setScore.classList.add('winner-scores');
            setScores.appendChild(setScore);
          });
        }
        
        statusCell.appendChild(setScores);
        statusCell.innerHTML += '<div class="status-finished">Ferdig</div>';
      } else if (isWalkover) {
        const winnerName = matchState.walkoverWinner === 'A' ? match.playerA : match.playerB;
        statusCell.innerHTML = `
          <div class="status-finished">Walkover</div>
          <div class="walkover-info">${winnerName} vant</div>
        `;
      } else {
        // Ongoing match
        const setScores = document.createElement('div');
        setScores.className = 'set-scores';
        
        const currentSet = matchState.currentSet ?? 1;
        const totalSets = matchState.totalSets ?? 3;
        
        // Show completed sets
        for (let i = 1; i < currentSet; i++) {
          const setScore = document.createElement('span');
          setScore.className = 'set-score';
          const setA = matchState[`set${i}A`] || 0;
          const setB = matchState[`set${i}B`] || 0;
          setScore.textContent = `${setA}-${setB}`;
          setScores.appendChild(setScore);
        }
        
        // Show current set with pulsing effect
        if (currentSet <= totalSets) {
          const currentSetScore = document.createElement('span');
          currentSetScore.className = 'set-score current live-set';
          currentSetScore.textContent = `${matchState.scoreA}-${matchState.scoreB}`;
          setScores.appendChild(currentSetScore);
        }
        
        statusCell.appendChild(setScores);
        statusCell.innerHTML += '<div class="status-ongoing">Pågår</div>';
      }
      
      row.appendChild(statusCell);

      // Action column
      const actionCell = document.createElement('td');
      actionCell.className = 'match-action';
      
      const actionBtn = document.createElement('button');
      actionBtn.className = 'tournament-table-btn';
      actionBtn.dataset.matchId = match.id;

      if (isCompleted) {
        actionBtn.textContent = 'Ferdig';
        actionBtn.disabled = true;
        actionBtn.classList.add('disabled');
      } else if (isWalkover) {
        actionBtn.textContent = 'Walkover';
        actionBtn.disabled = true;
        actionBtn.classList.add('disabled');
      } else {
        actionBtn.textContent = 'Gå til kamp';
        actionBtn.addEventListener('click', () => handleStartMatch(match.id));
      }

      actionCell.appendChild(actionBtn);
      row.appendChild(actionCell);

      if (match.id === scrollTargetId) targetElement = row;
      matchesFragment.appendChild(row);
    });

    tbody.appendChild(matchesFragment);
    table.appendChild(tbody);
    roundsElement.appendChild(table);
  });

  // Scroll to target match if specified
  if (targetElement) {
    const scrollContainer = roundsElement.closest('.fullscreenPanel .panelBody') || roundsElement;
    requestAnimationFrame(function(){
      const offset = targetElement.offsetTop - 24; // litt headroom
      scrollContainer.scrollTo({ top: offset < 0 ? 0 : offset, behavior: 'smooth' });
      targetElement.classList.add('just-finished');
      setTimeout(() => targetElement.classList.remove('just-finished'), 1500);
      delete state.tournamentData.scrollTargetMatchId;
    });
  }
}

export function setupTournamentOverview(){
  bindEvents();
  if(!ensureElements()) return;
  mask.style.display = 'none';
  mask.setAttribute('aria-hidden', 'true');
}

// Internal function to handle starting a match
function handleStartMatch(matchId) {
  const match = state.tournamentData.matches.find(m => m.id === matchId);
  if (match) {
    import('./matchView.js').then(module => {
      module.startTournamentMatch(matchId);
    });
  }
}

// Make showTournamentOverview available globally
window.showTournamentOverview = showTournamentOverview;
