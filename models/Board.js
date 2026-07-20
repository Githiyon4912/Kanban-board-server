import mongoose from 'mongoose';
import crypto from 'crypto';

const boardSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    inviteCode: { type: String, unique: true, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export function generateInviteCode() {
  return crypto.randomBytes(4).toString('hex');
}

export default mongoose.model('Board', boardSchema);
