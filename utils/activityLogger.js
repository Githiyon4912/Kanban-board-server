import Activity from '../models/Activity.js';

export async function logActivity({ boardId, userId, action, message, meta }) {
  try {
    const activity = await Activity.create({
      boardId,
      userId,
      action,
      message,
      meta,
    });
    await activity.populate('userId', 'name email');
    return activity;
  } catch (err) {
    console.error('Failed to log activity', err.message);
    return null;
  }
}

export async function getBoardActivities(boardId, limit = 40) {
  return Activity.find({ boardId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('userId', 'name email');
}
