export interface GridConfig {
  numItems: number;
  numUsers: number;
  origin: { x: number; y: number };
  cardWidth: number;
  cardHeight: number;
  personaWidth: number;
  personaHeight: number;
  feedbackWidth: number;
  feedbackHeight: number;
  colGap: number;
  rowGap: number;
}

export interface CellPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function buildGridConfig(
  items: Array<{ width: number; height: number }>,
  numUsers: number,
  origin: { x: number; y: number },
  gaps: { colGap: number; rowGap: number } = { colGap: 20, rowGap: 20 },
): GridConfig {
  const cardWidth = Math.max(...items.map((i) => i.width));
  const cardHeight = Math.max(...items.map((i) => i.height));
  return {
    numItems: items.length,
    numUsers,
    origin,
    cardWidth,
    cardHeight,
    personaWidth: cardWidth,
    personaHeight: cardHeight,
    feedbackWidth: cardWidth,
    feedbackHeight: cardHeight,
    colGap: gaps.colGap,
    rowGap: gaps.rowGap,
  };
}

// col 0 = persona (left of origin), col 1..N = items, col N+1 = feedback
function getColX(col: number, config: GridConfig): number {
  const { origin, personaWidth, cardWidth, colGap } = config;
  if (col === 0) return origin.x - personaWidth - colGap;
  return origin.x + (col - 1) * (cardWidth + colGap);
}

// row 0 = header items, row 1..K = user rows
function getRowY(row: number, config: GridConfig): number {
  const { origin, cardHeight, rowGap } = config;
  if (row === 0) return origin.y;
  return origin.y + cardHeight + rowGap + (row - 1) * (cardHeight + rowGap);
}

export function getHeaderItemPosition(itemIndex: number, config: GridConfig): CellPosition {
  return {
    x: getColX(itemIndex + 1, config),
    y: getRowY(0, config),
    width: config.cardWidth,
    height: config.cardHeight,
  };
}

export function getPersonaPosition(userIndex: number, config: GridConfig): CellPosition {
  return {
    x: getColX(0, config),
    y: getRowY(userIndex + 1, config),
    width: config.personaWidth,
    height: config.personaHeight,
  };
}

// rankPosition 0 = least matching trait (col 1), rankPosition N-1 = most matching (col N)
export function getRankedItemPosition(userIndex: number, rankPosition: number, config: GridConfig): CellPosition {
  return {
    x: getColX(rankPosition + 1, config),
    y: getRowY(userIndex + 1, config),
    width: config.cardWidth,
    height: config.cardHeight,
  };
}

export function getFeedbackPosition(userIndex: number, config: GridConfig): CellPosition {
  return {
    x: getColX(config.numItems + 1, config),
    y: getRowY(userIndex + 1, config),
    width: config.feedbackWidth,
    height: config.feedbackHeight,
  };
}
