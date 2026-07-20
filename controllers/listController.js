import List from '../models/List.js';
import Card from '../models/Card.js';
import { getBoardIfMember } from '../utils/boardAccess.js';

export async function createList(req, res) {
  try {
    const { boardId, title } = req.body;
    if (!boardId || !title?.trim()) {
      return res.status(400).json({ message: 'boardId and title are required' });
    }
    await getBoardIfMember(boardId, req.user._id);
    const last = await List.findOne({ boardId }).sort({ order: -1 });
    const order = last ? last.order + 1 : 0;
    const list = await List.create({ boardId, title: title.trim(), order });
    res.status(201).json(list);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

export async function updateList(req, res) {
  try {
    const list = await List.findById(req.params.id);
    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }
    await getBoardIfMember(list.boardId, req.user._id);
    if (req.body.title !== undefined) {
      if (!req.body.title?.trim()) {
        return res.status(400).json({ message: 'Title is required' });
      }
      list.title = req.body.title.trim();
    }
    await list.save();
    res.json(list);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

export async function deleteList(req, res) {
  try {
    const list = await List.findById(req.params.id);
    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }
    const boardId = list.boardId;
    await getBoardIfMember(boardId, req.user._id);
    await Card.deleteMany({ listId: list._id });
    await list.deleteOne();
    const remaining = await List.find({ boardId }).sort({ order: 1 });
    for (let i = 0; i < remaining.length; i += 1) {
      if (remaining[i].order !== i) {
        remaining[i].order = i;
        await remaining[i].save();
      }
    }
    res.json({ message: 'List deleted', boardId, orderedLists: remaining });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

export async function reorderLists(req, res) {
  try {
    const { boardId, orderedListIds } = req.body;
    if (!boardId || !Array.isArray(orderedListIds)) {
      return res.status(400).json({ message: 'boardId and orderedListIds are required' });
    }
    await getBoardIfMember(boardId, req.user._id);
    const lists = await List.find({ boardId });
    const idSet = new Set(lists.map((l) => String(l._id)));
    if (
      orderedListIds.length !== lists.length ||
      orderedListIds.some((id) => !idSet.has(String(id)))
    ) {
      return res.status(400).json({ message: 'orderedListIds must match board lists' });
    }
    for (let i = 0; i < orderedListIds.length; i += 1) {
      await List.findByIdAndUpdate(orderedListIds[i], { order: i });
    }
    const updated = await List.find({ boardId }).sort({ order: 1 });
    res.json(updated);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}
