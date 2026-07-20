import Board, { generateInviteCode } from '../models/Board.js';
import List from '../models/List.js';
import Card from '../models/Card.js';
import { getBoardIfMember } from '../utils/boardAccess.js';

export async function getBoards(req, res) {
  try {
    const boards = await Board.find({
      $or: [{ owner: req.user._id }, { members: req.user._id }],
    }).sort({ createdAt: -1 });

    const boardsWithCounts = await Promise.all(
      boards.map(async (board) => {
        const listCount = await List.countDocuments({ boardId: board._id });
        return { ...board.toObject(), listCount };
      })
    );

    res.json(boardsWithCounts);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error' });
  }
}

export async function createBoard(req, res) {
  try {
    const { title } = req.body;
    if (!title?.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }
    let inviteCode = generateInviteCode();
    while (await Board.findOne({ inviteCode })) {
      inviteCode = generateInviteCode();
    }
    const board = await Board.create({
      title: title.trim(),
      owner: req.user._id,
      members: [req.user._id],
      inviteCode,
    });
    res.status(201).json({ ...board.toObject(), listCount: 0 });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error' });
  }
}

export async function getBoardById(req, res) {
  try {
    const board = await getBoardIfMember(req.params.id, req.user._id);
    await board.populate('members', 'name email');
    await board.populate('owner', 'name email');
    const lists = await List.find({ boardId: board._id }).sort({ order: 1 });
    const listIds = lists.map((l) => l._id);
    const cards = await Card.find({ listId: { $in: listIds } })
      .populate('assignedTo', 'name email')
      .sort({ order: 1 });
    res.json({ board, lists, cards });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

export async function joinBoard(req, res) {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode) {
      return res.status(400).json({ message: 'Invite code is required' });
    }
    const board = await Board.findOne({ inviteCode: String(inviteCode).trim() });
    if (!board) {
      return res.status(404).json({ message: 'Invalid invite code' });
    }
    const already = board.members.some((m) => String(m) === String(req.user._id));
    if (!already) {
      board.members.push(req.user._id);
      await board.save();
    }
    res.json(board);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error' });
  }
}

export async function updateBoard(req, res) {
  try {
    const board = await getBoardIfMember(req.params.id, req.user._id);
    const { title } = req.body;
    if (title === undefined) {
      return res.status(400).json({ message: 'Title is required' });
    }
    if (!String(title).trim()) {
      return res.status(400).json({ message: 'Title cannot be empty' });
    }
    board.title = String(title).trim();
    await board.save();
    res.json(board);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

export async function deleteBoard(req, res) {
  try {
    const board = await getBoardIfMember(req.params.id, req.user._id);
    if (String(board.owner) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Only the board owner can delete this board' });
    }
    const listCount = await List.countDocuments({ boardId: board._id });
    if (listCount > 0) {
      return res.status(400).json({
        message: 'Remove all lists before deleting this board',
      });
    }
    await board.deleteOne();
    res.json({ message: 'Board deleted', boardId: req.params.id });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}
