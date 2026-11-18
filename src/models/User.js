import mongoose from 'mongoose';
import { ROLE_VALUES } from '../lib/auth/roles.mjs';

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true },
        passwordHash: { type: String, required: true },
        role: { type: String, enum: ROLE_VALUES, default: 'student', index: true },
        roles: { type: [{ type: String, enum: ROLE_VALUES }], default: ['student'] },
        status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
        isSuspended: { type: Boolean, default: false, index: true },
        isHelper: { type: Boolean, default: false, index: true },
        courses: { type: [String], default: [] },
        availability: { type: Boolean, default: false, index: true },
        assignedCourses: { type: [String], default: [] },
        department: { type: String, trim: true, maxlength: 120, default: '' },
        accessControlVersion: { type: Number, default: 0 },
        helperProfile: {
            courses: { type: [String], default: [] },
            topics: { type: [String], default: [] },
            isWilling: { type: Boolean, default: false },
            isHelper: { type: Boolean, default: false },
            availability: { type: Boolean, default: false },
            reputation: { type: Number, default: 0 },
        },
    },
    { timestamps: true }
);

userSchema.index({ name: 'text', email: 'text' });
userSchema.index({ roles: 1, status: 1 });

export default mongoose.models.User || mongoose.model('User', userSchema);
