import mongoose from 'mongoose';

const listSchema = new mongoose.Schema({
  boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
  title: { type: String, required: true, trim: true },
  order: { type: Number, required: true },
});

export default mongoose.model('List', listSchema);
