import { getBoardActivities } from '../utils/activityLogger.js';
import { getBoardIfMember } from '../utils/boardAccess.js';

export async function getActivities(req, res) {
  try {
    await getBoardIfMember(req.params.id, req.user._id);
    const activities = await getBoardActivities(req.params.id);
    res.json(activities);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}
