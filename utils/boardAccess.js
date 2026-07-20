import Board from '../models/Board.js';

export async function getBoardIfMember(boardId, userId) {
  const board = await Board.findById(boardId);
  if (!board) {
    const err = new Error('Board not found');
    err.status = 404;
    throw err;
  }
  const uid = String(userId);
  const isMember =
    String(board.owner) === uid || board.members.some((m) => String(m) === uid);
  if (!isMember) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  return board;
}

export async function reindexCardsInList(listId, session = null) {
  const Card = (await import('../models/Card.js')).default;
  const cards = await Card.find({ listId }).sort({ order: 1 }).session(session);
  for (let i = 0; i < cards.length; i += 1) {
    if (cards[i].order !== i) {
      cards[i].order = i;
      await cards[i].save({ session });
    }
  }
  return cards;
}
