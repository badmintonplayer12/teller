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
      
      let playerAText = match.playerA;
      let playerBText = match.playerB;
      
      // Handle null values (walkover)
      if (playerAText === null) playerAText = 'Walkover';
      if (playerBText === null) playerBText = 'Walkover';
      
      // Handle placeholder strings (already formatted)
      if (typeof playerAText === 'string' && (playerAText.includes('Vinner') || playerAText.includes('Taper'))) {
        // Keep as is - it's already a placeholder string
      }
      if (typeof playerBText === 'string' && (playerBText.includes('Vinner') || playerBText.includes('Taper'))) {
        // Keep as is - it's already a placeholder string
      }
      
      // Create match info text
      let matchText;
      if (playerBText === 'Walkover') {
        matchText = `Kamp ${index + 1}: ${playerAText} (walkover)`;
      } else if (playerAText === 'Walkover') {
        matchText = `Kamp ${index + 1}: ${playerBText} (walkover)`;
      } else {
        matchText = `Kamp ${index + 1}: ${playerAText} vs ${playerBText}`;
      }
      
      // Add match info text
      const matchInfoSpan = document.createElement('span');
      matchInfoSpan.textContent = matchText;
      
      // Add match status
      const matchStatus = document.createElement('div');
      matchStatus.className = 'matchStatus';
      
      const matchState = state.tournamentData.matchStates?.[match.id];
      if (!matchState) {
        matchStatus.textContent = 'Venter på start';
      } else if (matchState.status === 'completed') {
        if (matchState.finalScore) {
          matchStatus.textContent = `Ferdig: ${matchState.finalScore.scoreA}–${matchState.finalScore.scoreB} (${matchState.finalScore.setsA}-${matchState.finalScore.setsB})`;
        } else {
          matchStatus.textContent = 'Ferdig';
        }
      } else if (matchState.status === 'walkover') {
        const winnerName = matchState.walkoverWinner === 'A' ? match.playerA : match.playerB;
        matchStatus.textContent = `Walkover – ${winnerName}`;
      } else {
        matchStatus.textContent = `Pågår: ${matchState.scoreA}–${matchState.scoreB} (sett ${matchState.currentSet}, ${matchState.setsA}-${matchState.setsB})`;
      }
      
      // Create info container
      const matchInfoContainer = document.createElement('div');
      matchInfoContainer.className = 'tournamentMatchInfo';
      matchInfoContainer.appendChild(matchInfoSpan);
      matchInfoContainer.appendChild(matchStatus);
      
      matchItem.appendChild(matchInfoContainer);
      
      // Add "Gå til kamp" button
      const startMatchBtn = document.createElement('button');
      startMatchBtn.className = 'tournamentMatchBtn';
      startMatchBtn.textContent = 'Gå til kamp';
      startMatchBtn.dataset.matchId = match.id;
      
      // Disable button for completed or walkover matches
      if (matchState?.status === 'completed' || matchState?.status === 'walkover') {
        startMatchBtn.disabled = true;
        startMatchBtn.textContent = matchState.status === 'walkover' ? 'Walkover' : 'Ferdig';
        startMatchBtn.classList.add('disabled');
      } else {
        startMatchBtn.addEventListener('click', () => handleStartMatch(match.id));
      }
      
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
