import { state } from '../state/matchState.js';
import { setBodyScroll } from '../dom.js';
import { showSplash } from './splash.js';

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
      showSplash();
    });
  }

  if(backBtn){
    backBtn.addEventListener('click', function(){
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

  mask.style.display = 'flex';
  mask.setAttribute('aria-hidden', 'false');
  setBodyScroll(false);

  if(startBtn) startBtn.focus();
}

export function hideTournamentOverview(){
  if(!ensureElements()) return;
  mask.style.display = 'none';
  mask.setAttribute('aria-hidden', 'true');
  setBodyScroll(true);
}

function startFirstMatch(){
  // Set tournament mode
  state.playMode = 'tournament';
  
  // Import and call the startMatchFlow function from matchView
  import('./matchView.js').then(function(module){
    module.startMatchFlow({ skipSplash: true });
  });
}

function createPlayerCard(playerName, side, matchState, isWinner, isWalkoverWinner) {
  const card = document.createElement('div');
  card.className = 'playerCard';
  
  // Handle null/placeholder values
  let displayName = playerName;
  if (playerName === null) {
    displayName = 'Walkover';
  } else if (typeof playerName === 'string' && (playerName.includes('Vinner') || playerName.includes('Taper'))) {
    displayName = playerName; // Keep placeholder strings as-is
  }
  
  // Player name
  const nameElement = document.createElement('div');
  nameElement.className = 'playerName';
  nameElement.textContent = displayName;
  
  // Score
  const scoreElement = document.createElement('div');
  scoreElement.className = 'playerScore';
  
  if (!matchState) {
    scoreElement.textContent = '0';
  } else if (matchState.status === 'completed' && matchState.finalScore) {
    scoreElement.textContent = side === 'A' ? matchState.finalScore.scoreA : matchState.finalScore.scoreB;
  } else if (matchState.status === 'walkover') {
    scoreElement.textContent = isWalkoverWinner ? 'W' : '0';
  } else {
    scoreElement.textContent = side === 'A' ? matchState.scoreA : matchState.scoreB;
  }
  
  // Set info
  const setInfoElement = document.createElement('div');
  setInfoElement.className = 'playerSetInfo';
  
  if (!matchState) {
    setInfoElement.textContent = '0 sett';
  } else if (matchState.status === 'completed' && matchState.finalScore) {
    const sets = side === 'A' ? matchState.finalScore.setsA : matchState.finalScore.setsB;
    setInfoElement.textContent = `${sets} sett`;
  } else if (matchState.status === 'walkover') {
    setInfoElement.textContent = isWalkoverWinner ? '1 sett' : '0 sett';
  } else {
    const sets = side === 'A' ? matchState.setsA : matchState.setsB;
    setInfoElement.textContent = `${sets} sett`;
  }
  
  // Assemble card
  card.appendChild(nameElement);
  card.appendChild(scoreElement);
  card.appendChild(setInfoElement);
  
  // Add winner styling
  if (isWinner || isWalkoverWinner) {
    card.classList.add('winner');
    // Add fade-in animation for winner badge
    setTimeout(() => card.classList.add('winner-visible'), 100);
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
      
      // Create match header
      const matchHeader = document.createElement('div');
      matchHeader.className = 'matchHeader';
      matchHeader.textContent = `Kamp ${index + 1}`;
      
      // Create player cards container
      const playerCardsContainer = document.createElement('div');
      playerCardsContainer.className = 'playerCardsContainer';
      
      const matchState = state.tournamentData.matchStates?.[match.id];
      const isCompleted = matchState?.status === 'completed';
      const isWalkover = matchState?.status === 'walkover';
      const winner = isCompleted ? (matchState.finalScore.setsA > matchState.finalScore.setsB ? 'A' : 'B') : 
                   isWalkover ? matchState.walkoverWinner : null;
      
      // Create player A card
      const playerACard = createPlayerCard(
        match.playerA, 
        'A', 
        matchState, 
        winner === 'A',
        isWalkover && matchState.walkoverWinner === 'A'
      );
      
      // Create player B card
      const playerBCard = createPlayerCard(
        match.playerB, 
        'B', 
        matchState, 
        winner === 'B',
        isWalkover && matchState.walkoverWinner === 'B'
      );
      
      // Create VS indicator
      const vsIndicator = document.createElement('div');
      vsIndicator.className = 'vsIndicator';
      vsIndicator.textContent = 'vs';
      
      playerCardsContainer.appendChild(playerACard);
      playerCardsContainer.appendChild(vsIndicator);
      playerCardsContainer.appendChild(playerBCard);
      
      // Create status line
      const statusLine = document.createElement('div');
      statusLine.className = 'matchStatusLine';
      
      if (!matchState) {
        statusLine.textContent = 'Venter på start';
      } else if (isCompleted) {
        const winnerName = winner === 'A' ? match.playerA : match.playerB;
        statusLine.innerHTML = `Avsluttet – ${winnerName} vant <span class="statusIndicator"></span>`;
      } else if (isWalkover) {
        const winnerName = matchState.walkoverWinner === 'A' ? match.playerA : match.playerB;
        statusLine.innerHTML = `Walkover – ${winnerName} vant <span class="statusIndicator"></span>`;
      } else {
        statusLine.textContent = `Pågår – sett ${matchState.currentSet}`;
      }
      
      // Create action button
      const startMatchBtn = document.createElement('button');
      startMatchBtn.className = 'tournamentMatchBtn';
      startMatchBtn.textContent = 'Gå til kamp';
      startMatchBtn.dataset.matchId = match.id;
      
      // Disable button for completed or walkover matches
      if (isCompleted || isWalkover) {
        startMatchBtn.disabled = true;
        startMatchBtn.textContent = isWalkover ? 'Walkover' : 'Ferdig';
        startMatchBtn.classList.add('disabled');
      } else {
        startMatchBtn.addEventListener('click', () => handleStartMatch(match.id));
      }
      
      // Assemble match item
      matchItem.appendChild(matchHeader);
      matchItem.appendChild(playerCardsContainer);
      matchItem.appendChild(statusLine);
      matchItem.appendChild(startMatchBtn);
      
      // Check if this is the target match for scrolling
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
