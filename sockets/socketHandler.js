import List from '../models/List.js';
import Card from '../models/Card.js';
import { getBoardIfMember, reindexCardsInList } from '../utils/boardAccess.js';

async function ensureAssigneeOnBoard(board, assignedTo) {
  if (assignedTo === undefined || assignedTo === null || assignedTo === '') {
    return null;
  }
  const uid = String(assignedTo);
  const ok =
    String(board.owner) === uid || board.members.some((m) => String(m) === uid);
  if (!ok) {
    const err = new Error('Assignee must be a board member');
    err.status = 400;
    throw err;
  }
  return assignedTo;
}

function ackError(ack, err) {
  ack?.({ ok: false, message: err.message || 'Error' });
}

export function registerBoardSockets(io, socket) {
  socket.on('board:join', async ({ boardId }, ack) => {
    try {
      await getBoardIfMember(boardId, socket.userId);
      socket.join(boardId);
      ack?.({ ok: true });
    } catch (err) {
      ackError(ack, err);
    }
  });

  socket.on('board:leave', ({ boardId }) => {
    if (boardId) socket.leave(boardId);
  });

  socket.on('list:create', async (payload, ack) => {
    try {
      const { boardId, title } = payload || {};
      if (!boardId || !title?.trim()) {
        throw Object.assign(new Error('boardId and title are required'), { status: 400 });
      }
      await getBoardIfMember(boardId, socket.userId);
      const last = await List.findOne({ boardId }).sort({ order: -1 });
      const order = last ? last.order + 1 : 0;
      const list = await List.create({ boardId, title: title.trim(), order });
      socket.to(boardId).emit('list:create', { list });
      ack?.({ ok: true, list });
    } catch (err) {
      ackError(ack, err);
    }
  });

  socket.on('list:update', async (payload, ack) => {
    try {
      const { listId, title } = payload || {};
      const list = await List.findById(listId);
      if (!list) throw Object.assign(new Error('List not found'), { status: 404 });
      await getBoardIfMember(list.boardId, socket.userId);
      if (!title?.trim()) {
        throw Object.assign(new Error('Title is required'), { status: 400 });
      }
      list.title = title.trim();
      await list.save();
      const boardId = String(list.boardId);
      socket.to(boardId).emit('list:update', { list });
      ack?.({ ok: true, list });
    } catch (err) {
      ackError(ack, err);
    }
  });

  socket.on('list:reorder', async (payload, ack) => {
    try {
      const { boardId, orderedListIds } = payload || {};
      if (!boardId || !Array.isArray(orderedListIds)) {
        throw Object.assign(new Error('boardId and orderedListIds are required'), {
          status: 400,
        });
      }
      await getBoardIfMember(boardId, socket.userId);
      const lists = await List.find({ boardId });
      const idSet = new Set(lists.map((l) => String(l._id)));
      if (
        orderedListIds.length !== lists.length ||
        orderedListIds.some((id) => !idSet.has(String(id)))
      ) {
        throw Object.assign(new Error('orderedListIds must match board lists'), {
          status: 400,
        });
      }
      for (let i = 0; i < orderedListIds.length; i += 1) {
        await List.findByIdAndUpdate(orderedListIds[i], { order: i });
      }
      const updated = await List.find({ boardId }).sort({ order: 1 });
      socket.to(boardId).emit('list:reorder', { lists: updated });
      ack?.({ ok: true, lists: updated });
    } catch (err) {
      ackError(ack, err);
    }
  });

  socket.on('list:delete', async (payload, ack) => {
    try {
      const { listId } = payload || {};
      const list = await List.findById(listId);
      if (!list) throw Object.assign(new Error('List not found'), { status: 404 });
      const boardId = String(list.boardId);
      await getBoardIfMember(boardId, socket.userId);
      await Card.deleteMany({ listId: list._id });
      await list.deleteOne();
      const remaining = await List.find({ boardId }).sort({ order: 1 });
      for (let i = 0; i < remaining.length; i += 1) {
        if (remaining[i].order !== i) {
          remaining[i].order = i;
          await remaining[i].save();
        }
      }
      socket.to(boardId).emit('list:delete', { listId, lists: remaining });
      ack?.({ ok: true, listId, lists: remaining });
    } catch (err) {
      ackError(ack, err);
    }
  });

  socket.on('card:create', async (payload, ack) => {
    try {
      const { listId, title, description = '', dueDate, assignedTo } = payload || {};
      if (!listId || !title?.trim()) {
        throw Object.assign(new Error('listId and title are required'), { status: 400 });
      }
      const list = await List.findById(listId);
      if (!list) throw Object.assign(new Error('List not found'), { status: 404 });
      const board = await getBoardIfMember(list.boardId, socket.userId);
      const assignee = await ensureAssigneeOnBoard(board, assignedTo);
      const last = await Card.findOne({ listId }).sort({ order: -1 });
      const order = last ? last.order + 1 : 0;
      const card = await Card.create({
        listId,
        title: title.trim(),
        description: description || '',
        order,
        dueDate: dueDate || undefined,
        assignedTo: assignee || undefined,
      });
      await card.populate('assignedTo', 'name email');
      const boardId = String(list.boardId);
      socket.to(boardId).emit('card:create', { card, boardId });
      ack?.({ ok: true, card });
    } catch (err) {
      ackError(ack, err);
    }
  });

  socket.on('card:update', async (payload, ack) => {
    try {
      const { cardId, title, description, dueDate, assignedTo } = payload || {};
      const card = await Card.findById(cardId);
      if (!card) throw Object.assign(new Error('Card not found'), { status: 404 });
      const list = await List.findById(card.listId);
      if (!list) throw Object.assign(new Error('List not found'), { status: 404 });
      const board = await getBoardIfMember(list.boardId, socket.userId);
      if (title !== undefined) {
        if (!title?.trim()) {
          throw Object.assign(new Error('Title is required'), { status: 400 });
        }
        card.title = title.trim();
      }
      if (description !== undefined) card.description = description;
      if (dueDate !== undefined) card.dueDate = dueDate || null;
      if (assignedTo !== undefined) {
        card.assignedTo = await ensureAssigneeOnBoard(board, assignedTo);
      }
      await card.save();
      await card.populate('assignedTo', 'name email');
      const boardId = String(list.boardId);
      socket.to(boardId).emit('card:update', { card, boardId });
      ack?.({ ok: true, card });
    } catch (err) {
      ackError(ack, err);
    }
  });

  socket.on('card:move', async (payload, ack) => {
    try {
      const { cardId, toListId, toOrder, boardId: payloadBoardId } = payload || {};
      if (!cardId || !toListId || toOrder === undefined || toOrder === null) {
        throw Object.assign(new Error('cardId, toListId, and toOrder are required'), {
          status: 400,
        });
      }
      const card = await Card.findById(cardId);
      if (!card) throw Object.assign(new Error('Card not found'), { status: 404 });
      const fromList = await List.findById(card.listId);
      const toList = await List.findById(toListId);
      if (!fromList || !toList) {
        throw Object.assign(new Error('List not found'), { status: 404 });
      }
      if (String(fromList.boardId) !== String(toList.boardId)) {
        throw Object.assign(new Error('Lists must belong to the same board'), {
          status: 400,
        });
      }
      await getBoardIfMember(fromList.boardId, socket.userId);

      const fromListId = String(card.listId);
      const sameList = fromListId === String(toListId);

      if (sameList) {
        const cards = await Card.find({ listId: toListId }).sort({ order: 1 });
        const without = cards.filter((c) => String(c._id) !== String(cardId));
        const insertAt = Math.max(0, Math.min(Number(toOrder), without.length));
        without.splice(insertAt, 0, card);
        for (let i = 0; i < without.length; i += 1) {
          without[i].order = i;
          without[i].listId = toListId;
          await without[i].save();
        }
      } else {
        card.listId = toListId;
        await card.save();
        const sourceCards = await Card.find({ listId: fromListId }).sort({ order: 1 });
        for (let i = 0; i < sourceCards.length; i += 1) {
          sourceCards[i].order = i;
          await sourceCards[i].save();
        }
        const destCards = await Card.find({
          listId: toListId,
          _id: { $ne: card._id },
        }).sort({ order: 1 });
        const insertAt = Math.max(0, Math.min(Number(toOrder), destCards.length));
        destCards.splice(insertAt, 0, card);
        for (let i = 0; i < destCards.length; i += 1) {
          destCards[i].listId = toListId;
          destCards[i].order = i;
          await destCards[i].save();
        }
      }

      const updated = await Card.findById(cardId).populate('assignedTo', 'name email');
      const boardId = String(fromList.boardId);
      const sourceCards = await Card.find({ listId: fromListId }).sort({ order: 1 });
      const destCards = await Card.find({ listId: toListId }).sort({ order: 1 });
      socket.to(boardId).emit('card:move', {
        card: updated,
        fromListId,
        toListId,
        boardId: payloadBoardId || boardId,
        sourceCards,
        destCards,
      });
      ack?.({ ok: true, card: updated, sourceCards, destCards });
    } catch (err) {
      ackError(ack, err);
    }
  });

  socket.on('card:delete', async (payload, ack) => {
    try {
      const { cardId } = payload || {};
      const card = await Card.findById(cardId);
      if (!card) throw Object.assign(new Error('Card not found'), { status: 404 });
      const list = await List.findById(card.listId);
      if (!list) throw Object.assign(new Error('List not found'), { status: 404 });
      const boardId = String(list.boardId);
      await getBoardIfMember(boardId, socket.userId);
      const listId = String(card.listId);
      await card.deleteOne();
      await reindexCardsInList(listId);
      const cards = await Card.find({ listId }).sort({ order: 1 });
      socket.to(boardId).emit('card:delete', { cardId, listId, cards, boardId });
      ack?.({ ok: true, cardId, listId, cards });
    } catch (err) {
      ackError(ack, err);
    }
  });
}
