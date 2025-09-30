import { state } from '../state/matchState.js';
// (fjernet ubrukte imports)
import { openModal, closeModal } from './modal.js';
import { showSplash, setSplashContinueState, syncSplashButtons } from './splash.js';

// Konfig: når turneringen låses (må matche tournamentSetup.js)
const TOURNAMENT_LOCK_MODE = 'onCreation'; // 'onCreation' | 'onFirstMatch'

function hasActiveMatchState(){
  return (
    state.allowScoring ||
    state.scoreA > 0 ||
    state.scoreB > 0 ||
    state.setsA > 0 ||
    state.setsB > 0 ||
    (Array.isArray(state.setHistory) && state.setHistory.length > 0) ||
    state.betweenSets ||
    state.locked
  );
}

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
      // Oppdater "Fortsett"-knappen live
      const visible = hasActiveMatchState();
      const continueLabel = state.playMode === 'tournament'
        ? 'Fortsett pågående turnering'
        : 'Fortsett pågående kamp';
      setSplashContinueState({ visible, label: continueLabel });
      syncSplashButtons();
      showSplash();
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

function createMatchPlayerCard(playerName, side, matchState, isWinner, isWalkoverWinner) {
  const card = document.createElement('article');
  card.className = 'player-card';
  
  // Handle null/placeholder values
  let displayName = playerName;
  if (playerName === null) {
    displayName = 'Walkover';
  } else if (typeof playerName === 'string' && (playerName.includes('Vinner') || playerName.includes('Taper'))) {
    displayName = playerName; // Keep placeholder strings as-is
  }
  
  // Header with name and set badge
  const header = document.createElement('header');
  header.className = 'card-header';
  
  const nameElement = document.createElement('div');
  nameElement.className = 'player-name';
  nameElement.textContent = displayName;
  
  const setBadge = document.createElement('div');
  setBadge.className = 'set-badge';
  
  // Calculate sets won
  let setsWon = 0;
  if (!matchState) {
    setsWon = 0;
  } else if (matchState.status === 'completed' && matchState.finalScore) {
    setsWon = side === 'A' ? matchState.finalScore.setsA : matchState.finalScore.setsB;
  } else if (matchState.status === 'walkover') {
    setsWon = isWalkoverWinner ? 1 : 0;
  } else {
    setsWon = side === 'A' ? matchState.setsA : matchState.setsB;
  }
  
  setBadge.textContent = setsWon;
  
  header.appendChild(nameElement);
  header.appendChild(setBadge);
  
  // Score slot
  const scoreSlot = document.createElement('div');
  scoreSlot.className = 'score-slot';
  
  if (!matchState) {
    scoreSlot.textContent = '0';
  } else if (matchState.status === 'completed' && matchState.finalScore) {
    scoreSlot.textContent = side === 'A' ? matchState.finalScore.scoreA : matchState.finalScore.scoreB;
  } else if (matchState.status === 'walkover') {
    scoreSlot.textContent = isWalkoverWinner ? 'W' : '0';
  } else {
    scoreSlot.textContent = side === 'A' ? matchState.scoreA : matchState.scoreB;
  }
  
  // Assemble card
  card.appendChild(header);
  card.appendChild(scoreSlot);
  
  // Add winner styling
  const isFinished = matchState?.status === 'completed' || matchState?.status === 'walkover';
  if (isWinner && isFinished) {
    card.classList.add('winner');
    nameElement.classList.add('gold-text');
    scoreSlot.classList.add('gold-text');
  }
  
  // Fade out score for finished matches
  if (isFinished) {
    scoreSlot.style.opacity = '0';
    setTimeout(() => {
      scoreSlot.style.display = 'none';
    }, 300);
  }
  
  return card;
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

  // Render each round
  Object.keys(matchesByRound).sort((a, b) => parseInt(a) - parseInt(b)).forEach(roundNumber => {
    const roundDiv = document.createElement('div');
    roundDiv.className = 'tournamentRound';
    
    const roundTitle = document.createElement('h4');
    roundTitle.textContent = `Runde ${roundNumber}`;
    roundDiv.appendChild(roundTitle);

    const matchesList = document.createElement('ul');
    matchesList.className = 'tournamentMatches';

    matchesByRound[roundNumber].forEach((match, index) => {
      const matchItem = document.createElement('li');
      matchItem.className = 'tournamentMatch';

      const matchLabel = document.createElement('span');
      matchLabel.className = 'matchLabel';
      matchLabel.textContent = `Kamp ${index + 1}`;

      const matchBody = document.createElement('div');
      matchBody.className = 'matchBody';

      const playerCardsContainer = document.createElement('div');
      playerCardsContainer.className = 'playerCardsContainer';

      const matchState = state.tournamentData.matchStates?.[match.id];
      const isCompleted = matchState?.status === 'completed';
      const isWalkover = matchState?.status === 'walkover';
      const winner = isCompleted ? (matchState.finalScore.setsA > matchState.finalScore.setsB ? 'A' : 'B') :
                   isWalkover ? matchState.walkoverWinner : null;

      const playerACard = createMatchPlayerCard(
        match.playerA,
        'A',
        matchState,
        winner === 'A',
        isWalkover && matchState.walkoverWinner === 'A'
      );

      const playerBCard = createMatchPlayerCard(
        match.playerB,
        'B',
        matchState,
        winner === 'B',
        isWalkover && matchState.walkoverWinner === 'B'
      );

      const matchVs = document.createElement('div');
      matchVs.className = 'match-vs';

      const statusTag = document.createElement('span');
      statusTag.className = 'match-status';

      if (!matchState) {
        statusTag.textContent = 'Venter';
        statusTag.classList.add('status-waiting');
      } else if (isCompleted) {
        const winnerName = winner === 'A' ? match.playerA : match.playerB;
        statusTag.textContent = `Avsluttet - ${winnerName} vant`;
        statusTag.classList.add('status-finished');
      } else if (isWalkover) {
        const winnerName = matchState.walkoverWinner === 'A' ? match.playerA : match.playerB;
        statusTag.textContent = `Walkover - ${winnerName} vant`;
        statusTag.classList.add('status-finished');
      } else {
        statusTag.textContent = 'Pågår';
        statusTag.classList.add('status-ongoing');
      }

      const vsChip = document.createElement('span');
      vsChip.className = 'vs-chip';
      vsChip.textContent = 'vs';

      matchVs.appendChild(statusTag);
      matchVs.appendChild(vsChip);

      playerCardsContainer.appendChild(playerACard);
      playerCardsContainer.appendChild(matchVs);
      playerCardsContainer.appendChild(playerBCard);
      matchBody.appendChild(playerCardsContainer);

      const matchSummary = document.createElement('div');
      matchSummary.className = 'match-summary';

      if (!matchState) {
        matchSummary.textContent = 'Venter på start';
        matchSummary.style.opacity = '0.7';
      } else if (isCompleted && matchState.finalScore && matchState.finalScore.setHistory) {
        const setTexts = matchState.finalScore.setHistory.map((set, setIndex) => {
          return `Sett ${setIndex + 1}: ${set.a}-${set.b}`;
        });
        matchSummary.textContent = setTexts.join(' | ');
        matchSummary.style.opacity = '1';
      } else if (isWalkover) {
        matchSummary.textContent = 'Walkover';
        matchSummary.style.opacity = '1';
      } else {
        const currentSet = matchState.currentSet ?? 1;
        matchSummary.textContent = `Sett ${currentSet} pågår`;
        matchSummary.style.opacity = '0.7';
      }

      matchBody.appendChild(matchSummary);

      const actionsWrapper = document.createElement('div');
      actionsWrapper.className = 'actions';

      const startMatchBtn = document.createElement('button');
      startMatchBtn.className = 'tournamentMatchBtn';
      startMatchBtn.textContent = 'Gå til kamp';
      startMatchBtn.dataset.matchId = match.id;

      if (isCompleted || isWalkover) {
        startMatchBtn.disabled = true;
        startMatchBtn.textContent = isWalkover ? 'Walkover' : 'Ferdig';
        startMatchBtn.classList.add('disabled');
      } else {
        startMatchBtn.addEventListener('click', () => handleStartMatch(match.id));
      }

      actionsWrapper.appendChild(startMatchBtn);

      matchItem.appendChild(matchLabel);
      matchItem.appendChild(matchBody);
      matchItem.appendChild(actionsWrapper);

      if (match.id === scrollTargetId) targetElement = matchItem;

      matchesList.appendChild(matchItem);
    });

    roundDiv.appendChild(matchesList);
    roundsElement.appendChild(roundDiv);
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
