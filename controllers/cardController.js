import Card from '../models/Card.js';
import List from '../models/List.js';
import { getBoardIfMember, reindexCardsInList } from '../utils/boardAccess.js';
import { logActivity } from '../utils/activityLogger.js';

const VALID_PRIORITIES = ['none', 'low', 'medium', 'high', 'critical'];
const VALID_LABELS = ['bug', 'feature', 'urgent', 'design', 'docs'];

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

function sanitizeLabels(labels) {
  if (!Array.isArray(labels)) return [];
  return [...new Set(labels.filter((id) => VALID_LABELS.includes(id)))];
}

async function populateCard(card) {
  await card.populate('assignedTo', 'name email');
  await card.populate('comments.author', 'name email');
  return card;
}

export async function createCard(req, res) {
  try {
    const {
      listId,
      title,
      description = '',
      dueDate,
      assignedTo,
      labels = [],
      priority = 'none',
      checklist = [],
    } = req.body;
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
    const safePriority = VALID_PRIORITIES.includes(priority) ? priority : 'none';
    const card = await Card.create({
      listId,
      title: title.trim(),
      description: description || '',
      order,
      dueDate: dueDate || undefined,
      assignedTo: assignee || undefined,
      labels: sanitizeLabels(labels),
      priority: safePriority,
      checklist: Array.isArray(checklist)
        ? checklist
            .filter((item) => item?.text?.trim())
            .map((item) => ({ text: item.text.trim(), done: Boolean(item.done) }))
        : [],
    });
    await populateCard(card);
    const activity = await logActivity({
      boardId: list.boardId,
      userId: req.user._id,
      action: 'card:create',
      message: `${req.user.name} created card "${card.title}"`,
      meta: { cardId: card._id },
    });
    res.status(201).json({ card, activity });
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
    if (req.body.labels !== undefined) {
      card.labels = sanitizeLabels(req.body.labels);
    }
    if (req.body.priority !== undefined) {
      card.priority = VALID_PRIORITIES.includes(req.body.priority)
        ? req.body.priority
        : 'none';
    }
    if (req.body.checklist !== undefined && Array.isArray(req.body.checklist)) {
      card.checklist = req.body.checklist
        .filter((item) => item?.text?.trim())
        .map((item) => ({
          _id: item._id,
          text: item.text.trim(),
          done: Boolean(item.done),
        }));
    }
    await card.save();
    await populateCard(card);
    const activity = await logActivity({
      boardId: list.boardId,
      userId: req.user._id,
      action: 'card:update',
      message: `${req.user.name} updated card "${card.title}"`,
      meta: { cardId: card._id },
    });
    res.json({ card, activity });
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
    const title = card.title;
    await card.deleteOne();
    await reindexCardsInList(listId);
    const activity = await logActivity({
      boardId,
      userId: req.user._id,
      action: 'card:delete',
      message: `${req.user.name} deleted card "${title}"`,
      meta: { cardId: req.params.id },
    });
    res.json({ message: 'Card deleted', cardId: req.params.id, listId, boardId, activity });
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

    const updated = await Card.findById(cardId);
    await populateCard(updated);
    const activity = await logActivity({
      boardId: fromList.boardId,
      userId: req.user._id,
      action: 'card:move',
      message: sameList
        ? `${req.user.name} reordered card "${updated.title}"`
        : `${req.user.name} moved card "${updated.title}"`,
      meta: { cardId, fromListId, toListId },
    });
    res.json({ card: updated, activity });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

export async function addComment(req, res) {
  try {
    const { text } = req.body;
    if (!text?.trim()) {
      return res.status(400).json({ message: 'Comment text is required' });
    }
    const card = await Card.findById(req.params.id);
    if (!card) return res.status(404).json({ message: 'Card not found' });
    const list = await List.findById(card.listId);
    if (!list) return res.status(404).json({ message: 'List not found' });
    await getBoardIfMember(list.boardId, req.user._id);

    card.comments.push({ text: text.trim(), author: req.user._id });
    await card.save();
    await populateCard(card);
    const activity = await logActivity({
      boardId: list.boardId,
      userId: req.user._id,
      action: 'card:comment',
      message: `${req.user.name} commented on "${card.title}"`,
      meta: { cardId: card._id },
    });
    res.status(201).json({ card, activity });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}
