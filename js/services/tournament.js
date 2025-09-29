/**
 * Tournament service functions
 */

/**
 * Generate Swiss tournament Round 1 matches with placeholder rounds
 * @param {Array} participants - Array of participant names
 * @returns {Object} Object with round1 and placeholderRounds
 */
export function generateSwissRoundOne(participants) {
  if (!participants || participants.length < 2) {
    return { round1: [], placeholderRounds: [] };
  }

  // Filter out empty strings
  const validParticipants = participants.filter(name => name && name.trim().length > 0);
  
  if (validParticipants.length < 2) {
    return { round1: [], placeholderRounds: [] };
  }

  const round1 = [];
  
  // Pair participants in order (0-1, 2-3, ...)
  for (let i = 0; i < validParticipants.length; i += 2) {
    const playerA = validParticipants[i];
    const playerB = (i + 1 < validParticipants.length) ? validParticipants[i + 1] : null;
    
    round1.push({
      id: `match-${round1.length + 1}`,
      round: 1,
      playerA: playerA,
      playerB: playerB
    });
  }

  // Store Round 1 match IDs for reference
  const roundOneIds = round1.map(match => match.id);
  
  // Generate placeholder rounds
  const placeholderRounds = [];
  
  // Round 2: Winners vs Winners, Losers vs Losers
  const round2Matches = [];
  
  // Process winners bracket
  const winnersCount = round1.length;
  for (let i = 0; i < winnersCount; i += 2) {
    if (i + 1 < winnersCount) {
      // Normal pairing
      round2Matches.push({
        id: `match-${round1.length + round2Matches.length + 1}`,
        round: 2,
        playerA: `Vinner kamp ${roundOneIds[i]}`,
        playerB: `Vinner kamp ${roundOneIds[i + 1]}`
      });
    } else {
      // Odd number - last player gets walkover
      round2Matches.push({
        id: `match-${round1.length + round2Matches.length + 1}`,
        round: 2,
        playerA: `Vinner kamp ${roundOneIds[i]}`,
        playerB: 'Walkover'
      });
    }
  }
  
  // Process losers bracket
  for (let i = 0; i < winnersCount; i += 2) {
    if (i + 1 < winnersCount) {
      // Normal pairing
      round2Matches.push({
        id: `match-${round1.length + round2Matches.length + 1}`,
        round: 2,
        playerA: `Taper kamp ${roundOneIds[i]}`,
        playerB: `Taper kamp ${roundOneIds[i + 1]}`
      });
    } else {
      // Odd number - last player gets walkover
      round2Matches.push({
        id: `match-${round1.length + round2Matches.length + 1}`,
        round: 2,
        playerA: `Taper kamp ${roundOneIds[i]}`,
        playerB: 'Walkover'
      });
    }
  }
  
  // Round 3: Final matches
  const round3Matches = [];
  if (round2Matches.length >= 2) {
    round3Matches.push({
      id: `match-${round1.length + round2Matches.length + 1}`,
      round: 3,
      playerA: `Vinner kamp ${round2Matches[0].id}`,
      playerB: `Vinner kamp ${round2Matches[1].id}`
    });
    
    if (round2Matches.length >= 4) {
      round3Matches.push({
        id: `match-${round1.length + round2Matches.length + 2}`,
        round: 3,
        playerA: `Vinner kamp ${round2Matches[2].id}`,
        playerB: `Vinner kamp ${round2Matches[3].id}`
      });
    }
  }

  placeholderRounds.push(...round2Matches, ...round3Matches);

  return { round1, placeholderRounds };
}