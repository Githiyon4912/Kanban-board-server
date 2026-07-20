import Card from '../models/Card.js';
import List from '../models/List.js';
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

export async function createCard(req, res) {
  try {
    const { listId, title, description = '', dueDate, assignedTo } = req.body;
    if (!listId || !title?.trim()) {
      return res.status(400).json({ message: 'listId and title are required' });
    }
    const list = await List.findById(listId);
    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }
    const board = await getBoardIfMember(list.boardId, req.user._id);
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
    res.status(201).json(card);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

export async function updateCard(req, res) {
  try {
    const card = await Card.findById(req.params.id);
    if (!card) {
      return res.status(404).json({ message: 'Card not found' });
    }
    const list = await List.findById(card.listId);
    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }
    const board = await getBoardIfMember(list.boardId, req.user._id);

    if (req.body.title !== undefined) {
      if (!req.body.title?.trim()) {
        return res.status(400).json({ message: 'Title is required' });
      }
      card.title = req.body.title.trim();
    }
    if (req.body.description !== undefined) {
      card.description = req.body.description;
    }
    if (req.body.dueDate !== undefined) {
      card.dueDate = req.body.dueDate || null;
    }
    if (req.body.assignedTo !== undefined) {
      card.assignedTo = await ensureAssigneeOnBoard(board, req.body.assignedTo);
    }
    await card.save();
    await card.populate('assignedTo', 'name email');
    res.json(card);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

export async function deleteCard(req, res) {
  try {
    const card = await Card.findById(req.params.id);
    if (!card) {
      return res.status(404).json({ message: 'Card not found' });
    }
    const list = await List.findById(card.listId);
    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }
    await getBoardIfMember(list.boardId, req.user._id);
    const listId = card.listId;
    const boardId = list.boardId;
    await card.deleteOne();
    await reindexCardsInList(listId);
    res.json({ message: 'Card deleted', cardId: req.params.id, listId, boardId });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

export async function moveCard(req, res) {
  try {
    const { cardId, toListId, toOrder } = req.body;
    if (!cardId || !toListId || toOrder === undefined || toOrder === null) {
      return res.status(400).json({
        message: 'cardId, toListId, and toOrder are required',
      });
    }
    const card = await Card.findById(cardId);
    if (!card) {
      return res.status(404).json({ message: 'Card not found' });
    }
    const fromList = await List.findById(card.listId);
    const toList = await List.findById(toListId);
    if (!fromList || !toList) {
      return res.status(404).json({ message: 'List not found' });
    }
    if (String(fromList.boardId) !== String(toList.boardId)) {
      return res.status(400).json({ message: 'Lists must belong to the same board' });
    }
    await getBoardIfMember(fromList.boardId, req.user._id);

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
    res.json(updated);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}
