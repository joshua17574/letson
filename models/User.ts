// models/User.ts
import bcrypt from "bcryptjs";
import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type UserRole = "ADMIN" | "MANAGER" | "STAFF" | "CASHIER";

export interface IUser extends Document {
  _id: Types.ObjectId;
  username: string;
  name: string;
  contact?: string;
  email?: string;
  password: string;
  role: UserRole;
  position: string;
  isActive: boolean;
  joinedDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser, Model<IUser>>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    contact: {
      type: String,
      trim: true,
      default: "",
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: ["ADMIN", "MANAGER", "STAFF", "CASHIER"],
      default: "STAFF",
    },

    position: {
      type: String,
      required: true,
      trim: true,
      default: "Staff",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    joinedDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// UserSchema.index({ username: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ position: 1 });

UserSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

const UserModel: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default UserModel;