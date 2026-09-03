import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const checklistItemSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true },
  done: { type: Boolean, default: false },
});

const cardSchema = new mongoose.Schema(
  {
    listId: { type: mongoose.Schema.Types.ObjectId, ref: 'List', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    order: { type: Number, required: true },
    dueDate: { type: Date },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    labels: [{ type: String }],
    priority: {
      type: String,
      enum: ['none', 'low', 'medium', 'high', 'critical'],
      default: 'none',
    },
    comments: [commentSchema],
    checklist: [checklistItemSchema],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model('Card', cardSchema);
