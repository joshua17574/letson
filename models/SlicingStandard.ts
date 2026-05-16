import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface ISlicingStandard extends Document {
  _id: Types.ObjectId;
  wholeChickenId: Types.ObjectId;
  productId: Types.ObjectId;
  standardPacking: number;
  standardSlice: number;
  chickenSizeType: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SlicingStandardSchema = new Schema<ISlicingStandard>(
  {
    wholeChickenId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    standardPacking: {
      type: Number,
      required: true,
      min: 0,
    },

    standardSlice: {
      type: Number,
      required: true,
      min: 0,
    },

    chickenSizeType: {
      type: String,
      default: "-",
      trim: true,
      uppercase: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

SlicingStandardSchema.index({ wholeChickenId: 1 });
SlicingStandardSchema.index({ productId: 1 });
SlicingStandardSchema.index({ chickenSizeType: 1 });
SlicingStandardSchema.index({ isActive: 1 });

const SlicingStandardModel: Model<ISlicingStandard> =
  mongoose.models.SlicingStandard ||
  mongoose.model<ISlicingStandard>("SlicingStandard", SlicingStandardSchema);

export default SlicingStandardModel;