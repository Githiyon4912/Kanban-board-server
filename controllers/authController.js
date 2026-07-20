import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Board from '../models/Board.js';
import List from '../models/List.js';
import Card from '../models/Card.js';

function cookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function clearAuthCookie(res) {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
}

export async function signup(req, res) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    const user = await User.create({ name, email, password });
    const token = signToken(user._id);
    res.cookie('token', token, cookieOptions());
    res.status(201).json({ _id: user._id, name: user.name, email: user.email });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error' });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    const token = signToken(user._id);
    res.cookie('token', token, cookieOptions());
    res.json({ _id: user._id, name: user.name, email: user.email });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error' });
  }
}

export async function logout(_req, res) {
  clearAuthCookie(res);
  res.json({ message: 'Logged out' });
}

export async function me(req, res) {
  res.json({
    _id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    createdAt: req.user.createdAt,
  });
}

export async function updateProfile(req, res) {
  try {
    const { name, email, password, currentPassword } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({ message: 'Name is required' });
      }
      user.name = String(name).trim();
    }

    if (email !== undefined) {
      const nextEmail = String(email).trim().toLowerCase();
      if (!nextEmail) {
        return res.status(400).json({ message: 'Email is required' });
      }
      const taken = await User.findOne({ email: nextEmail, _id: { $ne: user._id } });
      if (taken) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      user.email = nextEmail;
    }

    if (password) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required to set a new password' });
      }
      if (!(await user.matchPassword(currentPassword))) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }
      user.password = password;
    }

    await user.save();
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error' });
  }
}

export async function deleteAccount(req, res) {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ message: 'Password is required to delete your account' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (!(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Password is incorrect' });
    }

    const userId = user._id;
    const ownedBoards = await Board.find({ owner: userId });
    const ownedBoardIds = ownedBoards.map((b) => b._id);
    const ownedLists = await List.find({ boardId: { $in: ownedBoardIds } });
    const ownedListIds = ownedLists.map((l) => l._id);

    await Card.deleteMany({ listId: { $in: ownedListIds } });
    await List.deleteMany({ boardId: { $in: ownedBoardIds } });
    await Board.deleteMany({ owner: userId });
    await Board.updateMany({ members: userId }, { $pull: { members: userId } });
    await Card.updateMany({ assignedTo: userId }, { $unset: { assignedTo: 1 } });
    await user.deleteOne();

    clearAuthCookie(res);
    res.json({ message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error' });
  }
}
